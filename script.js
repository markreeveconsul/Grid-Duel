const cells = document.querySelectorAll("#board .cell");
const statusText = document.getElementById("status");
const restartButton = document.getElementById("restart");
const resetScoreButton = document.getElementById("resetScore");
const modeTabs = document.querySelectorAll("#modeTabs .tab");
const difficultyTabs = document.querySelectorAll("#difficultyTabs .tab");
const difficultyTabsWrap = document.getElementById("difficultyTabs");
const tensionSegments = document.querySelectorAll("#tensionMeter .segment");
const boardEl = document.getElementById("board");
const winLine = document.getElementById("winLine");
const scoreXEl = document.getElementById("scoreX");
const scoreOEl = document.getElementById("scoreO");
const fxFlash = document.getElementById("fxFlash");
const fxStamp = document.getElementById("fxStamp");
const fxLayer = document.getElementById("fx");
const embersEl = document.getElementById("embers");
const smokeEl = document.getElementById("smoke");
const tensionMeterEl = document.getElementById("tensionMeter");
const arenaEl = document.querySelector(".arena");
const lightningEl = document.getElementById("lightning");
const boltSvg = document.getElementById("boltSvg");
const boltOutline = document.getElementById("boltOutline");
const boltPath = document.getElementById("boltPath");
const boltBranch1 = document.getElementById("boltBranch1");
const boltBranch2 = document.getElementById("boltBranch2");
const countdownOverlay = document.getElementById("countdownOverlay");
const countdownNumberEl = document.getElementById("countdownNumber");

const HUMAN = "X"; // in "Player vs AI" mode, the human always plays X
const TEAM_COLOR = { X: "#2FB8FF", O: "#FF7A45" };

// Restarts a CSS animation by clearing the class, forcing a synchronous layout
// flush, then re-adding it. getBoundingClientRect() is used instead of
// offsetWidth because offsetWidth is an HTMLElement property and returns
// undefined on SVG elements (which would silently skip the reflow).
function restartAnimation(el, className) {
    el.classList.remove(className);
    void el.getBoundingClientRect().width;
    el.classList.add(className);
}

let gameMode = "pvc";       // "pvc" | "pvp" | "cvc"
let difficulty = "medium";  // "easy" | "medium" | "hard"
let currentPlayer = "X";
let gameActive = true;
let moveCount = 0;
const scores = new GridRules.ScoreBoard();

let board = ["", "", "", "", "", "", "", "", ""];

const winningPatterns = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
];

const X_MARK = `<svg class="mark-svg" viewBox="0 0 100 100">
  <line class="stroke stroke-1" x1="22" y1="22" x2="78" y2="78"></line>
  <line class="stroke stroke-2" x1="78" y1="22" x2="22" y2="78"></line>
</svg>`;

const O_MARK = `<svg class="mark-svg" viewBox="0 0 100 100">
  <circle class="stroke stroke-o" cx="50" cy="50" r="32"></circle>
</svg>`;


// ---------- Cell layers ----------
// Each cell holds two independent layers so lightning cracks persist
// regardless of the X/O mark being drawn or cleared on top of them.

const markSlots = [];
const crackSlots = [];

cells.forEach(cell => {
    const markSlot = document.createElement("span");
    markSlot.className = "mark-slot";

    const crackSlot = document.createElement("span");
    crackSlot.className = "crack-slot";

    cell.append(crackSlot, markSlot);

    markSlots.push(markSlot);
    crackSlots.push(crackSlot);
});


// ---------- Embers (rise below the board, intensity set by tension tier) ----------

function initEmbers() {
    const EMBER_COUNT = 16;

    for (let i = 0; i < EMBER_COUNT; i++) {
        const ember = document.createElement("span");
        ember.className = "ember";

        ember.style.setProperty("--left", Math.random() * 100 + "%");
        ember.style.setProperty("--dur", (1.3 + Math.random() * 1.1).toFixed(2) + "s");
        ember.style.setProperty("--delay", (Math.random() * 2).toFixed(2) + "s");
        ember.style.background = Math.random() < 0.5 ? "var(--o)" : "var(--danger)";

        embersEl.appendChild(ember);
    }
}
initEmbers();


// ---------- Smoke (drifts up alongside the embers once tension is high) ----------

function initSmoke() {
    const PUFF_COUNT = 12;

    for (let i = 0; i < PUFF_COUNT; i++) {
        const puff = document.createElement("span");
        puff.className = "puff";

        puff.style.setProperty("--left", Math.random() * 100 + "%");
        puff.style.setProperty("--dur", (2.2 + Math.random() * 1.6).toFixed(2) + "s");
        puff.style.setProperty("--delay", (Math.random() * 2.5).toFixed(2) + "s");
        puff.style.setProperty("--drift", (Math.random() * 40 - 20).toFixed(0) + "px");

        smokeEl.appendChild(puff);
    }
}
initSmoke();


// ---------- Background grain texture (self-contained, no image requests) ----------

