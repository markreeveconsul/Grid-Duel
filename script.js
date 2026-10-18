/* GRID DUEL — STUDY COPY
 * Read STUDY-FIRST.md before reading this whole file.
 * Search the section names or function names below with Ctrl+F.
 *
 * Learning route (not execution order):
 * 1. ScoreBoard, create(), play(), win() — data and game rules.
 * 2. makeMove() — connects a click to a move, result, score and display.
 * 3. startMatch(), newMatch(), restartGame() — round and match lifecycle.
 * 4. advanceTurn(), choose() — computer turns and AI decisions.
 * 5. pauseForSetup(), resumeFromSetup() — settings and timer cancellation.
 * 6. Storm/texture functions — presentation; study these last.
 *
 * The browser runs top to bottom. Functions run when called; event callbacks
 * run later after clicks or timer delays. Do not rearrange initialization lines.
 */

// ===== SECTION A: RULES, SCOREBOARD CLASS, AND AI =====
/* Pure rules and AI. No DOM, timers, or external dependencies. */

// ===== DATABASE: saves finished matches to the SQLite server =====
function getPlayerName() {
  try {
    let name = window.localStorage.getItem('grid-duel-player-name');
    if (!name) {
      name = (window.prompt('Enter your player name:') || '').trim().slice(0, 20) || 'Player';
      window.localStorage.setItem('grid-duel-player-name', name);
    }
    return name;
  } catch { return 'Player'; }
}

function saveMatchToDatabase(winner) {
  // Capture the values now, because the board may be reset before the save runs.
  const record = {
    mode: gameMode, ruleset, difficulty, winner,
    xWins: scores.X, oWins: scores.O, rounds: roundNumber
  };
  // Short delay so the win animation isn't frozen by the name prompt.
  setTimeout(async () => {
    record.name = record.mode === 'pvc' ? getPlayerName()
                : record.mode === 'pvp' ? 'PvP' : 'AI vs AI';
    try {
      const res = await fetch('/api/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record)
      });
      console.log('Saved match:', await res.json());
    } catch (e) {
      console.warn('Could not save match', e);
    }
  }, 1200);
}

const GridRules = (() => {
  'use strict';
  // One instance stores match scores and survives round restarts.
  class ScoreBoard {
    constructor() { this.reset(); }
    addWin(player) {
      if (player !== 'X' && player !== 'O') throw new TypeError('Expected X or O');
      this[player] += 1;
      return this[player];
    }
    reset() { this.X = 0; this.O = 0; }
  }
  const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  const other = p => p === 'X' ? 'O' : 'X';
  const win = (b,p) => lines.find(line => line.every(i => b[i] === p));
  const key = s => s.turn + ':' + s.board.map(v => v || '-').join('') + ':' + s.queues.X.join('') + ':' + s.queues.O.join('');
  // A state object is a snapshot: board, turn, mark age, result and move count.
  function create(rule = 'classic', starter = 'X') {
    const s = { rule, turn: starter, board: Array(9).fill(''), queues: { X: [], O: [] }, moves: 0, winner: null, draw: null, line: null, seen: {} };
    s.seen[key(s)] = 1;
    return s;
  }
  const legal = s => s.winner || s.draw ? [] : s.board.flatMap((v,i) => v ? [] : [i]);
  // Return a new state for a legal move, or null for an invalid move.
  // Copying arrays prevents an AI trial move from changing the real board.
  function play(s,i) {
    if (!Number.isInteger(i) || !legal(s).includes(i)) return null;
    const n = { ...s, board: [...s.board], queues: { X: [...s.queues.X], O: [...s.queues.O] }, seen: {...s.seen}, moves: s.moves + 1 };
    const p = s.turn;
    // Select an empty tile, then remove the oldest mark before checking victory.
    if (s.rule === 'vanish' && n.queues[p].length === 3) n.board[n.queues[p].shift()] = '';
    n.board[i] = p;
    n.queues[p].push(i);
    n.line = win(n.board,p) || null;
    n.turn = other(p);
    if (n.line) n.winner = p;
    else if (n.board.every(Boolean)) n.draw = 'Board full';
    else {
      const k = key(n);
      n.seen[k] = (n.seen[k] || 0) + 1;
      if (n.seen[k] >= 3) n.draw = 'Position repeated three times';
      else if (n.moves >= 60) n.draw = '60-move limit reached';
    }
    return n;
  }
  function evaluate(s,p) {
    let score = 0;
    for (const line of lines) {
      const mine = line.filter(i => s.board[i] === p).length;
      const theirs = line.filter(i => s.board[i] === other(p)).length;
      if (!theirs) score += [0,1,7,100][mine];
      if (!mine) score -= [0,1,7,100][theirs];
    }
    return score;
  }
  const ordered = s => [4,0,2,6,8,1,3,5,7].filter(i => !s.board[i]);
  // AI: compare possible futures. Easy/Medium sometimes choose randomly.
  function choose(s,difficulty = 'hard',random = Math.random) {
    const moves = legal(s);
    if (!moves.length) return null;
    const pick = () => moves[Math.min(moves.length - 1,Math.floor(random() * moves.length))];
    if (difficulty === 'easy' && random() < .7) return pick();
    if (difficulty === 'medium' && random() < .2) return pick();
    const player = s.turn;
    const depth = s.rule === 'classic' ? 9 : difficulty === 'hard' ? 8 : 4;
    const cache = new Map();
    function classic(b,turn,left) {
      if (win(b,player)) return 1000 + left;
      if (win(b,other(player))) return -1000 - left;
      if (b.every(Boolean)) return 0;
      const k = b.map(v => v || '-').join('') + turn;
      if (cache.has(k)) return cache.get(k);
      let best = turn === player ? -Infinity : Infinity;
      for (let i = 0; i < 9; i++) if (!b[i]) {
        b[i] = turn;
        const value = classic(b,other(turn),left - 1);
        b[i] = '';
        best = turn === player ? Math.max(best,value) : Math.min(best,value);
      }
      cache.set(k,best);
      return best;
    }
    function search(position,left,alpha,beta) {
      if (position.winner) return position.winner === player ? 1000 + left : -1000 - left;
      if (position.draw) return 0;
      if (!left) return evaluate(position,player);
      const max = position.turn === player;
      let best = max ? -Infinity : Infinity;
      for (const i of ordered(position)) {
        const value = search(play(position,i),left - 1,alpha,beta);
        best = max ? Math.max(best,value) : Math.min(best,value);
        if (max) alpha = Math.max(alpha,best); else beta = Math.min(beta,best);
        if (beta <= alpha) break;
      }
      return best;
    }
    let best = -Infinity, result = moves[0];
    for (const i of ordered(s)) {
      const n = play(s,i);
      const value = s.rule === 'classic' ? classic([...n.board],n.turn,depth - 1) : search(n,depth - 1,-Infinity,Infinity);
      if (value > best) { best = value; result = i; }
    }
    return result;
  }
  const api = { create,play,legal,choose,key,win,lines,ScoreBoard };
  return api;
})();

