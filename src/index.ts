import { Extension, Events, Snap } from "sef";
import { Question } from "./Question";

function inspect() {
    Snap.sprites.forEach(sprite => {
        console.log(sprite.name);
        const q = new Question(sprite);
        console.log(q.renderHTML());
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



