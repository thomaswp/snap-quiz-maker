import {
    ArgLabelMorph, ArgMorph, BlockMorph, BooleanSlotMorph, ColorSlotMorph,
    CommandBlockMorph, CommandSlotMorph, HatBlockMorph, InputSlotMorph,
    Morph, MultiArgMorph, PrototypeHatBlockMorph, ReporterBlockMorph,
    ReporterSlotMorph, RingMorph, StringMorph, SymbolMorph, TemplateSlotMorph
} from "sef/src/snap/Snap";

/*
 * Generates screen-reader-friendly pseudocode for Snap scripts, e.g.
 *
 *   when green flag clicked
 *     set x to 0
 *     repeat 10
 *       say (join "x is ", x)
 *       change x by 1
 *     end repeat
 *   end when
 *
 * Unlike Process.prototype.toTextSyntax, which works from the syntax tree
 * (selectors and codes), this walks the visible morphs that make up each
 * block, so the text matches what is displayed on screen as closely as
 * possible.
 */

const INDENT = "  ";
// Shown for an empty, non-text input slot
const EMPTY_SLOT = "_";

const SYMBOL_NAMES: Record<string, string> = {
    flag: "green flag",
    turnRight: "clockwise",
    turnLeft: "counterclockwise",
    turtleOutline: "turtle",
    flash: "lightning",
    // The loop arrow at the bottom of C-slots is decorative
    loop: "",
};

type Token =
    | { kind: "label", text: string }
    | { kind: "input", text: string }
    // A C-slot, which is rendered on its own indented lines
    | { kind: "script", block: BlockMorph | null };

/**
 * Renders a block as pseudocode. Command blocks are rendered along with all
 * blocks that follow them, one statement per line. Reporters are rendered
 * as a single expression.
 */
export function toPseudocode(block: BlockMorph): string {
    if (block instanceof CommandBlockMorph) {
        return scriptLines(block, 0).join("\n");
    }
    return renderBlockInline(block, false);
}

// Statements (multi-line)

function scriptLines(first: BlockMorph | null, depth: number): string[] {
    const lines: string[] = [];
    let block: any = first;
    while (block) {
        lines.push(...commandLines(block, depth));
        if (block instanceof HatBlockMorph) {
            // The hat's script was rendered nested inside it
            break;
        }
        block = block.nextBlock?.();
    }
    return lines;
}

function commandLines(block: BlockMorph, depth: number): string[] {
    const pad = INDENT.repeat(depth);
    let tokens: Token[];
    if (block instanceof PrototypeHatBlockMorph) {
        // The hat itself has no label, just the prototype block
        tokens = [{ kind: "label", text: "define" }, ...collectTokens(block, false)];
    } else {
        tokens = collectTokens(block, false);
    }

    const lines: string[] = [];
    let line: string[] = [];
    let hasNestedScript = false;
    const flush = () => {
        if (line.length) {
            lines.push(pad + line.join(" "));
        }
        line = [];
    };

    for (const token of tokens) {
        if (token.kind === "script") {
            flush();
            lines.push(...scriptLines(token.block, depth + 1));
            hasNestedScript = true;
        } else {
            line.push(token.text);
        }
    }
    flush();

    if (block instanceof HatBlockMorph) {
        lines.push(...scriptLines((block as any).nextBlock(), depth + 1));
        hasNestedScript = true;
    }
    if (hasNestedScript) {
        lines.push(pad + "end " + firstWord(tokens));
    }
    return lines;
}

function firstWord(tokens: Token[]): string {
    for (const token of tokens) {
        if (token.kind === "label" && token.text.trim()) {
            return token.text.trim().split(/\s+/)[0];
        }
    }
    return "block";
}

// Expressions (single line)

/**
 * Renders a block on one line. Nested reporters are wrapped in parentheses,
 * except for variables and lists, which are unambiguous without them.
 */
function renderBlockInline(block: BlockMorph, isNested: boolean): string {
    const anyBlock = block as any;
    if (anyBlock.selector === "reportGetVar") {
        return anyBlock.blockSpec;
    }
    if (anyBlock.selector === "reportNewList") {
        const multi = block.inputs().find((input: Morph) => input instanceof MultiArgMorph);
        const items = multi ? (multi as any).inputs().map(renderInput) : [];
        return "[" + items.join(", ") + "]";
    }
    const text = tokensToString(collectTokens(block, true));
    if (isNested && block instanceof ReporterBlockMorph && !(block instanceof RingMorph)) {
        return "(" + text + ")";
    }
    return text;
}

/** Renders a script on one line, e.g. inside a ring: {say "hi"; move 10 steps} */
function renderScriptInline(first: BlockMorph | null): string {
    const statements: string[] = [];
    let block: any = first;
    while (block) {
        statements.push(renderBlockInline(block, false));
        block = block.nextBlock?.();
    }
    return "{" + statements.join("; ") + "}";
}

