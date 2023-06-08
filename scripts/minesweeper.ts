import {graphics, canvas, drawLine, makeColor, fillPolygon, getMousePosition, fillCircle, startGraphics} from "./graphics";
import {Modal} from "bootstrap";

class Cell {
    readonly row: number;
    readonly col: number;
    open: boolean;
    flagged: boolean;
    question: boolean;
    mine: boolean;
    neighborMines = 0;
    neighborFlags = 0;

    constructor(row: number, col: number) {
        this.row = row;
        this.col = col;
        this.open = false;
        this.flagged = false;
        this.mine = false;
    }    
}

let grid: Cell[][];
let numRows: number;
let numCols: number;
let numMines: number;
let numFlagsLeft: number;
let numOpenCells: number;
let gameStarted: boolean;
let gameOver: boolean;
let playerDead: boolean;
let gameWon: boolean;
let generatedMines: boolean;
let mineRestrictions: boolean[][];

let startTime: number;

function newGame(rows: number, cols: number, mines: number): void {
    numRows = rows;
    numCols = cols;
    numMines = mines;
    numFlagsLeft = mines;
    numOpenCells = 0;
    gameStarted = true;
    gameOver = false;
    playerDead = false;
    gameWon = false;
    generatedMines = false;

    grid = Array(numRows);
    mineRestrictions = Array(numRows);
    for (let i = 0; i < numRows; i++) {
        const row: Cell[] = new Array(numCols);
        const restictRow: boolean[] = new Array(numCols);
        for (let j = 0; j < numCols; j++) {
            row[j] = new Cell(i, j);
            restictRow[j] = false;
        }
        grid[i] = row;
        mineRestrictions[i] = restictRow;
    }
    console.log(grid);
}

function isValidCell(row: number, col: number): boolean {
    return (row >= 0 && col >= 0 && row < numRows && col < numCols); 
}

function getElapsedSeconds(): number {
    if (generatedMines) return Math.floor((performance.now() - startTime) / 1000);
    else return 0;
}

function getCell(row: number, col: number) {
    return grid[row][col];
}

function getNeighborCells(row: number, col: number): Cell[] {
    const out: Cell[] = [];
    for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
            if (isValidCell(row + i, col + j) && !(i == 0 && j == 0)) out.push(grid[row + i][col + j]);
        }
    }
    return out;
}

function generateMines(initialRow: number, initialCol: number): void {
    // Set up restrictions such that the first click does not click on a mine
    if (numRows * numCols - numMines >= 9) {
        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                if (isValidCell(initialRow + i, initialCol + j)) mineRestrictions[initialRow + i][initialCol + j] = true;
            }
        }
    } else mineRestrictions[initialRow][initialCol] = true;

    for (let mine = 0; mine < numMines; mine++) {
        let i: number;
        let j: number;
        do {
            i = Math.floor(Math.random() * numRows);
            j = Math.floor(Math.random() * numCols);
        } while (grid[i][j].mine || mineRestrictions[i][j]);
        grid[i][j].mine = true;
        getNeighborCells(i, j).forEach(cell => cell.neighborMines++);
    }
    generatedMines = true;
}

function showMines() {
    console.log("showing mines");
    for (let i = 0; i < numRows; i++) {
        for (let j = 0; j < numCols; j++) {
            if (grid[i][j].mine) grid[i][j].open = true;
        }
    }
}

function stepOnCell(row: number, col: number): void {
    if (!generatedMines) {
        generateMines(row, col);
        startTime = performance.now();
    }
    if (!grid[row][col].flagged && !grid[row][col].question && !grid[row][col].open) {
        grid[row][col].open = true;
        numOpenCells++;
        if (grid[row][col].mine) {
            playerDead = true;
            gameOver = true;
            showMines();
        } else if (grid[row][col].neighborMines == 0) getNeighborCells(row, col).forEach(cell => stepOnCell(cell.row, cell.col));
        if (numOpenCells == numRows * numCols - numMines && !playerDead) {
            gameOver = true;
            gameWon = true;
        }
    }
}

function chordCell(row: number, col: number): void {
    if (grid[row][col].neighborFlags == grid[row][col].neighborMines) {
        getNeighborCells(row, col).forEach(cell => stepOnCell(cell.row, cell.col));
    }
}

function toggleCellFlag(row: number, col: number): void {
    if (!grid[row][col].open) {
        if (grid[row][col].flagged) {
            grid[row][col].flagged = false;
            grid[row][col].question = true;
            numFlagsLeft++;
            getNeighborCells(row, col).forEach(cell => cell.neighborFlags--);
        } else if (grid[row][col].question) grid[row][col].question = false;
        else if (numFlagsLeft > 0) {
            grid[row][col].flagged = true;
            numFlagsLeft--;
            console.log("flagging cell")
            getNeighborCells(row, col).forEach(cell => cell.neighborFlags++);
        }
    }
}
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// The following functions are for graphics
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
let cellSize: number;
let xOffset: number;
let timeDisplay: string;
const yOffset = 35;
const winModal = new Modal(document.getElementById("winModal"), {});
const loseModal = new Modal(document.getElementById("loseModal"), {});
const numberColors = ["lightgray", "blue", makeColor(0, 123, 0), "red", makeColor(102, 0, 153), makeColor(153, 0, 0), "cyan", "black", "gray"];

