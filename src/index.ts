import { Extension, Snap } from "sef";
import { Question } from "./Question";
import { HTMLDisplay } from "./Display";


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
            inspect(display);
        });
        // this.events.addListener(new Events.IDE.GreenFlagListener(() => inspect(display)));

    }
}

const quiz = new SnapQuiz();
quiz.register();



