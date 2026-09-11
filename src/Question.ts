import { marked } from 'marked';
import { BlockMorph, SpriteMorph, StageMorph } from "sef/src/snap/Snap";

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

    constructor(text: string) {
        this.text = text;
    }

    renderHTML(): string {
        return marked.parse(this.text) as string;
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
        return `<img src="${this.imageDataURL}" alt="${htmlEncode(this.altText)}"/>`;
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

    constructor(sprite: SpriteMorph | StageMorph) {
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
            html += `<h3>Answer${this.makeCopyButton()}</h3>`;
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