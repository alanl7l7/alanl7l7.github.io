// ==========================================
// GAME VARIABLES & SETUP
// ==========================================

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

// 8-bit synth audio (same WebAudio pattern as main portfolio UI).
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// Global Game State
let isPlaying = false;
let score = 0;
let lives = 3;
let animationId;
let lastShootSfxTime = 0;

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

function playPlayerShootSound() {
    const now = performance.now();
    if (now - lastShootSfxTime < 80) {
        return;
    }
    lastShootSfxTime = now;
    play8BitBlip(880, 520, 0.06, 0.06);
}

function playAlienShootSound() {
    play8BitBlip(300, 210, 0.06, 0.05);
}

function playAlienHitSound() {
    play8BitBlip(640, 1000, 0.06, 0.08);
}

function playPlayerHitSound() {
    play8BitBlip(220, 70, 0.15, 0.12);
}

function playShieldHitSound() {
    play8BitBlip(410, 250, 0.05, 0.05);
}

function playWinSound() {
    play8BitBlip(520, 880, 0.08, 0.09);
    setTimeout(() => play8BitBlip(700, 1100, 0.08, 0.09), 90);
}

// Input State
const keys = {
    ArrowLeft: false,
    ArrowRight: false,
    Space: false
};

// Arrays to hold our game entities
let aliens = [];
let projectiles = [];
let shields = [];

// Alien movement state
let alienDirection = 1; // 1 for right, -1 for left
let alienSpeed = 1.5;
let alienDropDistance = 20;
let alienFireRate = 0.02; // Chance per frame for an alien to shoot

// ==========================================
// CLASSES (Object-Oriented Structures)
// ==========================================

class Player {
    constructor() {
        this.width = 50;
        this.height = 20;
        this.x = canvas.width / 2 - this.width / 2;
        this.y = canvas.height - 40;
        this.speed = 5;
        this.color = "#39ff14"; // Phosphor green
        
        // Shooting cooldown mechanics
        this.lastShotTime = 0;
        this.shootCooldown = 400; // milliseconds between shots
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        // Draw a simple ship shape (a base and a turret)
        ctx.fillRect(this.x, this.y + 10, this.width, 10); // Base
        ctx.fillRect(this.x + 20, this.y, 10, 10);         // Turret
    }

    update() {
        // Movement
        if (keys.ArrowLeft && this.x > 0) {
            this.x -= this.speed;
        }
        if (keys.ArrowRight && this.x < canvas.width - this.width) {
            this.x += this.speed;
        }

        // Shooting
        if (keys.Space) {
            const currentTime = Date.now();
            if (currentTime - this.lastShotTime > this.shootCooldown) {
                // Fire a projectile moving upwards (negative speed)
                projectiles.push(new Projectile(this.x + this.width / 2 - 2, this.y, -7, false));
                playPlayerShootSound();
                this.lastShotTime = currentTime;
            }
        }
    }
}

class Alien {
    constructor(x, y, row) {
        this.x = x;
        this.y = y;
        this.width = 40;
        this.height = 30;
        this.active = true;
        
        // Different colors based on row for retro feel
        const colors = ["#ff3333", "#ffb000", "#39ff14", "#00ffff", "#eeeeee"];
        this.color = colors[row % colors.length];
    }

    draw(ctx) {
        if (!this.active) return;
        ctx.fillStyle = this.color;
        // Simple alien block
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        // Draw "eyes" (cutouts)
        ctx.fillStyle = "#000";
        ctx.fillRect(this.x + 8, this.y + 8, 6, 6);
        ctx.fillRect(this.x + 26, this.y + 8, 6, 6);
    }
}

class Projectile {
    constructor(x, y, speed, isAlien) {
        this.x = x;
        this.y = y;
        this.width = 4;
        this.height = 15;
        this.speed = speed;
        this.isAlien = isAlien; // true if shot by alien, false if shot by player
        this.active = true;
        this.color = isAlien ? "#ff3333" : "#39ff14";
    }

    draw(ctx) {
        if (!this.active) return;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }

    update() {
        this.y += this.speed;
        // Deactivate if it goes off screen
        if (this.y < 0 || this.y > canvas.height) {
            this.active = false;
        }
    }
}

class ShieldBlock {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 10;
        this.height = 10;
        this.active = true;
        this.color = "#39ff14";
    }

    draw(ctx) {
        if (!this.active) return;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }
}

// Instantiate the player
let player = new Player();

// ==========================================
// INITIALIZATION FUNCTIONS
// ==========================================

function initAliens() {
    aliens = [];
    const rows = 5;
    const cols = 8;
    const padding = 20;
    const offsetX = 100;
    const offsetY = 60;

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            let x = offsetX + c * (40 + padding);
            let y = offsetY + r * (30 + padding);
            aliens.push(new Alien(x, y, r));
        }
    }
    alienDirection = 1;
    alienSpeed = 1.5;
}

function initShields() {
    shields = [];
    const numShields = 4;
    const shieldWidth = 80;
    const spacing = (canvas.width - (numShields * shieldWidth)) / (numShields + 1);
    const startY = canvas.height - 120;

    for (let s = 0; s < numShields; s++) {
        let startX = spacing + s * (shieldWidth + spacing);
        // Create a grid of small blocks for each shield
        for (let r = 0; r < 5; r++) {
            for (let c = 0; c < 8; c++) {
                // Skip some blocks to make it look like a classic bunker arch
                if ((r === 0 && (c === 0 || c === 7)) || 
                    (r === 4 && (c > 2 && c < 5))) {
                    continue;
                }
                shields.push(new ShieldBlock(startX + c * 10, startY + r * 10));
            }
        }
    }
}

