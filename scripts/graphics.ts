// JavaScript Library for Animated Games
// Author: Andrew Merrill, April 2022
// Version: 1.1.1

"use strict";


let start:() => void;
let frame:() => void;

////////////////////////////////////////////////////
// Returns true if the given key is currently pressed,
//   otherwise returns false
// See https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key/Key_Values for key names (refer to the first column, the "KeyboardEvent.key" value)
 export function isKeyPressed(key: string): boolean {
    return _GLI.pressedKeys[key];
}

////////////////////////////////////////////////////
// Returns true if the mouse button is currently pressed, and false otherwise
 export function isMousePressed(): boolean {
    return _GLI.mousePressed;
}

////////////////////////////////////////////////////
// Returns an object with x and y properties that give the current coordinates of the mouse
 export function getMousePosition(): {x: number, y: number} {
    return {x:_GLI.mousePosition.x, y:_GLI.mousePosition.y};
}

////////////////////////////////////////////////////
// Returns an image that can be drawn on the canvas
// Arguments:
//  imageFileName is the name of a file that contains the image (usually a .png or .jpg file), in the same folder as the web page
//  scale is the amount to expand (if it is greater than 1) or reduce (if it is less than 1) the image size.  For example, 2 means to double the size, 0.5 means to shrink the size to half of the original.  Defaults to 1 (no change).
 export function loadImage(imageFileName: string, scale=1): HTMLImageElement {
    _GLI.waitingImagesCount ++;
    const image = new Image();
    image.src = imageFileName;
    image.addEventListener('load', function() {
        if (scale != 1) {
            image.width *= scale;
            image.height *= scale;
        }     
        (<any>image).radius = Math.sqrt((image.width / 2)**2 + (image.height / 2)**2)
        console.log(`loaded image ${imageFileName}, size = ${image.width} x ${image.height}, radius = ${(<any>image).radius}`); 
        _GLI.waitingImagesCount --;
    });
    return image;
}

////////////////////////////////////////////////////
// Draws a previously loaded image in the canvas
// Arguments:
//   image is an image that was previously loaded with loadImage
//   x, y are the coordinates on the canvas where the center of the image will be drawn
//   rotate is the number of degrees to rotate the image clockwise (defaults to 0, no rotation)
//   opacity is how opaque to draw the image on a scale of 0 to 1 (0 is fully transparent, 1 is filly opaque)
 export function drawImage(image: HTMLImageElement, x: number, y: number, rotate=0, opacity=1): void {
    graphics.save();
    if (rotate != 0) {
        graphics.translate(x, y);
        graphics.rotate(rotate * Math.PI / 180);
        graphics.translate(-x, -y);
    }
    if (opacity != 1) {
        graphics.globalAlpha = opacity;
    }
    graphics.drawImage(image, x - image.width/2, y - image.height/2, image.width, image.height);
    graphics.restore();
}

////////////////////////////////////////////////////
// Draws the outline of a circle on the canvas
// Arguments:
//    x, y are the coordinates on the canvas of the center of the circle
//    radius the is radius of the circle
//    color is the color of the circle (for example: "red", "#FF0000", "rgb(255,0,0)", or makeColor(255,0,0) )
//    thickness is the width of the circle's rim (defaults to 1)
 export function strokeCircle(x: number, y: number, radius: number, color: string, thickness=1): void {
    graphics.save();
    graphics.strokeStyle = color;
    graphics.lineWidth = thickness;
    graphics.beginPath();
    graphics.arc(x, y, radius, 0, 2*Math.PI);
    graphics.stroke();
    graphics.restore();
}


////////////////////////////////////////////////////
// Draws a solid, filled in circle on the canvas
// Arguments:
//    x, y are the coordinates on the canvas of the center of the circle
//    radius the is radius of the circle
//    color is the color of the circle (for example: "red", "#FF0000", "rgb(255,0,0)", or makeColor(255,0,0) )
 export function fillCircle(x: number, y: number, radius: number, color: string): void {
    graphics.save();
    graphics.fillStyle = color;
    graphics.beginPath();
    graphics.arc(x, y, radius, 0, 2*Math.PI);
    graphics.fill();
    graphics.closePath();
    graphics.restore();
}

