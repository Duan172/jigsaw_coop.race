import React, { useState, useEffect, useRef, useMemo } from 'react';
import { RoomState, PieceState, StudentScore } from '../types';
import { sound } from '../utils/audio';
import {
  ArrowLeft,
  Users,
  Clock,
  Sparkles,
  Volume2,
  VolumeX,
  Eye,
  RotateCcw,
  Trophy,
  Layers,
  ZoomIn,
  ZoomOut,
  Maximize,
  HelpCircle,
  Move,
  CheckCircle2,
  X,
  Lock,
  ChevronDown,
  ChevronUp,
  Medal
} from 'lucide-react';
import { getSocket } from '../socket';
import {
  getJigsawPath,
  checkClusterSnap,
  mergeAndLockClusters,
  getClusterStats,
  PUZZLE_FRAME_CONFIG,
  checkFrameSnap
} from '../utils/jigsawHelper';

interface PuzzleBoardProps {
  room: RoomState;
  studentName: string;
  studentScores?: StudentScore[];
  onLeaveRoom: () => void;
  onOpenLeaderboard: () => void;
  onOpenQuestionModal?: () => void;
}

interface Reaction {
  id: string;
  emoji: string;
  senderName: string;
  x: number;
}

export const PuzzleBoard: React.FC<PuzzleBoardProps> = ({
  room,
  studentName,
  studentScores,
  onLeaveRoom,
  onOpenLeaderboard,
  onOpenQuestionModal,
}) => {
  const socket = getSocket();

  // Local mirror of pieces to allow instantaneous 60fps drag & snapping
  const [pieces, setPieces] = useState<PieceState[]>(room.pieces);
  const piecesRef = useRef<PieceState[]>(room.pieces);
  const [activeClusterId, setActiveClusterId] = useState<number | null>(null);
  const [snapNotice, setSnapNotice] = useState<string | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const [reactions, setReactions] = useState<Reaction[]>([]);

  // Timer state (starts counting when first piece moves)
  const [currentStartTime, setCurrentStartTime] = useState<number | null>(room.startTime);

  // Live Team Snap Scores (Top 3 in our group)
  const [teamStudentScores, setTeamStudentScores] = useState<StudentScore[]>(studentScores || []);
  const [isLeaderboardMinimized, setIsLeaderboardMinimized] = useState(false);

  // Zoom & Pan state
  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanningBoard, setIsPanningBoard] = useState(false);

  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const panRef = useRef(pan);
  panRef.current = pan;

  const boardContainerRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{
    pointerX: number;
    pointerY: number;
    initialPieces: Map<number, { x: number; y: number }>;
  } | null>(null);

  const panStartRef = useRef<{
    pointerX: number;
    pointerY: number;
    initialPan: { x: number; y: number };
  } | null>(null);

  // Multi-touch pinch-to-zoom ref
  const touchPinchRef = useRef<{
    initialDist: number;
    initialZoom: number;
    initialPan: { x: number; y: number };
    initialCenter: { x: number; y: number };
  } | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Keep local pieces and ref in sync when room pieces change from server
  useEffect(() => {
    piecesRef.current = room.pieces;
    setPieces(room.pieces);
  }, [room.pieces]);

  // Keep room start time in sync
  useEffect(() => {
    if (room.startTime) {
      setCurrentStartTime(room.startTime);
    }
  }, [room.startTime]);

  // Keep student scores prop in sync
  useEffect(() => {
    if (studentScores) {
      setTeamStudentScores(studentScores);
    }
  }, [studentScores]);

  // Listen for timer start and student scores updates from socket
  useEffect(() => {
    const handleScoresUpdate = (updatedScores: StudentScore[]) => {
      setTeamStudentScores(updatedScores);
    };

    const handleTimerStarted = (data: { roomId: string; startTime: number }) => {
      if (data.roomId === room.id) {
        setCurrentStartTime(data.startTime);
      }
    };

    socket.on('student_scores:updated', handleScoresUpdate);
    socket.on('room:timer_started', handleTimerStarted);

    return () => {
      socket.off('student_scores:updated', handleScoresUpdate);
      socket.off('room:timer_started', handleTimerStarted);
    };
  }, [socket, room.id]);

  // Canonical workspace space for assembled puzzle
  const solvedWidth = 600;
  const solvedHeight = 400;
  const pw = solvedWidth / room.gridCols;
  const ph = solvedHeight / room.gridRows;
  const tabDepthX = pw * 0.20;
  const tabDepthY = ph * 0.20;

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    sound.setEnabled(next);
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(2.5, Math.round((prev + 0.15) * 100) / 100));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(0.4, Math.round((prev - 0.15) * 100) / 100));
  };

  const handleResetZoom = () => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
  };

  // Timer counter: starts calculating as soon as currentStartTime is set
  useEffect(() => {
    if (currentStartTime && (room.status === 'PLAYING' || room.status === 'WAITING')) {
      const updateTimer = () => {
        const now = Date.now();
        setElapsedSec(Math.max(0, Math.floor((now - currentStartTime) / 1000)));
      };
      updateTimer();
      timerRef.current = setInterval(updateTimer, 1000);
    } else if (room.status === 'COMPLETED' || room.status === 'QUESTION') {
      if (room.puzzleCompletedTime) {
        setElapsedSec(Math.floor(room.puzzleCompletedTime / 1000));
      }
      if (timerRef.current) clearInterval(timerRef.current);
    } else {
      setElapsedSec(0);
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [room.status, currentStartTime, room.puzzleCompletedTime]);

  // Top 3 students with the most snaps in our team (nhóm mình)
  const topTeamSnappers = useMemo(() => {
    const scoresForRoom = teamStudentScores.filter(s => s.roomId === room.id);
    const membersMap = new Map<string, { name: string; snapsCount: number; color?: string }>();

    // 1. Pre-populate with current members in this room (starts with 0 snaps)
    room.members.forEach(m => {
      const clean = m.name.trim();
      if (clean) {
        membersMap.set(clean.toLowerCase(), {
          name: clean,
          snapsCount: 0,
          color: m.color,
        });
      }
    });

    // 2. Merge registered snap scores for this room
    scoresForRoom.forEach(s => {
      const clean = s.name.trim();
      if (clean) {
        const key = clean.toLowerCase();
        const existing = membersMap.get(key);
        membersMap.set(key, {
          name: clean,
          snapsCount: s.snapsCount ?? s.piecesCount,
          color: s.color || existing?.color || room.accentColor,
        });
      }
    });

    // 3. Make sure current student is included
    if (studentName && studentName.trim()) {
      const clean = studentName.trim();
      const key = clean.toLowerCase();
      if (!membersMap.has(key)) {
        membersMap.set(key, {
          name: clean,
          snapsCount: 0,
          color: room.accentColor,
        });
      }
    }

    const list = Array.from(membersMap.values());
    list.sort((a, b) => {
      if (b.snapsCount !== a.snapsCount) {
        return b.snapsCount - a.snapsCount;
      }
      return a.name.localeCompare(b.name);
    });

    return list.slice(0, 3);
  }, [teamStudentScores, room.id, room.members, studentName, room.accentColor]);

  // Socket listeners for this room
  useEffect(() => {
    const handleClusterMoved = (data: {
      clusterId: number;
      pieces?: Array<{ id: number; x: number; y: number }>;
    }) => {
      if (activeClusterId === data.clusterId) return; // Ignore own dragging
      if (data.pieces && data.pieces.length > 0) {
        setPieces(prev => {
          const map = new Map(data.pieces!.map(p => [p.id, p]));
          const updated = prev.map(p => {
            if (p.isLocked) return p; // Never move locked pieces
            const update = map.get(p.id);
            if (update) {
              return { ...p, x: update.x, y: update.y };
            }
            return p;
          });
          piecesRef.current = updated;
          return updated;
        });
      }
    };

    const handleSnappedBroadcast = (data: {
      updates: Array<{ id: number; x: number; y: number; clusterId: number; isLocked?: boolean }>;
      isCompleted: boolean;
      roomStatus: string;
      stats: any;
      snappedBy: string;
    }) => {
      sound.playSnap();
      setSnapNotice(`${data.snappedBy || 'Thành viên'} vừa ghép chuẩn vào khung tranh! ✨`);
      setTimeout(() => setSnapNotice(null), 2500);

      setPieces(prev => {
        const updateMap = new Map(data.updates.map(u => [u.id, u]));
        const updated = prev.map(p => {
          const update = updateMap.get(p.id);
          if (update) {
            return {
              ...p,
              x: update.x,
              y: update.y,
              clusterId: update.clusterId,
              isLocked: update.isLocked !== undefined ? update.isLocked : (data.isCompleted ? true : p.isLocked),
            };
          }
          return p;
        });
        piecesRef.current = updated;
        return updated;
      });

      if (data.isCompleted) {
        sound.playPuzzleComplete();
      }
    };

    const handleReaction = (reaction: { id: string; emoji: string; senderName: string }) => {
      const newReaction: Reaction = {
        ...reaction,
        x: 20 + Math.random() * 60,
      };
      setReactions(prev => [...prev.slice(-8), newReaction]);
      setTimeout(() => {
        setReactions(prev => prev.filter(r => r.id !== reaction.id));
      }, 2500);
    };

    socket.on('piece:cluster_moved', handleClusterMoved);
    socket.on('piece:snapped_broadcast', handleSnappedBroadcast);
    socket.on('room:reaction_received', handleReaction);

    return () => {
      socket.off('piece:cluster_moved', handleClusterMoved);
      socket.off('piece:snapped_broadcast', handleSnappedBroadcast);
      socket.off('room:reaction_received', handleReaction);
    };
  }, [socket, activeClusterId]);

  // Touch event listeners for 2-finger pinch zoom and panning
  useEffect(() => {
    const el = boardContainerRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        // Multi-touch pinch zoom started
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        const midX = (t1.clientX + t2.clientX) / 2;
        const midY = (t1.clientY + t2.clientY) / 2;

        touchPinchRef.current = {
          initialDist: dist,
          initialZoom: zoomRef.current,
          initialPan: { ...panRef.current },
          initialCenter: { x: midX, y: midY },
        };

        // Cancel any active single-finger piece drag
        setActiveClusterId(null);
        dragStartRef.current = null;
        setIsPanningBoard(false);
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && touchPinchRef.current) {
        e.preventDefault();
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        const midX = (t1.clientX + t2.clientX) / 2;
        const midY = (t1.clientY + t2.clientY) / 2;

        if (touchPinchRef.current.initialDist > 0) {
          const scale = dist / touchPinchRef.current.initialDist;
          const newZoom = Math.max(0.4, Math.min(2.5, Math.round(touchPinchRef.current.initialZoom * scale * 100) / 100));
          setZoom(newZoom);

          const panDx = midX - touchPinchRef.current.initialCenter.x;
          const panDy = midY - touchPinchRef.current.initialCenter.y;
          setPan({
            x: touchPinchRef.current.initialPan.x + panDx,
            y: touchPinchRef.current.initialPan.y + panDy,
          });
        }
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        touchPinchRef.current = null;
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    el.addEventListener('touchcancel', onTouchEnd);

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [zoom, pan]);

  const sendReaction = (emoji: string) => {
    socket.emit('room:reaction', {
      roomId: room.id,
      emoji,
      senderName: studentName || 'Teammate',
    });
  };

  // 1. Piece Dragging Handlers (Corrected for Zoom & Pan)
  const handlePiecePointerDown = (e: React.PointerEvent, piece: PieceState) => {
    if (room.status !== 'PLAYING' && room.status !== 'WAITING') return;
    if (piece.isLocked) return;

    // Start timer on FIRST piece movement if not started yet!
    if (!currentStartTime || room.status === 'WAITING') {
      const now = Date.now();
      setCurrentStartTime(now);
      socket.emit('room:start_timer', { roomId: room.id });
    }

    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    const clusterId = piece.clusterId;
    setActiveClusterId(clusterId);
    sound.playPick();

    const clusterPieces = piecesRef.current.filter(p => p.clusterId === clusterId && !p.isLocked);
    const initialMap = new Map<number, { x: number; y: number }>();
    clusterPieces.forEach(p => {
      initialMap.set(p.id, { x: p.x, y: p.y });
    });

    dragStartRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      initialPieces: initialMap,
    };
  };

  // 2. Background Canvas Pan Handlers
  const handleCanvasPointerDown = (e: React.PointerEvent) => {
    // Only pan if not clicking a puzzle piece
    if (activeClusterId !== null) return;
    setIsPanningBoard(true);
    panStartRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      initialPan: { ...pan },
    };
  };

  // 3. Combined Pointer Move
  const handleContainerPointerMove = (e: React.PointerEvent) => {
    // A. Move Piece Cluster as one solid body
    if (dragStartRef.current && activeClusterId !== null) {
      e.preventDefault();
      if (!currentStartTime || room.status === 'WAITING') {
        const now = Date.now();
        setCurrentStartTime(now);
        socket.emit('room:start_timer', { roomId: room.id });
      }

      // Adjust delta by current zoom factor so cursor and pieces move 1:1!
      const dx = (e.clientX - dragStartRef.current.pointerX) / zoom;
      const dy = (e.clientY - dragStartRef.current.pointerY) / zoom;

      const updatedPieces = piecesRef.current.map(p => {
        if (p.clusterId === activeClusterId && !p.isLocked) {
          const initial = dragStartRef.current!.initialPieces.get(p.id);
          if (initial) {
            const newX = Math.max(-100, Math.min(1200, initial.x + dx));
            const newY = Math.max(-100, Math.min(800, initial.y + dy));
            return { ...p, x: newX, y: newY };
          }
        }
        return p;
      });

      piecesRef.current = updatedPieces;
      setPieces(updatedPieces);

      const clusterPositions = updatedPieces
        .filter(p => p.clusterId === activeClusterId && !p.isLocked)
        .map(p => ({ id: p.id, x: p.x, y: p.y }));

      socket.emit('piece:move_cluster', {
        roomId: room.id,
        clusterId: activeClusterId,
        pieces: clusterPositions,
      });
      return;
    }

    // B. Pan Board Canvas
    if (panStartRef.current && isPanningBoard) {
      e.preventDefault();
      const dx = e.clientX - panStartRef.current.pointerX;
      const dy = e.clientY - panStartRef.current.pointerY;
      setPan({
        x: panStartRef.current.initialPan.x + dx,
        y: panStartRef.current.initialPan.y + dy,
      });
    }
  };

  // 4. Pointer Up & Strict Frame Snap / Edge Snap Verification
  const handleContainerPointerUp = (e: React.PointerEvent) => {
    // End Pan
    if (isPanningBoard) {
      setIsPanningBoard(false);
      panStartRef.current = null;
    }

    // End Piece Drag
    if (!dragStartRef.current || activeClusterId === null) return;
    e.preventDefault();

    const currentClusterId = activeClusterId;
    const dragData = dragStartRef.current;
    setActiveClusterId(null);
    dragStartRef.current = null;

    const frameX = PUZZLE_FRAME_CONFIG.x;
    const frameY = PUZZLE_FRAME_CONFIG.y;

    // Calculate final exact positions with clientX, clientY at pointer up
    const dx = (e.clientX - dragData.pointerX) / zoom;
    const dy = (e.clientY - dragData.pointerY) / zoom;

    const currentPieces = piecesRef.current.map(p => {
      if (p.clusterId === currentClusterId && !p.isLocked) {
        const initial = dragData.initialPieces.get(p.id);
        if (initial) {
          const newX = Math.max(-100, Math.min(1200, initial.x + dx));
          const newY = Math.max(-100, Math.min(800, initial.y + dy));
          return { ...p, x: newX, y: newY };
        }
      }
      return p;
    });
    piecesRef.current = currentPieces;
    setPieces(currentPieces);

    // 1. Check if dragged piece/cluster aligns with its target slot in the Frame (Khung Tranh)
    // Snaps into frame with generous 42px magnetic threshold and permanently locks
    const frameSnap = checkFrameSnap(currentClusterId, currentPieces, frameX, frameY, pw, ph, 42);

    if (frameSnap && frameSnap.hasSnapped) {
      sound.playSnap();
      setSnapNotice('🎉 Đã đính vào khung và cố định vị trí vĩnh viễn! ✨');
      setTimeout(() => setSnapNotice(null), 3000);

      // Lock these pieces into their exact frame slots forever
      const lockMap = new Map(frameSnap.piecesToLock.map(p => [p.id, p]));
      const finalPieces = currentPieces.map(p => {
        const locked = lockMap.get(p.id);
        if (locked) {
          return {
            ...p,
            x: locked.x,
            y: locked.y,
            isLocked: true,
            clusterId: -1,
          };
        }
        return p;
      });

      piecesRef.current = finalPieces;
      setPieces(finalPieces);

      socket.emit('piece:cluster_snapped', {
        roomId: room.id,
        updates: frameSnap.piecesToLock,
        studentName: studentName || 'Student',
      });
      return;
    }

    // 2. Check if dragged cluster aligns strictly along complementary edges of a neighboring cluster on the table
    const snapResult = checkClusterSnap(currentClusterId, currentPieces, pw, ph, 28);

    if (snapResult && snapResult.hasSnapped) {
      sound.playSnap();
      setSnapNotice('✨ Ghép viền chuẩn xác!');
      setTimeout(() => setSnapNotice(null), 2500);

      const { updatedPieces, updates } = mergeAndLockClusters(currentPieces, snapResult, pw, ph);
      piecesRef.current = updatedPieces;
      setPieces(updatedPieces);

      socket.emit('piece:cluster_snapped', {
        roomId: room.id,
        updates,
        studentName: studentName || 'Student',
      });
      return;
    }

    // 3. Neither frame nor cluster snapped, sync final dropped coordinates to teammates
    const clusterPositions = currentPieces
      .filter(p => p.clusterId === currentClusterId && !p.isLocked)
      .map(p => ({ id: p.id, x: p.x, y: p.y }));

    socket.emit('piece:move_cluster', {
      roomId: room.id,
      clusterId: currentClusterId,
      pieces: clusterPositions,
    });
  };

  // Wheel Zoom support (trackpad pinch gesture or Ctrl+wheel)
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.1 : -0.1;
      setZoom(z => Math.max(0.4, Math.min(2.5, Math.round((z + delta) * 100) / 100)));
    }
  };

  // Re-scatter pieces
  const handleScatterBoard = () => {
    if (room.status !== 'PLAYING') return;
    const paddingX = 40;
    const paddingY = 40;
    const maxX = 850;
    const maxY = 550;

    // Only scatter loose (unlocked) pieces
    const loosePieces = pieces.filter(p => !p.isLocked);
    const clusters = Array.from(new Set(loosePieces.map(p => p.clusterId)));
    const clusterOffsets = new Map<number, { dx: number; dy: number }>();

    clusters.forEach(cid => {
      const randomX = paddingX + Math.random() * (maxX - paddingX);
      const randomY = paddingY + Math.random() * (maxY - paddingY);
      const firstPiece = loosePieces.find(p => p.clusterId === cid);
      if (firstPiece) {
        clusterOffsets.set(cid, {
          dx: randomX - firstPiece.x,
          dy: randomY - firstPiece.y,
        });
      }
    });

    const scattered = pieces.map(p => {
      if (p.isLocked) return p;
      const offset = clusterOffsets.get(p.clusterId);
      if (offset) {
        return {
          ...p,
          x: Math.round(p.x + offset.dx),
          y: Math.round(p.y + offset.dy),
        };
      }
      return p;
    });

    setPieces(scattered);
    const updates = scattered.map(p => ({
      id: p.id,
      x: p.x,
      y: p.y,
      clusterId: p.clusterId,
      isLocked: p.isLocked,
    }));

    socket.emit('piece:cluster_snapped', {
      roomId: room.id,
      updates,
      studentName: studentName || 'Student',
    });
  };

  const stats = getClusterStats(pieces, room.totalPieces);
  const minutes = Math.floor(elapsedSec / 60);
  const seconds = elapsedSec % 60;
  const timeFormatted = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  return (
    <div className="relative w-full min-h-screen bg-blue-50/50 text-slate-800 flex flex-col select-none overflow-hidden font-sans">
      
      {/* 1. Header: Royal Blue + White + Gold */}
      <header className="h-16 px-4 md:px-6 bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-800 text-white shadow-md flex items-center justify-between z-30 shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onLeaveRoom}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-blue-100 hover:text-white bg-blue-900/60 hover:bg-blue-900 border border-blue-400/30 transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Leave Room</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="text-2xl p-1 bg-white/10 rounded-xl">{room.badge}</span>
            <div>
              <h1 className="text-sm md:text-base font-black text-white tracking-tight flex items-center gap-2">
                {room.name}
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-400 text-blue-950 shadow-xs">
                  {room.gridCols} × {room.gridRows} ({room.totalPieces} pieces)
                </span>
              </h1>
            </div>
          </div>
        </div>

        {/* Central HUD: Gold Timer & Progress Tracking (Học sinh theo dõi tiến độ & thời gian) */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Live Timer */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-blue-950/70 border border-amber-400/40 shadow-inner">
            <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
            <div className="flex flex-col">
              <span className="font-mono font-black text-sm md:text-base text-amber-300 leading-tight">
                {timeFormatted}
              </span>
              {!currentStartTime && (room.status === 'WAITING' || room.status === 'PLAYING') && (
                <span className="text-[9px] text-amber-300/80 font-bold -mt-0.5 leading-none hidden sm:inline">
                  Kéo mảnh để tính giờ
                </span>
              )}
            </div>
          </div>

          {/* Real-time Progress HUD */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-blue-950/60 border border-blue-400/30">
            <Layers className="w-4 h-4 text-amber-400" />
            <div className="flex flex-col">
              <span className="text-[11px] sm:text-xs font-bold text-blue-100 leading-tight">
                Tiến độ: <strong className="text-amber-300 font-black">{stats.lockedCount}/{room.totalPieces}</strong> mảnh ({stats.progressPercent}%)
              </span>
              <div className="w-20 sm:w-28 h-1.5 rounded-full bg-blue-900 overflow-hidden mt-1 border border-blue-700">
                <div
                  className="h-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-300"
                  style={{ width: `${stats.progressPercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2">
          {/* Question / Notification Button if puzzle solved or completed */}
          {(room.status === 'COMPLETED' || stats.isFullySolved) && onOpenQuestionModal && (
            <button
              type="button"
              onClick={onOpenQuestionModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-400 hover:bg-amber-300 text-blue-950 shadow-md transition cursor-pointer"
            >
              <HelpCircle className="w-4 h-4" />
              <span>View Question</span>
            </button>
          )}

          {/* Preview original image */}
          <button
            type="button"
            onClick={() => setShowPreviewModal(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition cursor-pointer"
            title="Preview puzzle image"
          >
            <Eye className="w-3.5 h-3.5 text-amber-300" />
            <span className="hidden md:inline">Preview</span>
          </button>

          {/* Scatter pieces */}
          <button
            type="button"
            onClick={handleScatterBoard}
            disabled={room.status !== 'PLAYING'}
            className="p-2 rounded-xl text-xs font-medium bg-white/10 hover:bg-white/20 text-white border border-white/20 transition disabled:opacity-40 cursor-pointer"
            title="Shuffle & scatter pieces"
          >
            <RotateCcw className="w-4 h-4 text-blue-200 hover:text-white" />
          </button>

          {/* Audio Mute/Unmute */}
          <button
            type="button"
            onClick={toggleSound}
            className="p-2 rounded-xl text-blue-200 hover:text-white bg-white/10 hover:bg-white/20 border border-white/20 transition cursor-pointer"
            title={soundEnabled ? 'Mute Sound' : 'Enable Sound'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-amber-300" /> : <VolumeX className="w-4 h-4 text-slate-300" />}
          </button>

          {/* Leaderboard Trigger */}
          <button
            type="button"
            onClick={onOpenLeaderboard}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-blue-950 shadow-md transition cursor-pointer"
          >
            <Trophy className="w-4 h-4 text-blue-950" />
            <span className="hidden sm:inline">Leaderboard</span>
          </button>
        </div>
      </header>

      {/* 2. Sub-bar: Online Members & Cheer */}
      <div className="h-10 px-4 md:px-6 bg-white/80 border-b border-blue-100 flex items-center justify-between text-xs text-slate-600 z-20 shrink-0 backdrop-blur-xs">
        <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-none">
          <Users className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          <span className="font-bold text-slate-700 shrink-0">
            Active Teammates ({room.members.length}):
          </span>
          <div className="flex items-center gap-1.5">
            {room.members.map(m => (
              <span
                key={m.socketId}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200"
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: m.color }} />
                {m.name}
              </span>
            ))}
          </div>
        </div>

        {/* Floating Quick Cheer Reactions */}
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[11px] text-slate-400 hidden sm:inline mr-1">Cheer:</span>
          {[
            { emoji: '🔥', label: 'Fire' },
            { emoji: '⚡', label: 'Lightning' },
            { emoji: '👏', label: 'Clap' },
            { emoji: '🎉', label: 'Party' },
          ].map(btn => (
            <button
              key={btn.emoji}
              type="button"
              onClick={() => sendReaction(btn.emoji)}
              className="px-2 py-0.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-sm hover:scale-110 active:scale-95 transition cursor-pointer border border-blue-100"
              title={btn.label}
            >
              {btn.emoji}
            </button>
          ))}
        </div>
      </div>

      {/* Snap Notification Toast */}
      {snapNotice && (
        <div className="absolute top-28 left-1/2 -translate-x-1/2 z-40 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 text-blue-950 font-black text-xs sm:text-sm shadow-xl flex items-center gap-2 animate-bounce border border-amber-300">
          <Sparkles className="w-4 h-4 text-blue-950" />
          <span>{snapNotice}</span>
        </div>
      )}

      {/* Floating Animated Reactions */}
      <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
        {reactions.map(r => (
          <div
            key={r.id}
            style={{ left: `${r.x}%`, bottom: '20%' }}
            className="absolute text-3xl animate-floatUp"
          >
            {r.emoji}
          </div>
        ))}
      </div>

      {/* 3. Freeform Assembly Workspace with Zoom & Pan Canvas */}
      <main
        ref={boardContainerRef}
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handleContainerPointerMove}
        onPointerUp={handleContainerPointerUp}
        onWheel={handleWheel}
        className={`relative flex-1 w-full bg-slate-50 overflow-hidden ${
          isPanningBoard ? 'cursor-grabbing' : 'cursor-default'
        } touch-none`}
        style={{
          backgroundImage: 'radial-gradient(#93c5fd 1.2px, transparent 1.2px)',
          backgroundSize: '24px 24px',
        }}
      >
        {/* Top-Right Corner: Live Top 3 Team Snap Leaderboard (Bảng xếp hạng 3 bạn học sinh đứng đầu tạo nhiều snap nhất của nhóm mình) */}
        <div
          id="team-top-snappers-leaderboard"
          className="absolute top-3.5 right-3.5 z-40 pointer-events-auto select-none"
        >
          {isLeaderboardMinimized ? (
            <button
              type="button"
              onClick={() => setIsLeaderboardMinimized(false)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-white/95 border-2 border-amber-400 shadow-xl text-xs font-black text-slate-800 hover:bg-amber-50 transition cursor-pointer"
              title="Mở rộng bảng xếp hạng snap nhóm mình"
            >
              <span className="text-base">🏆</span>
              <span className="font-extrabold text-blue-950">Top 3 Snap</span>
              <ChevronDown className="w-3.5 h-3.5 text-amber-600" />
            </button>
          ) : (
            <div className="w-64 sm:w-72 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border-2 border-amber-400 overflow-hidden transition-all animate-fadeIn">
              {/* Leaderboard Header */}
              <div className="px-3.5 py-2 bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 text-blue-950 font-black text-xs flex items-center justify-between shadow-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">🏆</span>
                  <span className="tracking-tight uppercase">Top 3 Snap • {room.name}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsLeaderboardMinimized(true)}
                  className="p-1 rounded-lg hover:bg-black/15 text-blue-950 transition cursor-pointer"
                  title="Thu nhỏ bảng xếp hạng"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Student Rankings List */}
              <div className="p-2 space-y-1.5">
                {topTeamSnappers.length === 0 ? (
                  <div className="py-3 text-center text-xs text-slate-500 font-medium">
                    Chưa có học sinh nào trong nhóm
                  </div>
                ) : (
                  topTeamSnappers.map((st, idx) => {
                    const isYou = Boolean(studentName && st.name.toLowerCase() === studentName.trim().toLowerCase());
                    const medals = ['🥇', '🥈', '🥉'];
                    const medalColors = [
                      'bg-amber-100 text-amber-900 border-amber-300',
                      'bg-slate-100 text-slate-800 border-slate-300',
                      'bg-orange-100 text-amber-900 border-orange-300',
                    ];

                    return (
                      <div
                        key={st.name + idx}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl border transition-all ${
                          isYou
                            ? 'bg-amber-50/90 border-amber-400 shadow-xs ring-1 ring-amber-400/50'
                            : 'bg-slate-50/90 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-black shrink-0 border ${medalColors[idx]}`}
                          >
                            {medals[idx]}
                          </span>

                          <div
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: st.color || '#3b82f6' }}
                          />

                          <div className="truncate text-xs font-bold text-slate-800">
                            {st.name}
                            {isYou && (
                              <span className="ml-1 text-[10px] font-black text-amber-600">
                                (Bạn)
                              </span>
                            )}
                          </div>
                        </div>

                        <span className="shrink-0 ml-2 px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-900 text-[11px] font-black font-mono">
                          {st.snapsCount} {st.snapsCount === 1 ? 'snap' : 'snaps'}
                        </span>
                      </div>
                    );
                  })
                )}

                {/* Helpful cue for students */}
                <div className="pt-1 px-1 flex items-center justify-between text-[10px] text-slate-500 font-semibold border-t border-slate-100">
                  <span className="flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    <span>Ghép vào khung để tăng snap</span>
                  </span>
                  <button
                    type="button"
                    onClick={onOpenLeaderboard}
                    className="text-blue-600 hover:underline font-bold cursor-pointer"
                  >
                    Xem tất cả
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Transformable Canvas Layer (Scale + Pan) */}
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '50% 50%',
            transition: isPanningBoard || activeClusterId !== null || touchPinchRef.current !== null ? 'none' : 'transform 0.15s ease-out',
            width: '100%',
            height: '100%',
            position: 'absolute',
            top: 0,
            left: 0,
          }}
        >
          {/* Target Picture Frame: Only the outer border matching picture dimensions (solvedWidth x solvedHeight), no faint image behind */}
          <div
            id="target-picture-frame"
            style={{
              position: 'absolute',
              left: `${PUZZLE_FRAME_CONFIG.x}px`,
              top: `${PUZZLE_FRAME_CONFIG.y}px`,
              width: `${solvedWidth}px`,
              height: `${solvedHeight}px`,
              pointerEvents: 'none',
              boxSizing: 'border-box',
            }}
            className={`z-0 transition-all duration-300 ${
              stats.lockedCount === room.totalPieces
                ? 'border-4 border-amber-400 shadow-[0_0_35px_rgba(251,191,36,0.65)] rounded-xs'
                : 'border-2 sm:border-[2.5px] border-dashed border-amber-500/80 dark:border-amber-400/85 rounded-xs'
            }`}
          >
            {/* Minimalist Top Indicator Badge outside the frame border */}
            <div className="absolute -top-7 left-0 flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-amber-500/90 text-blue-950 text-[11px] font-bold shadow-xs select-none">
              <span>🖼️ Khung tranh</span>
              <span className="font-mono text-[10px] bg-amber-400 px-1.5 py-0.5 rounded font-black text-blue-950">
                {stats.lockedCount}/{room.totalPieces} mảnh đã cố định
              </span>
            </div>
          </div>

          {/* SVG Jigsaw Pieces with authentic interlocking bezier edges */}
          {pieces.map(piece => {
            const isCurrentDragging = activeClusterId === piece.clusterId && !piece.isLocked;
            const piecePath = getJigsawPath(pw, ph, piece.edgeTabs);
            const clipId = `jigsaw-clip-${room.id}-${piece.id}`;

            const visualWidth = pw + 2 * tabDepthX;
            const visualHeight = ph + 2 * tabDepthY;
            const posX = piece.x - tabDepthX;
            const posY = piece.y - tabDepthY;

            return (
              <div
                key={piece.id}
                onPointerDown={e => handlePiecePointerDown(e, piece)}
                title={piece.isLocked ? 'Đã đính cố định vào khung tranh (Không thể di chuyển)' : undefined}
                style={{
                  position: 'absolute',
                  left: `${posX}px`,
                  top: `${posY}px`,
                  width: `${visualWidth}px`,
                  height: `${visualHeight}px`,
                  zIndex: isCurrentDragging ? 900 : piece.isLocked ? 100 + piece.correctIndex : piece.clusterId + 10,
                  pointerEvents: piece.isLocked ? 'none' : 'auto',
                  cursor: piece.isLocked ? 'default' : isCurrentDragging ? 'grabbing' : 'grab',
                  transform: isCurrentDragging ? 'scale(1.03)' : 'none',
                  transition: isCurrentDragging ? 'none' : 'transform 0.15s ease-out',
                  filter: isCurrentDragging
                    ? 'drop-shadow(0 16px 24px rgba(2,132,199,0.45)) drop-shadow(0 0 10px rgba(59,130,246,0.5))'
                    : piece.isLocked
                    ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))'
                    : 'drop-shadow(0 4px 8px rgba(0,0,0,0.22))',
                }}
                className={`touch-none select-none group ${piece.isLocked ? 'pointer-events-none' : ''}`}
              >
                <svg
                  width={visualWidth}
                  height={visualHeight}
                  viewBox={`0 0 ${visualWidth} ${visualHeight}`}
                  className={`overflow-visible ${piece.isLocked ? 'pointer-events-none' : 'pointer-events-auto'}`}
                >
                  <defs>
                    <clipPath id={clipId}>
                      <path
                        d={piecePath}
                        transform={`translate(${tabDepthX}, ${tabDepthY})`}
                      />
                    </clipPath>
                  </defs>

                  {/* Sliced Piece Texture */}
                  <g clipPath={`url(#${clipId})`}>
                    <image
                      href={room.imageUrl}
                      x={-piece.correctCol * pw + tabDepthX}
                      y={-piece.correctRow * ph + tabDepthY}
                      width={room.gridCols * pw}
                      height={room.gridRows * ph}
                      preserveAspectRatio="none"
                    />
                  </g>

                  {/* Tactile Highlight & Interlocking Edge Outline */}
                  <path
                    d={piecePath}
                    transform={`translate(${tabDepthX}, ${tabDepthY})`}
                    fill="none"
                    stroke={
                      isCurrentDragging
                        ? '#fbbf24'
                        : piece.isLocked
                        ? 'rgba(251,191,36,0.5)'
                        : 'rgba(255,255,255,0.7)'
                    }
                    strokeWidth={isCurrentDragging ? 2.5 : piece.isLocked ? 1.0 : 1.4}
                  />
                  <path
                    d={piecePath}
                    transform={`translate(${tabDepthX + 0.5}, ${tabDepthY + 0.5})`}
                    fill="none"
                    stroke="rgba(0,0,0,0.25)"
                    strokeWidth={0.8}
                  />
                </svg>

                {/* Subtle Lock Icon Badge when piece is locked in the frame */}
                {piece.isLocked && (
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-90 pointer-events-none transition-opacity bg-blue-950/80 text-amber-300 p-1 rounded-full shadow-md">
                    <Lock className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 4. Floating Zoom & Pan Control HUD (Bottom-Right) */}
        <div className="absolute bottom-5 right-5 z-40 flex items-center gap-1.5 p-1.5 rounded-2xl bg-white/95 text-slate-800 shadow-xl border border-blue-200 backdrop-blur-md">
          <button
            type="button"
            onClick={handleZoomOut}
            className="w-8 h-8 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 flex items-center justify-center transition cursor-pointer"
            title="Zoom out (-)"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleResetZoom}
            className="px-2.5 py-1 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-800 font-mono font-bold text-xs transition cursor-pointer min-w-[54px] text-center"
            title="Reset to 100%"
          >
            {Math.round(zoom * 100)}%
          </button>

          <button
            type="button"
            onClick={handleZoomIn}
            className="w-8 h-8 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 flex items-center justify-center transition cursor-pointer"
            title="Zoom in (+)"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <div className="w-[1px] h-5 bg-blue-200 mx-0.5" />

          <button
            type="button"
            onClick={handleResetZoom}
            className="p-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 transition cursor-pointer"
            title="Recenter puzzle board"
          >
            <Maximize className="w-4 h-4" />
          </button>
        </div>

        {/* Hint Pill (Bottom-Left) */}
        <div className="absolute bottom-5 left-5 z-20 hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/90 text-blue-900 text-xs font-semibold shadow-md border border-blue-100 backdrop-blur-xs">
          <Move className="w-3.5 h-3.5 text-blue-600" />
          <span>Pinch with 2 fingers or drag background to pan & zoom • Drag pieces to assemble</span>
        </div>
      </main>

      {/* Full Sample Image Modal */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-blue-950/70 backdrop-blur-xs animate-fadeIn">
          <div className="relative max-w-lg w-full bg-white rounded-3xl p-5 shadow-2xl border-2 border-blue-400">
            <button
              type="button"
              onClick={() => setShowPreviewModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="font-black text-slate-900 text-base mb-1">Target Puzzle Image</h3>
            <p className="text-xs text-blue-600 font-semibold mb-3">{room.imageTitle}</p>

            <div className="rounded-2xl overflow-hidden border border-blue-200 bg-black aspect-[4/3] shadow-inner">
              <img
                src={room.imageUrl}
                alt={room.imageTitle}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>

            <button
              type="button"
              onClick={() => setShowPreviewModal(false)}
              className="w-full mt-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md transition cursor-pointer"
            >
              Back to Puzzle Board
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
