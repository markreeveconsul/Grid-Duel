# Grid Duel — start studying here

This is a separate copy of the current Storm Table game. It keeps the rules, AI, ScoreBoard class, start button, settings pause/resume, storm effects, and occasional lightning impact frames.

There are only **three code files**. This guide is a reading aid, not code.

| File | Purpose | Study priority |
| --- | --- | --- |
| index.html | The buttons, board, labels, and settings menu | First: understand what is on the screen |
| script.js | Rules, scores, AI, input, and effects | Second: focus on the functions below |
| style.css | Colors, layout, board appearance, and animations | Last: explain how the game looks |

Open index.html to play. Keep these three files together. No build step is needed. The pixel logo is embedded in the HTML, so it needs no image file. Optional Google Fonts have local fallbacks.

## 1. Understand the board before studying functions

The board is an array with nine positions. Empty positions contain an empty string; occupied positions contain X or O.

    0 | 1 | 2
    --+---+--
    3 | 4 | 5
    --+---+--
    6 | 7 | 8

These numbers are indexes. For example, board[4] refers to the middle square.

The state object groups the board, whose turn it is, move count, result, and queues. A queue remembers which marks were placed first. In Vanishing Marks, each player can keep three marks; their oldest mark is removed when they place a fourth on an empty square. The win check happens after that removal.

## 2. Study these functions in this order

Use Ctrl+F in script.js to find each name. You do not have to read every animation function first.

1. **ScoreBoard**: a class is a blueprint for objects. Its constructor calls reset(), which sets X and O scores to zero. addWin(player) adds one point to the winner. The game creates one object with new GridRules.ScoreBoard(). The class is actually used, not just declared to satisfy the rubric.
2. **create()**: builds the starting state with nine empty squares. Do not confuse it with newMatch(), which also resets scores and the interface.
3. **win()**: examines the eight possible winning lines: three rows, three columns, and two diagonals. find() locates a line whose three indexes all contain the same player's symbol; every() checks those three positions.
4. **play()**: rejects an invalid move, copies the state, handles an old disappearing mark, places the new mark, and checks for a winner or draw. It returns the new state. Invalid moves return null.
5. **makeMove()**: connects the rules to the page. It checks whether play is allowed, calls GridRules.play(), saves the returned state, updates scores for a win, prints the round result with console.log(), and redraws the interface. A draw earns no points.
6. **startMatch(), newMatch(), restartGame()**: newMatch() resets scores and prepares a waiting game. startMatch() allows play. restartGame() prepares a round; if the match has already started, the round becomes active. The restart button handles whether to restart, advance to the next round, or prepare a new match.
7. **advanceTurn()**: schedules a computer move only when the current player is controlled by AI and the game is active. A revision number prevents an old timer from making a move after a reset or pause.
8. **choose()**: selects the AI move. Study this after understanding normal moves.
9. **pauseForSetup() and resumeFromSetup()**: pause an active round while settings are open and resume it when the menu closes. Changing opponent, difficulty, or rules resets the match and requires Start match again.
10. **Section C**: connects settings-menu buttons to those functions. It also handles closing the menu and enabling impact frames.

## 3. Trace one turn

    Player clicks an empty square
      -> the click listener calls makeMove(index, currentPlayer)
      -> makeMove checks gameActive and the current player
      -> GridRules.play validates and calculates the next state
      -> if the round ended: score/result/console output update
      -> otherwise: the next player's turn is prepared
      -> renderBoard updates the visible marks
      -> updateTensionEffects adjusts the presentation

The state decides the result. The animation does not decide who wins.

## 4. Explain the AI simply

Minimax tries possible moves and assumes that the opponent will choose a good reply. It prefers outcomes that help the AI and avoids outcomes that help the opponent.

Classic searches to the end of the game. Hard Classic always uses the search. Easy chooses randomly 70% of the time; Medium does so 20% of the time. Otherwise they search.

Vanishing Marks can continue much longer, so its search is limited: eight moves ahead on Hard, four on the other levels when they search. At the limit, evaluate() estimates how promising the position is. Alpha-beta pruning skips branches that cannot improve a decision. Hard Vanishing is not guaranteed unbeatable.

Classic draws when the board is full without a winner. Vanishing draws after three occurrences of the same state or 60 moves without a win. Repetition includes turn and mark order, not just the visible squares.

## 5. Match and effect behavior

- First to three round wins wins the match. Draws give no points.
- The starting symbol alternates after a completed round, including a draw. Restarting an unfinished round keeps its starter and score.
- A new match waits until Start match is pressed. The AI cannot move before that.
- Vivid and Extreme add lightning, cracks, magma, electrical surges, and shaking. Calm and system reduced motion suppress animated storm effects.
- countLightningImpact() counts lightning strikes. It triggers an 85ms high-contrast frame after three strikes, then four, repeating at strikes 3, 7, 10, 14. The cadence resets each round.
- clearImpactFrame() removes that brief frame and clears its timer. stopLightning() also clears it, preventing it from getting stuck after a pause or reset.

## 6. Evidence for your eight requirements

| Requirement | What to point to in script.js |
| --- | --- |
| At least three let/const bindings | gameMode, difficulty, currentPlayer |
| At least two conditional structures | play() checks results; updateTensionEffects() checks intensity tiers |
| At least two loops | for loops in initEmbers() and initSmoke() |
| At least three reusable functions | makeMove(), advanceTurn(), newMatch() |
| An array and an object | board array; state object and scores instance |
| map, filter, or reduce | map() in key(); filter() in evaluate() |
| Class with constructor and method | ScoreBoard constructor, addWin(), reset() |
| prompt and/or console.log | console.log() in makeMove() prints completed-round results |

## 7. Short practice answers for your hearing

