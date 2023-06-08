import {graphics, canvas, drawLine, makeColor, fillCircle, isKeyPressed, startGraphics} from "./graphics";
import io from "socket.io-client";

const socket = io("cs.catlin.edu", {path: "/node/2023/alvin/pong/socket.io"});
const ballSize = 20;
const paddleHeight = 80;
const paddleWidth = 10;
const maxPaddleSpeed = 10;
const maxBounceAngle = 60;
const maxBallStartAngle = 20;
const ballSpeed = 15;
const serveDelay = 750;
const tickDelay = 1000/60;
const paddleSyncDelay = 500;


interface VectorData {
    magnitude: number;
    degrees: number;
}
class Vector implements VectorData{
    magnitude: number;
    degrees: number

    constructor(magnitude: number, degrees: number) {
        this.magnitude = magnitude;
        this.degrees = degrees;
    }
    
    public invert(): Vector {
        return new Vector(this.magnitude, 180 - this.degrees);
    }

    public static fromData(data:VectorData) {
        console.log("VectorData", data)
        return new Vector(data.magnitude, data.degrees)
    }
}

enum GameState {
    Waiting,
    Start,
    Serve,
    Playing,
    Over
}

enum BoxSide{
    Top,
    Bottom,
    Left,
    Right
}

class Hitbox {
    nwX: number;
    nwY: number;
    readonly width: number;
    readonly height: number;

    constructor(centerX: number, centerY: number, width: number, height: number) {
        this.nwX = centerX - width/2;
        this.nwY = centerY - height/2;
        this.width = width;
        this.height = height;
    }

    public getPosition(): {x: number, y: number} {
        return {x: this.nwX + this.width/2, y: this.nwY + this.height/2};
    }

    public translateBy(tx: number, ty: number) {
        this.nwX += tx;
        this.nwY += ty;
    }

    public setPosition(centerX: number, centerY: number) {
        this.nwX = centerX - this.width/2;
        this.nwY = centerY - this.height/2;
    }

    public collidesWith(other: Hitbox): boolean{
       return (
            this.nwX < other.nwX + other.width &&
            this.nwX + this.width > other.nwX &&
            this.nwY < other.nwY + other.height &&
            this.nwY + this.height > other.nwY
       );
    }

    public hitsWall(wallSide: BoxSide): boolean {
        switch (wallSide) {
            case BoxSide.Top:
                return this.nwY <= 0;
            case BoxSide.Bottom:
                return this.nwY + this.height >= canvas.height;
            case BoxSide.Left:
                return this.nwX <= 0;
            case BoxSide.Right:
                return this.nwX + this.width >= canvas.width;
        }
    }
}

class Ball extends Hitbox {
    vx: number;
    vy: number;
    prevPositions: {x: number, y: number}[] = [];

    constructor(left: boolean) {
        super(canvas.width/2, canvas.height/2, ballSize, ballSize);
        let deg = Math.random() * 2 * maxBallStartAngle - maxBallStartAngle;
        if (left) deg = 180 - deg;
        this.setVector(new Vector(ballSpeed * 2/3, deg));
    }

    public setVector(vector: Vector) {
        const theta = vector.degrees * (Math.PI / 180);
        this.vx = Math.cos(theta) * vector.magnitude;
        this.vy = -Math.sin(theta) * vector.magnitude;
    }

    public getVector(): Vector {
        return new Vector(
            Math.sqrt(this.vx*this.vx + this.vy*this.vy),
            Math.atan2(-this.vy, this.vx) * (180 / Math.PI)
            );
    }

    public periodic() {
        if (this.hitsWall(BoxSide.Top)) {
            this.setPosition(this.getPosition().x, this.height/2);
            this.vy = -this.vy;
        } else if (this.hitsWall(BoxSide.Bottom)) {
            this.setPosition(this.getPosition().x, canvas.height - this.height/2);
            this.vy = -this.vy;
        }
        this.prevPositions.unshift(this.getPosition());
        if (this.prevPositions.length > 5) this.prevPositions.pop();
        this.translateBy(this.vx, this.vy);
    }
}

class Paddle extends Hitbox {
    readonly isPlayer: boolean;
    private vy: number;

    constructor(isPlayer: boolean) {
        super(isPlayer ? canvas.width * 9/10 : canvas.width/10, canvas.height/2, paddleWidth, paddleHeight);
        this.isPlayer = isPlayer;
        this.vy = 0;
    }

    public setSpeed(speed: number) {
        if (this.vy != speed && this.isPlayer) socket.emit("paddleSpeedChange", speed, this.getPosition().y);
        this.vy = speed;
    }

    public resetPosition() {
        this.setPosition(this.getPosition().x, canvas.height/2);
    }