function generateNoiseTexture() {
    const size = 96;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext("2d");
    const imageData = ctx.createImageData(size, size);

    for (let i = 0; i < imageData.data.length; i += 4) {
        const shade = 190 + Math.random() * 65;
        imageData.data[i] = shade;
        imageData.data[i + 1] = shade;
        imageData.data[i + 2] = shade;
        imageData.data[i + 3] = Math.random() * 30;
    }

    ctx.putImageData(imageData, 0, 0);
    document.documentElement.style.setProperty("--noise-texture", `url(${canvas.toDataURL()})`);
}
generateNoiseTexture();


// ---------- Lava crust texture (procedural, not a repeating stripe pattern) ----------
// Painted once as scattered organic hot-spots under irregular dark rock
// plates, so it reads as broken molten crust rather than a geometric motif.

function generateLavaTexture() {
    const size = 180;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");

    // Cooled rock base
    ctx.fillStyle = "#170701";
    ctx.fillRect(0, 0, size, size);

    // Scattered molten hot-spots glowing up through the rock
    for (let i = 0; i < 30; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const r = 7 + Math.random() * 17;
        const warm = Math.random() < 0.5 ? "255,122,69" : "255,201,61";

        const glow = ctx.createRadialGradient(x, y, 0, x, y, r);
        glow.addColorStop(0, `rgba(${warm}, 0.95)`);
        glow.addColorStop(0.55, `rgba(${warm}, 0.4)`);
        glow.addColorStop(1, "rgba(255,122,69,0)");

        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * (0.55 + Math.random() * 0.6), Math.random() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }

    // Irregular dark crust plates fracturing the glow into veins rather than blobs
    ctx.fillStyle = "rgba(9, 3, 1, 0.62)";
    for (let i = 0; i < 16; i++) {
        const cx = Math.random() * size;
        const cy = Math.random() * size;
        const points = 5 + Math.floor(Math.random() * 3);

        ctx.beginPath();
        for (let p = 0; p < points; p++) {
            const angle = (p / points) * Math.PI * 2 + Math.random() * 0.6;
            const radius = 9 + Math.random() * 16;
            const px = cx + Math.cos(angle) * radius;
            const py = cy + Math.sin(angle) * radius;
            p === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
    }

    // Branched incandescent veins under the cooled rock plates.
    for (let vein=0; vein<9; vein++) {
        let x=Math.random()*size, y=Math.random()*size;
        ctx.beginPath(); ctx.moveTo(x,y);
        for(let step=0;step<6;step++) {
            x+=(Math.random()-.5)*40; y+=(Math.random()-.4)*30;
            ctx.lineTo(x,y);
        }
        ctx.lineWidth=5; ctx.strokeStyle='rgba(255,71,12,.7)';
        ctx.shadowColor='#ff680b'; ctx.shadowBlur=8; ctx.stroke();
        ctx.lineWidth=1.2; ctx.strokeStyle='rgba(255,217,111,.85)'; ctx.stroke();
    }
    ctx.shadowBlur=0;
    // Fine grain so it doesn't read as flat vector shapes
    const imageData = ctx.getImageData(0, 0, size, size);
    for (let i = 0; i < imageData.data.length; i += 4) {
        if (Math.random() < 0.12) {
            const n = (Math.random() - 0.5) * 26;
            imageData.data[i] = Math.min(255, Math.max(0, imageData.data[i] + n));
            imageData.data[i + 1] = Math.min(255, Math.max(0, imageData.data[i + 1] + n));
            imageData.data[i + 2] = Math.min(255, Math.max(0, imageData.data[i + 2] + n));
        }
    }
    ctx.putImageData(imageData, 0, 0);

    document.documentElement.style.setProperty("--lava-texture", `url(${canvas.toDataURL()})`);
}
generateLavaTexture();


// ---------- Pixel-dissolve stamp canvas ("X WINS" / "DRAW") ----------

const STAMP_W = 300;
const STAMP_H = 90;
const dpr = window.devicePixelRatio || 1;

fxStamp.style.width = STAMP_W + "px";
fxStamp.style.height = STAMP_H + "px";
fxStamp.width = STAMP_W * dpr;
fxStamp.height = STAMP_H * dpr;

const stampCtx = fxStamp.getContext("2d");
stampCtx.scale(dpr, dpr);

let dissolveTimer = null;
let dissolveFrame = null;

function playStamp(text, color) {
    clearTimeout(dissolveTimer);
    if (dissolveFrame) cancelAnimationFrame(dissolveFrame);

    stampCtx.clearRect(0, 0, STAMP_W, STAMP_H);
    stampCtx.font = "700 44px 'Rajdhani', sans-serif";
    stampCtx.textAlign = "center";
    stampCtx.textBaseline = "middle";
    stampCtx.shadowColor = color;
    stampCtx.shadowBlur = 18;
    stampCtx.fillStyle = color;
    stampCtx.fillText(text.toUpperCase(), STAMP_W / 2, STAMP_H / 2);

    fxStamp.classList.remove("play");
    void fxStamp.offsetWidth;
    fxStamp.classList.add("play");

    dissolveTimer = setTimeout(dissolveStamp, 950);
}

function dissolveStamp() {
    const blockSize = 7;
    const cols = Math.ceil(STAMP_W / blockSize);
    const rows = Math.ceil(STAMP_H / blockSize);

    const blocks = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            blocks.push([c * blockSize, r * blockSize]);
        }
    }

    // Shuffle so the vanish reads as random pixel decay, not a wipe
    for (let i = blocks.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
    }

    const totalFrames = 34;
    const perFrame = Math.ceil(blocks.length / totalFrames);
    let frame = 0;

    function step() {
        const start = frame * perFrame;
        blocks.slice(start, start + perFrame).forEach(([x, y]) => {
            stampCtx.clearRect(x, y, blockSize, blockSize);
        });

        frame++;
        if (start + perFrame < blocks.length) {
            dissolveFrame = requestAnimationFrame(step);
        }
    }

    dissolveFrame = requestAnimationFrame(step);
}

