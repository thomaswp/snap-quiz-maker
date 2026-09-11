import { Extension, Events, Snap } from "sef";
import { Question } from "./Question";

async function copyHtmlToClipboard(htmlString: string) {
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


function inspect() {
    Snap.sprites.forEach(sprite => {
        console.log(sprite.name);
        const q = new Question(sprite);
        const html = q.renderHTML();
        console.log(html);
        copyHtmlToClipboard(html);
    });
}

export class SnapQuiz extends Extension {


    init() {
        console.log("SnapQuiz extension initialized");


        this.events.Trace.addGlobalListener(() => {

        });
        this.events.addListener(new Events.IDE.GreenFlagListener(() => inspect()));
    }
}

const quiz = new SnapQuiz();
quiz.register();