**What is the purpose of each file?** HTML defines the elements, CSS styles them, and JavaScript controls behavior.

**How do you prevent an illegal move?** makeMove() checks the game phase and player; play() verifies that the index is an integer and the square is empty.

**How do you detect a win?** I compare the board with eight winning patterns and check whether all three positions contain the current player's symbol.

**Why copy state?** Trial moves for the AI must not change the real board. Copying also keeps the previous state available for rendering changes.

**What does the class do?** ScoreBoard stores X and O scores and supplies methods to add a win and reset them.

**Why use timers?** They delay AI turns and schedule effects. Timers are cancelled when needed, and the revision check rejects stale AI work.

**Did you use AI assistance?** Answer honestly about the assistance you used. Demonstrate your understanding by tracing a move and explaining or changing a small function. Do not claim authorship or understanding you cannot demonstrate.

## 8. A practical study plan

First session: HTML and board indexes. Second: create(), play(), win(), and ScoreBoard. Third: trace makeMove() and the start/reset flow. Fourth: understand the AI and practise the questions above. Study the effects last.

This version has fewer files, not fewer features. The combined script is still long because it retains the complete visual effects. The section comments are a reading map; they do not change execution order. In CSS, later rules intentionally override earlier ones.

## Match point and revised epic comeback
At two wins the score display shows MATCH POINT. Winning 3–2 after trailing 0–2 triggers the comeback; draws preserve eligibility. New match clears it.

The message is standalone original 5×7 pixel lettering, with no banner. A large bolt descends over about 0.1 seconds. The impact frame lasts 85ms, then wide faults spread through the board. Thirty-six polygon pieces shake and sink into a clipped crater. A 128×128 canvas simulates fire: heat rises, spreads to neighboring pixels, cools, and becomes embers. Fire art is original, with Noita gameplay used as a visual reference: https://www.gamingonlinux.com/2024/04/the-incredible-pixel-smashing-game-noita-got-a-huge-free-update/

Study comebackText(), startCraterFire(), fractureBoard(), sinkBoard(), and showEpicComeback(). The main stages occur at 450ms (bolt), 550ms (impact/fire), 1450ms (collapse), and 4300ms (shaking ends). Fire ends about 5.95 seconds after the announcement.

clearComebackEffects() cancels both timeouts and the animation frame loop and removes generated elements. Reset/New match/Play again restore the board. Calm and reduced motion show only the pixel text; switching to Calm cancels an active sequence.

Browser verification covered real X and O comeback matches, delayed impact, 36 fragments, sinking, quake, full cleanup, mid-collapse reset, reduced motion, Calm cancellation and a 320px viewport.

The fire now has a connected ignition front that rises to the top of the board over 1.8 seconds, with uneven tips and heat diffusion. The lightning uses sharp corners and a small glow instead of a broad blur. This folder is the live three-code-file copy; open index.html directly or refresh its browser tab after edits.

## Reactive tabletop update
The game still has three code files and unchanged rules. Search for “Table atmosphere” in script.js to study the new visual functions.

- updateTableAtmosphere() draws responsive SVG power cables and highlights the active player's connection. The paths change with the screen size. Pausing or ending a round turns off the active feed.
- placementFeedback() briefly depresses the tile and draws diagonal sparks for X or a circular ripple for O, with small dust particles.
- awardFeedback() gives the winning score unit a short pulse. The three score pips are now fuse indicators; the last empty fuse sparks at match point.
- Lightning cracks now persist through Next round and Restart round. New match (including changing opponent, rules or difficulty) clears them. These marks are cosmetic and never block a legal move. Calm retains the damage without animated electrical activity.
- collapseDust() creates small debris before sinkBoard() drops the larger pieces. The comeback reset cleanup removes the debris with the rest of the scene.
- tableLater() tracks short visual timers. clearTableFeedback() cancels them and removes move feedback on reset or when effects are disabled.

The new effects respect reduced motion. Verification covered alternating power feeds, X/O feedback, score fuses, damage across rounds, new-match cleanup, settings pause, dust-before-chunks timing, reset during collapse and 320/390/768/1280px widths. New game mechanics are deferred.

## Meaningful move landings
Cable endpoints and curve control points are mirrored around the board center on desktop and mobile.

Normal moves drop a short distance in 150ms. chooseLanding() selects a 290ms heavy drop when a move creates a new immediate winning threat or removes all of the opponent's immediate winning replies. Only one such non-winning heavy landing is allowed per round. Winning moves always receive the stronger landing. The board shakes once at contact; dust, fragments and X sparks or an O ripple appear after the drop.

immediateWins() uses GridRules.play(), so it accounts for disappearing marks rather than assuming every two-in-a-row is a threat. The visual limit resets with each round. Moves still obey the same rules. Calm/reduced motion skips the drop; reset cancels temporary objects and restores hidden mark slots.

## Effect-setting fix
Auto follows the system reduced-motion preference. Vivid and Extreme explicitly enable animations, even if the system requests reduced motion; Calm keeps the optional storm/landing animations off. The reduced-motion CSS now uses the same body class as the JavaScript decision so the two cannot disagree. The settings menu displays the effective status. Lightning requires at least five moves in an active round.


### Comeback animation sequence
A comeback still means winning 3–2 after trailing 0–2. The final move index is passed to showEpicComeback. The scoreboard dims, its cable sends a pulse, and lightning targets that tile. fractureBoard builds paths from its center. sinkBoard delays each fragment using its distance from that tile. Dust appears before fire, and text appears after lightning fades. These effects never change the rules or score. comebackLater tracks callbacks with a generation number; clearComebackEffects cancels timers and animation frames and removes temporary styles on reset. Calm and Auto with reduced motion show only the text.
