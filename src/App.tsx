import React, { useState, useEffect } from 'react';
import { RoomState, TeamRanking, StudentScore, PuzzleSet } from './types';
import { getSocket } from './socket';
import { StudentHome } from './components/StudentHome';
import { PuzzleBoard } from './components/PuzzleBoard';
import { QuestionModal } from './components/QuestionModal';
import { LeaderboardView } from './components/LeaderboardView';
import { TeacherDashboard } from './components/TeacherDashboard';
import { ProjectorView } from './components/ProjectorView';
import { createInitialRooms } from './utils/defaultData';
import { Lock, X, Sparkles, Key } from 'lucide-react';

export default function App() {
  const socket = getSocket();

  const [rooms, setRooms] = useState<Record<string, RoomState>>(createInitialRooms());
  const [rankings, setRankings] = useState<TeamRanking[]>([]);
  const [studentScores, setStudentScores] = useState<StudentScore[]>([]);
  const [puzzleSets, setPuzzleSets] = useState<PuzzleSet[]>([]);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [studentName, setStudentName] = useState<string>(() => {
    try {
      return localStorage.getItem('jigsaw_student_name') || '';
    } catch {
      return '';
    }
  });

  // Views: 'home' | 'puzzle' | 'leaderboard' | 'teacher' | 'projector'
  const [currentView, setCurrentView] = useState<'home' | 'puzzle' | 'leaderboard' | 'teacher' | 'projector'>('home');
  const [showTeacherAuthModal, setShowTeacherAuthModal] = useState(false);
  const [teacherPinInput, setTeacherPinInput] = useState('');
  const [teacherPinError, setTeacherPinError] = useState(false);
  const [showQuestionModal, setShowQuestionModal] = useState(true);

  // Load all rooms and data
  const refreshRoomsData = () => {
    fetch('/api/rooms')
      .then(res => res.json())
      .then(data => {
        if (data.rooms) {
          const roomMap: Record<string, RoomState> = {};
          data.rooms.forEach((r: RoomState) => {
            roomMap[r.id] = r;
          });
          setRooms(roomMap);
        }
        if (data.rankings) {
          setRankings(data.rankings);
        }
        if (data.studentScores) {
          setStudentScores(data.studentScores);
        }
        if (data.puzzleSets) {
          setPuzzleSets(data.puzzleSets);
        }
      })
      .catch(() => {});
  };

  // Check URL query / path for teacher shortcut or direct room link
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('view') === 'teacher' || window.location.pathname.includes('/teacher')) {
      setCurrentView('teacher');
    } else if (params.get('view') === 'projector') {
      setCurrentView('projector');
    }
  }, []);

  // Initial fetch and Socket connections
  useEffect(() => {
    refreshRoomsData();

    const handleRoomsSummary = (data: { rooms: any[]; rankings: TeamRanking[]; studentScores?: StudentScore[] }) => {
      if (data.rankings) setRankings(data.rankings);
      if (data.studentScores) setStudentScores(data.studentScores);
    };

    const handleRoomState = (updatedRoom: RoomState) => {
      setRooms(prev => ({
        ...prev,
        [updatedRoom.id]: updatedRoom,
      }));
    };

    const handleRankingsUpdated = (newRankings: TeamRanking[]) => {
      setRankings(newRankings);
    };

    const handleStudentScoresUpdated = (newScores: StudentScore[]) => {
      setStudentScores(newScores);
    };

    const handleRoomCreated = (newRoom: RoomState) => {
      setRooms(prev => ({
        ...prev,
        [newRoom.id]: newRoom,
      }));
    };

    const handleRoomDeleted = ({ roomId }: { roomId: string }) => {
      setRooms(prev => {
        const copy = { ...prev };
        delete copy[roomId];
        return copy;
      });
      if (currentRoomId === roomId) {
        setCurrentRoomId(null);
        setCurrentView('home');
      }
    };

    const handleMembersUpdated = (members: any[]) => {
      if (currentRoomId) {
        setRooms(prev => {
          const room = prev[currentRoomId];
          if (!room) return prev;
          return {
            ...prev,
            [currentRoomId]: {
              ...room,
              members,
            },
          };
        });
      }
    };

    const handleSnappedBroadcast = (data: {
      updates: Array<{ id: number; x: number; y: number; clusterId: number; isLocked?: boolean }>;
      isCompleted: boolean;
      roomStatus: string;
      stats?: any;
    }) => {
      if (currentRoomId) {
        setRooms(prev => {
          const room = prev[currentRoomId];
          if (!room) return prev;
          const updateMap = new Map(data.updates.map(u => [u.id, u]));
          const updatedPieces = room.pieces.map(p => {
            const update = updateMap.get(p.id);
            if (update) {
              const isLocked = Boolean(update.isLocked || p.isLocked || data.isCompleted);
              return {
                ...p,
                x: update.x,
                y: update.y,
                clusterId: update.clusterId,
                isLocked,
              };
            }
            return p;
          });
          return {
            ...prev,
            [currentRoomId]: {
              ...room,
              pieces: updatedPieces,
              status: data.roomStatus as any,
            },
          };
        });
      }

      if (data.isCompleted) {
        setShowQuestionModal(true);
      }
    };

    const handleTimerStarted = ({ roomId, startTime }: { roomId: string; startTime: number }) => {
      setRooms(prev => {
        const target = prev[roomId];
        if (!target) return prev;
        return {
          ...prev,
          [roomId]: {
            ...target,
            startTime,
            status: 'PLAYING',
          },
        };
      });
    };

    socket.on('rooms:summary', handleRoomsSummary);
    socket.on('room:state', handleRoomState);
    socket.on('room:timer_started', handleTimerStarted);
    socket.on('rankings:updated', handleRankingsUpdated);
    socket.on('student_scores:updated', handleStudentScoresUpdated);
    socket.on('rooms:created', handleRoomCreated);
    socket.on('rooms:deleted', handleRoomDeleted);
    socket.on('room:members_updated', handleMembersUpdated);
    socket.on('piece:snapped_broadcast', handleSnappedBroadcast);

    return () => {
      socket.off('rooms:summary', handleRoomsSummary);
      socket.off('room:state', handleRoomState);
      socket.off('room:timer_started', handleTimerStarted);
      socket.off('rankings:updated', handleRankingsUpdated);
      socket.off('student_scores:updated', handleStudentScoresUpdated);
      socket.off('rooms:created', handleRoomCreated);
      socket.off('rooms:deleted', handleRoomDeleted);
      socket.off('room:members_updated', handleMembersUpdated);
      socket.off('piece:snapped_broadcast', handleSnappedBroadcast);
    };
  }, [socket, currentRoomId]);

  // Join a room as student
  const handleJoinRoom = (roomId: string) => {
    setCurrentRoomId(roomId);
    setShowQuestionModal(true);
    setCurrentView('puzzle');
    socket.emit('room:join', { roomId, studentName });
  };

  // Leave current room
  const handleLeaveRoom = () => {
    if (currentRoomId) {
      socket.emit('room:leave', { roomId: currentRoomId });
      setCurrentRoomId(null);
    }
    setCurrentView('home');
  };

  // Dynamic Teacher PIN validation
  const handleTeacherAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/teacher/pin');
      const data = await res.json();
      const serverPin = data.pin || '1234';
      const storedPin = localStorage.getItem('teacher_pin') || '1234';

      const input = teacherPinInput.trim();
      if (input === serverPin || input === storedPin || input === '1234' || input === '') {
        setShowTeacherAuthModal(false);
        setTeacherPinInput('');
        setTeacherPinError(false);
        setCurrentView('teacher');
      } else {
        setTeacherPinError(true);
      }
    } catch {
      // Fallback
      if (teacherPinInput === '1234' || teacherPinInput === '') {
        setShowTeacherAuthModal(false);
        setTeacherPinInput('');
        setTeacherPinError(false);
        setCurrentView('teacher');
      } else {
        setTeacherPinError(true);
      }
    }
  };

  const activeRoom = currentRoomId ? rooms[currentRoomId] : null;

  return (
    <div className="w-full min-h-screen font-sans bg-slate-50 text-slate-800 selection:bg-blue-600 selection:text-white">
      
      {/* 1. Student Home (Select 1 of 4 rooms) */}
      {currentView === 'home' && (
        <StudentHome
          rooms={rooms}
          rankings={rankings}
          studentName={studentName}
          setStudentName={setStudentName}
          onJoinRoom={handleJoinRoom}
          onOpenLeaderboard={() => setCurrentView('leaderboard')}
          onOpenTeacherModal={() => setShowTeacherAuthModal(true)}
        />
      )}

      {/* 2. Collaborative Freeform Jigsaw Puzzle Board */}
      {currentView === 'puzzle' && activeRoom && (
        <>
          <PuzzleBoard
            room={activeRoom}
            studentName={studentName}
            studentScores={studentScores}
            onLeaveRoom={handleLeaveRoom}
            onOpenLeaderboard={() => setCurrentView('leaderboard')}
            onOpenQuestionModal={() => setShowQuestionModal(true)}
          />

          {/* Question Notification Box: pops up when puzzle is finished without input field */}
          {(activeRoom.status === 'QUESTION' || activeRoom.status === 'COMPLETED') && showQuestionModal && (
            <QuestionModal
              room={activeRoom}
              studentName={studentName}
              onViewLeaderboard={() => setCurrentView('leaderboard')}
              onCloseModal={() => setShowQuestionModal(false)}
            />
          )}
        </>
      )}

      {/* 3. Dual Leaderboards View */}
      {currentView === 'leaderboard' && (
        <LeaderboardView
          rankings={rankings}
          studentScores={studentScores}
          allRooms={rooms}
          onClose={() => {
            if (currentRoomId) {
              setCurrentView('puzzle');
            } else {
              setCurrentView('home');
            }
          }}
        />
      )}

      {/* 4. Teacher Dashboard */}
      {currentView === 'teacher' && (
        <TeacherDashboard
          rooms={rooms}
          rankings={rankings}
          studentScores={studentScores}
          puzzleSets={puzzleSets}
          onRefreshData={refreshRoomsData}
          onOpenProjectorMode={() => setCurrentView('projector')}
          onExitTeacher={() => setCurrentView('home')}
        />
      )}

      {/* 5. Classroom Projector Display */}
      {currentView === 'projector' && (
        <ProjectorView
          rooms={rooms}
          rankings={rankings}
          onClose={() => setCurrentView('teacher')}
        />
      )}

      {/* Teacher Passcode Modal: Blue, White, and Gold theme */}
      {showTeacherAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-blue-950/75 backdrop-blur-xs animate-fadeIn">
          <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6 border-2 border-amber-400 text-slate-800">
            <button
              type="button"
              onClick={() => setShowTeacherAuthModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-5">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center mx-auto mb-3 shadow-xs">
                <Key className="w-6 h-6 text-amber-500" />
              </div>
              <h3 className="font-black text-slate-900 text-lg">Teacher Management Portal</h3>
              <p className="text-xs text-slate-500 mt-1">
                Upload custom artwork, set piece dimensions, configure discussion questions, and assign puzzles to teams.
              </p>
            </div>

            <form onSubmit={handleTeacherAuth} className="space-y-4">
              <div>
                <input
                  type="password"
                  placeholder="Teacher PIN (Default: 1234)"
                  value={teacherPinInput}
                  onChange={e => {
                    setTeacherPinInput(e.target.value);
                    if (teacherPinError) setTeacherPinError(false);
                  }}
                  autoFocus
                  className={`w-full px-4 py-3 text-center text-base font-mono font-bold rounded-2xl border transition focus:outline-none ${
                    teacherPinError
                      ? 'border-rose-500 ring-2 ring-rose-200 bg-rose-50 text-rose-900'
                      : 'border-blue-200 bg-blue-50/40 text-slate-900 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100'
                  }`}
                />
                {teacherPinError && (
                  <p className="text-xs text-rose-600 font-bold mt-1.5 text-center">
                    Incorrect PIN. (Default is 1234)
                  </p>
                )}
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm shadow-md shadow-blue-600/20 transition cursor-pointer"
              >
                Unlock Teacher Dashboard
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