function clearStamp() {
    clearTimeout(dissolveTimer);
    if (dissolveFrame) cancelAnimationFrame(dissolveFrame);
    stampCtx.clearRect(0, 0, STAMP_W, STAMP_H);
    fxStamp.classList.remove("play");
}


// ---------- Rules, matches, and turn ownership ----------
let ruleset = 'classic';
let roundStarter = 'X';
let roundNumber = 1;
let matchComplete = false;
let roundResults = [];
let state = GridRules.create();
let aiTimer = null;
let revision = 0;
let effectsLevel = 'vivid';
let vividEffects = true;
let soundEnabled = false;
let audioContext = null;
const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');

function isHumanControlled(player) {
    return gameMode === 'pvp' || (gameMode === 'pvc' && player === HUMAN);
}
function selectButtons(buttons, value, field) {
    buttons.forEach(button => {
        const selected = button.dataset[field] === value;
        button.classList.toggle('active', selected);
        button.setAttribute('aria-pressed', String(selected));
    });
}
modeTabs.forEach(button => button.addEventListener('click', () => {
    if (gameMode === button.dataset.mode) return;
    gameMode = button.dataset.mode;
    selectButtons(modeTabs, gameMode, 'mode');
    document.getElementById('difficultySection').hidden = gameMode === 'pvp';
    newMatch();
}));
difficultyTabs.forEach(button => button.addEventListener('click', () => {
    if (difficulty === button.dataset.difficulty) return;
    difficulty = button.dataset.difficulty;
    selectButtons(difficultyTabs, difficulty, 'difficulty');
    newMatch();
}));
const ruleTabs = document.querySelectorAll('[data-rule]');
ruleTabs.forEach(button => button.addEventListener('click', () => {
    if (ruleset === button.dataset.rule) return;
    ruleset = button.dataset.rule;
    selectButtons(ruleTabs, ruleset, 'rule');
    document.getElementById('ruleHelp').textContent = ruleset === 'classic'
        ? 'Connect three marks in a row, column, or diagonal. First to three round wins takes the match.'
        : 'Only three marks per player. Place a fourth and your oldest disappears. Build a line with the three that remain.';
    document.getElementById('ruleBadge').textContent = ruleset === 'classic' ? 'CLASSIC / 3 × 3' : 'VANISHING / 3 MARKS';
    newMatch();
}));
cells.forEach((cell,index) => {
    cell.addEventListener('click', () => {
        if (isHumanControlled(currentPlayer)) makeMove(index,currentPlayer);
    });
    cell.addEventListener('keydown', event => {
        const shifts = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -3, ArrowDown: 3 };
        if (!(event.key in shifts)) return;
        event.preventDefault();
        const row = Math.floor(index / 3), col = index % 3;
        const next = event.key === 'ArrowLeft' ? row*3+(col+2)%3 : event.key === 'ArrowRight' ? row*3+(col+1)%3 : (index+shifts[event.key]+9)%9;
        cells[next].focus();
    });
});
function renderMark(cell,player) {
    markSlots[Number(cell.dataset.index)].innerHTML = player === 'X' ? X_MARK : O_MARK;
}
function renderBoard(previous = []) {
    cells.forEach((cell,i) => {
        if (previous[i] !== board[i]) {
            markSlots[i].innerHTML = '';
            if (board[i]) renderMark(cell,board[i]);
            cell.classList.toggle('vanished', Boolean(previous[i] && !board[i]));
        }
        cell.classList.toggle('mark-x',board[i] === 'X');
        cell.classList.toggle('mark-o',board[i] === 'O');
        const expiring = ruleset === 'vanish' && gameActive && board[i] && state.queues[board[i]].length === 3 && state.queues[board[i]][0] === i;
        cell.classList.toggle('expiring',Boolean(expiring));
        cell.classList.toggle('last-move',i === state.queues[currentPlayer === 'X' ? 'O' : 'X'].at(-1));
        // aria-disabled keeps every tile available to keyboard navigation.
        cell.disabled = false;
        cell.setAttribute('aria-disabled',String(Boolean(board[i]) || !gameActive || !isHumanControlled(currentPlayer)));
        cell.setAttribute('aria-label','Row '+(Math.floor(i/3)+1)+', column '+(i%3+1)+', '+(board[i] || 'empty')+(expiring ? ', next to vanish for '+board[i] : ''));
    });
    boardEl.setAttribute('aria-busy',String(gameActive && !isHumanControlled(currentPlayer)));
}
function makeMove(index,player) {
    if (!gameActive || player !== currentPlayer) return;
    const next = GridRules.play(state,index);
    if (!next) return;
    const previous = board;
    state = next;
    board = state.board;
    moveCount = state.moves;
    currentPlayer = state.turn;
    sound('move',player);
    if (state.winner || state.draw) {
        gameActive = false;
        clearTimeout(aiTimer);
        aiTimer = null;
        if (state.winner) {
            scores.addWin(player);
            matchComplete = scores[player] === 3;
            drawWinLine(state.line);
            cells.forEach((cell,i) => cell.classList.toggle('winning',state.line.includes(i)));
            statusText.textContent = matchComplete ? playerName(player)+(gameMode === 'pvc' && player === HUMAN ? ' take the match!' : ' takes the match!') : winMessage(player);
            statusText.className = 'status turn-'+player.toLowerCase();
            triggerWinEffects(player,state.line);
            sound('win',player);
        } else {
            statusText.textContent = 'Round drawn';
            statusText.className = 'status';
            triggerDrawEffect();
            sound('draw');
        }
        // A readable result for browser-console classroom demonstrations.
        console.log('Round '+roundNumber+': '+(state.winner ? state.winner+' wins' : 'Draw ('+state.draw+')')+
            '. Score — X: '+scores.X+', O: '+scores.O+(matchComplete ? '. Match winner: '+state.winner : ''));
        roundResults.push({ round: roundNumber, winner: state.winner });
        document.getElementById('turnHint').textContent = state.draw ? state.draw+'. No points awarded.' : matchComplete ? 'Three wins. Well played. Ready for a rematch?' : 'Point to '+player+'. '+(roundStarter === 'X' ? 'O' : 'X')+' starts the next round.';
        restartButton.textContent = matchComplete ? 'Play again' : 'Next round →';
        updateMatchUI();
    } else {
        updateStatusText();
        advanceTurn();
    }
    document.getElementById('moveLabel').textContent = String(moveCount).padStart(2,'0')+' MOVES';
    renderBoard(previous);
    updateTensionEffects();
}
function playerName(player) {
    return gameMode === 'pvc' ? player === HUMAN ? 'You' : 'AI' : gameMode === 'cvc' ? 'AI '+player : 'Player '+player;
}
function winMessage(player) { return playerName(player)+(gameMode === 'pvc' && player === HUMAN ? ' win the round!' : ' wins the round!'); }
function updateStatusText() {
    statusText.textContent = isHumanControlled(currentPlayer) ? gameMode === 'pvc' ? 'Your move.' : 'Player '+currentPlayer+' to move.' : document.hidden ? 'AI paused' : playerName(currentPlayer)+' is thinking…';
    statusText.className = 'status turn-'+currentPlayer.toLowerCase();
    boardEl.classList.remove('turn-x','turn-o');
    boardEl.classList.add('turn-'+currentPlayer.toLowerCase());
    const queue = state.queues[currentPlayer];
    document.getElementById('turnHint').textContent = ruleset === 'vanish' && queue.length === 3
        ? currentPlayer+'’s NEXT OUT mark disappears after this move.'
        : gameMode === 'pvc' ? 'You are X. '+(currentPlayer === HUMAN ? 'Choose an empty tile.' : 'Plan your next move.') : 'Three in a row wins. '+currentPlayer+' plays next.';
}
function advanceTurn() {
    clearTimeout(aiTimer);
    aiTimer = null;
    if (!gameActive || isHumanControlled(currentPlayer) || document.hidden) return;
    const ticket = revision;
    const player = currentPlayer;
    aiTimer = setTimeout(() => {
        aiTimer = null;
        if (ticket !== revision || !gameActive || currentPlayer !== player || isHumanControlled(player) || document.hidden) return;
        const move = GridRules.choose(state,difficulty);
        if (move !== null) makeMove(move,player);
    },gameMode === 'cvc' ? 650 : 380);
}
function updateMatchUI() {
    scoreXEl.textContent = scores.X;
    scoreOEl.textContent = scores.O;
    for (const p of ['X','O']) {
        document.getElementById('label'+p).textContent = (gameMode === 'pvc' ? p === 'X' ? 'YOU' : 'AI' : gameMode === 'cvc' ? 'AI' : 'PLAYER')+' / '+p;
        document.getElementById('pips'+p).innerHTML = [0,1,2].map(i => '<i class="'+(i<scores[p] ? 'filled' : '')+'"></i>').join('');
    }
    document.getElementById('roundLabel').textContent = matchComplete ? 'MATCH COMPLETE' : 'ROUND '+String(roundNumber).padStart(2,'0');
    const log = document.getElementById('roundHistory');
    log.innerHTML = '';
    for (const result of roundResults) {
        const item = document.createElement('li');
        item.className = result.winner ? 'result-'+result.winner.toLowerCase() : 'result-draw';
        item.textContent = result.winner || '–';
        item.title = 'Round '+result.round+': '+(result.winner ? result.winner+' won' : 'draw');
        item.setAttribute('aria-label',item.title);
        log.appendChild(item);
    }
    if (!roundResults.length) log.innerHTML = '<li class="history-empty">Your story starts here.</li>';
    log.scrollLeft = log.scrollWidth;
}
function sound(kind,player = 'X') {
    if (!soundEnabled) return;
    try {
        if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
        if (audioContext.state !== 'running') { audioContext.resume().catch(() => {}); return; }
        const notes = kind === 'win' ? [440,554,659] : kind === 'draw' ? [260,220] : [player === 'X' ? 520 : 390];
        notes.forEach((frequency,i) => {
            const oscillator = audioContext.createOscillator(), gain = audioContext.createGain();
            const start = audioContext.currentTime+i*.09;
            oscillator.type = 'sine'; oscillator.frequency.value = frequency;
            gain.gain.setValueAtTime(0,start); gain.gain.linearRampToValueAtTime(.045,start+.01); gain.gain.exponentialRampToValueAtTime(.001,start+.16);
            oscillator.connect(gain); gain.connect(audioContext.destination);
            oscillator.start(start); oscillator.stop(start+.18);
            oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
        });
    } catch (_) { soundEnabled = false; syncSoundButton(); }
}
function syncSoundButton() {
    const button = document.getElementById('soundToggle');
    button.setAttribute('aria-pressed',String(soundEnabled));
    button.innerHTML = 'Sound <span>'+(soundEnabled ? 'ON' : 'OFF')+'</span>';
}
document.getElementById('soundToggle').addEventListener('click',() => { soundEnabled = !soundEnabled; syncSoundButton(); if(soundEnabled) sound('move'); });
function syncEffects() {
    vividEffects = effectsLevel !== 'calm' && !motionPreference.matches;
    stopLightning();
    document.body.classList.toggle('vivid-effects',vividEffects);
    document.body.classList.toggle('extreme-effects',vividEffects && effectsLevel === 'extreme');
    document.getElementById('effectsSelect').value = effectsLevel;
    document.getElementById('motionNote').hidden = !motionPreference.matches;
    if (!vividEffects) clearCracks();
    if (gameActive) updateTensionEffects();
}
document.getElementById('effectsSelect').addEventListener('change',event => {
    effectsLevel = event.target.value;
    syncEffects();
});
motionPreference.addEventListener('change',syncEffects);
document.addEventListener('visibilitychange',() => {
    document.body.classList.toggle('effects-paused',document.hidden);
    clearTimeout(aiTimer); aiTimer = null; stopLightning();
    if (gameActive) { updateStatusText(); if (!document.hidden) { updateTensionEffects(); advanceTurn(); } }
});

