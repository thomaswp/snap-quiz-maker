import { OverrideRegistry, Snap } from "sef";
import { WorldMorph } from "sef/src/snap/Snap";


function fillPartialPage(this: WorldMorph, width: number) {
    var clientHeight = window.innerHeight;

    this.worldCanvas.style.position = "absolute";
    this.worldCanvas.style.left = "0px";
    this.worldCanvas.style.right = "0px";
    this.worldCanvas.style.width = width + "px";
    this.worldCanvas.style.height = "100%";

    if (document.documentElement.scrollTop) {
        // scrolled down b/c of viewport scaling
        clientHeight = document.documentElement.clientHeight;
    }
    if (this.worldCanvas.width !== width) {
        this.worldCanvas.width = width;
        this.setWidth(width);
    }
    if (this.worldCanvas.height !== clientHeight) {
        this.worldCanvas.height = clientHeight;
        this.setHeight(clientHeight);
    }
    this.children.forEach(child => {
        if (child.reactToWorldResize) {
            child.reactToWorldResize(this.bounds.copy());
        }
    });
}


export class HTMLDisplay {

    panelWidth = 400;
    worldWidth = 0;
    panel: HTMLDivElement;
    container: HTMLDivElement;

    collapsed = false;

    private get windowWidth() {
        return window.innerWidth;
    }

    constructor() {


        const self: HTMLDisplay = this;
        OverrideRegistry.extend(WorldMorph, "fillPage", function(this: WorldMorph) {
            self.layout();
            fillPartialPage.call(this, self.worldWidth);
        });

        this.panel = document.createElement("div");
        this.panel.style.position = "absolute";
        this.panel.style.top = "0px";
        this.panel.style.right = "0px";
        this.panel.style.height = "100%";
        this.panel.style.width = this.panelWidth + "px";
        this.panel.style.overflowY = "auto";
        this.panel.style.backgroundColor = "#f0f0f0";
        this.panel.style.zIndex = "1000";
        this.panel.style.boxSizing = "border-box";
        this.panel.style.fontFamily = "Arial, sans-serif";
        document.body.appendChild(this.panel);

        this.createCollapseShowButton();

        this.container = document.createElement("div");
        this.container.style.width = "100%";
        this.container.style.height = "100%";
        this.container.style.padding = "10px";
        this.container.style.boxSizing = "border-box";
        this.panel.appendChild(this.container);


        Snap.world.fillPage();
    }

    private createCollapseShowButton() {
        const button = document.createElement("button");
        button.innerText = "Hide";
        button.style.float = "right";
        button.style.zIndex = "1001";
        this.panel.appendChild(button);
        button.addEventListener("click", () => {
            this.toggleCollapsed();
            button.innerText = this.collapsed ? "Show" : "Hide";
        });
    }

    private toggleCollapsed() {
        this.collapsed = !this.collapsed;
        Snap.world.fillPage();
    }

    private layout() {
        if (this.collapsed) {
            this.panelWidth = 50;
            this.container.style.display = "none";
        } else {
            this.panelWidth = 400;
            this.container.style.display = "block";
        }
        this.panel.style.width = this.panelWidth + "px";

        // If the screen gets too small, switch to float
        const remainingWidth = this.windowWidth - this.panelWidth;
        if (remainingWidth < 600) {
            this.setPanelFloat();
            this.worldWidth = this.windowWidth;
        } else {
            this.setPanelDocked();
            this.worldWidth = remainingWidth;
        }
    }

    // Panel floats above the main body
    private setPanelFloat() {
        this.panel.style.float = "right";
    }

    private setPanelDocked() {
        this.panel.style.float = "none";
    }

    setContent(html: string) {
        this.container.innerHTML = html;
    }
}