// ===== SECTION B: PAGE ELEMENTS, GAME CONTROLLER, AND EFFECTS =====
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
let gameActive = false;
let matchStarted = false;
let setupPaused = false;
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
let effectsLevel = 'auto';
let vividEffects = true;
let soundEnabled = false;
let audioContext = null;
const systemMotionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
// Auto follows the system. Explicit Vivid/Extreme selections enable motion.
const motionPreference = {
    get matches() { return effectsLevel === 'auto' && systemMotionPreference.matches; },
    addEventListener(type,listener) { systemMotionPreference.addEventListener(type,listener); }
};

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
    const slot=markSlots[Number(cell.dataset.index)];slot.style.visibility='';delete slot.dataset.landing;
    markSlots[Number(cell.dataset.index)].innerHTML = player === 'X' ? X_MARK : O_MARK;
}
function renderBoard(previous = []) {
    updateTableAtmosphere();
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
    const landingReason = chooseLanding(state,next,player);
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
            const opponent = player === 'X' ? 'O' : 'X';
            if (scores[player] === 2 && scores[opponent] === 0) comebackEligible[opponent] = true;
            matchComplete = scores[player] === 3;
            if (matchComplete) saveMatchToDatabase(player);
            drawWinLine(state.line);
            cells.forEach((cell,i) => cell.classList.toggle('winning',state.line.includes(i)));
            statusText.textContent = matchComplete ? playerName(player)+(gameMode === 'pvc' && player === HUMAN ? ' take the match!' : ' takes the match!') : winMessage(player);
            statusText.className = 'status turn-'+player.toLowerCase();
            if (!(matchComplete && comebackEligible[player])) triggerWinEffects(player,state.line);
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
    placementFeedback(index,player,landingReason);
    if (state.winner) awardFeedback(player);
    updateTensionEffects();
    if (matchComplete && comebackEligible[player]) showEpicComeback(player,index);
}
function playerName(player) {
    return gameMode === 'pvc' ? player === HUMAN ? 'You' : 'AI' : gameMode === 'cvc' ? 'AI '+player : 'Player '+player;
}
function winMessage(player) { return playerName(player)+(gameMode === 'pvc' && player === HUMAN ? ' win the round!' : ' wins the round!'); }
function updateStatusText() {
    if (!matchStarted || setupPaused) {
        statusText.textContent = matchStarted ? 'Match paused' : 'Ready when you are';
        statusText.className = 'status';
        document.getElementById('turnHint').textContent = matchStarted
            ? 'Close setup to continue your round.'
            : 'Choose your settings, then press Start match.';
        boardEl.classList.remove('turn-x','turn-o');
        return;
    }
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
        const display = document.querySelector('.score--'+p.toLowerCase());
        display.classList.toggle('at-match-point',scores[p] === 2 && !matchComplete);
        display.classList.toggle('match-victor',scores[p] === 3);
        let badge = display.querySelector('.match-point-label');
        if (!badge) { badge = document.createElement('span'); badge.className = 'match-point-label'; display.appendChild(badge); }
        badge.textContent = scores[p] === 3 ? 'MATCH WINNER' : scores[p] === 2 && !matchComplete ? 'MATCH POINT' : '';
        badge.hidden = !badge.textContent;
        document.getElementById('label'+p).textContent = (gameMode === 'pvc' ? p === 'X' ? 'YOU' : 'AI' : gameMode === 'cvc' ? 'AI' : 'PLAYER')+' / '+p;
        document.getElementById('pips'+p).innerHTML = [0,1,2].map(i => '<i class="'+(i<scores[p] ? 'filled' : scores[p]===2 && !matchComplete ? 'fuse-armed' : '')+'"></i>').join('');
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
    document.body.classList.toggle('reduced-motion',motionPreference.matches);
    document.body.classList.toggle('vivid-effects',vividEffects);
    document.body.classList.toggle('extreme-effects',vividEffects && effectsLevel === 'extreme');
    document.getElementById('effectsSelect').value = effectsLevel;
    const effectsNote = document.getElementById('motionNote');
    effectsNote.hidden = false;
    effectsNote.textContent = motionPreference.matches
        ? 'Auto follows reduced motion. Choose Vivid or Extreme to enable animations.'
        : effectsLevel === 'calm' ? 'Calm: storm and landing animations are off.'
        : 'Animations enabled. Lightning begins after five moves in a round.';
    if (!vividEffects) { clearComebackEffects(); clearTableFeedback(); }
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
    impactStrikeCount = 0; impactStrikeGap = 3;
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
// Alternate gaps of three and four strikes; restart the cadence each round.
let impactStrikeCount = 0;
let impactStrikeGap = 3;
let impactFrameTimer = null;
let impactFramesEnabled = true;
function clearImpactFrame() {
    clearTimeout(impactFrameTimer);
    impactFrameTimer = null;
    document.body.classList.remove('impact-frame');
}
function countLightningImpact() {
    if (!gameActive || !vividEffects || motionPreference.matches || document.hidden) return;
    impactStrikeCount++;
    if (impactStrikeCount < impactStrikeGap) return;
    impactStrikeCount = 0;
    impactStrikeGap = impactStrikeGap === 3 ? 4 : 3;
    if (!impactFramesEnabled) return;
    clearImpactFrame();
    document.body.classList.add('impact-frame');
    impactFrameTimer = setTimeout(clearImpactFrame, 85);
}

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
    clearImpactFrame();
    stopSurges();
    arenaEl.classList.remove("jolt");
    clearTimeout(lightningTimer);
    lightningTimer = null;
    lightningEl.classList.remove("strike");
    boltSvg.classList.remove("strike");
}