// ---------- Tension escalation (meter + board tremor + embers + lightning) ----------

function tensionTier() {
    if (moveCount >= 7) return "critical";
    if (moveCount >= 5) return "high";
    if (moveCount >= 3) return "mid";
    return "calm";
}

function updateTensionEffects() {
    tensionSegments.forEach((seg, i) => seg.classList.toggle("lit", i < moveCount));

    const tier = gameActive ? tensionTier() : "calm";

    document.body.classList.remove("tension-mid", "tension-high", "tension-critical");
    embersEl.classList.remove("tier-mid", "tier-high", "tier-critical");
    smokeEl.classList.remove("tier-high", "tier-critical");
    boardEl.classList.remove("tension-high", "tension-critical");
    tensionMeterEl.classList.remove("tier-critical");

    if (tier === "mid") {
        document.body.classList.add("tension-mid");
        embersEl.classList.add("tier-mid");
    } else if (tier === "high") {
        document.body.classList.add("tension-high");
        embersEl.classList.add("tier-high");
        smokeEl.classList.add("tier-high");
        boardEl.classList.add("tension-high");
    } else if (tier === "critical") {
        document.body.classList.add("tension-critical");
        embersEl.classList.add("tier-critical");
        smokeEl.classList.add("tier-critical");
        boardEl.classList.add("tension-critical");
        tensionMeterEl.classList.add("tier-critical");
    }

    if (gameActive && lightningTier() && vividEffects && !motionPreference.matches && !document.hidden) {
        startLightning();
    } else {
        stopLightning();
    }
}

