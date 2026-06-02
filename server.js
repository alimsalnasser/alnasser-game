const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, "public")));

const rooms = new Map();

function newGame() {
  return {
    turn: "blue",
    players: {},
    board: {
      blue: { x: 8, y: 1 },
      red: { x: 4, y: 6 },
      walls: []
    },
    winner: null
  };
}

function roomState(roomId) {
  if (!rooms.has(roomId)) rooms.set(roomId, newGame());
  return rooms.get(roomId);
}

function isBlocked(game, x1, y1, x2, y2) {
  return game.board.walls.some(w =>
    (w.x1 === x1 && w.y1 === y1 && w.x2 === x2 && w.y2 === y2) ||
    (w.x1 === x2 && w.y1 === y2 && w.x2 === x1 && w.y2 === y1)
  );
}

function canMove(game, color, x, y) {
  if (x < 0 || x > 8 || y < 0 || y > 8) return false;
  const p = game.board[color];
  const dist = Math.abs(p.x - x) + Math.abs(p.y - y);
  if (dist !== 1) return false;
  if (isBlocked(game, p.x, p.y, x, y)) return false;
  const other = color === "blue" ? "red" : "blue";
  if (game.board[other].x === x && game.board[other].y === y) return false;
  return true;
}

function send(roomId) {
  io.to(roomId).emit("state", roomState(roomId));
}

io.on("connection", socket => {
  socket.on("join", ({ roomId, name }) => {
    roomId = String(roomId || "demo").trim().slice(0, 30);
    const game = roomState(roomId);

    let color = null;
    if (!game.players.blue) color = "blue";
    else if (!game.players.red) color = "red";
    else color = "spectator";

    if (color !== "spectator") {
      game.players[color] = { id: socket.id, name: name || color };
    }

    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.color = color;

    socket.emit("joined", { roomId, color });
    send(roomId);
  });

  socket.on("move", ({ x, y }) => {
    const { roomId, color } = socket.data;
    if (!roomId || !["blue", "red"].includes(color)) return;
    const game = roomState(roomId);
    if (game.winner || game.turn !== color) return;

    x = Number(x); y = Number(y);
    if (!canMove(game, color, x, y)) return;

    game.board[color] = { x, y };
    if (color === "blue" && y === 8) game.winner = "blue";
    if (color === "red" && y === 0) game.winner = "red";
    game.turn = color === "blue" ? "red" : "blue";
    send(roomId);
  });

  socket.on("wall", ({ x1, y1, x2, y2 }) => {
    const { roomId, color } = socket.data;
    if (!roomId || !["blue", "red"].includes(color)) return;
    const game = roomState(roomId);
    if (game.winner || game.turn !== color) return;

    x1 = Number(x1); y1 = Number(y1); x2 = Number(x2); y2 = Number(y2);
    if ([x1,y1,x2,y2].some(n => Number.isNaN(n))) return;
    if (x1 < 0 || x1 > 8 || x2 < 0 || x2 > 8 || y1 < 0 || y1 > 8 || y2 < 0 || y2 > 8) return;
    if (Math.abs(x1-x2) + Math.abs(y1-y2) !== 1) return;
    if (isBlocked(game, x1,y1,x2,y2)) return;

    game.board.walls.push({ x1,y1,x2,y2,color });
    game.turn = color === "blue" ? "red" : "blue";
    send(roomId);
  });

  socket.on("restart", () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    const old = roomState(roomId);
    const game = newGame();
    game.players = old.players;
    rooms.set(roomId, game);
    send(roomId);
  });

  socket.on("disconnect", () => {
    const { roomId, color } = socket.data;
    if (!roomId || !["blue", "red"].includes(color)) return;
    const game = roomState(roomId);
    if (game.players[color]?.id === socket.id) delete game.players[color];
    send(roomId);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Running on http://localhost:" + PORT));
