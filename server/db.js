const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const dir = path.join(__dirname, "..", "data");
fs.mkdirSync(dir, { recursive: true });

const db = new Database(path.join(dir, "grid-duel.db"));
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_name TEXT NOT NULL,
    mode TEXT NOT NULL CHECK (mode IN ('pvc','pvp','cvc')),
    ruleset TEXT NOT NULL CHECK (ruleset IN ('classic','vanish')),
    difficulty TEXT NOT NULL CHECK (difficulty IN ('easy','medium','hard')),
    winner TEXT NOT NULL CHECK (winner IN ('X','O')),
    x_wins INTEGER NOT NULL,
    o_wins INTEGER NOT NULL,
    rounds INTEGER NOT NULL,
    played_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

module.exports = db;