function resetTensionEffects() {
    document.body.classList.remove("tension-mid", "tension-high", "tension-critical");
    embersEl.classList.remove("tier-mid", "tier-high", "tier-critical");
    smokeEl.classList.remove("tier-high", "tier-critical");
    boardEl.classList.remove("tension-high", "tension-critical");
    tensionMeterEl.classList.remove("tier-critical");
    stopLightning();
}


// ---------- Electrical eruptions above the fractured tiles ----------
// The layer is outside the clipped cells: arcs rise into the air and cross tile edges.
const SVG_NS = 'http://www.w3.org/2000/svg';
const surgeLayer = document.createElementNS(SVG_NS,'svg');
surgeLayer.classList.add('surge-layer');
surgeLayer.setAttribute('aria-hidden','true');
document.querySelector('.board-wrap').appendChild(surgeLayer);
const crackVents = new Map();
const surgeCleanups = new Map();
let surgeTimer = null;
function svgElement(tag,attributes) {
    const element = document.createElementNS(SVG_NS,tag);
    for (const [key,value] of Object.entries(attributes)) element.setAttribute(key,value);
    return element;
}
function stopSurges() {
    clearTimeout(surgeTimer); surgeTimer = null;
    for (const timer of surgeCleanups.values()) clearTimeout(timer);
    surgeCleanups.clear(); surgeLayer.replaceChildren();
}
function scheduleSurge() {
    if (surgeTimer || !gameActive || !vividEffects || document.hidden) return;
    const extreme = effectsLevel === 'extreme';
    surgeTimer = setTimeout(() => {
        surgeTimer = null;
        if (!gameActive || !vividEffects || motionPreference.matches || document.hidden) return;
        const sources = [...crackVents.keys()];
        if (sources.length) emitSurge(sources[Math.floor(Math.random()*sources.length)]);
        scheduleSurge();
    },extreme ? 280 + Math.random()*260 : 650 + Math.random()*450);
}
function emitSurge(index,impact = false) {
    if (!gameActive || !vividEffects || motionPreference.matches || document.hidden) return;
    const vents = crackVents.get(index);
    if (!vents || surgeCleanups.size >= 6) return;
    const wrap = document.querySelector('.board-wrap').getBoundingClientRect();
    const tile = cells[index].getBoundingClientRect();
    // Normalize transformed geometry so the overlay follows the board's tremor.
    const scale = document.querySelector('.board-wrap').clientWidth / wrap.width;
    surgeLayer.setAttribute('viewBox','0 0 '+wrap.width*scale+' '+wrap.height*scale);
    const extreme = effectsLevel === 'extreme';
    const group = svgElement('g',{'class':'surge-burst'});
    const count = extreme ? 4 : 2;
    for (let i=0;i<count;i++) {
        const vent = vents[i % vents.length];
        const x = (tile.left-wrap.left+tile.width*vent.x/100)*scale;
        const y = (tile.top-wrap.top+tile.height*vent.y/100)*scale;
        const lift = tile.height*(extreme ? .6+Math.random()*.65 : .35+Math.random()*.45);
        const spread = (Math.random()-.5)*tile.width*(extreme ? 1.4 : 1);
        const points = [{x,y}];
        let d = 'M '+x+' '+y;
        for (let j=1;j<=7;j++) {
            const t=j/7;
            const px=x+spread*t+(Math.random()-.5)*18*Math.sin(t*Math.PI);
            const py=y-lift*t;
            points.push({x:px,y:py}); d+=' L '+px+' '+py;
        }
        const branch=points[3];
        d+=' M '+branch.x+' '+branch.y+' l '+(spread*.25+8)+' -10 l -5 -12';
        group.append(svgElement('path',{d,'class':'surge-halo'}),svgElement('path',{d,'class':'surge-core'}));
        const ring=svgElement('ellipse',{cx:x,cy:y,rx:10,ry:4,'class':'surge-root'});
        ring.style.transformOrigin=x+'px '+y+'px'; group.append(ring);
        const particles=extreme ? 5 : 3;
        for(let p=0;p<particles;p++) {
            const spark=svgElement('circle',{cx:x,cy:y,r:p%2 ? 1.2 : 1.8,'class':'surge-particle'});
            spark.style.setProperty('--dx',(Math.random()-.5)*80+'px');
            spark.style.setProperty('--dy',-20-Math.random()*lift+'px');
            group.append(spark);
        }
    }
    if(impact) group.classList.add('impact-burst');
    surgeLayer.appendChild(group);
    const timer=setTimeout(()=>{group.remove();surgeCleanups.delete(group);},850);
    surgeCleanups.set(group,timer);
}

