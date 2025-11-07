const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { v4: uuidv4 } = require("uuid");

const app = express();
const server = http.createServer(app);

// Configuración para Vercel
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(express.static("public"));

// Almacenar información de jugadores
let rooms = {};
let playerNames = {};

io.on("connection", (socket) => {
  console.log("Nuevo jugador conectado:", socket.id);

  socket.on("createRoom", (playerName) => {
    console.log("Creando sala para:", playerName);
    const roomId = uuidv4().slice(0, 6);
    console.log("Código de sala generado:", roomId);
    
    rooms[roomId] = { 
      players: [], 
      winner: null, 
      gameActive: false,
      playerNames: {}
    };
    socket.join(roomId);
    rooms[roomId].players.push(socket.id);
    rooms[roomId].playerNames[socket.id] = playerName || `Jugador ${rooms[roomId].players.length}`;
    
    console.log("Sala creada:", roomId, "Jugadores:", rooms[roomId].players);
    socket.emit("roomCreated", { roomId, players: rooms[roomId].players, playerNames: rooms[roomId].playerNames });
  });

  socket.on("joinRoom", ({ roomId, playerName }) => {
    if (rooms[roomId] && !rooms[roomId].gameActive) {
      socket.join(roomId);
      rooms[roomId].players.push(socket.id);
      rooms[roomId].playerNames[socket.id] = playerName || `Jugador ${rooms[roomId].players.length}`;
      socket.emit("roomJoined", { roomId, players: rooms[roomId].players, playerNames: rooms[roomId].playerNames });
      io.to(roomId).emit("playerJoined", { players: rooms[roomId].players, playerNames: rooms[roomId].playerNames });
    } else {
      socket.emit("roomError", "Sala no válida o juego en progreso.");
    }
  });

  socket.on("startGame", (roomId) => {
    if (rooms[roomId] && rooms[roomId].players.length >= 2) {
      rooms[roomId].gameActive = true;
      rooms[roomId].winner = null;
      io.to(roomId).emit("gameStarted");
    }
  });

  socket.on("pressButton", (roomId) => {
    if (!rooms[roomId] || !rooms[roomId].gameActive) return;

    if (rooms[roomId].winner === null) {
      rooms[roomId].winner = socket.id;
      const winnerName = rooms[roomId].playerNames[socket.id];
      io.to(roomId).emit("gameResult", { 
        winner: socket.id, 
        winnerName: winnerName,
        players: rooms[roomId].players,
        playerNames: rooms[roomId].playerNames
      });
    }
  });

  socket.on("resetGame", (roomId) => {
    if (rooms[roomId]) {
      rooms[roomId].winner = null;
      rooms[roomId].gameActive = false;
      io.to(roomId).emit("gameReset", {
        players: rooms[roomId].players,
        playerNames: rooms[roomId].playerNames
      });
    }
  });

  socket.on("disconnect", () => {
    for (let roomId in rooms) {
      rooms[roomId].players = rooms[roomId].players.filter(id => id !== socket.id);
      delete rooms[roomId].playerNames[socket.id];
      if (rooms[roomId].players.length === 0) {
        delete rooms[roomId];
      } else {
        io.to(roomId).emit("playerLeft", { 
          players: rooms[roomId].players, 
          playerNames: rooms[roomId].playerNames 
        });
      }
    }
  });
});

// Puerto para Vercel
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
