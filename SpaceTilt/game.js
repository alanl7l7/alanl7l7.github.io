const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const scoreEl = document.getElementById('score');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const finalScoreEl = document.getElementById('final-score');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const controlStatusEl = document.getElementById('control-status');

let width, height;
let animationId;
let isPlaying = false;
let score = 0;
let tilt = 0; // Gamma value from device orientation
let hasOrientationListener = false;
let usingTouchControls = false;
let orientationSamples = 0;
let orientationFallbackTimer = null;
let hasStartedPermissionFlow = false;
let player;
let asteroids = [];
let stars = [];
let frames = 0;
let asteroidSpawnRate = 60; // Spawn an asteroid every X frames
let baseAsteroidSpeed = 4;

// Resize canvas to fill screen
function resize() {
    width = window.visualViewport ? window.visualViewport.width : window.innerWidth;
    height = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    if (player) {
        player.y = height - player.height - Math.max(24, height * 0.06);
        player.x = Math.min(player.x, width - player.width);
    }
}
window.addEventListener('resize', resize);
resize();

// --- Game Entities ---

class Player {
    constructor() {
        this.width = Math.max(36, Math.min(52, width * 0.1));
        this.height = Math.max(52, Math.min(70, height * 0.12));
        this.x = width / 2 - this.width / 2;
        this.y = height - this.height - Math.max(24, height * 0.06);
        this.color = '#0f0'; // Neon green
        this.speed = 0;
    }

    update() {
        // Adjust sensitivity here. Gamma is typically -90 to 90.
        // We map tilt to velocity. A multiplier of 0.6 feels responsive.
        this.speed = tilt * 0.6; 
        this.x += this.speed;

        // Clamp to screen edges
        if (this.x < 0) this.x = 0;
        if (this.x + this.width > width) this.x = width - this.width;
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;
        
        // Draw a simple spaceship shape (triangle)
        ctx.beginPath();
        ctx.moveTo(this.x + this.width / 2, this.y); // Nose
        ctx.lineTo(this.x + this.width, this.y + this.height); // Right wing
        ctx.lineTo(this.x + this.width / 2, this.y + this.height - 15); // Engine indent
        ctx.lineTo(this.x, this.y + this.height); // Left wing
        ctx.closePath();
        ctx.fill();
        
        ctx.shadowBlur = 0; // Reset shadow for other elements
    }
}

class Asteroid {
    constructor(baseSpeed) {
        this.radius = Math.random() * 20 + 15; // Random radius between 15 and 35
        this.x = Math.random() * (width - this.radius * 2) + this.radius;
        this.y = -this.radius;
        // Speed varies slightly but scales with game progression
        this.speed = baseSpeed + Math.random() * 2;
        this.color = '#aaa';
    }

    update() {
        this.y += this.speed;
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 5;
        ctx.shadowColor = '#fff';
        
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Add some craters for texture
        ctx.fillStyle = '#777';
        ctx.beginPath();
        ctx.arc(this.x - this.radius * 0.3, this.y - this.radius * 0.3, this.radius * 0.2, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.shadowBlur = 0;
    }
}

class Star {
    constructor() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.size = Math.random() * 2 + 1;
        this.speed = this.size * 1.5; // Parallax: bigger stars move faster
    }

    update() {
        this.y += this.speed;
        // Reset to top when it goes off screen
        if (this.y > height) {
            this.y = 0;
            this.x = Math.random() * width;
        }
    }

    draw() {
        ctx.fillStyle = '#fff';
        ctx.fillRect(this.x, this.y, this.size, this.size);
    }
}

function init() {
    player = new Player();
    asteroids = [];
    score = 0;
    frames = 0;
    asteroidSpawnRate = 60;
    baseAsteroidSpeed = 4;
    tilt = 0;
    scoreEl.innerText = score;
    
    // Initialize starfield if empty
    if (stars.length === 0) {
        for (let i = 0; i < 100; i++) {
            stars.push(new Star());
        }
    }
}

