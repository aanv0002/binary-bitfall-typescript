/**
 * Inside this file you will use the classes and functions from rx.js
 * to add visuals to the svg element in index.html, animate them, and make them interactive.
 *
 * Study and complete the tasks in observable exercises first to get ideas.
 *
 * Course Notes showing Asteroids in FRP: https://tgdwyer.github.io/asteroids/
 *
 * You will be marked on your functional programming style
 * as well as the functionality that you implement.
 *
 * Document your code!
 */
import "./style.css";

import {
    Observable,
    catchError,
    filter,
    fromEvent,
    interval,
    map,
    scan,
    merge,
    switchMap,
    take,
    startWith,
} from "rxjs";

/** Constants */

const Viewport = {
    CANVAS_WIDTH: 600,
    CANVAS_HEIGHT: 400,
} as const;

const Target = {
    WIDTH: 64,
    HEIGHT: 36,
} as const;

const Constants = {
    DIGIT_COUNT: 8,
    TICK_RATE_MS: 500, // Might need to change this!
} as const;

// State processing
export type TargetNumber = Readonly<{
    id: number; // Unique Identifier for DOM tracking
    value: number; // The target numeric value
    hexvalue: string; // Base-16 display string
    x: number; // Horizontal  center position on canvas
    y: number; // Vertical position on canvas
}>;

export type State = Readonly<{
    bits: ReadonlyArray<number>;
    targets: ReadonlyArray<TargetNumber>;
    score: number;
    gameEnd: boolean;
}>;

/**
 * InitialState which resets and starts the game.
 */
export const initialState: State = {
    bits: [0, 0, 0, 0, 0, 0, 0, 0],
    targets: [],
    score: 0,
    gameEnd: false,
};

/**
 * Creates a new target with a random binary-compatible value
 * @param id Unique identifier generated for the target instance
 * @returns A newly created TargetNumber object initialized at the top edge of the viewport
 */
const createTarget = (id: number): TargetNumber => {
    const val = Math.floor(Math.random() * 256); // Random number between 0 and 255
    return {
        id,
        value: val,
        hexvalue: val.toString(16).toUpperCase().padStart(2, "0"),
        x:
            Math.floor(Math.random() * (Viewport.CANVAS_WIDTH - Target.WIDTH)) +
            Target.WIDTH / 2,
        y: 0, // Start at the top of the canvas
    };
};

/**
 * A state transition function that receives the current State and transforms it to a new State.
 */
type Action = (s: State) => State;

/** Converts an array of 8 bits into its integer value */
const bitsToDecimal = (bits: ReadonlyArray<number>): number =>
    bits.reduce((acc, bit) => (acc << 1) | bit, 0);

const TARGET_SPEED = 5;

/**
 * Updates the state by proceeding with one time step.
 *
 * @param s Current state
 * @returns Updated state
 */
const tick = (s: State): State => {
    if (s.gameEnd) return s;

    const currentBitValue = bitsToDecimal(s.bits);

    const movedTargets = s.targets
        .map(t => ({ ...t, y: t.y + TARGET_SPEED }))
        .filter(t => t.value !== currentBitValue);

    const checkLineY = Viewport.CANVAS_HEIGHT - 60;
    const hitCheckLine = movedTargets.some(t => t.y >= checkLineY);

    if (hitCheckLine) {
        return { ...s, targets: movedTargets, gameEnd: true };
    }

    const shouldSpawn =
        movedTargets.length === 0 ||
        (movedTargets.length < 3 && Math.random() < 0.25);

    const updatedTargets = shouldSpawn
        ? [...movedTargets, createTarget(Date.now())]
        : movedTargets;

    return {
        ...s,
        targets: updatedTargets,
        score: s.score + (s.targets.length - movedTargets.length) * 10,
    };
};

// Rendering (side effects)

/**
 * Brings an SVG element to the foreground.
 * @param elem SVG element to bring to the foreground
 */
const bringToForeground = (elem: SVGElement): void => {
    elem.parentNode?.appendChild(elem);
};

/**
 * Displays a SVG element on the canvas. Brings to foreground.
 * @param elem SVG element to display
 */
const show = (elem: SVGElement): void => {
    elem.setAttribute("visibility", "visible");
    bringToForeground(elem);
};

/**
 * Hides a SVG element on the canvas.
 * @param elem SVG element to hide
 */
const hide = (elem: SVGElement): void => {
    elem.setAttribute("visibility", "hidden");
};

