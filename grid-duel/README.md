# Grid Duel — Duel Edition

## Play
Open index.html in a current browser. No install, build step, account, or server is needed.
Keep index.html, style.css, script.js, and game-core.js together in the same folder.
The game works offline; Google Fonts are optional and fall back to local fonts.

This is a separate upgraded copy. The original Downloads/WST_XOXO files were not changed.

## What's new
- Vanishing Marks: keep three marks per player. On your fourth placement, the oldest mark disappears before the winning line is checked. NEXT OUT labels identify each player's oldest mark. Select an empty tile; you cannot choose an occupied oldest tile.
- First-to-three matches, score pips, round history, alternating starters, and a rematch action. Draws do not score points.
- Classic, Solo, Two players, AI vs AI, and all three AI difficulty choices remain available.
- Refined blue/orange arena, drawn marks, last-move indicators, precise winning lines, turbulent molten seams, and a board-first mobile layout.
- Optional synthesized sound, Calm/Vivid/Extreme effects, system reduced-motion support, accessible tile labels, and arrow-key navigation.
- AI turns are cancelled on restart or setting changes and paused while the page is hidden.

## Rules and controls
Three in a row, column, or diagonal wins the round. First to three round wins takes the match.
After a completed round, Next round alternates the starter. Restart round keeps the current starter and score.
New match, opponent changes, ruleset changes, and difficulty changes reset the match.
In Solo, you always play X; the AI can start alternate rounds as O.
Vanishing rounds draw after three occurrences of the same position (including turn and mark ages), or 60 moves.
Tab to a tile and press Enter or Space to play. Arrow keys move focus around the board.
Sound starts off. Vivid effects are the default. Choose Calm, Vivid, or Extreme from the Effects selector. Your system's reduced-motion preference overrides animated effects in both Vivid and Extreme.
Settings and scores last for the current page session; reloading starts fresh.

## AI
Hard Classic searches the full game tree and is unbeatable. Hard Vanishing Marks searches eight moves ahead; it is strong but not guaranteed unbeatable. Easy makes more random moves, and Medium mixes search with occasional random moves.

## Verification
Run node verify.cjs from this folder (Node.js required only for tests).
Nine suites cover ScoreBoard behavior, win/draw handling, illegal moves, immutable state, removal-before-win ordering, repetition, the move cap, hard AI, and 1,000 deterministic randomized Vanishing rounds.
Hard Classic was checked against every legal opponent branch for both AI symbols and starting players (422 terminal outcomes under the selected AI policy).
Browser checks in Edge covered complete matches and rematches, drawn rounds, keyboard navigation, settings changes during pending AI turns, AI vs AI, sound controls, reduced motion, and widths of 320, 390, 768, 1024, and 1440 pixels. No JavaScript page errors occurred during those checks.

## Files
- index.html: interface and accessible controls
- style.css: original visual foundation plus the new arena styling
- game-core.js: pure rules and AI
- script.js: match controller, UI, and visual/audio effects
- verify.cjs: runnable rules regression tests
- preview.png: desktop preview

## Storm effects update
Vivid restores tension-driven board tremors and lightning impacts. Electrical arcs erupt upward from fracture endpoints into a separate overlay above the tiles, with branching paths, vent rings, and flying sparks. Magma combines branching hot veins, moving convection plumes, and rising bright particles under the tile seams.
Extreme adds more crack branches and simultaneous outward arcs, shorter strike intervals, stronger tremors, and faster magma circulation. Calm is steady; system reduced motion disables animated storm effects.
Transient surges are capped at six groups and removed after 850ms. Switching to Calm, restarting, finishing a round, or hiding the page clears their timers and nodes.
Additional Edge checks passed for effect selection, high/critical tremors, round-end cleanup, restart cleanup, live reduced-motion changes, and Extreme layouts at 320, 390, 768, and 1440 pixels. The nine regression suites pass.

## Classroom requirements
All eight items are demonstrated in the game code:
- Variables: gameMode, difficulty, currentPlayer, and other let/const bindings in script.js.
- Conditionals: win/draw handling in makeMove() and effect tiers in updateTensionEffects().
- Loops: for loops in initEmbers() and initSmoke(), plus AI search loops.
- Functions: makeMove(), advanceTurn(), newMatch(), and others.
- Data structures: board is an array; scores is an object created from ScoreBoard.
- Higher-order functions: map() builds position keys; filter() evaluates AI lines in game-core.js.
- OOP: ScoreBoard in game-core.js has a constructor, addWin(player), and reset(). The game creates one instance, uses addWin() after wins, and reset() for a new match. Restarting an unfinished round keeps the scores.
- Input/output: console.log() in makeMove() prints each completed round, scores, and the match winner. Open browser Developer Tools (F12), then Console to demonstrate it. The rubric permits console.log() without prompt().

The scoring update was checked in Edge for X/O wins, draws without points, a full first-to-three match, rematches, round restarts, and console output, with no page errors.
