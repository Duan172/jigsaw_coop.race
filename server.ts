import express from 'express';
import http from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { createInitialRooms, PRESET_IMAGES } from './src/utils/defaultData.js';
import { createJigsawPieces, getClusterStats } from './src/utils/jigsawHelper.js';
import { RoomState, TeamRanking, StudentScore, PuzzleSet } from './src/types.js';

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = 3000;

  app.use(express.json({ limit: '20mb' }));

  // In-memory Authoritative Game State
  const rooms: Record<string, RoomState> = createInitialRooms(3, 3);

  // In-memory Library of Puzzle Sets created or uploaded by teacher
  const puzzleSets: PuzzleSet[] = PRESET_IMAGES.map((p, idx) => ({
    id: `preset-${idx + 1}`,
    title: p.title,
    imageUrl: p.url,
    gridRows: 3,
    gridCols: 3,
    question: { ...p.defaultQuestion },
    createdAt: Date.now() - (10 - idx) * 60000,
  }));

  // Avatar colors for students
  const STUDENT_COLORS = [
    '#6366f1', '#0ea5e9', '#10b981', '#f43f5e', '#8b5cf6',
    '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#f59e0b',
    '#14b8a6', '#3b82f6'
  ];

  // Persistent student score map: tracks successful snaps by student name
  const studentSnapScores = new Map<string, {
    name: string;
    piecesCount: number;
    snapsCount: number;
    roomId: string;
    roomName: string;
    badge: string;
    color: string;
    lastPieceTime: number;
  }>();

  // All participating students across rooms (active and past)
  const participatingStudentsMap = new Map<string, {
    name: string;
    roomId: string;
    roomName: string;
    badge: string;
    color: string;
    joinedAt: number;
    snapsCount: number;
    isOnline: boolean;
  }>();

  // Calculate student leaderboard (most piece/frame snaps created)
  function getStudentLeaderboard(): StudentScore[] {
    const list = Array.from(studentSnapScores.values());
    list.sort((a, b) => {
      const snapA = a.snapsCount ?? a.piecesCount;
      const snapB = b.snapsCount ?? b.piecesCount;
      if (snapB !== snapA) {
        return snapB - snapA;
      }
      return a.name.localeCompare(b.name);
    });

    return list.map((s, idx) => ({
      ...s,
      snapsCount: s.snapsCount ?? s.piecesCount,
      rank: idx + 1,
    }));
  }

  function getRankings(): TeamRanking[] {
    const list: TeamRanking[] = Object.values(rooms).map(r => {
      const stats = getClusterStats(r.pieces, r.totalPieces);
      const placed = r.pieces.filter(p => p.isLocked).length;

      return {
        roomId: r.id,
        roomName: r.name,
        color: r.color,
        accentColor: r.accentColor,
        badge: r.badge,
        memberCount: r.members.length,
        status: r.status,
        puzzleDurationMs: r.puzzleCompletedTime,
        totalDurationMs: r.totalDurationMs,
        piecesPlaced: placed,
        totalPieces: r.totalPieces,
        answerSubmitted: r.answerSubmitted ? {
          answerText: r.answerSubmitted.answerText,
          answeredBy: r.answerSubmitted.answeredBy,
        } : null,
      };
    });

    // Sort order: COMPLETED (fastest total time), QUESTION (fastest puzzle time), PLAYING (most connected pieces), WAITING
    list.sort((a, b) => {
      if (a.status === 'COMPLETED' && b.status === 'COMPLETED') {
        return (a.totalDurationMs || 0) - (b.totalDurationMs || 0);
      }
      if (a.status === 'COMPLETED') return -1;
      if (b.status === 'COMPLETED') return 1;

      if (a.status === 'QUESTION' && b.status === 'QUESTION') {
        return (a.puzzleDurationMs || 0) - (b.puzzleDurationMs || 0);
      }
      if (a.status === 'QUESTION') return -1;
      if (b.status === 'QUESTION') return 1;

      if (a.status === 'PLAYING' && b.status === 'PLAYING') {
        return b.piecesPlaced - a.piecesPlaced;
      }
      if (a.status === 'PLAYING') return -1;
      if (b.status === 'PLAYING') return 1;

      return 0;
    });

    return list.map((item, idx) => ({ ...item, rank: idx + 1 }));
  }

  function broadcastLeaderboards() {
    const teamRankings = getRankings();
    const studentScores = getStudentLeaderboard();
    io.emit('rankings:updated', teamRankings);
    io.emit('student_scores:updated', studentScores);
  }

  // Socket.IO Server
  const io = new SocketIOServer(server, {
    cors: { origin: '*' },
    pingTimeout: 30000,
  });

  // Track socket to room mapping
  const socketUserMap = new Map<string, { roomId: string; name: string }>();

  io.on('connection', (socket: Socket) => {
    // Send full summary to newly connected client
    socket.emit('rooms:summary', {
      rooms: Object.values(rooms).map(r => ({
        id: r.id,
        name: r.name,
        badge: r.badge,
        color: r.color,
        accentColor: r.accentColor,
        memberCount: r.members.length,
        status: r.status,
        piecesPlaced: r.pieces.filter(p => p.isLocked).length,
        totalPieces: r.totalPieces,
        totalDurationMs: r.totalDurationMs,
      })),
      rankings: getRankings(),
      studentScores: getStudentLeaderboard(),
      puzzleSets,
    });

    // Student joins a room
    socket.on('room:join', ({ roomId, studentName }: { roomId: string; studentName: string }) => {
      const room = rooms[roomId];
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      // Leave any previous room
      const existing = socketUserMap.get(socket.id);
      if (existing) {
        socket.leave(existing.roomId);
        const prevRoom = rooms[existing.roomId];
        if (prevRoom) {
          prevRoom.members = prevRoom.members.filter(m => m.socketId !== socket.id);
          io.to(existing.roomId).emit('room:members_updated', prevRoom.members);
        }
      }

      socket.join(roomId);
      const cleanName = (studentName || 'Student').trim().slice(0, 25);
      const color = STUDENT_COLORS[room.members.length % STUDENT_COLORS.length];

      // Add to room members if not already
      const existingIdx = room.members.findIndex(m => m.socketId === socket.id);
      if (existingIdx >= 0) {
        room.members[existingIdx].name = cleanName;
      } else {
        room.members.push({
          socketId: socket.id,
          name: cleanName,
          color,
          joinedAt: Date.now(),
        });
      }

      socketUserMap.set(socket.id, { roomId, name: cleanName });

      // Track in participating students directory for teacher overview
      const participantKey = `${cleanName.toLowerCase()}-${room.id}`;
      const existingPart = participatingStudentsMap.get(participantKey);
      const curScore = studentSnapScores.get(`${cleanName}-${room.id}`);
      participatingStudentsMap.set(participantKey, {
        name: cleanName,
        roomId: room.id,
        roomName: room.name,
        badge: room.badge,
        color: existingPart?.color || color,
        joinedAt: existingPart?.joinedAt || Date.now(),
        snapsCount: curScore?.snapsCount ?? 0,
        isOnline: true,
      });

      // Send initial room state to this user
      socket.emit('room:state', room);

      // Broadcast updated members list to the room
      io.to(roomId).emit('room:members_updated', room.members);

      // Notify summary to all
      io.emit('rooms:summary_updated', {
        roomId,
        memberCount: room.members.length,
        status: room.status,
      });
    });

    // Real-time piece/cluster movement during drag
    socket.on('piece:move_cluster', ({ roomId, clusterId, deltaX, deltaY, pieces }: {
      roomId: string;
      clusterId: number;
      deltaX?: number;
      deltaY?: number;
      pieces?: Array<{ id: number; x: number; y: number }>;
    }) => {
      const room = rooms[roomId];
      if (!room) return;

      // Start timer on FIRST piece movement if not started yet!
      if (!room.startTime || room.status === 'WAITING') {
        room.status = 'PLAYING';
        room.startTime = Date.now();
        io.to(roomId).emit('room:timer_started', {
          roomId: room.id,
          startTime: room.startTime,
        });
        io.emit('room:state', room);
      }

      if (pieces && pieces.length > 0) {
        pieces.forEach(update => {
          const target = room.pieces.find(p => p.id === update.id);
          if (target && !target.isLocked) {
            target.x = update.x;
            target.y = update.y;
          }
        });
      }

      // Broadcast moving coordinates to other teammates in this room
      socket.to(roomId).emit('piece:cluster_moved', {
        clusterId,
        pieces,
      });
    });

    socket.on('room:start_timer', ({ roomId }: { roomId: string }) => {
      const room = rooms[roomId];
      if (!room) return;
      if (!room.startTime || room.status === 'WAITING') {
        room.status = 'PLAYING';
        room.startTime = Date.now();
        io.to(roomId).emit('room:timer_started', {
          roomId: room.id,
          startTime: room.startTime,
        });
        io.emit('room:state', room);
      }
    });

    // Cluster snapped together or snapped into frame
    socket.on('piece:cluster_snapped', ({ roomId, updates, studentName }: {
      roomId: string;
      updates: Array<{ id: number; x: number; y: number; clusterId: number; isLocked?: boolean }>;
      studentName: string;
    }) => {
      const room = rooms[roomId];
      if (!room) return;

      if (!room.startTime || room.status === 'WAITING') {
        room.status = 'PLAYING';
        room.startTime = Date.now();
        io.to(roomId).emit('room:timer_started', {
          roomId: room.id,
          startTime: room.startTime,
        });
      }

      // Apply coordinates, cluster assignments, and frame locking status
      updates.forEach(u => {
        const piece = room.pieces.find(p => p.id === u.id);
        if (piece) {
          piece.x = u.x;
          piece.y = u.y;
          piece.clusterId = u.clusterId;
          if (u.isLocked) {
            piece.isLocked = true;
          }
          piece.lastMovedBy = studentName || 'Student';
        }
      });

      // Credit student snap score (1 successful snap recorded)
      const cleanName = (studentName || 'Student').trim();
      const scoreKey = `${cleanName}-${room.id}`;
      const existingScore = studentSnapScores.get(scoreKey);
      if (existingScore) {
        existingScore.piecesCount += 1;
        existingScore.snapsCount = (existingScore.snapsCount || existingScore.piecesCount - 1) + 1;
        existingScore.lastPieceTime = Date.now();
      } else {
        const member = room.members.find(m => m.name.toLowerCase() === cleanName.toLowerCase());
        studentSnapScores.set(scoreKey, {
          name: cleanName,
          piecesCount: 1,
          snapsCount: 1,
          roomId: room.id,
          roomName: room.name,
          badge: room.badge,
          color: member ? member.color : room.accentColor,
          lastPieceTime: Date.now(),
        });
      }

      // Update student's snap count in participating roster
      const participantKey = `${cleanName.toLowerCase()}-${room.id}`;
      const part = participatingStudentsMap.get(participantKey);
      if (part) {
        part.snapsCount = studentSnapScores.get(scoreKey)?.snapsCount || 1;
      }

      // Check if all pieces have merged into 1 single cluster or locked into target frame
      const stats = getClusterStats(room.pieces, room.totalPieces);
      const isCompleted = stats.isFullySolved;

      if (isCompleted && room.status === 'PLAYING') {
        room.status = 'COMPLETED';
        const now = Date.now();
        room.puzzleCompletedTime = Math.max(1000, now - (room.startTime || now));
        room.totalDurationMs = room.puzzleCompletedTime;
        room.pieces.forEach(p => {
          p.isLocked = true;
        });
      }

      // Broadcast snapped update to everyone in room
      io.to(roomId).emit('piece:snapped_broadcast', {
        updates,
        isCompleted,
        roomStatus: room.status,
        stats,
        snappedBy: cleanName,
      });

      broadcastLeaderboards();
    });

    // Submit open answer to the post-puzzle question (NO ABCD!)
    socket.on('question:submit', ({ roomId, answerText, studentName }: {
      roomId: string;
      answerText: string;
      studentName: string;
    }) => {
      const room = rooms[roomId];
      if (!room || room.status !== 'QUESTION') return;

      const now = Date.now();
      const start = room.startTime || now;
      const puzzleTime = room.puzzleCompletedTime || (now - start);

      room.status = 'COMPLETED';
      room.questionCompletedTime = Math.max(0, (now - start) - puzzleTime);
      room.totalDurationMs = now - start;
      room.answerSubmitted = {
        answerText: (answerText || '').trim(),
        answeredBy: studentName || 'Team',
        submittedAt: now,
      };

      io.to(roomId).emit('question:result', {
        answerText: room.answerSubmitted.answerText,
        answeredBy: studentName,
        sampleAnswer: room.question.sampleAnswer,
        explanation: room.question.explanation,
        totalDurationMs: room.totalDurationMs,
        puzzleCompletedTime: room.puzzleCompletedTime,
      });

      io.to(roomId).emit('room:state', room);

      // Check if all rooms completed
      const allRoomsCompleted = Object.values(rooms).every(r => r.status === 'COMPLETED');
      const rankings = getRankings();
      broadcastLeaderboards();

      if (allRoomsCompleted) {
        io.emit('competition:all_completed', { rankings });
      }
    });

    // Reaction emoji
    socket.on('room:reaction', ({ roomId, emoji, senderName }: { roomId: string; emoji: string; senderName: string }) => {
      io.to(roomId).emit('room:reaction_received', {
        id: Math.random().toString(36).slice(2),
        emoji,
        senderName: senderName || 'Teammate',
        timestamp: Date.now(),
      });
    });

    // Teacher start all rooms
    socket.on('teacher:start_all', () => {
      const now = Date.now();
      Object.values(rooms).forEach(r => {
        r.status = 'PLAYING';
        r.startTime = now;
        r.puzzleCompletedTime = null;
        r.questionCompletedTime = null;
        r.totalDurationMs = null;
        r.answerSubmitted = null;
        r.pieces = createJigsawPieces(r.gridRows, r.gridCols);
        io.to(r.id).emit('room:state', r);
      });
      broadcastLeaderboards();
      io.emit('competition:started', { startTime: now });
    });

    // Teacher reset all rooms
    socket.on('teacher:reset_all', () => {
      Object.values(rooms).forEach(r => {
        r.status = 'WAITING';
        r.startTime = null;
        r.puzzleCompletedTime = null;
        r.questionCompletedTime = null;
        r.totalDurationMs = null;
        r.answerSubmitted = null;
        r.pieces = createJigsawPieces(r.gridRows, r.gridCols);
        io.to(r.id).emit('room:state', r);
      });
      studentSnapScores.clear();
      broadcastLeaderboards();
      io.emit('competition:reset');
    });

    // Disconnect cleanup
    socket.on('disconnect', () => {
      const info = socketUserMap.get(socket.id);
      if (info) {
        const room = rooms[info.roomId];
        if (room) {
          room.members = room.members.filter(m => m.socketId !== socket.id);
          io.to(info.roomId).emit('room:members_updated', room.members);
          io.emit('rooms:summary_updated', {
            roomId: info.roomId,
            memberCount: room.members.length,
            status: room.status,
          });
        }
        const participantKey = `${info.name.toLowerCase()}-${info.roomId}`;
        const part = participatingStudentsMap.get(participantKey);
        if (part) {
          part.isOnline = false;
        }
        socketUserMap.delete(socket.id);
      }
    });
  });

  // Helper to get participating students roster
  function getParticipatingStudents() {
    const list = Array.from(participatingStudentsMap.values()).map(s => {
      const score = studentSnapScores.get(`${s.name}-${s.roomId}`);
      return {
        ...s,
        snapsCount: score?.snapsCount ?? score?.piecesCount ?? s.snapsCount,
      };
    });
    list.sort((a, b) => {
      if (b.snapsCount !== a.snapsCount) return b.snapsCount - a.snapsCount;
      return a.name.localeCompare(b.name);
    });
    return list;
  }

  // REST API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  app.get('/api/rooms', (req, res) => {
    res.json({
      rooms: Object.values(rooms),
      rankings: getRankings(),
      studentScores: getStudentLeaderboard(),
      participatingStudents: getParticipatingStudents(),
      puzzleSets,
    });
  });

  app.get('/api/teacher/students', (req, res) => {
    res.json(getParticipatingStudents());
  });

  app.get('/api/rooms/:id', (req, res) => {
    const room = rooms[req.params.id];
    if (!room) return res.status(404).json({ error: 'Room not found' });
    res.json(room);
  });

  // Teacher Passcode PIN state
  let teacherPin = '1234';

  app.get('/api/teacher/pin', (req, res) => {
    res.json({ pin: teacherPin });
  });

  app.post('/api/teacher/pin', (req, res) => {
    const { pin } = req.body;
    if (pin && typeof pin === 'string' && pin.trim().length > 0) {
      teacherPin = pin.trim();
      return res.json({ success: true, pin: teacherPin });
    }
    return res.status(400).json({ error: 'Invalid PIN' });
  });

  // 1. Puzzle Sets API
  app.get('/api/puzzle-sets', (req, res) => {
    res.json(puzzleSets);
  });

  app.post('/api/puzzle-sets', (req, res) => {
    const { title, imageUrl, gridRows, gridCols, question } = req.body;
    if (!title || !imageUrl) {
      return res.status(400).json({ error: 'Title and image are required' });
    }

    const rows = Math.max(2, Math.min(10, Number(gridRows) || 3));
    const cols = Math.max(2, Math.min(12, Number(gridCols) || 3));

    const newSet: PuzzleSet = {
      id: `set-${Date.now()}`,
      title: title.trim(),
      imageUrl: imageUrl.trim(),
      gridRows: rows,
      gridCols: cols,
      question: {
        text: question?.text || 'Explain the central concept depicted in this puzzle image:',
        sampleAnswer: question?.sampleAnswer || 'Model answer and analytical summary of the image.',
        explanation: question?.explanation || '',
      },
      createdAt: Date.now(),
    };
    puzzleSets.unshift(newSet);
    res.json({ success: true, puzzleSet: newSet, puzzleSets });
  });

  app.delete('/api/puzzle-sets/:id', (req, res) => {
    const idx = puzzleSets.findIndex(p => p.id === req.params.id);
    if (idx >= 0) {
      puzzleSets.splice(idx, 1);
    }
    res.json({ success: true, puzzleSets });
  });

  // 2. Room Management APIs
  app.post('/api/rooms', (req, res) => {
    const { name, badge, color, accentColor, puzzleSetId, imageUrl, imageTitle, gridRows, gridCols, question } = req.body;
    const roomId = `room-${Date.now()}`;

    let resolvedImageUrl = imageUrl || PRESET_IMAGES[0].url;
    let resolvedTitle = imageTitle || PRESET_IMAGES[0].title;
    let resolvedRows = Math.max(2, Math.min(10, Number(gridRows) || 3));
    let resolvedCols = Math.max(2, Math.min(12, Number(gridCols) || 3));
    let resolvedQuestion = question || PRESET_IMAGES[0].defaultQuestion;

    if (puzzleSetId) {
      const foundSet = puzzleSets.find(s => s.id === puzzleSetId);
      if (foundSet) {
        resolvedImageUrl = foundSet.imageUrl;
        resolvedTitle = foundSet.title;
        resolvedRows = foundSet.gridRows;
        resolvedCols = foundSet.gridCols;
        resolvedQuestion = foundSet.question;
      }
    }

    const totalPieces = resolvedRows * resolvedCols;
    const newRoom: RoomState = {
      id: roomId,
      name: name?.trim() || `Team ${Object.keys(rooms).length + 1}`,
      badge: badge || '⭐',
      color: color || 'indigo',
      accentColor: accentColor || '#6366f1',
      imageUrl: resolvedImageUrl,
      imageTitle: resolvedTitle,
      gridRows: resolvedRows,
      gridCols: resolvedCols,
      totalPieces,
      pieces: createJigsawPieces(resolvedRows, resolvedCols),
      status: 'WAITING',
      question: resolvedQuestion,
      members: [],
      startTime: null,
      puzzleCompletedTime: null,
      questionCompletedTime: null,
      totalDurationMs: null,
      answerSubmitted: null,
    };

    rooms[roomId] = newRoom;
    broadcastLeaderboards();
    io.emit('rooms:created', newRoom);
    res.json({ success: true, room: newRoom, rooms: Object.values(rooms) });
  });

  app.put('/api/rooms/:id', (req, res) => {
    const room = rooms[req.params.id];
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const { name, badge, color, accentColor } = req.body;
    if (name) room.name = name.trim();
    if (badge) room.badge = badge;
    if (color) room.color = color;
    if (accentColor) room.accentColor = accentColor;

    io.to(room.id).emit('room:state', room);
    broadcastLeaderboards();
    res.json({ success: true, room, rooms: Object.values(rooms) });
  });

  app.delete('/api/rooms/:id', (req, res) => {
    const roomId = req.params.id;
    if (!rooms[roomId]) return res.status(404).json({ error: 'Room not found' });
    if (Object.keys(rooms).length <= 1) {
      return res.status(400).json({ error: 'At least 1 team room must be maintained.' });
    }

    delete rooms[roomId];
    broadcastLeaderboards();
    io.emit('rooms:deleted', { roomId });
    res.json({ success: true, rooms: Object.values(rooms) });
  });

  // Teacher config update (Apply puzzle set or custom details to room or all rooms)
  app.post('/api/teacher/config', (req, res) => {
    const {
      targetRoomId,
      name,
      imageUrl,
      imageTitle,
      gridRows,
      gridCols,
      question,
      puzzleSetId,
    } = req.body;

    const targetList = targetRoomId === 'all'
      ? Object.values(rooms)
      : (rooms[targetRoomId] ? [rooms[targetRoomId]] : []);

    if (targetList.length === 0) {
      return res.status(400).json({ error: 'Invalid room id' });
    }

    let resolvedImageUrl = imageUrl;
    let resolvedTitle = imageTitle;
    let resolvedRows = gridRows ? Math.max(2, Math.min(10, Number(gridRows))) : undefined;
    let resolvedCols = gridCols ? Math.max(2, Math.min(12, Number(gridCols))) : undefined;
    let resolvedQuestion = question;

    if (puzzleSetId) {
      const foundSet = puzzleSets.find(s => s.id === puzzleSetId);
      if (foundSet) {
        resolvedImageUrl = foundSet.imageUrl;
        resolvedTitle = foundSet.title;
        resolvedRows = foundSet.gridRows;
        resolvedCols = foundSet.gridCols;
        resolvedQuestion = foundSet.question;
      }
    }

    targetList.forEach(room => {
      if (name && targetRoomId !== 'all') room.name = name;
      if (resolvedImageUrl) room.imageUrl = resolvedImageUrl;
      if (resolvedTitle) room.imageTitle = resolvedTitle;
      if (resolvedRows && resolvedCols) {
        room.gridRows = resolvedRows;
        room.gridCols = resolvedCols;
        room.totalPieces = room.gridRows * room.gridCols;
        room.pieces = createJigsawPieces(room.gridRows, room.gridCols);
      }
      if (resolvedQuestion) {
        room.question = {
          text: resolvedQuestion.text || room.question.text,
          sampleAnswer: resolvedQuestion.sampleAnswer || room.question.sampleAnswer,
          explanation: resolvedQuestion.explanation || room.question.explanation,
        };
      }

      // Reset room state so pieces match new grid
      room.status = 'WAITING';
      room.startTime = null;
      room.puzzleCompletedTime = null;
      room.questionCompletedTime = null;
      room.totalDurationMs = null;
      room.answerSubmitted = null;

      io.to(room.id).emit('room:state', room);
    });

    broadcastLeaderboards();
    res.json({ success: true, rooms: Object.values(rooms) });
  });

  // Start specific or all rooms
  app.post('/api/teacher/start', (req, res) => {
    const { roomId } = req.body;
    const now = Date.now();
    const list = roomId && roomId !== 'all' ? [rooms[roomId]].filter(Boolean) : Object.values(rooms);

    list.forEach(r => {
      r.status = 'PLAYING';
      r.startTime = now;
      r.puzzleCompletedTime = null;
      r.questionCompletedTime = null;
      r.totalDurationMs = null;
      r.answerSubmitted = null;
      r.pieces = createJigsawPieces(r.gridRows, r.gridCols);
      io.to(r.id).emit('room:state', r);
    });

    broadcastLeaderboards();
    io.emit('competition:started', { startTime: now });
    res.json({ success: true });
  });

  // Reset specific or all rooms
  app.post('/api/teacher/reset', (req, res) => {
    const { roomId } = req.body;
    const isAll = !roomId || roomId === 'all';
    const list = !isAll ? [rooms[roomId]].filter(Boolean) : Object.values(rooms);

    list.forEach(r => {
      r.status = 'WAITING';
      r.startTime = null;
      r.puzzleCompletedTime = null;
      r.questionCompletedTime = null;
      r.totalDurationMs = null;
      r.answerSubmitted = null;
      r.pieces = createJigsawPieces(r.gridRows, r.gridCols);
      io.to(r.id).emit('room:state', r);
    });

    if (isAll) {
      studentSnapScores.clear();
      participatingStudentsMap.forEach(s => { s.snapsCount = 0; });
    } else if (roomId) {
      // Clear individual scores for this room
      for (const [key, val] of studentSnapScores.entries()) {
        if (val.roomId === roomId) {
          studentSnapScores.delete(key);
        }
      }
      participatingStudentsMap.forEach(s => {
        if (s.roomId === roomId) s.snapsCount = 0;
      });
    }

    broadcastLeaderboards();
    io.emit('competition:reset');
    res.json({ success: true, rooms: Object.values(rooms) });
  });

  app.post('/api/teacher/reset-all', (req, res) => {
    Object.values(rooms).forEach(r => {
      r.status = 'WAITING';
      r.startTime = null;
      r.puzzleCompletedTime = null;
      r.questionCompletedTime = null;
      r.totalDurationMs = null;
      r.answerSubmitted = null;
      r.pieces = createJigsawPieces(r.gridRows, r.gridCols);
      io.to(r.id).emit('room:state', r);
    });

    studentSnapScores.clear();
    participatingStudentsMap.forEach(s => { s.snapsCount = 0; });
    broadcastLeaderboards();
    io.emit('competition:reset');
    res.json({ success: true, rooms: Object.values(rooms) });
  });

  // Vite middleware for development vs Production static serving
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});