function strikeLightning() {
    countLightningImpact();
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
    updateTableAtmosphere();
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



// ---------- Match-point displays and 0–2 comeback finale ----------
let comebackEligible = { X: false, O: false };
const comebackTimers = new Set();
let comebackGeneration = 0;
let comebackFrame = null;
function clearComebackEffects() {
    comebackGeneration++;
    comebackTimers.forEach(clearTimeout); comebackTimers.clear();
    cancelAnimationFrame(comebackFrame); comebackFrame = null;
    document.querySelectorAll('.comeback-text,.comeback-scene,.comeback-fissures').forEach(el => el.remove());
    boardEl.classList.remove('comeback-break','comeback-collapse');
    document.querySelector('.board-wrap').classList.remove('comeback-crater','comeback-quake');
    fxLayer.classList.remove('comeback-strike');
    boltSvg.classList.remove('strike');
    arenaEl.classList.remove('comeback-powercut','comeback-charge','jolt');
    delete arenaEl.dataset.comebackWinner;
    cells.forEach(cell=>cell.classList.remove('comeback-target'));
    document.querySelector('.board-wrap').classList.remove('comeback-rumble');
    [boltPath,boltOutline,boltBranch1,boltBranch2].forEach(path=>path.removeAttribute('pathLength'));
    clearImpactFrame();
}
function comebackLater(callback, delay) {
    const generation = comebackGeneration;
    const timer = setTimeout(() => {
        comebackTimers.delete(timer);
        if (generation === comebackGeneration && vividEffects && !motionPreference.matches) callback();
    }, delay);
    comebackTimers.add(timer);
}
// Draw original 5x7 pixel letters as SVG rectangles. There is no banner panel.
function comebackText(player) {
    const alphabet = {
        A:['01110','10001','10001','11111','10001','10001','10001'],
        B:['11110','10001','10001','11110','10001','10001','11110'],
        C:['01111','10000','10000','10000','10000','10000','01111'],
        E:['11111','10000','10000','11110','10000','10000','11111'],
        I:['111','010','010','010','010','010','111'],
        K:['10001','10010','10100','11000','10100','10010','10001'],
        M:['10001','11011','10101','10101','10001','10001','10001'],
        O:['01110','10001','10001','10001','10001','10001','01110'],
        P:['11110','10001','10001','11110','10000','10000','10000'],
        X:['10001','10001','01010','00100','01010','10001','10001'],
        Y:['10001','10001','01010','00100','00100','00100','00100']
    };
    const box = document.createElement('div'); box.className = 'comeback-text';
    box.setAttribute('role','status'); box.setAttribute('aria-label','EPIC COMEBACK BY '+player);
    for(const phrase of ['EPIC COMEBACK','BY '+player]) {
        const svg = svgElement('svg',{'aria-hidden':'true','shape-rendering':'crispEdges'});
        let x = 0;
        for(const letter of phrase) {
            if(letter === ' ') { x += 4; continue; }
            const glyph = alphabet[letter];
            glyph.forEach((row,y) => [...row].forEach((pixel,i) => {
                if(pixel === '1') svg.appendChild(svgElement('rect',{x:x+i,y,width:1,height:1}));
            }));
            x += glyph[0].length+1;
        }
        svg.setAttribute('viewBox','0 0 '+(x-1)+' 7'); box.appendChild(svg);
    }
    return box;
}
// Fire is a low-resolution heat simulation: heat rises, drifts and cools.
function startCraterFire(scene, origin) {
    const canvas = document.createElement('canvas'); canvas.className = 'crater-fire';
    canvas.width = canvas.height = 128; canvas.setAttribute('aria-hidden','true'); scene.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    if(!ctx) { canvas.remove(); return; }
    const heat = new Uint8Array(128*128);
    const palette = [[0,0,0,0],[91,24,12,150],[167,42,13,220],[234,76,17,245],[255,133,31,255],[255,195,66,255],[255,232,139,255]];
    const vents = [18,39,57,79,102,117];
    const start = performance.now(); let last = 0;
    const generation = comebackGeneration;
    function frame(now) {
        if(generation !== comebackGeneration) return;
        if(now-start > 5400 || !vividEffects || motionPreference.matches) { canvas.remove(); comebackFrame=null; return; }
        if(now-last > 55 && !document.hidden) {
            last = now;
            const fade = Math.min(1,(5400-(now-start))/1500);
            for(let x=0;x<128;x++) {
                const active = vents.some(v=>Math.abs(x-v)<3+Math.sin(now*.003+v)*2);
                heat[127*128+x] = active ? (180+Math.random()*75)*fade : 0;
            }
            // One connected ignition front climbs the entire board in 1.8 seconds.
            // Irregular tips and cooler gaps keep it from looking like a flat wipe.
            const rise=Math.min(1,(now-start)/1800);
            for(let x=1;x<127;x++) {
                const tip=Math.max(1,Math.min(126,Math.round(126-rise*125+Math.sin(x*.17+now*.004)*6+Math.sin(x*.43)*3)));
                for(let y=tip;y<Math.min(128,tip+10);y++) {
                    const fuel=.48+.52*Math.sin(x*.14+now*.002);
                    if(fuel>.42) heat[y*128+x]=Math.max(heat[y*128+x],(155+fuel*100)*fade);
                }
            }
            // Short-lived heat sources follow the fissures out from the hit tile.
            if(now-start<1700) for(let arm=0;arm<8;arm++) {
                const angle=arm*Math.PI/4;
                const distance=Math.min(45,(now-start)*.035);
                const hx=Math.round(origin.x*1.27+Math.cos(angle)*distance);
                const hy=Math.round(origin.y*1.27+Math.sin(angle)*distance);
                if(hx>1&&hx<126&&hy>1&&hy<126) heat[hy*128+hx]=250*fade;
            }
            for(let y=0;y<127;y++) for(let x=0;x<128;x++) {
                const drift=Math.floor(Math.random()*3)-1;
                const sample=Math.max(1,Math.min(126,x+drift));
                const row=(y+1)*128;
                const below=heat[row+sample]*.6+(heat[row+sample-1]+heat[row+sample+1])*.2;
                heat[y*128+x]=Math.max(0,below-2-Math.random()*5);
            }
            const img=ctx.createImageData(128,128);
            heat.forEach((value,i)=>{const c=palette[Math.min(6,Math.floor(value/38))];img.data.set(c,i*4);});
            ctx.putImageData(img,0,0);
            // Sparse rising sparks rather than a uniform shower.
            for(let k=0;k<12;k++) {
                const age=((now-start)*.025+k*13)%100;
                ctx.fillStyle=k%3 ? '#ee7c24' : '#ffe28d';
                ctx.globalAlpha=Math.max(0,(1-age/100)*fade);
                ctx.fillRect(Math.round(vents[k%vents.length]+Math.sin(age*.1+k)*5),Math.round(119-age),1,k%2+1);
            }
            ctx.globalAlpha=1;
        }
        comebackFrame=requestAnimationFrame(frame);
    }
    comebackFrame=requestAnimationFrame(frame);
}
function fractureBoard(wrap, origin) {
    const fissures=svgElement('svg',{viewBox:'0 0 100 100','class':'comeback-fissures','aria-hidden':'true'});
    // All faults start at the actual winning tile, including corner wins.
    const ends=[[0,0],[50,0],[100,0],[100,50],[100,100],[50,100],[0,100],[0,50]];
    ends.forEach(([ex,ey],arm)=>{
        let d='M '+origin.x+' '+origin.y;
        for(let step=1;step<=4;step++) {
            const t=step/4, bend=step===4?0:(arm%2?1:-1)*4;
            const x=Math.max(0,Math.min(100,origin.x+(ex-origin.x)*t+bend));
            const y=Math.max(0,Math.min(100,origin.y+(ey-origin.y)*t-bend));
            d+=' L '+x+' '+y;
        }
        fissures.append(svgElement('path',{d,'class':'fault-rim',pathLength:1}),svgElement('path',{d,'class':'fault-void',pathLength:1}));
    });
    wrap.appendChild(fissures); boardEl.classList.add('comeback-break');
}
// Each tile breaks into four irregular polygons, then drops inside a clipped pit.
function sinkBoard(wrap,scene,hitIndex) {
    const r=wrap.getBoundingClientRect();
    cells.forEach((cell,index)=>{
        const tile=cell.getBoundingClientRect();
        const cx=37+(index*17)%27, cy=35+(index*13)%29;
        const polygons=[
            '0% 0%,100% 0%,'+cx+'% '+cy+'%',
            '100% 0%,100% 100%,'+cx+'% '+cy+'%',
            '100% 100%,0% 100%,'+cx+'% '+cy+'%',
            '0% 100%,0% 0%,'+cx+'% '+cy+'%'];
        polygons.forEach((polygon,k)=>{
            const piece=document.createElement('div'); piece.className='ground-fragment';
            piece.style.left=(tile.left-r.left)/r.width*100+'%'; piece.style.top=(tile.top-r.top)/r.height*100+'%';
            piece.style.width=tile.width/r.width*100+'%'; piece.style.height=tile.height/r.height*100+'%';
            piece.style.clipPath='polygon('+polygon+')';
            piece.style.setProperty('--sink-delay',(.08*k+Math.hypot(index%3-hitIndex%3,Math.floor(index/3)-Math.floor(hitIndex/3))*.22)+'s');
            piece.style.setProperty('--sink-turn',((index+k)%2 ? 14+k*6 : -19-k*5)+'deg');
            piece.style.setProperty('--sink-x',((index%3-1)*10+(k-1.5)*5)+'px');
            const face=document.createElement('div'); face.className='fragment-face';
            const mark=cell.querySelector('.mark-slot'); if(mark) face.innerHTML=mark.innerHTML;
            piece.appendChild(face); scene.appendChild(piece);
        });
    });
    boardEl.classList.add('comeback-collapse'); wrap.classList.add('comeback-crater','comeback-quake');
    winLine.classList.remove('drawn');
}
function showEpicComeback(player, hitIndex) {
    clearComebackEffects(); clearTableFeedback(); clearStamp(); stopLightning();
    const wrap=document.querySelector('.board-wrap');
    document.documentElement.style.setProperty('--winner-color',TEAM_COLOR[player]);
    document.getElementById('turnHint').textContent='From 0–2 down to match winner. Play again to rebuild the board.';
    if(!vividEffects || motionPreference.matches) { wrap.appendChild(comebackText(player)); return; }
    arenaEl.dataset.comebackWinner=player.toLowerCase();
    arenaEl.classList.add('comeback-powercut');
    cells[hitIndex].classList.add('comeback-target');
    winLine.classList.remove('drawn');
    // Silence, then one pulse from the winner's scoreboard into the table.
    comebackLater(()=>arenaEl.classList.add('comeback-charge'),300);
    comebackLater(()=>{
        const rect=cells[hitIndex].getBoundingClientRect();
        const bolt=buildBoltPath(rect.left+rect.width/2,rect.top+rect.height/2);
        boltSvg.setAttribute('viewBox','0 0 '+innerWidth+' '+innerHeight);
        boltPath.setAttribute('d',bolt.main); boltOutline.setAttribute('d',bolt.main);
        [boltPath,boltOutline,boltBranch1,boltBranch2].forEach(path=>path.setAttribute('pathLength','1'));
        const branches=buildBranches(bolt.points);
        boltBranch1.setAttribute('d',branches[0]||'');boltBranch2.setAttribute('d',branches[1]||'');
        fxLayer.classList.add('comeback-strike');restartAnimation(boltSvg,'strike');
    },900);
    comebackLater(()=>{
        arenaEl.classList.remove('comeback-powercut','comeback-charge');
        if(impactFramesEnabled && !document.hidden) {
            clearImpactFrame();document.body.classList.add('impact-frame');
            impactFrameTimer=setTimeout(clearImpactFrame,85);
        }
        const origin=cellCenterPercent(hitIndex);
        fractureBoard(wrap,origin);
        restartAnimation(arenaEl,'jolt');wrap.classList.add('comeback-quake');
        const scene=document.createElement('div');scene.className='comeback-scene';
        scene.setAttribute('aria-hidden','true');wrap.appendChild(scene);
        collapseDust(scene);
        // Dust leads the fire, so the impact reads as broken stone.
        comebackLater(()=>startCraterFire(scene,origin),250);
    },1000);
    comebackLater(()=>{
        const scene=wrap.querySelector('.comeback-scene');
        if(scene) sinkBoard(wrap,scene,hitIndex);
    },1400);
    comebackLater(()=>{
        wrap.classList.remove('comeback-quake');
        wrap.classList.add('comeback-rumble');
        arenaEl.classList.remove('jolt');
    },1900);
    // The bolt has faded; the lettering stays still while the floor falls away.
    comebackLater(()=>wrap.appendChild(comebackText(player)),2200);
    comebackLater(()=>{
        wrap.classList.remove('comeback-rumble');
        fxLayer.classList.remove('comeback-strike');
        boltSvg.classList.remove('strike');
        wrap.querySelector('.comeback-fissures')?.remove();
        const scene=wrap.querySelector('.comeback-scene');
        if(scene) for(let i=0;i<14;i++) {
            const mote=document.createElement('i');mote.className='aftermath-dust';
            mote.style.left=(8+i*37%84)+'%';mote.style.top=(20+i*23%65)+'%';
            mote.style.setProperty('--delay',(i%5*.14)+'s');scene.appendChild(mote);
        }
    },4200);
}

// ---------- Table atmosphere: decoration never changes the game state ----------
const tableTimers = new Set();
let tacticalLandingUsed = false;
let landingSerial = 0;
const cableSvg = svgElement('svg',{'class':'power-cables','aria-hidden':'true'});
arenaEl.appendChild(cableSvg);
for(const player of ['X','O']) {
    const group=svgElement('g',{'class':'cable-'+player.toLowerCase()});
    for(const part of ['housing','edge','energy']) group.appendChild(svgElement('path',{'class':'cable-'+part,pathLength:100}));
    cableSvg.appendChild(group);
}
const wear=document.createElement('div');wear.className='surface-wear';wear.setAttribute('aria-hidden','true');document.querySelector('.play-area').prepend(wear);
let cableLayoutFrame=null;
function updateTableAtmosphere() {
    arenaEl.dataset.power=gameActive && !document.hidden ? currentPlayer.toLowerCase() : 'none';
    wear.style.setProperty('--wear',String(.12+crackedCells.length*.035));
    if(cableLayoutFrame!==null) return;
    cableLayoutFrame=requestAnimationFrame(()=>{
        cableLayoutFrame=null;
        const a=arenaEl.getBoundingClientRect(), target=document.querySelector('.board-wrap').getBoundingClientRect();
        cableSvg.setAttribute('viewBox','0 0 '+a.width+' '+a.height);
        const left=document.querySelector('.score--x').getBoundingClientRect();
        const right=document.querySelector('.score--o').getBoundingClientRect();
        const mobile=innerWidth<=760, center=(target.left+target.right)/2-a.left;
        const sourceLeft=mobile ? left.left+left.width/2 : left.right;
        const sourceRight=mobile ? right.left+right.width/2 : right.left;
        const spread=(sourceRight-sourceLeft)/2;
        const y1=(mobile ? (left.bottom+right.bottom)/2 : (left.top+left.height*.66+right.top+right.height*.66)/2)-a.top;
        const y2=(mobile ? target.top+12 : target.top+target.height*.65)-a.top;
        // Reflect the same curve around the board center, including control points.
        for(const p of ['X','O']) {
            const sign=p==='X' ? -1 : 1;
            const x1=center+sign*spread, x2=center+sign*(target.width/2+9);
            const bend=mobile ? 25 : 80;
            const d='M '+x1+' '+y1+' C '+x1+' '+(y1+bend)+','+x2+' '+(mobile ? y1+bend : y2+bend)+','+x2+' '+y2;
            cableSvg.querySelectorAll('.cable-'+p.toLowerCase()+' path').forEach(path=>path.setAttribute('d',d));
        }
    });
}
function tableLater(fn,delay) {
    const timer=setTimeout(()=>{tableTimers.delete(timer);fn();},delay);tableTimers.add(timer);
}
function clearTableFeedback() {
    tableTimers.forEach(clearTimeout);tableTimers.clear();
    document.querySelectorAll('.move-impact,.falling-mark,.landing-shadow,.score-award').forEach(el=>el.classList.contains('score-award') ? el.classList.remove('score-award') : el.remove());
    cells.forEach(cell=>cell.classList.remove('placement'));
    markSlots.forEach(slot=>{slot.style.visibility='';delete slot.dataset.landing;});
    arenaEl.classList.remove('landing-jolt');
}
// Test actual legal next moves, including oldest-mark removal in Vanishing Marks.
function immediateWins(position,player) {
    const trial={...position,turn:player};
    return GridRules.legal(trial).filter(i=>GridRules.play(trial,i)?.winner===player);
}
function chooseLanding(before,after,player) {
    if(after.winner) return 'win';
    if(after.draw || tacticalLandingUsed) return '';
    const opponent=player==='X' ? 'O' : 'X';
    const blocked=immediateWins(before,opponent).length>0 && immediateWins(after,opponent).length===0;
    const threat=immediateWins(before,player).length===0 && immediateWins(after,player).length>0;
    if(!blocked && !threat) return '';
    tacticalLandingUsed=true;
    return blocked ? 'block' : 'threat';
}
function placementFeedback(index,player,reason='') {
    if(!vividEffects || motionPreference.matches) return;
    const wrap=document.querySelector('.board-wrap'),r=wrap.getBoundingClientRect(),t=cells[index].getBoundingClientRect();
    const heavy=Boolean(reason),duration=heavy ? 290 : 150;
    const token=String(++landingSerial),slot=markSlots[index];
    const falling=document.createElement('div');falling.className='falling-mark'+(heavy?' heavy-landing':'')+(reason==='win'?' winning-landing':'');
    falling.dataset.reason=reason || 'normal';falling.setAttribute('aria-hidden','true');
    falling.innerHTML=player==='X'?X_MARK:O_MARK;
    falling.style.left=(t.left-r.left)/r.width*100+'%';falling.style.top=(t.top-r.top)/r.height*100+'%';
    falling.style.width=t.width/r.width*100+'%';falling.style.height=t.height/r.height*100+'%';
    falling.style.setProperty('--landing-color',TEAM_COLOR[player]);
    slot.dataset.landing=token;slot.style.visibility='hidden';wrap.appendChild(falling);
    const shadow=document.createElement('i');shadow.className='landing-shadow';shadow.setAttribute('aria-hidden','true');
    shadow.style.left=(t.left+t.width/2-r.left)/r.width*100+'%';shadow.style.top=(t.top+t.height*.8-r.top)/r.height*100+'%';
    shadow.style.setProperty('--land-time',duration+'ms');wrap.appendChild(shadow);
    tableLater(()=>{
        falling.remove();shadow.remove();
        if(slot.dataset.landing!==token)return;
        slot.style.visibility='';delete slot.dataset.landing;
        slot.querySelectorAll('.stroke').forEach(stroke=>{stroke.style.animation='none';stroke.style.strokeDashoffset='0';});
        restartAnimation(cells[index],'placement');
        const effect=document.createElement('div');effect.className='move-impact move-'+player.toLowerCase()+(heavy?' heavy-impact':'');effect.setAttribute('aria-hidden','true');
        effect.style.left=(t.left+t.width/2-r.left)/r.width*100+'%';effect.style.top=(t.top+t.height/2-r.top)/r.height*100+'%';
        if(player==='O'){const ring=document.createElement('i');ring.className='move-ring';effect.appendChild(ring);}
        for(let i=0;i<(heavy?12:8);i++){
            const spark=document.createElement('i');spark.className=i<4?'move-spark':i<8?'move-dust':'landing-chip';
            const angle=(i%4)*Math.PI/2+Math.PI/4;
            spark.style.setProperty('--mx',Math.cos(angle)*(heavy?52:24)+'px');spark.style.setProperty('--my',Math.sin(angle)*(heavy?44:20)+'px');effect.appendChild(spark);
        }
        wrap.appendChild(effect);
        if(heavy){arenaEl.style.setProperty('--land-shake',reason==='win'?'3px':'1.5px');restartAnimation(arenaEl,'landing-jolt');tableLater(()=>arenaEl.classList.remove('landing-jolt'),190);}
        tableLater(()=>{effect.remove();cells[index].classList.remove('placement');},600);
    },duration);
}
function awardFeedback(player) {
    if(!vividEffects || motionPreference.matches)return;
    const display=document.querySelector('.score--'+player.toLowerCase());restartAnimation(display,'score-award');
    tableLater(()=>display.classList.remove('score-award'),850);
}
function collapseDust(scene) {
    for(let i=0;i<30;i++) {
        const bit=document.createElement('i');bit.className=i<12 ? 'fault-chip' : 'fault-dust';
        bit.style.left=(8+(i*29)%84)+'%';bit.style.top=(12+(i*37)%72)+'%';
        bit.style.setProperty('--dx',((i%2?1:-1)*(10+i%6*5))+'px');bit.style.setProperty('--dy',(35+i%7*12)+'px');bit.style.setProperty('--delay',(i%5*.06)+'s');scene.appendChild(bit);
    }
}
window.addEventListener('resize',updateTableAtmosphere);

// ---------- Round lifecycle ----------
restartButton.addEventListener('click',() => {
    if (!matchStarted) { startMatch(); return; }
    if (setupPaused) return;
    if (matchComplete) { newMatch(); return; }
    if (!gameActive) { roundNumber++; roundStarter = roundStarter === 'X' ? 'O' : 'X'; }
    restartGame();
});
resetScoreButton.addEventListener('click',newMatch);
function newMatch() {
    comebackEligible = { X: false, O: false };
    matchStarted = false; setupPaused = false;
    clearCracks();
    scores.reset();
    roundNumber = 1; roundStarter = 'X'; matchComplete = false; roundResults = [];
    restartGame();
}
function restartGame() {
    tacticalLandingUsed = false;
    clearComebackEffects(); clearTableFeedback();
    revision++;
    clearTimeout(aiTimer); aiTimer = null;
    gameActive = false;
    clearStamp(); resetTensionEffects();
    document.querySelectorAll('#fx .spark').forEach(spark => spark.remove());
    fxFlash.classList.remove('play'); arenaEl.classList.remove('jolt');
    state = GridRules.create(ruleset,roundStarter);
    board = state.board; currentPlayer = state.turn; moveCount = 0;
    cells.forEach((cell,i) => {
        markSlots[i].innerHTML = ''; cell.classList.remove('winning','vanished','last-move');
    });
    boardEl.classList.remove('shake'); winLine.classList.remove('drawn');
    countdownOverlay.classList.remove('show');
    gameActive = matchStarted;
    restartButton.textContent = matchStarted ? 'Restart round' : 'Start match';
    syncSetupAction();
    document.getElementById('moveLabel').textContent = '00 MOVES';
    updateMatchUI(); updateStatusText(); renderBoard(); updateTensionEffects(); advanceTurn();
}
function syncSetupAction() {
    document.getElementById('startMatch').textContent = !matchStarted ? 'Start match' : setupPaused ? 'Resume match' : 'Return to board';
}
function startMatch() {
    if (matchStarted) return;
    matchStarted = true; setupPaused = false; gameActive = true;
    restartButton.textContent = 'Restart round';
    syncSetupAction(); updateStatusText(); renderBoard(); updateTensionEffects(); advanceTurn();
}
function pauseForSetup() {
    if (gameActive) {
        setupPaused = true; gameActive = false; revision++;
        clearTimeout(aiTimer); aiTimer = null;
        stopLightning(); updateTensionEffects(); updateStatusText(); renderBoard();
    }
    syncSetupAction();
}
function resumeFromSetup() {
    if (!setupPaused) return;
    setupPaused = false; gameActive = true;
    syncSetupAction(); updateStatusText(); renderBoard(); updateTensionEffects(); advanceTurn();
}
syncEffects();
newMatch();

window.addEventListener("resize", () => { if(state.winner) drawWinLine(state.line); });

// ===== SECTION C: SETTINGS MENU EVENTS =====
'use strict';
const setupDialog = document.getElementById('setupDialog');
document.getElementById('openSetup').addEventListener('click', () => { pauseForSetup(); setupDialog.showModal(); });
document.getElementById('closeSetup').addEventListener('click', () => setupDialog.close());
setupDialog.addEventListener('click', event => {
  const r = setupDialog.getBoundingClientRect();
  if (event.target === setupDialog && (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom)) setupDialog.close();
});
document.getElementById('impactToggle').addEventListener('change', event => {
  impactFramesEnabled = event.target.checked;
  clearImpactFrame();
});

setupDialog.addEventListener('close', resumeFromSetup);
document.getElementById('startMatch').addEventListener('click', () => {
  if (!matchStarted) startMatch();
  setupDialog.close();
});


// ===== SECTION D: ORIGINAL CYBERPUNK PRESENTATION =====
// Isolated names keep the reference engine separate from the game rules.
(()=>{
        // --- 1. DENSE ISOMETRIC PURPLE CIRCUIT BOARD CANVAS ENGINE ---
        const canvas = document.getElementById('circuit-canvas');
        const ctx = canvas.getContext('2d');
        if(!ctx) return;
        let backgroundFrame=null;
        const canAnimate=()=>vividEffects && !motionPreference.matches && !document.hidden;

        let width, height;
        let busLines = [];
        let pulses = [];
        let chipBoxes = [];

        function resizeCanvas() {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
            generateIsometricCircuitry();
        }

        // Isometric projection helper (30-degree angle lines)
        function projectIso(x, y) {
            // Diagonal tilt angle ~ 26.5 to 30 degrees matching reference image
            const isoX = x - y * 0.5;
            const isoY = x * 0.58 + y * 0.85;
            return { x: isoX, y: isoY };
        }

        class BusLine {
            constructor(points, width, color) {
                this.points = points; // Array of {x, y}
                this.width = width;
                this.color = color;
            }

            draw() {
                if (this.points.length < 2) return;
                ctx.save();
                ctx.beginPath();
                ctx.moveTo(this.points[0].x, this.points[0].y);
                for (let i = 1; i < this.points.length; i++) {
                    ctx.lineTo(this.points[i].x, this.points[i].y);
                }
                ctx.strokeStyle = this.color;
                ctx.lineWidth = this.width;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.shadowColor = '#c084fc';
                ctx.shadowBlur = this.width > 2 ? 12 : 5;
                ctx.globalAlpha = .5;
                ctx.lineWidth = this.width * 2.2;
                ctx.stroke();
                // A separate sharp trace sits inside the diffuse light.
                ctx.globalAlpha = 1;
                ctx.shadowBlur = 0;
                ctx.lineWidth = this.width;
                ctx.stroke();
                ctx.restore();
            }
        }

        class CircuitPulse {
            constructor(bus) {
                this.bus = bus;
                this.segmentIndex = 0;
                this.progress = 0;
                this.speed = Math.random() * 0.025 + 0.015;
                this.size = Math.random() * 3 + 2.5;
                this.color = Math.random() > 0.3 ? '#ffffff' : '#e879f9';
            }

            update() {
                this.progress += this.speed;
                if (this.progress >= 1) {
                    this.progress = 0;
                    this.segmentIndex++;
                    if (this.segmentIndex >= this.bus.points.length - 1) {
                        this.segmentIndex = 0; // Loop around or reset
                    }
                }
            }

            draw() {
                if (!this.bus || this.bus.points.length < 2) return;
                const p1 = this.bus.points[this.segmentIndex];
                const p2 = this.bus.points[this.segmentIndex + 1];
                if (!p1 || !p2) return;

                const currX = p1.x + (p2.x - p1.x) * this.progress;
                const currY = p1.y + (p2.y - p1.y) * this.progress;

                ctx.save();
                const radius=this.size*5;
                const bloom=ctx.createRadialGradient(currX,currY,0,currX,currY,radius);
                bloom.addColorStop(0,'rgba(255,235,255,.85)');
                bloom.addColorStop(.18,'rgba(232,121,249,.5)');
                bloom.addColorStop(.5,'rgba(168,85,247,.14)');
                bloom.addColorStop(1,'rgba(168,85,247,0)');
                ctx.fillStyle=bloom;
                ctx.fillRect(currX-radius,currY-radius,radius*2,radius*2);
                ctx.beginPath();
                ctx.arc(currX,currY,this.size*.65,0,Math.PI*2);
                ctx.fillStyle=this.color;
                ctx.fill();
                ctx.beginPath();
                ctx.arc(currX,currY,this.size*.28,0,Math.PI*2);
                ctx.fillStyle='#fff8ff';
                ctx.fill();
                ctx.restore();
            }
        }

        function generateIsometricCircuitry() {
            busLines = [];
            pulses = [];
            chipBoxes = [];

            // Generate ambient micro-chip footprints on substrate background
            const numChips = Math.floor((width * height) / 120000);
            for (let i = 0; i < numChips; i++) {
                chipBoxes.push({
                    x: Math.random() * width,
                    y: Math.random() * height,
                    w: Math.random() * 80 + 40,
                    h: Math.random() * 60 + 30,
                    pins: Math.floor(Math.random() * 8) + 4
                });
            }

            // Parallel Dense Isometric Circuit Buses across screen
            const busSpacing = 35;
            const totalBusses = Math.floor((width + height) / busSpacing);

            for (let b = -20; b < totalBusses; b++) {
                let startX = b * busSpacing - width * 0.3;
                let startY = -100;

                let points = [];
                let currentX = startX;
                let currentY = startY;

                // Build multi-segment isometric zigzag path (30-degree angles)
                points.push({ x: currentX, y: currentY });

                let segments = Math.floor(Math.random() * 4) + 4;
                for (let s = 0; s < segments; s++) {
                    const length = Math.random() * 200 + 120;
                    const dir = s % 2 === 0 ? 0 : (Math.random() > 0.5 ? 1 : -1);

                    if (dir === 0) {
                        // Main diagonal trace down-right (~30 deg)
                        currentX += length * 0.866;
                        currentY += length * 0.5;
                    } else if (dir === 1) {
                        // Steep angle shift
                        currentX += length * 0.5;
                        currentY += length * 0.866;
                    } else {
                        // Horizontal jog
                        currentX += length;
                    }

                    points.push({ x: currentX, y: currentY });
                }

                // Color gradient & neon intensity
                const isMainBus = b % 4 === 0;
                const widthVal = isMainBus ? (Math.random() > 0.5 ? 2.5 : 3.5) : 1.2;
                const alpha = isMainBus ? (Math.random() * 0.3 + 0.6) : (Math.random() * 0.2 + 0.25);
                const strokeColor = isMainBus
                    ? `rgba(232, 121, 249, ${alpha})`
                    : `rgba(168, 85, 247, ${alpha})`;

                const bus = new BusLine(points, widthVal, strokeColor);
                busLines.push(bus);

                // Add energy pulses to main buses
                if (isMainBus) {
                    const numPulses = Math.floor(Math.random() * 2) + 1;
                    for (let p = 0; p < numPulses; p++) {
                        pulses.push(new CircuitPulse(bus));
                    }
                }
            }
        }

        function drawCircuitBoardCanvas() {
            ctx.clearRect(0, 0, width, height);

            // Subtle dark grid background
            ctx.strokeStyle = 'rgba(46, 16, 101, 0.15)';
            ctx.lineWidth = 1;
            const step = 40;
            for (let x = 0; x < width; x += step) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height);
                ctx.stroke();
            }
            for (let y = 0; y < height; y += step) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(width, y);
                ctx.stroke();
            }

            // Draw Silicon Micro-Chip substrate footprints
            chipBoxes.forEach(chip => {
                ctx.save();
                ctx.fillStyle = 'rgba(15, 6, 33, 0.65)';
                ctx.strokeStyle = 'rgba(168, 85, 247, 0.25)';
                ctx.lineWidth = 1;
                ctx.fillRect(chip.x, chip.y, chip.w, chip.h);
                ctx.strokeRect(chip.x, chip.y, chip.w, chip.h);

                // Chip pin connectors
                ctx.fillStyle = 'rgba(192, 132, 252, 0.4)';
                for (let p = 0; p < chip.pins; p++) {
                    const px = chip.x + (chip.w / chip.pins) * p + 2;
                    ctx.fillRect(px, chip.y - 3, 3, 3);
                    ctx.fillRect(px, chip.y + chip.h, 3, 3);
                }
                ctx.restore();
            });

            // Draw Isometric Bus Lines
            busLines.forEach(bus => bus.draw());

            // Draw Glowing Node Junction Dots at trace corners
            busLines.forEach(bus => {
                bus.points.forEach((pt, idx) => {
                    if (idx > 0 && idx < bus.points.length - 1 && idx % 3 !== 0) {
                        ctx.save();
                        ctx.beginPath();
                        ctx.arc(pt.x, pt.y, bus.width + 1.5, 0, Math.PI * 2);
                        ctx.fillStyle = '#ffffff';
                        ctx.shadowColor = '#e879f9';
                        ctx.shadowBlur = 7;
                        ctx.fill();
                        ctx.restore();
                    }
                });
            });

            // Update and draw current pulses
            pulses.forEach(pulse => {
                if(canAnimate()) pulse.update();
                pulse.draw();
            });

            backgroundFrame=canAnimate()?requestAnimationFrame(drawCircuitBoardCanvas):null;
        }

        function restartBackground(){cancelAnimationFrame(backgroundFrame);resizeCanvas();drawCircuitBoardCanvas();}
 window.addEventListener('resize',restartBackground);
 document.addEventListener('visibilitychange',restartBackground);
 document.getElementById('effectsSelect').addEventListener('change',restartBackground);
 systemMotionPreference.addEventListener('change',restartBackground);
 restartBackground();
})();

