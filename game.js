// --- DOM ELEMENTS ---
const wrapper = document.getElementById('game-wrapper');
const cursor = document.getElementById('custom-cursor');
const hitmarker = document.getElementById('hitmarker');
const targetsContainer = document.getElementById('targets-container');
const particlesContainer = document.getElementById('particles-container');
const centerSeven = document.getElementById('center-seven');
const scoreEl = document.getElementById('score');
const comboEl = document.getElementById('combo');
const comboBox = document.getElementById('combo-box');
const accuracyEl = document.getElementById('accuracy');
const auraEl = document.getElementById('aura');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const rankDisplay = document.getElementById('rank-display');
const tauntDisplay = document.getElementById('taunt-display');

// --- GAME STATE ---
let isPlaying = false;
let score = 0, combo = 1, maxCombo = 1;
let shots = 0, hits = 0, accuracy = 100, aura = 100;
let targets = [];
let animationId, lastSpawn = 0;
let spawnRate = 1200, targetBaseSpeed = 1.2;

const TAUNTS = [
    "Are you playing with a steering wheel?",
    "My algorithm aims better while sleeping.",
    "Please plug in your mouse.",
    "Spamming won't save you.",
    "Is this your first time using a PC?"
];

// --- AUDIO ENGINE (WEB AUDIO API) ---
let audioCtx;
function initAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playSound(type) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);

    if (type === 'shoot') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start(); osc.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'hit') {
        osc.type = 'highpass'; // Tick sound
        osc.frequency.setValueAtTime(800, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.05);
        osc.start(); osc.stop(audioCtx.currentTime + 0.05);
    } else if (type === 'shatter') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(600, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        osc.start(); osc.stop(audioCtx.currentTime + 0.2);
    }
}

// --- CROSSHAIR & HOVER LOGIC ---
document.addEventListener('mousemove', (e) => {
    cursor.style.left = e.clientX + 'px';
    cursor.style.top = e.clientY + 'px';
    
    // Smart Crosshair
    if (e.target.closest('.target')) cursor.classList.add('cursor-hover');
    else cursor.classList.remove('cursor-hover');
});

// --- FREE FIRE LOGIC (The Core Mechanic) ---
document.addEventListener('mousedown', (e) => {
    if (!isPlaying) return;
    if (e.target.closest('.btn-glass')) return; // Don't shoot UI buttons

    initAudio();
    shots++;
    
    // Recoil Animation
    cursor.classList.add('cursor-shoot');
    setTimeout(() => cursor.classList.remove('cursor-shoot'), 50);

    const targetEl = e.target.closest('.target');
    
    if (targetEl) {
        // IT'S A HIT!
        playHitmarker();
        playSound('hit');
        hits++;
        handleHit(targetEl);
    } else {
        // IT'S A MISS. (Punishment)
        playSound('shoot');
        combo = 1; // Break combo
        updateUI();
        checkTaunts();
    }
});

function playHitmarker() {
    hitmarker.classList.add('hit-active');
    setTimeout(() => hitmarker.classList.remove('hit-active'), 100);
}

function handleHit(targetEl) {
    let t = targets.find(obj => obj.element === targetEl);
    if (!t) return;

    if (t.type === 'armored') {
        t.hp--;
        if (t.hp > 0) {
            targetEl.style.transform = `translate(-50%, -50%) scale(${0.8 + (t.hp*0.1)})`;
            return; // Doesn't die yet
        }
    }

    // Kill target
    playSound('shatter');
    createGlassParticles(t.x, t.y, t.type);
    
    // Math logic
    score += (t.type === 'flick' ? 50 : (t.type === 'armored' ? 30 : 10)) * combo;
    combo = Math.min(7, combo + 1);
    if (combo > maxCombo) maxCombo = combo;
    
    t.element.remove();
    targets = targets.filter(obj => obj.element !== targetEl);
    updateUI();
}

// --- GAME LOOP & SPAWNING ---
document.getElementById('start-btn').addEventListener('click', () => {
    initAudio();
    startScreen.classList.add('hidden');
    startGame();
});

document.getElementById('restart-btn').addEventListener('click', () => {
    gameOverScreen.classList.add('hidden');
    startGame();
});

function startGame() {
    isPlaying = true;
    score = 0; combo = 1; maxCombo = 1;
    shots = 0; hits = 0; accuracy = 100; aura = 100;
    spawnRate = 1200; targetBaseSpeed = 1.2;
    targetsContainer.innerHTML = '';
    targets = []; tauntDisplay.innerText = '';
    updateUI();
    
    lastSpawn = performance.now();
    animationId = requestAnimationFrame(gameLoop);
}

function gameLoop(timestamp) {
    if (!isPlaying) return;

    if (timestamp - lastSpawn > spawnRate) {
        spawnTarget();
        lastSpawn = timestamp;
        spawnRate = Math.max(350, spawnRate - 12);
        targetBaseSpeed += 0.015;
    }

    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const coreRadius = 70;

    for (let i = targets.length - 1; i >= 0; i--) {
        let t = targets[i];
        
        if (t.type === 'flick') {
            if (timestamp - t.spawnTime > 1200) { // Flick disappears fast
                t.element.remove();
                targets.splice(i, 1);
                continue;
            }
        } else {
            let dx = centerX - t.x;
            let dy = centerY - t.y;
            let dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < coreRadius) {
                takeDamage(t.type === 'armored' ? 20 : 10);
                t.element.remove();
                targets.splice(i, 1);
                continue;
            }

            let moveX = (dx / dist) * t.speed;
            let moveY = (dy / dist) * t.speed;
            t.x += moveX; t.y += moveY;
            t.element.style.left = t.x + 'px'; t.element.style.top = t.y + 'px';
        }
    }

    animationId = requestAnimationFrame(gameLoop);
}

