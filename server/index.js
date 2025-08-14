import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import bodyParser from "body-parser";
import cors from "cors";
import crypto from "crypto";
import { saveQuizJson, getQuizJson } from "./storage.js";
import { validateQuiz } from "./validateQuiz.js";
import { attachWebPubSubAdapter } from "./webpubsub.js";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: process.env.CORS_ORIGIN || "*", methods: ["GET","POST"] }
});

await attachWebPubSubAdapter(io);

app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(bodyParser.json({ limit: "2mb" }));
app.use(express.static("public"));

const PORT = process.env.PORT || 8080;

// In-memory session state for MVP
const sessions = new Map();

function createSessionState(sessionId, quiz){
  return {
    status: "lobby",
    createdAt: Date.now(),
    currentIndex: -1,
    players: { p1: null, p2: null }, // { id, name, socketId, score }
    quizMeta: {
      title: quiz.title || "Quiz",
      settings: {
        timePerQuestionSec: quiz?.settings?.timePerQuestionSec ?? 20,
        readDelaySec: quiz?.settings?.readDelaySec ?? 3
      }
    },
    history: [],
    answers: { p1: null, p2: null } // per-question temp answers
  };
}

function getRoomPlayers(state){
  const players = [];
  for (const k of ["p1","p2"]){
    if (state.players[k]) players.push({ id:k, name: state.players[k].name, score: state.players[k].score || 0, online: !!state.players[k].socketId });
  }
  return players;
}

function broadcastRoomState(sessionId){
  const state = sessions.get(sessionId);
  if (!state) return;
  io.to(sessionId).emit("room:state", {
    players: getRoomPlayers(state),
    status: state.status,
    currentIndex: state.currentIndex,
    settings: state.quizMeta.settings
  });
}

function scrubQuestionForClient(q){
  const { answerIndex, ...rest } = q;
  return rest;
}

app.post("/api/sessions", async (req, res) => {
  try {
    const quiz = req.body?.quiz || req.body;
    const ok = validateQuiz(quiz);
    if (!ok.valid) return res.status(400).json({ error: ok.error });

    const sessionId = crypto.randomBytes(3).toString("hex").toUpperCase(); // 6 chars
    await saveQuizJson(sessionId, quiz);
    const state = createSessionState(sessionId, quiz);
    sessions.set(sessionId, state);

    const joinUrl = `${req.protocol}://${req.get("host")}/join.html?c=${sessionId}`;
    res.status(201).json({ sessionId, joinUrl, settings: state.quizMeta.settings });
  } catch (e){
    console.error(e);
    res.status(500).json({ error: "Failed to create session" });
  }
});

app.post("/api/join", async (req, res) => {
  try {
    const { sessionId, playerName } = req.body || {};
    if (!sessionId) return res.status(400).json({ error: "Missing sessionId" });
    if (!sessions.has(sessionId)) return res.status(404).json({ error: "Session not found" });

    const state = sessions.get(sessionId);
    let slot = null;
    if (!state.players.p1) slot = "p1";
    else if (!state.players.p2) slot = "p2";
    else return res.status(409).json({ error: "Session full" });

    const name = (playerName || (slot === "p1" ? "Player 1" : "Player 2")).slice(0,24);
    state.players[slot] = { id: slot, name, socketId: null, score: 0 };
    res.json({ room: sessionId, playerId: slot, name });
  } catch (e){
    console.error(e);
    res.status(500).json({ error: "Join failed" });
  }
});

