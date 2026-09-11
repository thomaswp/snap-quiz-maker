import { Events, Extension, Snap } from "sef";
import { Question } from "./Question";
import { HTMLDisplay } from "./Display";
import { IDE_Morph } from "sef/src/snap/Snap";


function inspect(display: HTMLDisplay) {
    const sprite = Snap.currentSprite
    const q = new Question(sprite);
    const html = q.renderHTML();
    display.setContent(html);
}


export class SnapQuiz extends Extension {


    init() {
        console.log("SnapQuiz extension initialized");


        const display = new HTMLDisplay();
        this.events.Trace.addGlobalListener(() => {
            setTimeout(() => {
                inspect(display);
            });
        });
        setTimeout(() => {
            inspect(display);
        });
    }
}

const quiz = new SnapQuiz();
quiz.register();