function spawnTarget() {
    const el = document.createElement('div');
    
    // RNG Type
    let rand = Math.random();
    let type = 'normal'; let hp = 1; let speedMult = 1;
    
    if (rand > 0.90) { type = 'flick'; } // 10% Flick
    else if (rand > 0.75) { type = 'armored'; hp = 3; speedMult = 0.6; } // 15% Armored

    el.className = `target target-${type}`;
    
    let side = Math.floor(Math.random() * 4);
    let startX, startY;
    
    if (type === 'flick') {
        startX = Math.random() * (window.innerWidth - 200) + 100;
        startY = Math.random() * (window.innerHeight - 200) + 100;
    } else {
        if (side === 0) { startX = Math.random() * window.innerWidth; startY = -50; }
        else if (side === 1) { startX = window.innerWidth + 50; startY = Math.random() * window.innerHeight; }
        else if (side === 2) { startX = Math.random() * window.innerWidth; startY = window.innerHeight + 50; }
        else { startX = -50; startY = Math.random() * window.innerHeight; }
    }

    el.style.left = startX + 'px'; el.style.top = startY + 'px';
    targetsContainer.appendChild(el);
    targets.push({ element: el, type: type, hp: hp, speed: targetBaseSpeed * speedMult, x: startX, y: startY, spawnTime: performance.now() });
}

// --- PARTICLES & DAMAGE ---
function createGlassParticles(x, y, type) {
    let color = type === 'armored' ? '#fde047' : (type === 'flick' ? '#c084fc' : '#fff');
    for (let i = 0; i < 6; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        p.style.width = (Math.random() * 10 + 5) + 'px';
        p.style.height = (Math.random() * 10 + 5) + 'px';
        p.style.background = color;
        particlesContainer.appendChild(p);

        let angle = Math.random() * Math.PI * 2;
        let vel = Math.random() * 80 + 30;
        
        p.animate([
            { transform: `translate(-50%, -50%) rotate(0deg)`, opacity: 1, left: x + 'px', top: y + 'px' },
            { transform: `translate(-50%, -50%) rotate(${Math.random()*360}deg)`, opacity: 0, left: x + (Math.cos(angle)*vel) + 'px', top: y + (Math.sin(angle)*vel) + 100 + 'px' }
        ], { duration: 600, easing: 'cubic-bezier(0.25, 1, 0.5, 1)' }).onfinish = () => p.remove();
    }
}

function takeDamage(amount) {
    aura -= amount;
    combo = 1; // Damage breaks combo
    updateUI();
    
    wrapper.classList.remove('shake'); void wrapper.offsetWidth; wrapper.classList.add('shake');
    centerSeven.classList.add('damage-flash'); setTimeout(() => centerSeven.classList.remove('damage-flash'), 200);

    if (aura <= 0) gameOver();
}

// --- UI UPDATES & TAUNTS ---
function updateUI() {
    scoreEl.innerText = score;
    comboEl.innerText = `x${combo}`;
    auraEl.innerText = Math.max(0, aura);
    
    accuracy = shots === 0 ? 100 : Math.round((hits / shots) * 100);
    accuracyEl.innerText = accuracy;
    accuracyEl.style.color = accuracy < 50 ? '#ef4444' : '#fff';

    // Seven Aura Evolution based on Combo
    centerSeven.className = 'glass-panel';
    comboBox.className = 'glass-panel stat-box';
    if (combo >= 3 && combo < 7) { centerSeven.classList.add('seven-glow-1'); comboBox.classList.add('combo-active'); }
    if (combo === 7) { centerSeven.classList.add('seven-glow-max'); comboBox.classList.add('combo-max'); }
}

function checkTaunts() {
    if (shots > 10 && accuracy < 40 && Math.random() > 0.7) {
        tauntDisplay.innerText = TAUNTS[Math.floor(Math.random() * TAUNTS.length)];
        setTimeout(() => tauntDisplay.innerText = '', 2000);
    }
}

// --- GAME OVER ---
function gameOver() {
    isPlaying = false; cancelAnimationFrame(animationId);
    
    document.getElementById('final-score').innerText = score;
    document.getElementById('final-accuracy').innerText = accuracy;
    document.getElementById('final-combo').innerText = `x${maxCombo}`;
    
    let rank = "Spammer (Accuracy too low)"; let rankColor = "#64748b";
    
    if (accuracy >= 50 && score > 200) { rank = "Decent Aim"; rankColor = "#38bdf8"; }
    if (accuracy >= 75 && score > 500) { rank = "Flickshot Master"; rankColor = "#a855f7"; }
    if (accuracy >= 90 && score > 1000) { rank = "SEVEN Level"; rankColor = "#fbbf24"; }

    rankDisplay.innerText = rank; rankDisplay.style.color = rankColor;
    gameOverScreen.classList.remove('hidden');
}