    public periodic() {
        if (this.hitsWall(BoxSide.Top) && this.vy < 0) this.setPosition(this.getPosition().x, this.height/2);
        else if (this.hitsWall(BoxSide.Bottom) && this.vy > 0) this.setPosition(this.getPosition().x, canvas.height - this.height/2);
        else this.translateBy(0, this.vy);
    }
}

let currentState: GameState;
let playerPaddle: Paddle;
let opponentPaddle: Paddle;
let ball: Ball;
let opponentScore: number;
let playerScore: number;
let lastTick = -1;
let dispStartTime = -1;

function drawWaitingScreen() {
    graphics.save();
    graphics.fillStyle = "white";
    graphics.textAlign = "center";
    graphics.textBaseline = "middle";
    graphics.font = `${canvas.height/8}px monospace`;
    graphics.fillText("pong", canvas.width/2, canvas.height/3);
    graphics.font = `${canvas.height/32}px monospace`;
    graphics.fillText("waiting for opponent...", canvas.width/2, canvas.height * 2/3);
    graphics.restore();
}

function drawStartScreen() {
    graphics.save();
    graphics.fillStyle = "white";
    graphics.textAlign = "center";
    graphics.textBaseline = "middle";
    graphics.font = `${canvas.height/8}px monospace`;
    graphics.fillText("pong", canvas.width/2, canvas.height/3);
    graphics.font = `${canvas.height/32}px monospace`;
    graphics.fillText("press space to start", canvas.width/2, canvas.height * 2/3);
    graphics.restore();
}

function drawGameOverScreen() {
    graphics.save();
    graphics.fillStyle = "white";
    graphics.textAlign = "center";
    graphics.textBaseline = "middle";
    graphics.font = `${canvas.height/8}px monospace`;
    const msg = playerScore > opponentScore ? "you won!" : "game over";
    graphics.fillText(msg, canvas.width/2, canvas.height/3);
    graphics.font = `${canvas.height/32}px monospace`;
    graphics.fillText("press space to play again", canvas.width/2, canvas.height * 2/3);
    graphics.restore();
}

function drawField() {
    graphics.save();
    graphics.fillStyle = "black";
    graphics.fillRect(0, 0, canvas.width, canvas.height);
    if (currentState == GameState.Playing || currentState == GameState.Serve) {
        graphics.setLineDash([canvas.height/41, canvas.height/41])
        drawLine(canvas.width/2, 0, canvas.width/2, canvas.height, "white", 5);
        graphics.restore();
    }
}

function drawScores() {
    graphics.save()
    graphics.textAlign = "center";
    graphics.textBaseline = "middle";
    graphics.fillStyle = "white";
    graphics.font = `${canvas.height/8}px monospace`;
    graphics.fillText(opponentScore.toString(), canvas.width/4, canvas.height/6);
    graphics.fillText(playerScore.toString(), canvas.width* 3/4, canvas.height/6);
    graphics.restore()
}

function drawGameElements() {
    graphics.fillStyle = "white";
    graphics.fillRect(playerPaddle.nwX, playerPaddle.nwY, playerPaddle.width, playerPaddle.height);
    graphics.fillRect(opponentPaddle.nwX, opponentPaddle.nwY, opponentPaddle.width, opponentPaddle.height);
    fillCircle(ball.getPosition().x, ball.getPosition().y, ballSize/2, "white");
    let opacity = 64;
    for (const coords of ball.prevPositions) {
        fillCircle(coords.x, coords.y, ballSize/2, makeColor(255, 255, 255, opacity));
        opacity /= 2;
    }
}

function checkPaddleCollisions() {
    let distFromPaddle: number;
    let degrees: number;
    if (ball.collidesWith(opponentPaddle)) {
        ball.setVector(new Vector(0, 0));
    } else if (ball.collidesWith(playerPaddle)) {
        distFromPaddle = Math.min(Math.max(playerPaddle.getPosition().y - ball.getPosition().y, -paddleHeight/2), paddleHeight/2);
        degrees = 180 - distFromPaddle * maxBounceAngle / (paddleHeight/2);
        ball.setPosition(playerPaddle.nwX - ball.width/2 - 1, ball.getPosition().y);
        ball.setVector(new Vector(ballSpeed, degrees));
        ball.periodic();
        socket.emit("paddleHit", ball.getPosition(), ball.getVector(), playerPaddle.getPosition().y);
    }
}

function newGame() {
    playerPaddle = new Paddle(true);
    opponentPaddle = new Paddle(false);
    ball = new Ball(false);
    opponentScore = 0;
    playerScore = 0;
}

function gamePeriodic() {
    checkPaddleCollisions();
    playerPaddle.periodic();
    opponentPaddle.periodic();
    ball.periodic();
}

function handleKeyInputs() {
    if (isKeyPressed("ArrowDown") || isKeyPressed("s") || isKeyPressed("j")) playerPaddle.setSpeed(maxPaddleSpeed);
    else if (isKeyPressed("ArrowUp") || isKeyPressed("w") || isKeyPressed("k")) playerPaddle.setSpeed(-maxPaddleSpeed);
    else playerPaddle.setSpeed(0);
}

