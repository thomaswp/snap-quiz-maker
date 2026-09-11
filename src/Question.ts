import { BlockMorph, SpriteMorph } from "sef/src/snap/Snap";

export interface Section {
    renderHTML(): string;
}

class TextSection implements Section {
    readonly text: string;

    constructor(text: string) {
        this.text = text;
    }

    renderHTML(): string {
        // TODO: Markdown
        return `<p>${this.text}</p>`;
    }
}

class CodeSection implements Section {
    readonly imageDataURL: string;
    readonly altText: string;

    constructor(blocks: BlockMorph[]) {
        // TODO: Filter unused blocks
        try {
            const canvas = blocks[0].scriptPic();
            this.imageDataURL = canvas.toDataURL();
        } catch (error) {
            console.error("Error creating code section:", error);
            this.imageDataURL = "";
        }
        // TODO: Generate actual text
        this.altText = blocks[0].toLisp();
    }

    renderHTML(): string {
        return `<img src="${this.imageDataURL}" alt="${this.altText}">`;
    }
}

enum ContentType {
    QuestionPrompt,
    CorrectAnswer,
    IncorrectAnswer
}

// Maybe question/correct/prompt should just be properties rather than classes...
export class Content {
    readonly topBlock: BlockMorph;
    readonly sections: Section[];
    readonly contentType: ContentType;

    constructor(topBlock: BlockMorph, contentType: ContentType) {
        this.topBlock = topBlock;
        this.sections = [];
        this.contentType = contentType;

        // TODO: Assert that this is a valid topBlock
        let block = topBlock.nextBlock();

        let currentScript: BlockMorph[] = [];
        const flushCurrentScript = () => {
            if (currentScript.length > 0) {
                this.sections.push(new CodeSection(currentScript));
                currentScript = [];
            }
        }

        while (block) {
            if (block instanceof BlockMorph) {
                if (block.blockSpec.startsWith("Text")) {
                    flushCurrentScript();
                    try {
                        const text = block.inputs()[0].evaluate();
                        this.sections.push(new TextSection(text));
                    } catch (error) {
                        console.error("Error evaluating text block:", error);
                    }
                } else {
                    currentScript.push(block);
                }
            }
            block = block.nextBlock();
        }
        flushCurrentScript();
    }

    renderHTML(): string {
        let html = "<div>";
        for (const section of this.sections) {
            html += section.renderHTML();
        }
        html += "</div>";
        return html;
    }
}

export class Question {
    name: string;
    question?: Content;
    answers: Content[];

    constructor(sprite: SpriteMorph) {
        this.name = sprite.name;
        this.answers = [];
        sprite.scripts.children.forEach((topBlock: any) => {
            if (!(topBlock instanceof BlockMorph)) {
                return;
            }
            if (topBlock.blockSpec.startsWith("Question")) {
                this.question = new Content(topBlock, ContentType.QuestionPrompt);
            } else if (topBlock.blockSpec.startsWith("Answer")) {
                const correct = topBlock.inputs()[0].evaluate();
                const type = correct ? ContentType.CorrectAnswer : ContentType.IncorrectAnswer;
                const answerContent = new Content(topBlock, type);
                this.answers.push(answerContent);
            }
        });
    }

    renderHTML(): string {
        let html = `<h2>${this.name}</h2>`;
        if (this.question) {
            html += this.question.renderHTML();
        }
        for (const answer of this.answers) {
            html += "<h3>Answer</h3>";
            html += answer.renderHTML();
        }
        return html;
    }
}