// ---------- Lightning strikes ----------
// Begins once tension reaches "high" and keeps striking until the round ends.
// Strike frequency tightens as the tier climbs.

let lightningTimer = null;

const STRIKE_INTERVAL = {
    high:     [2300, 3400],
    critical: [1500, 2400]
};

function startLightning() {
    if (lightningTimer) return; // already running
    strikeLightning();
    scheduleLightning();
    scheduleSurge();
}

function scheduleLightning() {
    const tier = tensionTier();
    const range = STRIKE_INTERVAL[tier] || STRIKE_INTERVAL.high;
    const delay = (range[0] + Math.random() * (range[1] - range[0])) * (effectsLevel === "extreme" ? .6 : 1);

    lightningTimer = setTimeout(() => {
        // Re-check on every tick: the round may have ended mid-wait
        if (!gameActive || !lightningTier() || !vividEffects || motionPreference.matches || document.hidden) {
            lightningTimer = null;
            return;
        }

        strikeLightning();
        scheduleLightning();
    }, delay);
}

// Lightning is active from "high" tension onward
function lightningTier() {
    const tier = tensionTier();
    return tier === "high" || tier === "critical";
}

function stopLightning() {
    stopSurges();
    arenaEl.classList.remove("jolt");
    clearTimeout(lightningTimer);
    lightningTimer = null;
    lightningEl.classList.remove("strike");
    boltSvg.classList.remove("strike");
}