// ==========================================
// INPUT HANDLING
// ==========================================

document.addEventListener("keydown", (e) => {
    if (e.code === "ArrowLeft") keys.ArrowLeft = true;
    if (e.code === "ArrowRight") keys.ArrowRight = true;
    if (e.code === "Space") keys.Space = true;
});

document.addEventListener("keyup", (e) => {
    if (e.code === "ArrowLeft") keys.ArrowLeft = false;
    if (e.code === "ArrowRight") keys.ArrowRight = false;
    if (e.code === "Space") keys.Space = false;
});

// ==========================================
// GAME LOGIC & PHYSICS
// ==========================================

// Helper function for Axis-Aligned Bounding Box (AABB) collision
function checkCollision(rect1, rect2) {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
}

function updateAliens() {
    let hitEdge = false;
    let activeAliensCount = 0;

    // First pass: check if any alien hits the edge of the screen
    for (let alien of aliens) {
        if (!alien.active) continue;
        activeAliensCount++;
        
        if (alien.x + alien.width + (alienSpeed * alienDirection) > canvas.width - 20 || 
            alien.x + (alienSpeed * alienDirection) < 20) {
            hitEdge = true;
        }
    }

    // Win condition
    if (activeAliensCount === 0) {
        gameWin();
        return;
    }

    // Second pass: move aliens
    if (hitEdge) {
        // Reverse direction and move down
        alienDirection *= -1;
        // Increase speed slightly as they get lower
        alienSpeed += 0.2; 
        
        for (let alien of aliens) {
            if (!alien.active) continue;
            alien.y += alienDropDistance;
            
            // Game Over if aliens reach the player
            if (alien.y + alien.height >= player.y) {
                gameOver();
            }
        }
    } else {
        // Move horizontally
        for (let alien of aliens) {
            if (!alien.active) continue;
            alien.x += alienSpeed * alienDirection;
            
            // Randomly shoot
            if (Math.random() < alienFireRate / activeAliensCount) {
                // Fire projectile downwards (positive speed)
                projectiles.push(new Projectile(alien.x + alien.width / 2, alien.y + alien.height, 5, true));
                playAlienShootSound();
            }
        }
    }
}

function handleCollisions() {
    for (let proj of projectiles) {
        if (!proj.active) continue;

        // 1. Player Projectile hits Alien
        if (!proj.isAlien) {
            for (let alien of aliens) {
                if (alien.active && checkCollision(proj, alien)) {
                    alien.active = false;
                    proj.active = false;
                    playAlienHitSound();
                    score += 20;
                    scoreElement.innerText = score;
                    break; // Projectile destroyed, stop checking other aliens
                }
            }
        }

        // 2. Alien Projectile hits Player
        if (proj.isAlien && proj.active) {
            if (checkCollision(proj, player)) {
                proj.active = false;
                lives--;
                livesElement.innerText = lives;
                playPlayerHitSound();
                
                // Visual feedback for getting hit
                player.color = "#ff3333";
                setTimeout(() => player.color = "#39ff14", 100);

                if (lives <= 0) {
                    gameOver();
                }
            }
        }

        // 3. Any Projectile hits Shield
        if (proj.active) {
            for (let block of shields) {
                if (block.active && checkCollision(proj, block)) {
                    block.active = false;
                    proj.active = false;
                    playShieldHitSound();
                    break;
                }
            }
        }
    }
}

function update() {
    player.update();
    updateAliens();
    
    // Update projectiles and remove inactive ones
    for (let proj of projectiles) {
        proj.update();
    }
    projectiles = projectiles.filter(p => p.active);
    
    handleCollisions();
}

// ==========================================
// DRAWING FUNCTIONS
// ==========================================

function draw() {
    if (!isPlaying) return;

    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw entities
    player.draw(ctx);
    
    for (let alien of aliens) {
        alien.draw(ctx);
    }
    
    for (let shield of shields) {
        shield.draw(ctx);
    }
    
    for (let proj of projectiles) {
        proj.draw(ctx);
    }

    // Game Loop
    update();
    animationId = requestAnimationFrame(draw);
}

// ==========================================
// GAME STATE MANAGEMENT
// ==========================================

function startGame() {
    unlockAudio();
    startScreen.classList.remove("active");
    gameOverScreen.classList.remove("active");
    winScreen.classList.remove("active");
    
    score = 0;
    lives = 3;
    scoreElement.innerText = score;
    livesElement.innerText = lives;
    
    player = new Player();
    projectiles = [];
    
    initAliens();
    initShields();
    
    isPlaying = true;
    draw();
}

function gameOver() {
    isPlaying = false;
    cancelAnimationFrame(animationId);
    gameOverScreen.classList.add("active");
}

function gameWin() {
    isPlaying = false;
    cancelAnimationFrame(animationId);
    playWinSound();
    winScreen.classList.add("active");
}

// ==========================================
// EVENT LISTENERS FOR BUTTONS
// ==========================================

startBtn.addEventListener("click", startGame);
restartBtn.addEventListener("click", startGame);
playAgainBtn.addEventListener("click", startGame);

// Draw initial state behind the start screen
initAliens();
initShields();
player.draw(ctx);
for (let alien of aliens) alien.draw(ctx);
for (let shield of shields) shield.draw(ctx);