function manageState() {
    switch (currentState) {
        case GameState.Start:
            if (isKeyPressed(" ")) {
                // currentState = GameState.Serve;
                ball = new Ball(false);
                socket.emit("startGame", ball.getVector());
                onServe(ball.getVector(), false)
            }
            break;
        case GameState.Playing:
            if (opponentScore >= 7 || playerScore >= 7 ) {
                currentState = GameState.Over;
                break;
            }
            if (ball.hitsWall(BoxSide.Right)) {
                const vector = new Ball(false).getVector();
                socket.emit("opponentScored", vector);
                onServe(vector, false)
            }
            break;
        case GameState.Serve:
            if (dispStartTime < 0) dispStartTime = performance.now();
            if (performance.now() - dispStartTime >= serveDelay) {
                currentState = GameState.Playing;
                dispStartTime = -1;
            }
            break;
        case GameState.Over:
            if (isKeyPressed(" ")) {
                window.location.reload()
            }
            
    }
}

function onServe(vector:Vector, isOpponent:boolean) {
    playerPaddle.resetPosition();
    opponentPaddle.resetPosition();
    ball = new Ball(false);
    ball.setVector(isOpponent ? vector.invert() : vector);
    currentState = GameState.Serve;
}

function start() {
    currentState = GameState.Waiting;
    newGame();
    document.addEventListener("keydown", (event) => {
        if (event.key == "ArrowUp" || event.key == "ArrowDown") {
            event.preventDefault();
        }
    });
}

function frame() {
    graphics.clearRect(0, 0, canvas.width, canvas.height);
    drawField();
    manageState();
    if (currentState == GameState.Waiting) drawWaitingScreen();
    else if (currentState == GameState.Start) drawStartScreen();
    else if (currentState == GameState.Over) drawGameOverScreen();
    else {
        if (currentState == GameState.Playing) {
            if (performance.now() - lastTick >= tickDelay) {
                lastTick = performance.now();
                gamePeriodic();
            }
            handleKeyInputs();
        }
        drawGameElements();
        drawScores();
    }
}

window.onload = () => {
    startGraphics(start, frame, 'pong-2p-canvas', false);

    let nameElement=document.querySelector("#playerName") as HTMLInputElement;
    let rememberName=() => {localStorage.setItem("pong_player_name",nameElement.value);};    
    nameElement.addEventListener("input",rememberName);
    nameElement.addEventListener("change",rememberName);
    nameElement.value = localStorage.getItem("pong_player_name");
    nameElement.addEventListener("keydown", (ev) => {if (ev.code == "Enter") {socket.emit("setName", nameElement.value)}})
    socket.emit("login", nameElement.value ?? "Unnamed")
}

window.onbeforeunload = () => {socket.emit("leave");console.log("disconnecting"); return null;}
// window.onunload = () => {socket.disconnect();console.log("disconnecting")}

socket.on("startGame", (ballVector:VectorData) => {
    console.log(ballVector);
    onServe(Vector.fromData(ballVector), true);
});

socket.on("paddleHit", (ballPosition: {x: number, y: number}, ballVector: VectorData, paddlePosition: number) => {
    console.log(ballPosition, ballVector, paddlePosition);
    ball.setPosition(canvas.width - ballPosition.x, ballPosition.y);
    ball.setVector(Vector.fromData(ballVector).invert());
    opponentPaddle.setPosition(opponentPaddle.getPosition().x, paddlePosition);
});

socket.on("paddleSpeedChange", (speed: number, ypos: number) => {
    console.log("speed changed");
    opponentPaddle.setSpeed(speed);
    // opponentPaddle.setPosition(opponentPaddle.getPosition().x, ypos);
})

socket.on("scores", (scores:{self: number, opponent: number}) => {
    playerScore = scores.self;
    opponentScore = scores.opponent;
})

socket.on("scored", (ballVector: VectorData)=>{
    onServe(Vector.fromData(ballVector), true);
})

socket.on("inRoom", () => {
    console.log("friend joined the room");
    currentState = GameState.Start;
})

socket.on("opponentName", (name:string) => {
    let opponentName=document.querySelector("#opponentName") as HTMLSpanElement;
    opponentName.innerText = name ?? "Unknown"
})

socket.on("cancelGame", () => {
    newGame();
    currentState = GameState.Waiting;
})

socket.on("paddlePosition", (paddlePosition:number) => {
    opponentPaddle.setPosition(opponentPaddle.getPosition().x, paddlePosition);
    console.log("paddle positions synced");
})

socket.on("ping", (cb:(socket:string) => void) => {
    cb(socket.id)
})

setInterval( () => {socket.emit("paddlePosition", playerPaddle.getPosition().y)}, 25);