// Screen adapters: the original game is the single source of truth.
(()=>{
 const title=document.getElementById('screen-title');
 const manual=document.getElementById('cyberManual');
 const victory=document.getElementById('cyberVictory');
 const initiate=document.getElementById('initiateProtocol');
 let victoryTimer=null, presented=false;
 function showTitle(){document.body.dataset.screen='title';title.hidden=false;arenaEl.inert=true;initiate.focus();}
 function enterSetup(){document.body.dataset.screen='setup';title.hidden=true;arenaEl.inert=false;document.getElementById('openSetup').click();}
 initiate.addEventListener('click',enterSetup);
 document.getElementById('openManual').addEventListener('click',()=>manual.showModal());
 setupDialog.addEventListener('close',()=>{
   if(!matchStarted) showTitle();
   else {document.body.dataset.screen='game';title.hidden=true;arenaEl.inert=false;window.dispatchEvent(new Event('resize'));}
 });
 function syncSynth(){
   document.getElementById('audio-status').textContent=soundEnabled?'SYNTH: ONLINE':'SYNTH: OFFLINE';
   document.getElementById('audio-toggle-btn').textContent=soundEnabled?'DISABLE SYNTH':'ENABLE SYNTH';
   document.getElementById('hud-synth-btn').textContent=soundEnabled?'SYNTH ON':'SYNTH OFF';
   ['audio-toggle-btn','hud-synth-btn'].forEach(id=>document.getElementById(id).setAttribute('aria-pressed',String(soundEnabled)));
 }
 ['audio-toggle-btn','hud-synth-btn'].forEach(id=>document.getElementById(id).addEventListener('click',()=>{document.getElementById('soundToggle').click();syncSynth();}));
 document.getElementById('soundToggle').addEventListener('click',syncSynth);
 // Wait for the existing destruction sequence before offering the reference result panel.
 const observer=new MutationObserver(()=>{
   if(!matchComplete){clearTimeout(victoryTimer);victoryTimer=null;presented=false;if(victory.open)victory.close();return;}
   if(presented||victoryTimer!==null)return;
   const ticket=revision;
   victoryTimer=setTimeout(()=>{
     victoryTimer=null;
     if(ticket!==revision||!matchComplete)return;
     presented=true;
     document.getElementById('cyberVictoryTitle').textContent=comebackEligible[state.winner]?'EPIC COMEBACK BY '+state.winner:state.winner+' WINS THE MATCH';
     document.getElementById('cyberVictoryDesc').textContent=comebackEligible[state.winner]?'From 0–2 down to match winner. Play again to rebuild the board.':'Three round wins. Circuit complete. Ready for another match?';
     // Keep the pixel comeback message and destroyed board fully visible.
     if(!comebackEligible[state.winner]&&!setupDialog.open)victory.showModal();
   },comebackEligible[state.winner]?6800:1000);
 });
 observer.observe(statusText,{childList:true,characterData:true,subtree:true});
 document.getElementById('cyberReplay').addEventListener('click',()=>{victory.close();restartButton.click();});
 document.getElementById('cyberVictorySetup').addEventListener('click',()=>{victory.close();document.getElementById('openSetup').click();});
 syncSynth();showTitle();
})();