function renderInput(morph: Morph): string {
    return tokensToString(childTokens(morph, true));
}

function tokensToString(tokens: Token[]): string {
    return tokens.map(token =>
        token.kind === "script" ? renderScriptInline(token.block) : token.text
    ).join(" ");
}

// Morph walking

function visibleChildren(morph: Morph): Morph[] {
    const children: Morph[] = morph instanceof BlockMorph ?
        (morph as any).parts() : morph.children;
    return children.filter(child => child.isVisible);
}

function collectTokens(morph: Morph, inline: boolean): Token[] {
    const tokens: Token[] = [];
    for (const child of visibleChildren(morph)) {
        tokens.push(...childTokens(child, inline));
    }
    return tokens;
}

/**
 * Converts a single part of a block into tokens. If inline is false,
 * C-slots become script tokens, to be rendered on separate lines.
 */
function childTokens(morph: Morph, inline: boolean): Token[] {
    const anyMorph = morph as any;

    // Labels
    if (morph instanceof SymbolMorph) {
        const text = SYMBOL_NAMES[anyMorph.name] ?? anyMorph.name;
        return text ? [{ kind: "label", text }] : [];
    }
    if (morph instanceof StringMorph) {
        const text = anyMorph.text;
        return text ? [{ kind: "label", text }] : [];
    }

    // Nested blocks (rings are reporters, so they come first)
    if (morph instanceof RingMorph) {
        return [{ kind: "input", text: tokensToString(collectTokens(morph, true)) }];
    }
    if (morph instanceof BlockMorph) {
        return [{ kind: "input", text: renderBlockInline(morph, true) }];
    }

    // Composite slots
    if (morph instanceof MultiArgMorph) {
        return multiArgTokens(morph, inline);
    }
    if (morph instanceof ArgLabelMorph) {
        return collectTokens(morph, inline);
    }

    // Slots
    if (morph instanceof CommandSlotMorph) {
        const nested = anyMorph.nestedBlock() ?? null;
        if (inline) {
            return [{ kind: "input", text: renderScriptInline(nested) }];
        }
        return [{ kind: "script", block: nested }];
    }
    if (morph instanceof ReporterSlotMorph) {
        // Reporter slot inside a ring
        const nested = anyMorph.nestedBlock();
        const text = nested ? renderBlockInline(nested, false) : "";
        return [{ kind: "input", text: "{" + text + "}" }];
    }
    if (morph instanceof TemplateSlotMorph) {
        // Upvars, script variables, ring and custom block parameters
        return [{ kind: "input", text: anyMorph.contents() }];
    }
    if (morph instanceof BooleanSlotMorph) {
        const value = anyMorph.value;
        const text = value === true ? "true" : value === false ? "false" : EMPTY_SLOT;
        return [{ kind: "input", text }];
    }
    if (morph instanceof ColorSlotMorph) {
        const color = anyMorph.color;
        return [{ kind: "input", text: `color(${color.r}, ${color.g}, ${color.b})` }];
    }
    if (morph instanceof InputSlotMorph) {
        return [{ kind: "input", text: inputSlotText(morph) }];
    }
    if (morph instanceof ArgMorph) {
        return [{ kind: "input", text: EMPTY_SLOT }];
    }

    // Anything else (e.g. label fragments in custom block prototypes):
    // look for labels and slots inside it
    return collectTokens(morph, inline);
}

function multiArgTokens(multi: MultiArgMorph, inline: boolean): Token[] {
    const arrows = (multi as any).arrows();
    const tokens: Token[] = [];
    for (const child of visibleChildren(multi)) {
        if (child === arrows) continue;
        tokens.push(...childTokens(child, inline));
    }
    // Separate adjacent inputs with commas, e.g. script variables a, b, c
    for (let i = 0; i < tokens.length - 1; i++) {
        const token = tokens[i];
        if (token.kind === "input" && tokens[i + 1].kind === "input") {
            token.text += ",";
        }
    }
    return tokens;
}

function inputSlotText(slot: InputSlotMorph): string {
    const anySlot = slot as any;
    if (anySlot.selectedBlock instanceof BlockMorph) {
        return renderBlockInline(anySlot.selectedBlock, true);
    }
    if (anySlot.symbol) {
        return SYMBOL_NAMES[anySlot.symbol.name] ?? anySlot.symbol.name;
    }
    const text: string = anySlot.contents()?.text ?? "";
    // Dropdown options (e.g. variable names, "x position", "last") are
    // not literal strings, so they are not quoted
    if (anySlot.constant || anySlot.isReadOnly) {
        return text === "" ? EMPTY_SLOT : text;
    }
    if (text === "") {
        return anySlot.isNumeric ? EMPTY_SLOT : '""';
    }
    if (isNumberText(text)) {
        return text;
    }
    return JSON.stringify(text);
}

function isNumberText(text: string): boolean {
    return text.trim() === text && text !== "" && isFinite(Number(text));
}