/**
 * Creates an SVG element with the given properties.
 *
 * See https://developer.mozilla.org/en-US/docs/Web/SVG/Element for valid
 * element names and properties.
 *
 * @param namespace Namespace of the SVG element
 * @param name SVGElement name
 * @param props Properties to set on the SVG element
 * @returns SVG element
 */
const createSvgElement = (
    namespace: string | null,
    name: string,
    props: Record<string, string> = {},
): SVGElement => {
    const elem = document.createElementNS(namespace, name) as SVGElement;
    Object.entries(props).forEach(([k, v]) => elem.setAttribute(k, v));
    return elem;
};

const render = (): ((s: State) => void) => {
    const svg = document.querySelector("#svgCanvas") as SVGSVGElement;

    svg.setAttribute(
        "viewBox",
        `0 0 ${Viewport.CANVAS_WIDTH} ${Viewport.CANVAS_HEIGHT}`,
    );
    /**
     * Renders the current state to the canvas.
     *
     * In MVC terms, this updates the View using the Model.
     *
     * @param s Current state
     */
    return (s: State) => {
        svg.innerHTML = "";

        const checkLine = createSvgElement(svg.namespaceURI, "line", {
            x1: "0",
            y1: `${Viewport.CANVAS_HEIGHT - 60}`,
            x2: `${Viewport.CANVAS_WIDTH}`,
            y2: `${Viewport.CANVAS_HEIGHT - 60}`,
            stroke: "red",
            "stroke-dasharray": "4",
        });
        svg.appendChild(checkLine);

        s.targets.forEach(target => {
            const rect = createSvgElement(svg.namespaceURI, "rect", {
                x: `${target.x - Target.WIDTH / 2}`,
                y: `${target.y}`,
                width: `${Target.WIDTH}`,
                height: `${Target.HEIGHT}`,
                rx: "6",
                fill: "white",
                stroke: "black",
                "stroke-width": "2",
            });

            const text = createSvgElement(svg.namespaceURI, "text", {
                x: `${target.x}`,
                y: `${target.y + Target.HEIGHT / 2 + 5}`,
                "text-anchor": "middle",
                "font-family": "monospace",
                "font-weight": "bold",
                fill: "black",
            });
            text.textContent = target.hexvalue;

            svg.appendChild(rect);
            svg.appendChild(text);
        });

        // Draw the row of digit toggles as a demonstration
        const digitWidth = Viewport.CANVAS_WIDTH / Constants.DIGIT_COUNT;
        s.bits.forEach((bitVal, i) => {
            const bitRect = createSvgElement(svg.namespaceURI, "rect", {
                x: `${i * digitWidth + 4}`,
                y: `${Viewport.CANVAS_HEIGHT - 50}`,
                width: `${digitWidth - 8}`,
                height: "40",
                fill: bitVal === 1 ? "#81c784" : "#ef9a9a",
                stroke: "black",
                "stroke-width": "2",
                "data-bitindex": `${i}`,
                cursor: "pointer",
            });

            const bitText = createSvgElement(svg.namespaceURI, "text", {
                x: `${i * digitWidth + digitWidth / 2}`,
                y: `${Viewport.CANVAS_HEIGHT - 22}`,
                "text-anchor": "middle",
                "font-family": "monospace",
                "font-size": "20",
                "font-weight": "bold",
                fill: "black",
                "data-bitindex": `${i}`,
                cursor: "pointer",
                "pointer-events": "none",
            });
            bitText.textContent = `${bitVal}`;

            svg.appendChild(bitRect);
            svg.appendChild(bitText);
        });

        // Sync total score with the DOM
        const scoreElement = document.querySelector("#scoreText");
        if (scoreElement) {
            scoreElement.textContent = `${s.score}`;
        }

        const infoContainer = document.querySelector("#info") as HTMLElement;
        if (infoContainer && !document.querySelector("#controlsSvg")) {
            const controlsSvg = createSvgElement(svg.namespaceURI, "svg", {
                id: "controlsSvg",
                width: "170",
                height: "36",
                style: "margin-left: 10px; vertical-align: middle;",
            });

            const pauseButton = createSvgElement(svg.namespaceURI, "g", {
                "data-action": "toggle-pause",
                cursor: "pointer",
            });

            const pauseBg = createSvgElement(svg.namespaceURI, "rect", {
                width: "36",
                height: "36",
                rx: "6",
                fill: "#e0e0e0",
                stroke: "#333",
                "stroke-width": "2",
            });

            const pauseText = createSvgElement(svg.namespaceURI, "text", {
                id: "pauseBtnText",
                x: "18",
                y: "24",
                "text-anchor": "middle",
                "font-size": "16",
                "font-weight": "bold",
                fill: "#333",
                "pointer-events": "none",
            });

            pauseText.textContent = "❚❚";
            pauseButton.appendChild(pauseBg);
            pauseButton.appendChild(pauseText);

            const restartButton = createSvgElement(svg.namespaceURI, "g", {
                transform: "translate(46, 0)",
                "data-action": "restart",
                cursor: "pointer",
            });
            const restartBg = createSvgElement(svg.namespaceURI, "rect", {
                width: "36",
                height: "36",
                rx: "6",
                fill: "#e0e0e0",
                stroke: "#333",
                "stroke-width": "2",
            });
            const restartText = createSvgElement(svg.namespaceURI, "text", {
                x: "18",
                y: "25",
                "text-anchor": "middle",
                "font-size": "20",
                "font-weight": "bold",
                fill: "#333",
                "pointer-events": "none",
            });

            restartText.textContent = "↻";
            restartButton.appendChild(restartBg);
            restartButton.appendChild(restartText);

            const hexGroup = createSvgElement(svg.namespaceURI, "g", {
                transform: "translate(92, 0)",
            });
            const hexBg = createSvgElement(svg.namespaceURI, "rect", {
                width: "70",
                height: "36",
                rx: "6",
                fill: "#333",
                stroke: "#111",
                "stroke-width": "2",
            });
            const hexText = createSvgElement(svg.namespaceURI, "text", {
                id: "currentHexText",
                x: "35",
                y: "24",
                "text-anchor": "middle",
                "font-family": "monospace",
                "font-size": "18",
                "font-weight": "bold",
                fill: "#00FF66",
                "pointer-events": "none",
            });
            hexGroup.appendChild(hexBg);
            hexGroup.appendChild(hexText);
            controlsSvg.appendChild(pauseButton);
            controlsSvg.appendChild(restartButton);
            controlsSvg.appendChild(hexGroup);
            infoContainer.appendChild(controlsSvg);
        }
        // Convert current bit array to decimal and format as uppercase 2-digit Hexadecimal value
        const currentHexText = document.querySelector("#currentHexText");
        if (currentHexText) {
            const currentDec = bitsToDecimal(s.bits);
            currentHexText.textContent = `${currentDec.toString(16).toUpperCase().padStart(2, "0")}`;
        }

        // Render Game Over message on canvas when termination condition is reached
        if (s.gameEnd) {
            const gameOverText = createSvgElement(svg.namespaceURI, "text", {
                x: `${Viewport.CANVAS_WIDTH / 2}`,
                y: `${Viewport.CANVAS_HEIGHT / 2}`,
                "text-anchor": "middle",
                "font-family": "sans-serif",
                "font-size": "32",
                "font-weight": "bold",
                fill: "red",
            });
            gameOverText.textContent = "GAME OVER";
            svg.appendChild(gameOverText);
        }
    };
};

