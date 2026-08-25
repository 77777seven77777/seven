// DOM Elements
const wrapper = document.getElementById('game-wrapper');
const cursor = document.getElementById('custom-cursor');
const targetsContainer = document.getElementById('targets-container');
const particlesContainer = document.getElementById('particles-container');
const centerSeven = document.getElementById('center-seven');
const scoreEl = document.getElementById('score');
const auraEl = document.getElementById('aura');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const finalScoreEl = document.getElementById('final-score');
const rankDisplay = document.getElementById('rank-display');
const tutorialTarget = document.getElementById('tutorial-target');
const restartBtn = document.getElementById('restart-btn');

// Game State
let isPlaying = false;
let score = 0;
let aura = 100;
let targets = [];
let animationId;
let lastSpawn = 0;

// Difficulty scaling
let spawnRate = 1200; // MS between spawns
let targetSpeed = 1.5; // Pixels per frame

// 1. CUSTOM CROSSHAIR LOGIC
document.addEventListener('mousemove', (e) => {
    cursor.style.left = e.clientX + 'px';
    cursor.style.top = e.clientY + 'px';
});

// 2. START THE GAME (TUTORIAL CLICK)
tutorialTarget.addEventListener('mousedown', (e) => {
    createExplosion(e.clientX, e.clientY);
    startScreen.classList.add('hidden');
    startGame();
});

restartBtn.addEventListener('click', () => {
    gameOverScreen.classList.add('hidden');
    startGame();
});

function startGame() {
    // Reset stats
    isPlaying = true;
    score = 0;
    aura = 100;
    spawnRate = 1200;
    targetSpeed = 1.5;
    targetsContainer.innerHTML = '';
    targets = [];
    updateUI();
    
    // Start Loop
    lastSpawn = performance.now();
    animationId = requestAnimationFrame(gameLoop);
}

// 3. MAIN GAME LOOP
function gameLoop(timestamp) {
    if (!isPlaying) return;

    // Spawn new target logic
    if (timestamp - lastSpawn > spawnRate) {
        spawnTarget();
        lastSpawn = timestamp;
        // The game gets harder over time
        spawnRate = Math.max(400, spawnRate - 15);
        targetSpeed += 0.02;
    }

    // Move existing targets
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const coreRadius = 60; // hitbox of the "7"

    for (let i = targets.length - 1; i >= 0; i--) {
        let t = targets[i];
        
        // Math to move towards center
        let dx = centerX - t.x;
        let dy = centerY - t.y;
        let dist = Math.sqrt(dx * dx + dy * dy);

        // Check Collision with the center "7"
        if (dist < coreRadius) {
            takeDamage();
            t.element.remove();
            targets.splice(i, 1);
            continue;
        }

        // Move target
        let moveX = (dx / dist) * targetSpeed;
        let moveY = (dy / dist) * targetSpeed;
        t.x += moveX;
        t.y += moveY;
        
        t.element.style.left = t.x + 'px';
        t.element.style.top = t.y + 'px';
    }

    animationId = requestAnimationFrame(gameLoop);
}

// 4. SPAWN TARGET
function spawnTarget() {
    const el = document.createElement('div');
    el.className = 'target';
    
    // Spawn randomly on the edges of the screen
    let side = Math.floor(Math.random() * 4);
    let startX, startY;
    
    if (side === 0) { startX = Math.random() * window.innerWidth; startY = -50; } // Top
    else if (side === 1) { startX = window.innerWidth + 50; startY = Math.random() * window.innerHeight; } // Right
    else if (side === 2) { startX = Math.random() * window.innerWidth; startY = window.innerHeight + 50; } // Bottom
    else { startX = -50; startY = Math.random() * window.innerHeight; } // Left

    el.style.left = startX + 'px';
    el.style.top = startY + 'px';

    // Click to destroy logic (UX folle)
    el.addEventListener('mousedown', (e) => {
        if (!isPlaying) return;
        createExplosion(e.clientX, e.clientY);
        score += 1;
        updateUI();
        el.remove();
        // Remove from array
        targets = targets.filter(t => t.element !== el);
    });

    targetsContainer.appendChild(el);
    targets.push({ element: el, x: startX, y: startY });
}

// 5. GAME FEEL : EXPLOSIONS & DAMAGE
function createExplosion(x, y) {
    for (let i = 0; i < 8; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        p.style.left = x + 'px';
        p.style.top = y + 'px';
        particlesContainer.appendChild(p);

        // Random trajectory
        let angle = Math.random() * Math.PI * 2;
        let velocity = Math.random() * 60 + 20;
        let destX = x + Math.cos(angle) * velocity;
        let destY = y + Math.sin(angle) * velocity;

        p.animate([
            { transform: `translate(-50%, -50%) scale(1)`, opacity: 1, left: x + 'px', top: y + 'px' },
            { transform: `translate(-50%, -50%) scale(0)`, opacity: 0, left: destX + 'px', top: destY + 'px' }
        ], {
            duration: 400,
            easing: 'cubic-bezier(0.25, 1, 0.5, 1)'
        }).onfinish = () => p.remove();
    }
}

function takeDamage() {
    aura -= 10;
    updateUI();
    
    // Screen shake
    wrapper.classList.remove('shake');
    void wrapper.offsetWidth; // trigger reflow
    wrapper.classList.add('shake');
    
    // Core damage flash
    centerSeven.classList.add('damage-flash');
    setTimeout(() => centerSeven.classList.remove('damage-flash'), 200);

    if (aura <= 0) {
        gameOver();
    }
}

function updateUI() {
    scoreEl.innerText = score;
    auraEl.innerText = Math.max(0, aura);
}

// 6. ENDING THE GAME & LORE RANKS
function gameOver() {
    isPlaying = false;
    cancelAnimationFrame(animationId);
    
    finalScoreEl.innerText = score;
    
    // The Ego-Trip Ranking System
    let rank = "Mortal Aim (Pathetic)";
    let rankColor = "#4a4e69";
    
    if (score > 15) { rank = "Decent for a Human"; }
    if (score > 35) { rank = "Pro Player (Still not 7)"; rankColor = "#0984e3"; }
    if (score > 60) { rank = "Aura Awakened"; rankColor = "#6c5ce7"; }
    if (score > 100) { rank = "SEVEN Level (Almost)"; rankColor = "#d63031"; }

    rankDisplay.innerText = rank;
    rankDisplay.style.color = rankColor;
    
    gameOverScreen.classList.remove('hidden');
}
