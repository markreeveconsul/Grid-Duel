const assert = require('node:assert/strict');
const R = require('./game-core.js');
let checks = 0;
const test = (name,fn) => { fn(); checks++; console.log('PASS',name); };
const sequence = (rule,moves,starter='X') => moves.reduce((s,i) => { const n=R.play(s,i); assert.ok(n,'legal move '+i); return n; },R.create(rule,starter));
test('ScoreBoard wins, validation, reset, and independent instances',()=>{
  const scores=new R.ScoreBoard(), other=new R.ScoreBoard();
  assert.equal(scores.X,0); assert.equal(scores.O,0);
  assert.equal(scores.addWin('X'),1); scores.addWin('O'); scores.addWin('X');
  assert.equal(scores.X,2); assert.equal(scores.O,1); assert.equal(other.X,0);
  assert.throws(()=>scores.addWin('reset'),TypeError);
  assert.equal(scores.X,2); assert.equal(scores.O,1);
  scores.reset(); assert.equal(scores.X,0); assert.equal(scores.O,0);
  assert.equal(scores.addWin('O'),1);
});
test('Classic win, draw and terminal lock',()=>{
  const win=sequence('classic',[0,3,1,4,2]); assert.equal(win.winner,'X'); assert.deepEqual(win.line,[0,1,2]); assert.equal(R.play(win,8),null);
  const draw=sequence('classic',[0,1,2,4,3,5,7,6,8]); assert.equal(draw.draw,'Board full');
});
test('Immutable state and illegal moves',()=>{
  const s=R.create('vanish'); const before=JSON.stringify(s); const n=R.play(s,0); assert.equal(JSON.stringify(s),before);
  for(const i of [-1,9,1.5,null,'1',0]) assert.equal(R.play(n,i),null);
});
test('Oldest mark leaves before victory is evaluated',()=>{
  const s=sequence('vanish',[0,1,2,3,4,5]);
  assert.equal(R.play(s,0),null);
  const n=R.play(s,8); assert.equal(n.board[0],''); assert.equal(n.winner,null); assert.deepEqual(n.queues.X,[2,4,8]);
  const win=R.play(s,6); assert.equal(win.board[0],''); assert.equal(win.winner,'X'); assert.deepEqual(win.line,[2,4,6]);
});
test('Repetition includes turn and mark age; threefold draw',()=>{
  const s=sequence('vanish',[0,1,2,3,4,5]); const n=R.play(s,8); s.seen[R.key(n)]=2; assert.equal(R.play(s,8).draw,'Position repeated three times');
  const shuffled={...s,queues:{...s.queues,X:[4,2,0]}}; assert.notEqual(R.key(s),R.key(shuffled));
});
test('60-move draw and victory takes priority',()=>{
  const s=sequence('vanish',[0,1,2,3,4,5]); s.moves=59; assert.equal(R.play(s,8).draw,'60-move limit reached'); assert.equal(R.play(s,6).winner,'X');
});
test('Hard Classic AI never loses against any legal opponent branch',()=>{
  let terminals=0;
  for(const starter of ['X','O']) for(const ai of ['X','O']) {
    const visited=new Set();
    function walk(s) {
      if(s.winner || s.draw) { assert.notEqual(s.winner,ai==='X'?'O':'X'); terminals++; return; }
      const key=s.board.map(x=>x||'-').join('')+s.turn;
      if(visited.has(key)) return; visited.add(key);
      const moves=s.turn===ai ? [R.choose(s,'hard')] : R.legal(s);
      for(const i of moves) walk(R.play(s,i));
    }
    walk(R.create('classic',starter));
  }
  console.log('Verified',terminals,'terminal outcomes');
});
test('Vanishing AI picks a win and does not mutate its input',()=>{
  const s=sequence('vanish',[0,1,2,3,4,5]); const before=JSON.stringify(s); const i=R.choose(s,'hard'); assert.equal(R.play(s,i).winner,'X'); assert.equal(JSON.stringify(s),before);
});
test('1,000 randomized vanishing rounds preserve invariants and terminate',()=>{
  let seed=7719; const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  for(let game=0;game<1000;game++) {
    let s=R.create('vanish',game%2?'O':'X');
    while(!s.winner && !s.draw) {
      const moves=R.legal(s); assert.ok(moves.length); const n=R.play(s,moves[Math.floor(random()*moves.length)]);
      for(const p of ['X','O']) { assert.ok(n.queues[p].length<=3); assert.equal(n.queues[p].length,n.board.filter(v=>v===p).length); for(const i of n.queues[p]) assert.equal(n.board[i],p); }
      assert.ok(n.moves<=60); s=n;
    }
  }
});
console.log(checks+' rule suites passed.');