function strikeLightning() {
    restartAnimation(lightningEl, "strike");
    restartAnimation(arenaEl, "jolt");
    strikeBoltOnBoard();
}

// Draws a jagged bolt from off-screen down to the center of a random board
// cell, using real viewport pixel coordinates so it visibly hits the board.
function strikeBoltOnBoard() {
    const targetIndex = pickStrikeTarget();
    const rect = cells[targetIndex].getBoundingClientRect();
    const x2 = rect.left + rect.width / 2;
    const y2 = rect.top + rect.height / 2;

    boltSvg.setAttribute("viewBox", `0 0 ${window.innerWidth} ${window.innerHeight}`);

    const { main, points } = buildBoltPath(x2, y2);
    boltPath.setAttribute("d", main);
    boltOutline.setAttribute("d", main);

    const branches = buildBranches(points);
    boltBranch1.setAttribute("d", branches[0] || "");
    boltBranch2.setAttribute("d", branches[1] || "");

    // SVG-safe restart (offsetWidth is undefined on <svg>)
    restartAnimation(boltSvg, "strike");

    impactCell(targetIndex);
}


// ---------- Impact: cracks + a burst of electricity ----------
// Every cell can crack — the cap that matters for performance is how much
// detail goes INTO each crack (arm count, segment count), not how many
// cells are allowed to have one.

let crackedCells = [];

function impactCell(index) {
    const cell = cells[index];
    const { svg, cx, cy, vents } = buildCrackSvg();
    crackVents.set(index, vents);

    cell.style.setProperty("--impact-x", cx + "%");
    cell.style.setProperty("--impact-y", cy + "%");

    // Replace, never append — a cell that's struck again gets a fresh
    // fracture pattern instead of stacking more paths on top of the old one.
    crackSlots[index].innerHTML = svg;

    if (!cell.classList.contains("cracked")) {
        cell.classList.add("cracked");
        crackedCells.push(index);
    }

    restartAnimation(cell, "scorched");
    restartAnimation(cell, "electrified");
    emitSurge(index, true);
}

function clearCracks() {
    crackVents.clear();
    crackedCells.forEach(i => {
        crackSlots[i].innerHTML = "";
        cells[i].classList.remove("cracked", "electrified", "scorched");
    });
    crackedCells = [];
}

// Fractures radiate from the bolt impact: three arms in Vivid, five in Extreme.
// Their endpoints feed the independent outward-surge layer.
function buildCrackSvg() {
    const cx = 50;
    const cy = 50;
    const armCount = effectsLevel === "extreme" ? 5 : 3;
    const vents = [];

    let underglow = "";
    let fissures = "";
    let sparks = "";
    let nodes = `<circle class="crack-node" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="1.4"></circle>`;

    for (let i = 0; i < armCount; i++) {
        const angle = (i / armCount) * Math.PI * 2 + (Math.random() * 1.4 - 0.7);
        let x = cx;
        let y = cy;
        let d = `M ${cx.toFixed(1)} ${cy.toFixed(1)}`;

        const segments = 3;
        for (let s = 0; s < segments; s++) {
            const step = 12 + Math.random() * 14;
            const wobble = (Math.random() * 0.9 - 0.45);
            x = Math.max(7, Math.min(93, x + Math.cos(angle + wobble) * step));
            y = Math.max(7, Math.min(93, y + Math.sin(angle + wobble) * step));
            d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
        }

        vents.push({x, y});
        underglow += `<path class="crack-underglow" d="${d}" style="animation-delay:${(Math.random() * 1.2).toFixed(2)}s"></path>`;
        fissures += `<path class="crack-line" d="${d}"></path>`;
        sparks += `<path class="crack-spark" d="${d}" style="animation-delay:${(Math.random() * 1.4).toFixed(2)}s"></path>`;
        nodes += `<circle class="crack-node" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.1"></circle>`;
    }

    return {
        svg: `<svg class="crack-svg" viewBox="0 0 100 100">${underglow}${fissures}${sparks}${nodes}</svg>`,
        cx,
        cy,
        vents
    };
}

// Favour cells that aren't cracked yet so damage spreads across the board
// instead of hammering the same square repeatedly.
function pickStrikeTarget() {
    const fresh = [];
    cells.forEach((cell, i) => {
        if (!cell.classList.contains("cracked")) fresh.push(i);
    });

    const pool = fresh.length ? fresh : [...cells.keys()];
    return pool[Math.floor(Math.random() * pool.length)];
}

function buildBoltPath(x2, y2) {
    const segments = effectsLevel === "extreme" ? 19 : 14;
    const x1 = x2 + (Math.random() * 120 - 60);
    const y1 = -30;

    const points = [{ x: x1, y: y1 }];
    let path = `M ${x1.toFixed(1)} ${y1}`;

    for (let i = 1; i <= segments; i++) {
        const t = i / segments;
        const y = y1 + (y2 - y1) * t;

        // Jitter shrinks sharply near the target so the bolt converges to a
        // clean point of impact instead of scribbling around it.
        const jitter = (Math.random() - .5) * (effectsLevel === "extreme" ? 85 : 50) * Math.pow(1 - t, 0.7);
        const x = x1 + (x2 - x1) * t + jitter;

        points.push({ x, y });
        path += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }

    return { main: path, points };
}