function drawClosedCell(x: number, y: number) {
    graphics.fillStyle = "#bdbdbd";
    graphics.fillRect(x, y, cellSize, cellSize);
    fillPolygon(
        [x, x, x+ cellSize, x+7* cellSize /8, x+ cellSize /8, x+ cellSize /8],
        [y+ cellSize, y, y, y+ cellSize /8, y+ cellSize /8, y+7* cellSize /8],
        "white"
    );
    fillPolygon(
        [x+ cellSize, x+ cellSize, x, x+ cellSize /8, x+7* cellSize /8, x+7* cellSize /8],
        [y, y+ cellSize, y+ cellSize, y+7* cellSize /8, y+7* cellSize /8, y+ cellSize /8],
        "#7b7b7b"
    );
}

function drawCell(cell: Cell, cellSize: number): void {
    const x = cell.col * cellSize + xOffset;
    const y = cell.row * cellSize + yOffset;
    
    const fontSizePx = Math.floor(cellSize * 5/8);
    graphics.font = fontSizePx.toString() + "px monospace";
    graphics.textAlign = "center";
    graphics.textBaseline = "middle";

    graphics.strokeStyle = "#7b7b7b";
    if (!cell.open || cell.flagged || cell.question) {
        drawClosedCell(x, y);
        if (cell.flagged) {
            graphics.fillText("🚩", x + cellSize/2, y + cellSize/2)
            if (!cell.mine && gameOver) {
                drawLine(x + cellSize/8, y + cellSize/8, x + 7*cellSize/8, y + 7*cellSize/8, "darkred", cellSize/10)
                drawLine(x + 7*cellSize/8, y + cellSize/8, x + cellSize/8, y + 7*cellSize/8, "darkred", cellSize/10)
            }
        } else if (cell.question) {
            graphics.fillStyle = "black";
            graphics.fillText("?", x + cellSize/2, y + cellSize/2)
        }
    } else if (cell.mine) {
        graphics.fillStyle = "red";
        graphics.fillRect(x, y, cellSize, cellSize);
        fillCircle(x + cellSize/2, y + cellSize/2, cellSize * 3/8, "darkred");
    } else {
        graphics.fillStyle = "#bdbdbd";
        graphics.lineWidth = 1;
        graphics.fillRect(x, y, cellSize, cellSize);
        graphics.strokeRect(x, y, cellSize, cellSize);

        if (cell.neighborMines > 0) {
            graphics.fillStyle = numberColors[cell.neighborMines];
            graphics.fillText(cell.neighborMines.toString(), x + cellSize/2, y + cellSize/2);
        }
    }
}

function drawInfoBar() {
    graphics.fillStyle = "black";
    graphics.fillRect(xOffset, 0, cellSize * numCols, yOffset);
    graphics.textAlign = "left";
    graphics.textBaseline = "middle";
    graphics.fillStyle = "white";
    graphics.font = "20px sans-serif"
    graphics.fillText(" 🚩 " + numFlagsLeft.toString(), xOffset, yOffset/2);
    graphics.textAlign = "right";
    graphics.fillText("⌛ " + timeDisplay + " ", canvas.width - xOffset, yOffset/2);
}

export function startGame(): void {
    const difficulty = (document.getElementById("difficulty") as HTMLSelectElement).value;
    let rows: number;
    let cols: number;
    let mines: number;
    switch (difficulty) {
        case "beginner":
            rows = 9;
            cols = 9;
            mines = 10;
            break;
        case "intermediate":
            rows = 13;
            cols = 15;
            mines = 40;
            break;
        default:
            rows = 16;
            cols = 30;
            mines = 99;
    }
    cellSize = Math.min(canvas.height / rows, canvas.width / cols);
    newGame(rows, cols, mines);
}

function start(): void {
    canvas.addEventListener('click', (event: MouseEvent) => {
        if (!gameStarted || gameOver) return;
        const pt = getMousePosition();

        const row = Math.floor((pt.y - yOffset) / cellSize);
        const col = Math.floor((pt.x - xOffset) / cellSize);
        if (!isValidCell(row, col)) return;
        if (!getCell(row, col).open) stepOnCell(row, col);
        else chordCell(row, col);

        if (playerDead) loseModal.show();
        else if (gameWon) winModal.show();
    });
    canvas.addEventListener('contextmenu', (event: MouseEvent) => {
        event.preventDefault();
        if (!gameStarted || gameOver) return;
        const pt = getMousePosition();
        const row = Math.floor((pt.y - yOffset) / cellSize);
        const col = Math.floor((pt.x - xOffset) / cellSize);
        if (isValidCell(row, col) && !getCell(row, col).open) toggleCellFlag(row, col);
    });
}

function frame(): void {
    cellSize = Math.min((canvas.height - yOffset) / numRows, canvas.width / numCols);
    xOffset = (canvas.width - numCols * cellSize) / 2;
    if (gameStarted) {
        graphics.clearRect(0, 0, canvas.width, canvas.height);
        drawInfoBar();
        for (const row of grid) {
            for (const cell of row) {
                drawCell(cell, cellSize);
            }
        }
        if (!gameOver) timeDisplay = getElapsedSeconds().toString() + "s";
    }
}

window.onload = () => {
    document.querySelectorAll(".startButton").forEach((element) => (element as HTMLButtonElement).onclick = startGame);
    startGraphics(start, frame, 'mine-canvas', false);
    startGame();
}