function setControlStatus(message) {
    if (controlStatusEl) {
        controlStatusEl.innerText = message;
    }
}

function clearOrientationFallbackTimer() {
    if (orientationFallbackTimer) {
        clearTimeout(orientationFallbackTimer);
        orientationFallbackTimer = null;
    }
}

function beginOrientationWatchdog() {
    clearOrientationFallbackTimer();
    orientationFallbackTimer = setTimeout(() => {
        if (orientationSamples === 0) {
            enableTouchControls('No motion sensor data detected. Drag left or right to move. On iPhone, make sure the site is opened over HTTPS and motion access is allowed.');
        }
    }, 1500);
}

function supportsOrientationEvents() {
    return 'DeviceOrientationEvent' in window || 'ondeviceorientation' in window;
}

async function requestSensorPermissionIfNeeded(sensorType) {
    if (typeof sensorType === 'undefined' || typeof sensorType.requestPermission !== 'function') {
        return 'granted';
    }

    return sensorType.requestPermission();
}

async function requestSensorPermissions() {
    const results = await Promise.allSettled([
        requestSensorPermissionIfNeeded(window.DeviceOrientationEvent),
        requestSensorPermissionIfNeeded(window.DeviceMotionEvent)
    ]);

    const denied = results.some((result) => result.status === 'fulfilled' && result.value === 'denied');
    const granted = results.some((result) => result.status === 'fulfilled' && result.value === 'granted');

    if (denied && !granted) {
        return 'denied';
    }

    if (granted) {
        return 'granted';
    }

    return 'granted';
}

// --- Collision Detection ---

// Circle (Asteroid) to Rectangle (Player) collision
function checkCollision(rect, circle) {
    // Find the closest point to the circle within the rectangle
    let closestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.width));
    let closestY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.height));

    // Calculate the distance between the circle's center and this closest point
    let distanceX = circle.x - closestX;
    let distanceY = circle.y - closestY;

    // If the distance is less than the circle's radius, an intersection occurs
    let distanceSquared = (distanceX * distanceX) + (distanceY * distanceY);
    return distanceSquared < (circle.radius * circle.radius);
}

// --- Main Game Loop ---

function update() {
    if (!isPlaying) return;

    // Clear canvas
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);

    // Update & Draw Stars (Background)
    stars.forEach(star => {
        star.update();
        star.draw();
    });

    // Update & Draw Player
    player.update();
    player.draw();

    // Handle Asteroids
    frames++;
    if (frames % asteroidSpawnRate === 0) {
        asteroids.push(new Asteroid(baseAsteroidSpeed));
        
        // Increase difficulty over time
        if (asteroidSpawnRate > 15) {
            asteroidSpawnRate -= 1; // Spawn faster
        }
        baseAsteroidSpeed += 0.05; // Move faster
    }

    for (let i = asteroids.length - 1; i >= 0; i--) {
        let a = asteroids[i];
        a.update();
        a.draw();

        // Check Collision
        if (checkCollision(player, a)) {
            gameOver();
            return; // Stop updating this frame
        }

        // Check if asteroid passed the player (dodged successfully)
        if (a.y - a.radius > height) {
            asteroids.splice(i, 1);
            score++;
            scoreEl.innerText = score;
        }
    }

    animationId = requestAnimationFrame(update);
}

function gameOver() {
    isPlaying = false;
    cancelAnimationFrame(animationId);
    finalScoreEl.innerText = score;
    gameOverScreen.classList.remove('hidden');
}

// --- Controls & Permissions ---

function handleOrientation(event) {
    // gamma is the left-to-right tilt in degrees, where right is positive
    let gamma = event.gamma; 

    if (typeof gamma !== 'number') {
        return;
    }
    
    // Handle edge cases (e.g., device is upside down or flat)
    if (gamma > 90) gamma = 90;
    if (gamma < -90) gamma = -90;

    orientationSamples += 1;
    clearOrientationFallbackTimer();

    if (!usingTouchControls) {
        setControlStatus('Tilt controls online. Tilt your device to steer.');
    }

    tilt = gamma;
}