// Short forks that peel off the main bolt partway down, like real lightning
function buildBranches(points) {
    const branchStarts = [
        points[2 + Math.floor(Math.random() * 3)],
        points[6 + Math.floor(Math.random() * 3)]
    ];

    return branchStarts.map(start => {
        if (!start) return "";

        const length = 30 + Math.random() * 40;
        const angle = (Math.random() < 0.5 ? -1 : 1) * (0.6 + Math.random() * 0.5); // radians-ish spread
        const endX = start.x + Math.sin(angle) * length;
        const endY = start.y + Math.cos(angle) * length;
        const midX = start.x + (endX - start.x) * 0.5 + (Math.random() * 14 - 7);
        const midY = start.y + (endY - start.y) * 0.5;

        return `M ${start.x.toFixed(1)} ${start.y.toFixed(1)} L ${midX.toFixed(1)} ${midY.toFixed(1)} L ${endX.toFixed(1)} ${endY.toFixed(1)}`;
    });
}


// ---------- Win / draw effects ----------

function cellCenterPercent(index) {
    const wrap = document.querySelector(".board-wrap").getBoundingClientRect();
    const cell = cells[index].getBoundingClientRect();
    return { x: (cell.left + cell.width / 2 - wrap.left) / wrap.width * 100, y: (cell.top + cell.height / 2 - wrap.top) / wrap.height * 100 };
}

function drawWinLine(pattern) {
    const p1 = cellCenterPercent(pattern[0]);
    const p2 = cellCenterPercent(pattern[2]);

    winLine.setAttribute("x1", p1.x);
    winLine.setAttribute("y1", p1.y);
    winLine.setAttribute("x2", p2.x);
    winLine.setAttribute("y2", p2.y);

    winLine.classList.remove("drawn");
    void winLine.getBBox(); // force reflow so the draw-in animation restarts
    winLine.classList.add("drawn");
}


function triggerWinEffects(player, pattern) {
    resetTensionEffects();

    const color = TEAM_COLOR[player];
    document.documentElement.style.setProperty("--winner-color", color);

    boardEl.classList.add("shake");
    setTimeout(() => boardEl.classList.remove("shake"), 400);

    fxFlash.classList.remove("play");
    void fxFlash.offsetWidth;
    fxFlash.classList.add("play");

    const stampText = gameMode === "pvc" && player === HUMAN ? "You win" : `${player} wins`;
    playStamp(stampText, color);

    spawnSparks(pattern, color);
}


function triggerDrawEffect() {
    resetTensionEffects();
    document.documentElement.style.setProperty("--winner-color", "#8B949E");
    playStamp("Draw", "#8B949E");
}


function spawnSparks(pattern, color) {
    if (motionPreference.matches) return;
    const rect = cells[pattern[1]].getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    for (let i = 0; i < 22; i++) {
        const spark = document.createElement("div");
        spark.className = "spark";

        const angle = Math.random() * Math.PI * 2;
        const distance = 55 + Math.random() * 85;

        spark.style.setProperty("--sx", cx + "px");
        spark.style.setProperty("--sy", cy + "px");
        spark.style.setProperty("--tx", Math.cos(angle) * distance + "px");
        spark.style.setProperty("--ty", Math.sin(angle) * distance + "px");
        spark.style.background = color;

        fxLayer.appendChild(spark);
        spark.addEventListener("animationend", () => spark.remove(), { once: true });
        setTimeout(() => spark.remove(), 1000);
    }
}


// ---------- Round lifecycle ----------
restartButton.addEventListener('click',() => {
    if (matchComplete) { newMatch(); return; }
    if (!gameActive) { roundNumber++; roundStarter = roundStarter === 'X' ? 'O' : 'X'; }
    restartGame();
});
resetScoreButton.addEventListener('click',newMatch);
function newMatch() {
    scores.reset();
    roundNumber = 1; roundStarter = 'X'; matchComplete = false; roundResults = [];
    restartGame();
}
function restartGame() {
    revision++;
    clearTimeout(aiTimer); aiTimer = null;
    gameActive = false;
    clearStamp(); resetTensionEffects(); clearCracks();
    document.querySelectorAll('#fx .spark').forEach(spark => spark.remove());
    fxFlash.classList.remove('play'); arenaEl.classList.remove('jolt');
    state = GridRules.create(ruleset,roundStarter);
    board = state.board; currentPlayer = state.turn; moveCount = 0;
    cells.forEach((cell,i) => {
        markSlots[i].innerHTML = ''; cell.classList.remove('winning','vanished','last-move');
    });
    boardEl.classList.remove('shake'); winLine.classList.remove('drawn');
    countdownOverlay.classList.remove('show');
    gameActive = true;
    restartButton.textContent = 'Restart round';
    document.getElementById('moveLabel').textContent = '00 MOVES';
    updateMatchUI(); updateStatusText(); renderBoard(); updateTensionEffects(); advanceTurn();
}
syncEffects();
newMatch();

window.addEventListener("resize", () => { if(state.winner) drawWinLine(state.line); });