export const state$ = (): Observable<State> => {
    /** Determines the rate of time steps */
    const tick$: Observable<Action> = interval(Constants.TICK_RATE_MS).pipe(
        map(
            () =>
                (s: State): State =>
                    tick(s),
        ),
    );

    const keys = [
        "KeyZ",
        "KeyX",
        "KeyC",
        "KeyV",
        "KeyB",
        "KeyN",
        "KeyM",
        "Comma",
    ];

    const key$ = fromEvent<KeyboardEvent>(document, "keydown").pipe(
        filter(e => !e.repeat && keys.includes(e.code)),
        map(e => (s: State) => {
            const i = keys.indexOf(e.code);
            const newBits = [...s.bits];
            newBits[i] = newBits[i] === 0 ? 1 : 0;
            return { ...s, bits: newBits };
        }),
    );

    return merge(tick$, key$).pipe(
        scan((s: State, action: Action) => action(s), initialState),
        startWith(initialState),
    );
};

// The following simply runs your main function on window load.  Make sure to leave it in place.
// You should not need to change this, beware if you are.
if (typeof window !== "undefined") {
    // Observable: wait for first user click
    const click$ = fromEvent(document.body, "mousedown").pipe(take(1));

    click$.pipe(switchMap(() => state$())).subscribe(render());
}