io.on("connection", (socket) => {
  socket.on("room:join", async ({ room, playerId, name }) => {
    if (!sessions.has(room)) return socket.emit("error", { error: "Session not found" });
    const state = sessions.get(room);
    if (!["p1","p2"].includes(playerId)) return socket.emit("error", { error: "Invalid playerId" });

    if (!state.players[playerId]){
      // Late-join without /api/join
      state.players[playerId] = { id: playerId, name: name || (playerId==="p1"?"Player 1":"Player 2"), socketId: null, score: 0 };
    } else {
      if (name) state.players[playerId].name = name;
    }

    socket.join(room);
    state.players[playerId].socketId = socket.id;
    broadcastRoomState(room);
  });

  socket.on("host:start", async ({ room }) => {
    const state = sessions.get(room);
    if (!state) return;
    state.status = "active";
    state.currentIndex = 0;
    const quiz = await getQuizJson(room);
    const q = quiz.questions[state.currentIndex];
    io.to(room).emit("question:show", {
      index: state.currentIndex,
      q: scrubQuestionForClient(q),
      settings: state.quizMeta.settings
    });
  });

  socket.on("answer:submit", async ({ room, index, playerId, answerIndex, timeLeftSec }) => {
    const state = sessions.get(room);
    if (!state || state.currentIndex !== index) return;
    if (!["p1","p2"].includes(playerId)) return;

    state.answers[playerId] = { answerIndex, timeLeftSec: Math.max(0, Math.min(999, Number(timeLeftSec)||0)) };

    const bothAnswered = state.answers.p1 && state.answers.p2;
    if (bothAnswered){
      const quiz = await getQuizJson(room);
      const correctIndex = quiz.questions[index].answerIndex;

      const p1 = state.answers.p1;
      const p2 = state.answers.p2;

      const p1Correct = p1.answerIndex === correctIndex;
      const p2Correct = p2.answerIndex === correctIndex;

      const pts = (ok, t) => ok ? Math.max(0, Math.floor(t||0)) : 0;

      if (state.players.p1) state.players.p1.score += pts(p1Correct, p1.timeLeftSec);
      if (state.players.p2) state.players.p2.score += pts(p2Correct, p2.timeLeftSec);

      const revealPayload = {
        index,
        correctIndex,
        perPlayer: [
          { id: "p1", choice: p1.answerIndex, correct: p1Correct, pointsAwarded: pts(p1Correct, p1.timeLeftSec) },
          { id: "p2", choice: p2.answerIndex, correct: p2Correct, pointsAwarded: pts(p2Correct, p2.timeLeftSec) }
        ],
        runningTotals: {
          p1: state.players.p1?.score || 0,
          p2: state.players.p2?.score || 0
        }
      };

      state.history.push({
        index,
        p1Choice: p1.answerIndex,
        p2Choice: p2.answerIndex,
        correctIndex,
        p1Points: pts(p1Correct, p1.timeLeftSec),
        p2Points: pts(p2Correct, p2.timeLeftSec)
      });

      // reset per-question answers for next round
      state.answers = { p1: null, p2: null };

      io.to(room).emit("answer:reveal", revealPayload);
    }
  });

  socket.on("game:next", async ({ room }) => {
    const state = sessions.get(room);
    if (!state) return;
    const quiz = await getQuizJson(room);
    state.currentIndex += 1;
    if (state.currentIndex >= quiz.questions.length){
      state.status = "done";
      io.to(room).emit("game:final", {
        totals: {
          p1: state.players.p1?.score || 0,
          p2: state.players.p2?.score || 0
        },
        history: state.history
      });
      return;
    }
    const q = quiz.questions[state.currentIndex];
    io.to(room).emit("question:show", {
      index: state.currentIndex,
      q: scrubQuestionForClient(q),
      settings: state.quizMeta.settings
    });
    broadcastRoomState(room);
  });

  socket.on("pause:toggle", ({ room, paused }) => {
    io.to(room).emit("pause:state", { paused: !!paused });
  });

  socket.on("disconnect", () => {
    for (const [sid, state] of sessions){
      for (const k of ["p1","p2"]){
        if (state.players[k]?.socketId === socket.id){
          state.players[k].socketId = null;
          broadcastRoomState(sid);
        }
      }
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server listening on :${PORT}`);
});
