import { Extension, Events, Snap } from "sef";
import { BlockMorph } from "sef/src/snap/Snap";

function inspect() {
    Snap.sprites.forEach(sprite => {
        console.log(sprite.name);
        sprite.scripts.children.forEach((script: BlockMorph) => {
            const xml = script.toScriptXML(Snap.IDE.serializer);
            console.log(xml);
        });
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