function enableOrientationControls() {
    if (!hasOrientationListener) {
        window.addEventListener('deviceorientation', handleOrientation);
        window.addEventListener('deviceorientationabsolute', handleOrientation);
        hasOrientationListener = true;
    }
    orientationSamples = 0;
    usingTouchControls = false;
    setControlStatus('Checking motion sensor...');
    beginOrientationWatchdog();
}

function enableTouchControls(statusMessage = 'Touch steering active. Drag left or right to move.') {
    clearOrientationFallbackTimer();
    usingTouchControls = true;
    setControlStatus(statusMessage);
}

function updateTouchTilt(clientX) {
    const normalized = ((clientX / width) - 0.5) * 2;
    tilt = normalized * 45;
}

function handlePointerMove(event) {
    if (!usingTouchControls || !isPlaying) {
        return;
    }

    updateTouchTilt(event.clientX);
}

function handlePointerDown(event) {
    if (!usingTouchControls) {
        return;
    }

    updateTouchTilt(event.clientX);
}

function handleTouchStart(event) {
    if (!usingTouchControls || event.touches.length === 0) {
        return;
    }

    event.preventDefault();
    updateTouchTilt(event.touches[0].clientX);
}

function handleTouchMove(event) {
    if (!usingTouchControls || !isPlaying || event.touches.length === 0) {
        return;
    }

    event.preventDefault();
    updateTouchTilt(event.touches[0].clientX);
}

function requestAccessAndStart() {
    if (hasStartedPermissionFlow) {
        return;
    }

    hasStartedPermissionFlow = true;

    if (!isPlaying) {
        startGame();
    }

    if (!window.isSecureContext) {
        enableTouchControls('Motion sensors are blocked here. Drag left or right to move. For tilt controls, open the game over HTTPS or localhost.');
        hasStartedPermissionFlow = false;
        return;
    }

    requestSensorPermissions()
        .then((permissionState) => {
            if (permissionState === 'granted' && supportsOrientationEvents()) {
                enableOrientationControls();
            } else if (supportsOrientationEvents()) {
                enableTouchControls('Motion access was denied. Drag left or right to move.');
            } else {
                enableTouchControls('This browser is not exposing tilt data. Drag left or right to move.');
            }
        })
        .catch(() => {
            if (supportsOrientationEvents()) {
                enableTouchControls('Sensor permission failed. Drag left or right to move.');
            } else {
                enableTouchControls('This browser is not exposing tilt data. Drag left or right to move.');
            }
        })
        .finally(() => {
            hasStartedPermissionFlow = false;
        });
}

function startGame() {
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    init();
    isPlaying = true;
    update();
}

// --- Event Listeners ---

startBtn.addEventListener('click', requestAccessAndStart);
restartBtn.addEventListener('click', startGame);
startBtn.addEventListener('pointerup', requestAccessAndStart);
restartBtn.addEventListener('pointerup', startGame);
startBtn.addEventListener('touchend', requestAccessAndStart, { passive: true });
restartBtn.addEventListener('touchend', startGame, { passive: true });
window.addEventListener('pointerdown', handlePointerDown, { passive: true });
window.addEventListener('pointermove', handlePointerMove, { passive: true });
window.addEventListener('touchstart', handleTouchStart, { passive: false });
window.addEventListener('touchmove', handleTouchMove, { passive: false });

// Draw initial background before game starts
ctx.fillStyle = '#000';
ctx.fillRect(0, 0, width, height);

if (supportsOrientationEvents()) {
    if (window.isSecureContext) {
        setControlStatus('Tilt available. Tap start to check the motion sensor.');
    } else {
        enableTouchControls('Motion sensors are unavailable here. Drag left or right to move. For tilt controls, open the game over HTTPS or localhost.');
    }
} else {
    enableTouchControls('This device has no motion sensor support. Drag left or right to move.');
}
