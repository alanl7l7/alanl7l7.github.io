// ==========================================
// GAME VARIABLES & SETUP
// ==========================================

// Get the canvas element and its 2D drawing context
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// UI Elements
const scoreElement = document.getElementById("score");
const livesElement = document.getElementById("lives");
const startScreen = document.getElementById("start-screen");
const gameOverScreen = document.getElementById("game-over-screen");
const winScreen = document.getElementById("win-screen");

// Buttons
const startBtn = document.getElementById("start-btn");
const restartBtn = document.getElementById("restart-btn");
const playAgainBtn = document.getElementById("play-again-btn");

// Game State
let isPlaying = false;
let score = 0;
let lives = 3;
let animationId; // Stores the requestAnimationFrame ID so we can cancel it

// ==========================================
// GAME OBJECTS
// ==========================================

// Paddle Object
const paddle = {
    width: 100,
    height: 10,
    x: canvas.width / 2 - 50, // Start centered
    y: canvas.height - 30,
    speed: 7,
    dx: 0
};

// Ball Object
const ball = {
    radius: 6,
    x: canvas.width / 2,
    y: canvas.height - 40,
    speed: 5,
    dx: 5 * (Math.random() > 0.5 ? 1 : -1), // Random initial horizontal direction
    dy: -5 // Always start moving up
};

// Brick Configuration
const brickRowCount = 5;
const brickColumnCount = 8;
const brickWidth = 80;
const brickHeight = 20;
const brickPadding = 10;
const brickOffsetTop = 60; // Space at the top for HUD
const brickOffsetLeft = 45; // Centers the grid horizontally

// Colors for the retro terminal theme
// Rows will have different colors: Red, Amber, Green, Cyan, White
const rowColors = ["#ff3333", "#ffb000", "#39ff14", "#00ffff", "#eeeeee"];

// Create the 2D array for bricks
let bricks = [];

function initBricks() {
    bricks = [];
    for (let c = 0; c < brickColumnCount; c++) {
        bricks[c] = [];
        for (let r = 0; r < brickRowCount; r++) {
            // status 1 means the brick is active (not destroyed)
            bricks[c][r] = { x: 0, y: 0, status: 1, color: rowColors[r] };
        }
    }
}

// ==========================================
// INPUT HANDLING
// ==========================================

let rightPressed = false;
let leftPressed = false;

// Keyboard Listeners
document.addEventListener("keydown", keyDownHandler, false);
document.addEventListener("keyup", keyUpHandler, false);

// Mouse Listener
document.addEventListener("mousemove", mouseMoveHandler, false);

function keyDownHandler(e) {
    if (e.key === "Right" || e.key === "ArrowRight") {
        rightPressed = true;
    } else if (e.key === "Left" || e.key === "ArrowLeft") {
        leftPressed = true;
    }
}

function keyUpHandler(e) {
    if (e.key === "Right" || e.key === "ArrowRight") {
        rightPressed = false;
    } else if (e.key === "Left" || e.key === "ArrowLeft") {
        leftPressed = false;
    }
}

function mouseMoveHandler(e) {
    // Calculate mouse position relative to the canvas
    const relativeX = e.clientX - canvas.getBoundingClientRect().left;
    
    // If the mouse is inside the canvas horizontally, move the paddle
    if (relativeX > 0 && relativeX < canvas.width) {
        paddle.x = relativeX - paddle.width / 2;
    }
}

// ==========================================
// GAME LOGIC & PHYSICS
// ==========================================

function collisionDetection() {
    for (let c = 0; c < brickColumnCount; c++) {
        for (let r = 0; r < brickRowCount; r++) {
            let b = bricks[c][r];
            // If the brick is still active
            if (b.status === 1) {
                // Check if the ball's coordinates overlap with the brick's area
                if (
                    ball.x + ball.radius > b.x && 
                    ball.x - ball.radius < b.x + brickWidth && 
                    ball.y + ball.radius > b.y && 
                    ball.y - ball.radius < b.y + brickHeight
                ) {
                    // Reverse the ball's vertical direction
                    ball.dy = -ball.dy;
                    // Mark brick as destroyed
                    b.status = 0;
                    // Increase score
                    score += 10;
                    scoreElement.innerText = score;
                    
                    // Check for Win Condition
                    if (score === brickRowCount * brickColumnCount * 10) {
                        gameWin();
                    }
                }
            }
        }
    }
}

