import {graphics, canvas, drawLine, makeColor, fillCircle, isKeyPressed, startGraphics} from "./graphics";

const ballSize = 20;
const paddleHeight = 80;
const paddleWidth = 10;
const maxPaddleSpeed = 10;
const maxBounceAngle = 60;
const maxBallStartAngle = 20;
const ballSpeed = 15;
const serveDelay = 750;
const tickDelay = 1000/60;
const paddleKP = 0.1;

enum GameState {
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
        this.setVector(ballSpeed * 2/3, deg);
    }

    public setVector(magnitude: number, degrees: number) {
        const theta = degrees * (Math.PI / 180);
        this.vx = Math.cos(theta) * magnitude;
        this.vy = -Math.sin(theta) * magnitude;
    }

    public getVector(): {magnitude: number, degrees: number} {
        return {
            magnitude: Math.sqrt(this.vx*this.vx + this.vy*this.vy),
            degrees: Math.atan2(-this.vy, this.vx) * (180 / Math.PI)
        };
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
    vy: number;

    constructor(isPlayer: boolean) {
        super(isPlayer ? canvas.width * 9/10 : canvas.width/10, canvas.height/2, paddleWidth, paddleHeight);
        this.isPlayer = isPlayer;
        this.vy = 0;
    }

    public setSpeed(speed: number) {
        let clampedSpeed = Math.min(Math.max(speed, -maxPaddleSpeed), maxPaddleSpeed);
        this.vy = clampedSpeed;
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
let computerPaddle: Paddle;
let ball: Ball;
let computerScore: number;
let playerScore: number;
let lastTick = -1;
let dispStartTime = -1;

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
    const msg = playerScore > computerScore ? "you won!" : "game over";
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
    graphics.fillText(computerScore.toString(), canvas.width/4, canvas.height/6);
    graphics.fillText(playerScore.toString(), canvas.width* 3/4, canvas.height/6);
    graphics.restore()
}

function drawGameElements() {
    graphics.fillStyle = "white";
    graphics.fillRect(playerPaddle.nwX, playerPaddle.nwY, playerPaddle.width, playerPaddle.height);
    graphics.fillRect(computerPaddle.nwX, computerPaddle.nwY, computerPaddle.width, computerPaddle.height);
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
    if (ball.collidesWith(computerPaddle)) {
        distFromPaddle = Math.min(Math.max(computerPaddle.getPosition().y - ball.getPosition().y, -paddleHeight/2), paddleHeight/2);
        degrees = distFromPaddle * maxBounceAngle / (paddleHeight/2);
        ball.setVector(ballSpeed, degrees)
    } else if (ball.collidesWith(playerPaddle)) {
        distFromPaddle = Math.min(Math.max(playerPaddle.getPosition().y - ball.getPosition().y, -paddleHeight/2), paddleHeight/2);
        degrees = 180 - distFromPaddle * maxBounceAngle / (paddleHeight/2);
        ball.setVector(ballSpeed, degrees);
    }
}

function calculateComputerPaddleSetpoint() {
    if (ball.vx > 0 || ball.getPosition().x > canvas.width/2) return -1;
    const simBall = new Ball(false);
    simBall.setPosition(ball.getPosition().x, ball.getPosition().y);
    simBall.setVector(ball.getVector().magnitude, ball.getVector().degrees);
    while (simBall.getPosition().x > computerPaddle.nwX + computerPaddle.width) {
        simBall.periodic();
    }
    return simBall.getPosition().y;
}

function newGame() {
    playerPaddle = new Paddle(true);
    computerPaddle = new Paddle(false);
    ball = new Ball(false);
    computerScore = 0;
    playerScore = 0;
}

function gamePeriodic() {
    checkPaddleCollisions();
    playerPaddle.periodic();
    computerPaddle.periodic();
    ball.periodic();
}

function handleKeyInputs() {
    if (isKeyPressed("ArrowDown") || isKeyPressed("s")) playerPaddle.setSpeed(maxPaddleSpeed);
    else if (isKeyPressed("ArrowUp") || isKeyPressed("w")) playerPaddle.setSpeed(-maxPaddleSpeed);
    else playerPaddle.setSpeed(0);
}

function moveComputerPaddle() {
    let setpoint = calculateComputerPaddleSetpoint();
    if (setpoint < 0) {
        computerPaddle.setSpeed(0);
        return;
    }
    let error = setpoint - computerPaddle.getPosition().y;
    computerPaddle.setSpeed(error * paddleKP);
    console.log(computerPaddle.vy);
    // if (Math.abs(computerPaddle.getPosition().y - setpoint) < maxPaddleSpeed * 2 && computerPaddle.vy == 0) computerPaddle.setSpeed(0);
    // else if (computerPaddle.getPosition().y - maxPaddleSpeed < setpoint) computerPaddle.setSpeed(computerPaddle.vy + 1);
    // else if (computerPaddle.getPosition().y + maxPaddleSpeed > setpoint) computerPaddle.setSpeed(computerPaddle.vy - 1);
}

function manageState() {
    switch (currentState) {
        case GameState.Start:
            if (isKeyPressed(" ")) {
                currentState = GameState.Serve;
            }
            break;
        case GameState.Playing:
            if (computerScore >= 7 || playerScore >= 7 ) {
                currentState = GameState.Over;
                break;
            }
            if (ball.hitsWall(BoxSide.Left)) {
                playerScore++;
                ball = new Ball(true);
                playerPaddle.resetPosition();
                computerPaddle.resetPosition();
                currentState = GameState.Serve;
            } else if (ball.hitsWall(BoxSide.Right)) {
                computerScore++;
                ball = new Ball(false);
                playerPaddle.resetPosition();
                computerPaddle.resetPosition();
                currentState = GameState.Serve;
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
                newGame();
                currentState = GameState.Serve;
            }
    }
}

function start() {
    currentState = GameState.Start;
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
    if (currentState == GameState.Start) drawStartScreen();
    else if (currentState == GameState.Over) drawGameOverScreen();
    else {
        if (currentState == GameState.Playing) {
            if (performance.now() - lastTick >= tickDelay) {
                lastTick = performance.now();
                gamePeriodic();
            }
            handleKeyInputs();
            moveComputerPaddle();
        }
        drawGameElements();
        drawScores()
    }
}

window.onload = () => {
    startGraphics(start, frame, 'pong-canvas', false);
}