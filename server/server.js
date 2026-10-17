const express = require("express");
const path = require("path");
const db = require("./db");

const root = path.join(__dirname, "..");
const app = express();
app.use(express.json());

// Serve only the game files, not the server or database folders
app.get("/", (req, res) => res.sendFile(path.join(root, "index.html")));
app.get("/script.js", (req, res) => res.sendFile(path.join(root, "script.js")));
app.get("/style.css", (req, res) => res.sendFile(path.join(root, "style.css")));

// Save one finished match
app.post("/api/matches", (req, res) => {
  const { name, mode, ruleset, difficulty, winner, xWins, oWins, rounds } = req.body;
  const valid =
    typeof name === "string" && name.trim() &&
    ["pvc", "pvp", "cvc"].includes(mode) &&
    ["classic", "vanish"].includes(ruleset) &&
    ["easy", "medium", "hard"].includes(difficulty) &&
    ["X", "O"].includes(winner) &&
    [xWins, oWins, rounds].every(Number.isInteger);
  if (!valid) return res.status(400).json({ error: "Invalid data" });

  db.prepare(`
    INSERT INTO matches
      (player_name, mode, ruleset, difficulty, winner, x_wins, o_wins, rounds)
    VALUES (?,?,?,?,?,?,?,?)
  `).run(name.trim().slice(0, 20), mode, ruleset, difficulty, winner, xWins, oWins, rounds);
  res.json({ ok: true });
});

// Leaderboard: Player vs AI matches only (the human is always X)
app.get("/api/leaderboard", (req, res) => {
  const rows = db.prepare(`
    SELECT player_name AS name,
           SUM(winner = 'X') AS wins,
           COUNT(*) AS played
    FROM matches
    WHERE mode = 'pvc'
    GROUP BY player_name
    ORDER BY wins DESC, played ASC
    LIMIT 10
  `).all();
  res.json(rows);
});

app.listen(3001, () => console.log("Grid Duel at http://localhost:3001"));