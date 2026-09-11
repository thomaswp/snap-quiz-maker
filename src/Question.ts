import { marked } from 'marked';
import { Snap } from 'sef';
import { BlockMorph, Costume, CustomBlockDefinition, PrototypeHatBlockMorph, SpriteMorph, StageMorph } from "sef/src/snap/Snap";

function htmlEncode(str: string): string {
  const entityMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };

  return String(str).replace(/[&<>"']/g, match => entityMap[match]);
}


export interface Section {
    renderHTML(): string;
}

class TextSection implements Section {
    readonly text: string;
    readonly isMarkdown: boolean;

    constructor(text: string, isMarkdown: boolean) {
        this.text = text;
        this.isMarkdown = isMarkdown;
    }

    renderHTML(): string {
        if (!this.isMarkdown) {
            return `<p>${htmlEncode(this.text).replace(/\n/g, '<br>')}</p>`;
        }
        return marked.parse(this.text) as string;
    }
}

class ImageSection implements Section {
    readonly imageDataURL: string
    readonly altText: string;

    constructor(imageDataURL: string, altText: string) {
        this.imageDataURL = imageDataURL;
        this.altText = altText;
    }

    renderHTML(): string {
        const alt = htmlEncode(this.altText);
        return `<img src="${this.imageDataURL}" alt="${alt}" title="${alt}">`;
    }

    static fromCustomBlockDefinition(definition: CustomBlockDefinition): ImageSection {
        const proto = new PrototypeHatBlockMorph(definition);
        proto.nextBlock(definition.body.expression.fullCopy());
        proto.fixLayout();
        const imageDataURL = proto.scriptPic().toDataURL();
        const altText = proto.toLisp();
        return new ImageSection(imageDataURL, altText);
    }

    static fromBlock(block: BlockMorph): ImageSection {
        let imageDataURL = "";
        try {
            const canvas = block.scriptPic();
            imageDataURL = canvas.toDataURL();
        } catch (error) {
            console.error("Error creating code section:", error);
            imageDataURL = "";
        }
        // TODO: Generate actual text
        const altText = block.toLisp();
        return new ImageSection(imageDataURL, altText);
    }

    static fromScript(blocks: BlockMorph[]) {
        // Temporarily remove the next block to avoid including it in the image
        let lastTopBlock = blocks[0];
        while (lastTopBlock.nextBlock() && blocks.includes(lastTopBlock.nextBlock() as BlockMorph)) {
            lastTopBlock = lastTopBlock.nextBlock() as BlockMorph;
        }
        const nextBlock = lastTopBlock.nextBlock();
        let nextBlockIndex = -1;
        if (nextBlock) {
            nextBlockIndex = lastTopBlock.children.indexOf(nextBlock);
            lastTopBlock.children.splice(nextBlockIndex, 1);
        }

        const imageSection = ImageSection.fromBlock(blocks[0]);

        // Then add the next block back to the end of the top block's children
        if (nextBlock && nextBlockIndex !== -1) {
            lastTopBlock.children.splice(nextBlockIndex, 0, nextBlock);
        }
        return imageSection;
    }

    static fromCostume(costume: Costume): ImageSection {
        // pictures have to be done manually
        return new ImageSection(costume.pngData(), "");
    }
}

enum ContentType {
    QuestionPrompt,
    CorrectAnswer,
    IncorrectAnswer
}

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
                this.sections.push(ImageSection.fromScript(currentScript));
                currentScript = [];
            }
        }

        while (block) {
            if (block instanceof BlockMorph) {
                if (block.blockSpec.startsWith("Text") || block.blockSpec.startsWith("Plain text")) {
                    flushCurrentScript();
                    try {
                        const text = block.inputs()[0].evaluate();
                        this.sections.push(new TextSection(text, block.blockSpec.startsWith("Text")));
                    } catch (error) {
                        console.error("Error evaluating text block:", error);
                    }
                } else if (block.blockSpec.startsWith("Custom block pic")) {
                    try {
                        const ring = block.inputs()[0];
                        const innerRing = ring?.inputs()[0];
                        const customBlockCall = innerRing?.inputs()[0];
                        if (customBlockCall?.definition) {
                            flushCurrentScript();
                            this.sections.push(ImageSection.fromCustomBlockDefinition(customBlockCall.definition));
                        } else {
                            console.error("Custom block call not found in Custom block pic block.");
                        }
                    } catch (error) {
                        console.error("Error evaluating text block:", error);
                    }
                } else if (block.blockSpec.startsWith("Costume pic")) {
                    try {
                        const costumeName = block.inputs()[0].evaluate();
                        const sprite = Snap.currentSprite;
                        const costume = sprite.costumes.asArray().find((c: Costume) => c.name === costumeName);
                        if (!costume || !costume.contents) {
                            console.error(`Costume with name "${costumeName}" not found.`);
                        } else {
                            flushCurrentScript();
                            console.log(costume);
                            this.sections.push(ImageSection.fromCostume(costume));
                        }
                    } catch (error) {
                        console.error("Error evaluating costume pic block:", error);
                    }
                } else if (block.blockSpec.startsWith("Reporter expression")) {
                    try {
                        const ring = block.inputs()[0];
                        const innerRing = ring?.inputs()[0];
                        const expression = innerRing?.inputs()[0];
                        if (expression) {
                            flushCurrentScript();
                            this.sections.push(ImageSection.fromBlock(expression));
                        }
                    } catch (error) {
                        console.error("Error evaluating reporter expression block:", error);
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
        let html = "<div style='border: 1px solid #ccc; padding: 3px; border-radius: 3px;'>";
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

    constructor(sprite: SpriteMorph | StageMorph) {
        this.name = sprite.name;
        this.answers = [];
        const topBlocks = sprite.scripts.children.filter((block: any) => block instanceof BlockMorph);
        topBlocks.sort((a: BlockMorph, b: BlockMorph) => a.id - b.id);
        topBlocks.forEach((topBlock: any) => {
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

    makeCopyButton() {
        return `<button style="margin-left: 10px;" onclick="copyNextDivToClipboard(this)">📋</button>`;
    }

    renderHTML(): string {
        let html = `<h2>${this.name}</h2>`;
        if (this.question) {
            html += `<h3>Prompt${this.makeCopyButton()}</h3>`;
            html += this.question.renderHTML();
        }
        for (const answer of this.answers) {
            const isCorrect = answer.contentType === ContentType.CorrectAnswer;
            html += `<h3>Answer ${isCorrect ? '✓' : '✗'} ${this.makeCopyButton()}</h3>`;
            html += answer.renderHTML();
        }
        return html;
    }
}

export async function copyHtmlToClipboard(htmlString: string) {
  try {
    const instantiated = new DOMParser().parseFromString(htmlString, "text/html");
    const fallback = instantiated.body.textContent || instantiated.body.innerText || "";

    // 1. Create Blobs for both HTML and plain text formats
    const htmlBlob = new Blob([htmlString], { type: "text/html" });
    const textBlob = new Blob([fallback], { type: "text/plain" });

    // 2. Wrap them inside a ClipboardItem object
    const clipboardItem = new ClipboardItem({
      "text/html": htmlBlob,
      "text/plain": textBlob
    });

    // 3. Write the item to the native clipboard
    await navigator.clipboard.write([clipboardItem]);
    console.log("HTML successfully copied to clipboard!");
  } catch (error) {
    console.error("Failed to copy HTML: ", error);
  }
}

declare global {
    interface Window {
        copyNextDivToClipboard: (button: HTMLButtonElement) => void;
    }
}

window.copyNextDivToClipboard = function(button: HTMLButtonElement) {
    const header = button.parentElement;
    if (header) {
        const nextDiv = header.nextElementSibling;
        if (nextDiv) {
            const div = nextDiv as HTMLDivElement;
            copyHtmlToClipboard(div.outerHTML);
        }
    }
};