function update() {
    // 1. Move the Paddle (Keyboard)
    if (rightPressed && paddle.x < canvas.width - paddle.width) {
        paddle.x += paddle.speed;
    } else if (leftPressed && paddle.x > 0) {
        paddle.x -= paddle.speed;
    }

    // 2. Move the Ball
    ball.x += ball.dx;
    ball.y += ball.dy;

    // 3. Ball Collision with Left/Right Walls
    if (ball.x + ball.dx > canvas.width - ball.radius || ball.x + ball.dx < ball.radius) {
        ball.dx = -ball.dx;
    }

    // 4. Ball Collision with Top Wall
    if (ball.y + ball.dy < ball.radius) {
        ball.dy = -ball.dy;
    } 
    // 5. Ball Collision with Bottom (Paddle or Floor)
    else if (ball.y + ball.dy > canvas.height - ball.radius) {
        
        // Check if ball hits the paddle
        if (ball.x > paddle.x && ball.x < paddle.x + paddle.width) {
            // Calculate where the ball hit the paddle (normalized from -1 to 1)
            let hitPoint = ball.x - (paddle.x + paddle.width / 2);
            hitPoint = hitPoint / (paddle.width / 2);
            
            // Calculate the bounce angle (max 60 degrees = Math.PI/3)
            let angle = hitPoint * (Math.PI / 3);
            
            // Update ball velocity based on the angle (sharper angle at edges)
            ball.dx = ball.speed * Math.sin(angle);
            ball.dy = -ball.speed * Math.cos(angle);
        } else {
            // Ball missed the paddle -> Lose a life
            lives--;
            livesElement.innerText = lives;
            
            if (!lives) {
                gameOver();
            } else {
                // Reset ball and paddle position
                resetPositions();
            }
        }
    }

    // 6. Check Brick Collisions
    collisionDetection();
}

// ==========================================
// DRAWING FUNCTIONS
// ==========================================

function drawBall() {
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = "#39ff14"; // Phosphor green
    ctx.fill();
    ctx.closePath();
}

function drawPaddle() {
    ctx.beginPath();
    ctx.rect(paddle.x, paddle.y, paddle.width, paddle.height);
    ctx.fillStyle = "#39ff14"; // Phosphor green
    ctx.fill();
    ctx.closePath();
}

function drawBricks() {
    for (let c = 0; c < brickColumnCount; c++) {
        for (let r = 0; r < brickRowCount; r++) {
            if (bricks[c][r].status === 1) {
                // Calculate brick X and Y positions based on grid index
                let brickX = (c * (brickWidth + brickPadding)) + brickOffsetLeft;
                let brickY = (r * (brickHeight + brickPadding)) + brickOffsetTop;
                
                bricks[c][r].x = brickX;
                bricks[c][r].y = brickY;
                
                ctx.beginPath();
                ctx.rect(brickX, brickY, brickWidth, brickHeight);
                ctx.fillStyle = bricks[c][r].color;
                ctx.fill();
                // Draw a border for that retro blocky look
                ctx.strokeStyle = "#000";
                ctx.strokeRect(brickX, brickY, brickWidth, brickHeight);
                ctx.closePath();
            }
        }
    }
}

// ==========================================
// GAME LOOP & STATE MANAGEMENT
// ==========================================

function draw() {
    if (!isPlaying) return;

    // Clear the canvas for the next frame
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw all game elements
    drawBricks();
    drawBall();
    drawPaddle();

    // Update game logic
    update();

    // Request the next animation frame
    animationId = requestAnimationFrame(draw);
}

function resetPositions() {
    paddle.x = canvas.width / 2 - paddle.width / 2;
    ball.x = canvas.width / 2;
    ball.y = canvas.height - 40;
    ball.dx = 5 * (Math.random() > 0.5 ? 1 : -1);
    ball.dy = -5;
}

function startGame() {
    startScreen.classList.remove("active");
    gameOverScreen.classList.remove("active");
    winScreen.classList.remove("active");
    
    score = 0;
    lives = 3;
    scoreElement.innerText = score;
    livesElement.innerText = lives;
    
    initBricks();
    resetPositions();
    
    isPlaying = true;
    draw(); // Start the game loop
}

function gameOver() {
    isPlaying = false;
    cancelAnimationFrame(animationId);
    gameOverScreen.classList.add("active");
}

function gameWin() {
    isPlaying = false;
    cancelAnimationFrame(animationId);
    winScreen.classList.add("active");
}

// ==========================================
// EVENT LISTENERS FOR BUTTONS
// ==========================================

startBtn.addEventListener("click", startGame);
restartBtn.addEventListener("click", startGame);
playAgainBtn.addEventListener("click", startGame);

// Initialize the brick array on load so they exist in memory
initBricks();
