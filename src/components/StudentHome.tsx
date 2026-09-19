import React, { useState, useEffect } from 'react';
import { RoomState, TeamRanking } from '../types';
import { Users, Trophy, ArrowRight, Lock, Layers, Sparkles, Activity, CheckCircle2, Star } from 'lucide-react';
import { getClusterStats } from '../utils/jigsawHelper';

interface StudentHomeProps {
  rooms: Record<string, RoomState>;
  rankings: TeamRanking[];
  studentName: string;
  setStudentName: (name: string) => void;
  onJoinRoom: (roomId: string) => void;
  onOpenLeaderboard: () => void;
  onOpenTeacherModal: () => void;
}

export const StudentHome: React.FC<StudentHomeProps> = ({
  rooms,
  rankings,
  studentName,
  setStudentName,
  onJoinRoom,
  onOpenLeaderboard,
  onOpenTeacherModal,
}) => {
  const [nameInput, setNameInput] = useState(studentName || '');
  const [nameError, setNameError] = useState(false);

  useEffect(() => {
    if (studentName) setNameInput(studentName);
  }, [studentName]);

  const handleJoin = (roomId: string) => {
    const clean = nameInput.trim();
    if (!clean) {
      setNameError(true);
      const el = document.getElementById('student-name-input');
      el?.focus();
      return;
    }
    setNameError(false);
    setStudentName(clean);
    try {
      localStorage.setItem('jigsaw_student_name', clean);
    } catch {}
    onJoinRoom(roomId);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            Finished 🏁
          </span>
        );
      case 'QUESTION':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 animate-pulse">
            Question Phase ❓
          </span>
        );
      case 'PLAYING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300">
            Assembling ⚡
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            Waiting to Start
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50/70 via-slate-50 to-white text-slate-800 flex flex-col justify-between font-sans selection:bg-blue-500 selection:text-white">
      
      {/* 1. Header: Royal Blue with Gold & White accents */}
      <header className="bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-800 text-white px-4 sm:px-6 py-3.5 shadow-md sticky top-0 z-30">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-400 text-blue-950 flex items-center justify-center text-xl shadow-md font-black">
              🧩
            </div>
            <div>
              <h1 className="font-black text-white text-base sm:text-lg tracking-tight leading-tight flex items-center gap-2">
                <span>Team Jigsaw Arena</span>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-900/60 border border-blue-400/40 text-blue-200 uppercase tracking-widest hidden sm:inline">
                  Classroom Edition
                </span>
              </h1>
              <p className="text-xs text-blue-100 font-medium">Real-Time Collaborative Puzzle Racing</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onOpenLeaderboard}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-blue-950 text-xs sm:text-sm font-black flex items-center gap-2 shadow-md shadow-amber-400/20 transition cursor-pointer"
            >
              <Trophy className="w-4 h-4 text-blue-950" />
              <span>Leaderboard</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. Main Content */}
      <main className="max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-10 flex-1 flex flex-col justify-center">
        
        {/* Step 1: Student Name Input (White card with blue border & gold accent) */}
        <div className="max-w-md mx-auto w-full mb-8 bg-white p-6 rounded-3xl border-2 border-blue-200 shadow-lg text-center">
          <label htmlFor="student-name-input" className="block text-xs font-black text-blue-800 uppercase tracking-widest mb-2 flex items-center justify-center gap-1.5">
            <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
            <span>Step 1: Enter Your Student Name</span>
          </label>
          <div className="relative">
            <input
              id="student-name-input"
              type="text"
              maxLength={25}
              value={nameInput}
              onChange={e => {
                setNameInput(e.target.value);
                if (nameError) setNameError(false);
              }}
              placeholder="e.g. Alex, Linh, John..."
              className={`w-full px-4 py-3 rounded-2xl text-center text-base sm:text-lg font-bold transition focus:outline-none ${
                nameError
                  ? 'border-2 border-rose-500 bg-rose-50 text-slate-900 ring-2 ring-rose-300'
                  : 'border-2 border-blue-200 bg-blue-50/40 text-blue-950 placeholder-slate-400 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100'
              }`}
            />
          </div>
          {nameError ? (
            <p className="text-xs text-rose-600 font-bold mt-2 animate-bounce">
              ⚠️ Please enter your name before joining a team room!
            </p>
          ) : (
            <p className="text-xs text-slate-500 mt-2 font-medium">
              Teammates will see your name when you pick and place pieces together!
            </p>
          )}
        </div>

        {/* Step 2: Select 1 of 4 Team Rooms */}
        <div>
          <div className="text-center mb-6">
            <h2 className="text-xl sm:text-2xl font-black text-blue-950 tracking-tight">
              Step 2: Choose Your Team Room
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 font-medium mt-1">
              Select 1 of 4 teams to join your classmates and assemble the puzzle collaboratively
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {Object.values(rooms).map((room, idx) => {
              const stats = getClusterStats(room.pieces, room.totalPieces);
              const isLead = rankings[0]?.roomId === room.id && rankings[0]?.status === 'COMPLETED';

              return (
                <div
                  key={room.id}
                  onClick={() => handleJoin(room.id)}
                  className="group relative bg-white rounded-3xl p-5 border-2 border-blue-100 hover:border-blue-500 hover:shadow-xl hover:-translate-y-1 transition-all duration-200 flex flex-col justify-between cursor-pointer overflow-hidden shadow-sm"
                >
                  {/* Top Rank Badge */}
                  {isLead && (
                    <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-amber-400 text-blue-950 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-xs">
                      <Trophy className="w-3 h-3 text-blue-950" />
                      <span>1st Place</span>
                    </div>
                  )}

                  <div>
                    {/* Team Identity Icon & Title */}
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-3xl p-2 rounded-2xl bg-blue-50 border border-blue-100 group-hover:scale-110 transition-transform">
                        {room.badge}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">
                          Team {idx + 1}
                        </div>
                        <h3 className="text-base font-black text-slate-900 truncate">
                          {room.name}
                        </h3>
                      </div>
                    </div>

                    {/* Puzzle Preview Thumbnail */}
                    <div className="relative w-full aspect-[4/2.6] rounded-2xl overflow-hidden mb-3 bg-slate-900 border border-blue-100 shadow-inner">
                      <img
                        src={room.imageUrl}
                        alt={room.imageTitle}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 opacity-90 group-hover:opacity-100"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-2.5">
                        <span className="text-white text-xs font-bold truncate">
                          {room.imageTitle}
                        </span>
                      </div>
                    </div>

                    {/* Progress & Specifications */}
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-slate-500">Status:</span>
                        {getStatusBadge(room.status)}
                      </div>

                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-slate-500">Dimensions:</span>
                        <span className="text-blue-900 font-bold">
                          {room.gridCols} × {room.gridRows} ({room.totalPieces} pieces)
                        </span>
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1">
                          <span>Assembly Progress:</span>
                          <span className="text-amber-600 font-black">{stats.progressPercent}%</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-blue-50 overflow-hidden border border-blue-100">
                          <div
                            className="h-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-300"
                            style={{ width: `${stats.progressPercent}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Join Action Bar */}
                  <div>
                    <div className="flex items-center justify-between pt-3 border-t border-blue-50 text-xs">
                      <span className="flex items-center gap-1 font-bold text-blue-700">
                        <Users className="w-3.5 h-3.5 text-blue-600" />
                        <span>{room.members.length} online</span>
                      </span>

                      <span className="inline-flex items-center gap-1 font-black text-blue-700 group-hover:text-blue-900 group-hover:translate-x-0.5 transition">
                        <span>Join</span>
                        <ArrowRight className="w-3.5 h-3.5 text-blue-600" />
                      </span>
                    </div>

                    <button
                      type="button"
                      className="w-full mt-3 py-2.5 px-4 rounded-xl bg-blue-50 group-hover:bg-blue-600 group-hover:text-white text-blue-800 font-black text-xs sm:text-sm transition flex items-center justify-center gap-2 border border-blue-200 group-hover:border-blue-600 shadow-xs"
                    >
                      <span>Enter Workspace</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </main>

      {/* 3. Footer: Teacher Portal Access */}
      <footer className="py-4 px-6 border-t border-blue-100 bg-white text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-3 max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          <span className="font-semibold text-slate-600">Multiplayer WebSocket Engine Active</span>
        </div>

        <button
          type="button"
          onClick={onOpenTeacherModal}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold transition cursor-pointer"
        >
          <Lock className="w-3.5 h-3.5 text-amber-500" />
          <span>Teacher Dashboard & Setup</span>
        </button>
      </footer>

    </div>
  );
};
