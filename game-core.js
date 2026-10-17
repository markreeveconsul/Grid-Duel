/* Pure rules and AI. No DOM, timers, or external dependencies. */
(function (root) {
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
  function create(rule = 'classic', starter = 'X') {
    const s = { rule, turn: starter, board: Array(9).fill(''), queues: { X: [], O: [] }, moves: 0, winner: null, draw: null, line: null, seen: {} };
    s.seen[key(s)] = 1;
    return s;
  }
  const legal = s => s.winner || s.draw ? [] : s.board.flatMap((v,i) => v ? [] : [i]);
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
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GridRules = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
