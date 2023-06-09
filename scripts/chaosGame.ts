import { canvas, fillCircle, getMousePosition, graphics, startGraphics, strokeCircle } from "./graphics"

const radius = 250;
const vertexColors = ["blue", "green", "red", "purple", "orange", "black"];

let drawing: boolean;
let vertices: point[];
let lastPt: point;
let ratio: number;
let ptsLeft: number;
let ptsPerFrame: number;

interface point {
    x: number,
    y:number
}

function applyShape() {
    drawing = false;
    graphics.fillStyle = "white";
    graphics.fillRect(0, 0, canvas.width, canvas.height);
    const numVertices = parseInt((document.getElementById("shapetype") as HTMLSelectElement).value);
    vertices = [];

    for (let i = 1; i <= numVertices; i++) {
        const pt = {
            x: canvas.width/2 + radius * Math.cos(i*2*Math.PI / numVertices - Math.PI/2),
            y: canvas.height/2 + radius * Math.sin(i*2*Math.PI / numVertices - Math.PI/2)
        };
        fillCircle(pt.x, pt.y, 5, "black");
        vertices.push(pt);
    }
}

function start() {
    applyShape();
    canvas.addEventListener("click", (event) => {
        ratio = parseFloat((document.getElementById("jumpdist") as HTMLInputElement).value);
        ptsLeft = parseInt((document.getElementById("numpts") as HTMLInputElement).value);
        applyShape();
        drawing = true;
        lastPt = getMousePosition();
        strokeCircle(lastPt.x, lastPt.y, 0.5, "black");
    });
    (document.getElementById("shapetype") as HTMLSelectElement).addEventListener("change", applyShape);
}

function frame() {
    ptsPerFrame = parseInt((document.getElementById("animationspeed") as HTMLInputElement).value)
    if (drawing) {
        for (let i = 0; i < ptsPerFrame; i++) {
            let vertexNum = Math.floor(Math.random() * vertices.length);
            let vertex = vertices[vertexNum];
            lastPt = {x: Math.round(lastPt.x - (lastPt.x - vertex.x) * ratio), y: Math.round(lastPt.y - (lastPt.y - vertex.y) * ratio)};
            strokeCircle(lastPt.x, lastPt.y, 0.5, vertexColors[vertexNum]);
            ptsLeft--;
            if (ptsLeft <= 0) {
                drawing = false;
                break;
            }
        }
    }
}

window.onload = () => {
    startGraphics(start, frame, "chaos-canvas", false);
}


