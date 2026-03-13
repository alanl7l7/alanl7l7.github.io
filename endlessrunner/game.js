// ==========================================
// GAME VARIABLES & SETUP
// ==========================================

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// UI Elements
const scoreElement = document.getElementById("score");
const highScoreElement = document.getElementById("high-score");
const startScreen = document.getElementById("start-screen");
const gameOverScreen = document.getElementById("game-over-screen");

// 8-bit synth audio, consistent with the main menu style.
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// Global Game State
let isPlaying = false;
let score = 0;
let scoreCounter = 0; // Used to increment score every few frames
let highScore = localStorage.getItem("terminalRunnerHighScore") || 0;
let animationId;
let lastScoreSfxAt = 0;

function unlockAudio() {
    if (audioCtx.state === "suspended") {
        audioCtx.resume().catch(() => {});
    }
}

function play8BitBlip(startFreq, endFreq, duration, volume = 0.08) {
    unlockAudio();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = "square";
    osc.frequency.setValueAtTime(startFreq, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), audioCtx.currentTime + duration);

    gain.gain.setValueAtTime(volume, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

function playJumpSound() {
    play8BitBlip(620, 980, 0.06, 0.07);
}

function playScoreSound() {
    play8BitBlip(420, 680, 0.05, 0.05);
}

function playGameOverSound() {
    play8BitBlip(240, 70, 0.16, 0.12);
}

// Physics & World Variables
let gameSpeed = 6;
const gravity = 0.6;
const groundY = canvas.height - 30; // The Y coordinate of the ground line

// Initialize High Score display
highScoreElement.innerText = String(Math.floor(highScore)).padStart(5, '0');

// ==========================================
// CLASSES (Object-Oriented Structures)
// ==========================================

class Player {
    constructor() {
        this.width = 30;
        this.height = 40;
        this.x = 50; // Fixed horizontal position
        this.y = groundY - this.height; // Start on the ground
        
        // Vertical velocity and jump power
        this.dy = 0;
        this.jumpForce = 12;
        this.originalHeight = this.height;
        this.grounded = false;
        
        this.color = "#39ff14"; // Phosphor green
    }

    // Apply gravity and handle jumping
    update() {
        // Apply gravity to vertical velocity
        this.dy += gravity;
        this.y += this.dy;

        // Floor collision detection
        if (this.y + this.height >= groundY) {
            this.y = groundY - this.height;
            this.dy = 0;
            this.grounded = true;
        } else {
            this.grounded = false;
        }
    }

    // Triggered by user input
    jump() {
        // Only allow jumping if the player is touching the ground
        if (this.grounded) {
            this.dy = -this.jumpForce;
            this.grounded = false;
            playJumpSound();
        }
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        // Draw the player block
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        // Draw a simple "eye" for detail
        ctx.fillStyle = "#000";
        ctx.fillRect(this.x + 20, this.y + 5, 5, 5);
    }
}

class Obstacle {
    constructor(x, width, height) {
        this.x = x;
        this.width = width;
        this.height = height;
        this.y = groundY - this.height; // Sit exactly on the ground
        this.color = "#39ff14";
    }

    update() {
        // Move the obstacle to the left based on the current game speed
        this.x -= gameSpeed;
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        // Draw the obstacle block
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        // Draw some internal lines to make it look like a terminal block/cactus
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 2;
        ctx.strokeRect(this.x, this.y, this.width, this.height);
    }
}

// ==========================================
// ENTITY MANAGEMENT & SPAWNING
// ==========================================

let player;
let obstacles = [];

// Variables to control how often obstacles spawn
let spawnTimer = 0;
const initialSpawnTimer = 100; // Frames until first spawn

function spawnObstacle() {
    // Randomize obstacle dimensions slightly
    const minWidth = 20;
    const maxWidth = 40;
    const minHeight = 30;
    const maxHeight = 60;
    
    const width = Math.floor(Math.random() * (maxWidth - minWidth + 1)) + minWidth;
    const height = Math.floor(Math.random() * (maxHeight - minHeight + 1)) + minHeight;
    
    // Spawn just off the right edge of the canvas
    obstacles.push(new Obstacle(canvas.width, width, height));
}

function handleObstacles() {
    // Decrement the spawn timer
    spawnTimer--;

    // When timer hits 0, spawn a new obstacle and reset the timer
    if (spawnTimer <= 0) {
        spawnObstacle();
        
        // Calculate next spawn time. 
        // We use gameSpeed to ensure obstacles aren't spawned too close together as speed increases.
        // The minimum distance must be enough for the player to jump over and land.
        const minFrames = 60; 
        const maxFrames = 150;
        
        // Randomize the next spawn time
        spawnTimer = Math.floor(Math.random() * (maxFrames - minFrames + 1)) + minFrames;
        
        // Slightly reduce the timer based on game speed to increase difficulty
        spawnTimer = spawnTimer / (gameSpeed / 6); 
    }

    // Update and draw all obstacles
    for (let i = 0; i < obstacles.length; i++) {
        let obs = obstacles[i];
        obs.update();
        obs.draw(ctx);

        // Remove obstacles that have moved completely off the left side of the screen
        if (obs.x + obs.width < 0) {
            obstacles.splice(i, 1);
            i--; // Adjust index after removal
        }
    }
}

// ==========================================
// INPUT HANDLING
// ==========================================

function handleInput(e) {
    // Prevent default scrolling behavior for Space and ArrowUp
    if (e.type === "keydown" && (e.code === "Space" || e.code === "ArrowUp")) {
        e.preventDefault();
    }

    // If the game is running, jump
    if (isPlaying) {
        if (e.type === "mousedown" || e.type === "touchstart" || 
           (e.type === "keydown" && (e.code === "Space" || e.code === "ArrowUp"))) {
            player.jump();
        }
    } 
    // If the game is NOT running, start/restart the game
    else {
        if (e.type === "mousedown" || e.type === "touchstart" || 
           (e.type === "keydown" && (e.code === "Space" || e.code === "ArrowUp"))) {
            startGame();
        }
    }
}

// Attach event listeners for keyboard, mouse, and touch
document.addEventListener("keydown", handleInput);
document.addEventListener("mousedown", handleInput);
document.addEventListener("touchstart", handleInput, { passive: false });

// ==========================================
// GAME LOGIC & PHYSICS
// ==========================================

// Axis-Aligned Bounding Box (AABB) Collision Detection
function checkCollision(rect1, rect2) {
    // We add a tiny bit of leniency (padding) so near-misses don't feel unfair
    const padding = 5; 
    return (
        rect1.x < rect2.x + rect2.width - padding &&
        rect1.x + rect1.width > rect2.x + padding &&
        rect1.y < rect2.y + rect2.height - padding &&
        rect1.y + rect1.height > rect2.y + padding
    );
}

function updateScore() {
    scoreCounter++;
    // Increase actual score every 5 frames
    if (scoreCounter % 5 === 0) {
        score++;
        // Pad the score with leading zeros (e.g., 00142)
        scoreElement.innerText = String(score).padStart(5, '0');

        // Keep point sounds periodic so they stay useful and not noisy.
        if (score - lastScoreSfxAt >= 25) {
            playScoreSound();
            lastScoreSfxAt = score;
        }
        
        // Gradually increase the game speed as the score goes up
        if (score % 100 === 0) {
            gameSpeed += 0.5;
        }
    }
}

function drawEnvironment() {
    // Draw the ground line
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(canvas.width, groundY);
    ctx.strokeStyle = "#39ff14";
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Optional: Draw some random "ground noise" (dots/lines) moving left
    // (Omitted here to keep the code clean and minimalist, but easy to add!)
}

// ==========================================
// MAIN GAME LOOP
// ==========================================

function draw() {
    if (!isPlaying) return;

    // Clear the canvas for the new frame
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Update and draw environment
    drawEnvironment();

    // Update and draw player
    player.update();
    player.draw(ctx);

    // Update, draw, and spawn obstacles
    handleObstacles();

    // Check for collisions between player and all active obstacles
    for (let obs of obstacles) {
        if (checkCollision(player, obs)) {
            gameOver();
            return; // Stop the loop immediately
        }
    }

    // Update score and progression
    updateScore();

    // Request the next frame
    animationId = requestAnimationFrame(draw);
}

// ==========================================
// GAME STATE MANAGEMENT
// ==========================================

function startGame() {
    unlockAudio();
    // Hide overlays
    startScreen.classList.remove("active");
    gameOverScreen.classList.remove("active");
    
    // Reset Game Variables
    score = 0;
    scoreCounter = 0;
    lastScoreSfxAt = 0;
    gameSpeed = 6;
    spawnTimer = initialSpawnTimer;
    scoreElement.innerText = "00000";
    
    // Reset Entities
    player = new Player();
    obstacles = [];
    
    isPlaying = true;
    
    // Start the game loop
    draw();
}

function gameOver() {
    isPlaying = false;
    cancelAnimationFrame(animationId);
    playGameOverSound();
    
    // Show Game Over overlay
    gameOverScreen.classList.add("active");
    
    // Check and save High Score
    if (score > highScore) {
        highScore = score;
        localStorage.setItem("terminalRunnerHighScore", highScore);
        highScoreElement.innerText = String(highScore).padStart(5, '0');
    }
}

// ==========================================
// INITIAL SETUP
// ==========================================

// Draw the initial static scene behind the start screen
player = new Player();
drawEnvironment();
player.draw(ctx);