////////////////////////////////////////////////////
// Draws a straight line segment between two points
// Arguments:
//    x1, y1 are the coordinates on the canvas of one end of the line segment
//    x2, y2 are the coordinates on the canvas of the other end of the line segment
//    color is the color of the line (for example: "red", "#FF0000", "rgb(255,0,0)", or makeColor(255,0,0) )
//    thickness is the width of the line (defaults to 1)
export function drawLine(x1: number, y1: number, x2: number, y2: number, color: string, thickness=1): void {
    graphics.save();
    graphics.strokeStyle = color;
    graphics.lineWidth = thickness;
    graphics.beginPath();
    graphics.moveTo(x1, y1);
    graphics.lineTo(x2, y2);
    graphics.stroke();
    graphics.closePath();
    graphics.restore();
}

export function fillPolygon(x: number[], y: number[], color: string): void{
    graphics.save();
    graphics.fillStyle = color;
    graphics.beginPath();
    graphics.moveTo(x[0], y[0]);
    for (let i = 1; i < Math.min(x.length, y.length); i++) {
        graphics.lineTo(x[i], y[i]);
    }
    graphics.fill();
    graphics.closePath();
    graphics.restore();
}

////////////////////////////////////////////////////
// Constructs a color from three numeric component values
//  Each of red, green, blue, and alpha should be in the range of 0 to 255
//  Note: alpha is the amount of opacity (0 is transparent, 255 is fully opaque), defaults to 255 (opaque)
export function makeColor(red: number, green: number, blue: number, alpha=255): string {
    if (alpha == 255) {
        return `rgb(${red},${green},${blue})`;
    } else {
        return `rgba(${red},${green},${blue},${alpha/255})`;
    }
}

////////////////////////////////////////////////////
// Returns a random color
export function makeRandomColor(): string{
    return makeColor(Math.floor(Math.random()*256), Math.floor(Math.random()*256), Math.floor(Math.random()*256));
}

////////////////////////////////////////////////////
// returns the current frame rate in frames per second
export function getFrameRate(): number{
    return _GLI.frameRate;
}

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// export functions below this point are for internal use
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export let canvas: HTMLCanvasElement;
export let graphics: CanvasRenderingContext2D;

const _GLI = {           // Graphics Library Information
    fullWindow : true,
    pressedKeys : {},
    mousePosition : {x:-1, y:-1},
    mousePressed : false,
    frameTimes : [],
    frameRate : 0,
    waitingImagesCount : 0
}  

// This should be called as your body's onload handler
export function startGraphics(startFunc:() => void, frameFunc:() => void, canvasID: string, fullWindow=true) {
    start = startFunc;
    frame = frameFunc;
    canvas = document.getElementById(canvasID) as HTMLCanvasElement;
    graphics = canvas.getContext("2d");
    _GLI.fullWindow = fullWindow;
    if (_GLI.fullWindow)
        _resizeCanvasToDisplaySize(canvas);

    document.addEventListener('keydown',  
        event => { 
            _GLI.pressedKeys[event.key] = true; 
        });
    document.addEventListener('keyup',  
        event => { 
            _GLI.pressedKeys[event.key] = false; 
        });

    canvas.addEventListener('mousedown', 
        event => {
            _GLI.mousePressed = true;
        });
    canvas.addEventListener('mouseup', 
        event => {
            _GLI.mousePressed = false;
        });
    canvas.addEventListener('mousemove', 
        event => {
            _GLI.mousePosition.x = event.offsetX;
            _GLI.mousePosition.y = event.offsetY;
         });

    start();

    window.requestAnimationFrame(drawGraphics);
}


////////////////////////////////////////////////////
// This is the animation export function that is run once per frame
export function drawGraphics() {
    if (_GLI.fullWindow)
        _resizeCanvasToDisplaySize(canvas);
    if (_GLI.waitingImagesCount == 0) {
        _computeFrameRate();
        frame();
    }
    window.requestAnimationFrame(drawGraphics);
}

////////////////////////////////////////////////////
// This resizes the canvas to match the current window size
function _resizeCanvasToDisplaySize(canvas) {
    const displayWidth  = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;            
    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
        canvas.width  = displayWidth;
        canvas.height = displayHeight;
        console.log(`canvas resized to ${canvas.width} x ${canvas.height}`);
    }            
}

////////////////////////////////////////////////////
// This should be called once per frame to compute the frame rate
function _computeFrameRate() {
    const currentTime = performance.now();
    _GLI.frameTimes.push(currentTime);
    if (_GLI.frameTimes.length > 100) {
        _GLI.frameTimes.shift();
    }
    const elapsedTime = (currentTime - _GLI.frameTimes[0]) / 1000.0;
    _GLI.frameRate = (_GLI.frameTimes.length - 1) / elapsedTime;
}