import React from 'react';
import { RoomState, TeamRanking } from '../types';
import { Clock, Users, ArrowLeft, Maximize2, Sparkles, CheckCircle2 } from 'lucide-react';
import { getClusterStats } from '../utils/jigsawHelper';

interface ProjectorViewProps {
  rooms: Record<string, RoomState>;
  rankings: TeamRanking[];
  onClose: () => void;
}

export const ProjectorView: React.FC<ProjectorViewProps> = ({
  rooms,
  rankings,
  onClose,
}) => {
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const formatMs = (ms: number | null) => {
    if (ms === null || ms === undefined) return '--:--';
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col p-4 sm:p-6 select-none font-sans">
      
      {/* Top Projector Header: Royal Blue + White + Gold */}
      <header className="flex items-center justify-between pb-4 border-b border-blue-900/60">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-blue-950 hover:bg-blue-900 text-blue-200 hover:text-white border border-blue-800 transition cursor-pointer"
            title="Exit Projector Mode"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-400 text-blue-950 text-xs font-black uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-blue-950" />
              <span>Live Classroom Projector Display</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-1">
              Classroom Jigsaw Challenge Arena
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleFullscreen}
            className="px-3.5 py-1.5 rounded-xl bg-blue-800 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold flex items-center gap-2 border border-blue-600 transition cursor-pointer"
          >
            <Maximize2 className="w-4 h-4 text-amber-300" />
            <span className="hidden sm:inline">Fullscreen</span>
          </button>
        </div>
      </header>

      {/* 4 Teams Arena Grid */}
      <main className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 pt-6 items-stretch">
        {Object.values(rooms).map(room => {
          const stats = getClusterStats(room.pieces, room.totalPieces);
          const rankingItem = rankings.find(r => r.roomId === room.id);
          const isCompleted = room.status === 'COMPLETED';

          return (
            <div
              key={room.id}
              className={`rounded-3xl border-2 flex flex-col justify-between overflow-hidden shadow-2xl transition-all duration-300 ${
                isCompleted
                  ? 'bg-slate-800/90 border-amber-400 ring-4 ring-amber-400/20'
                  : 'bg-slate-800/60 border-blue-900/80'
              }`}
            >
              {/* Room Card Header */}
              <div className="p-4 border-b border-slate-700/60 flex items-center justify-between bg-slate-800/80">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-3xl shrink-0">{room.badge}</span>
                  <div className="min-w-0">
                    <h2 className="font-black text-base sm:text-lg truncate text-white">
                      {room.name}
                    </h2>
                    <div className="text-xs text-blue-300 flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-blue-400" />
                      <span>{room.members.length} students</span>
                    </div>
                  </div>
                </div>

                {/* Rank Badge */}
                {rankingItem?.rank && isCompleted && (
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shadow-md ${
                    rankingItem.rank === 1 ? 'bg-amber-400 text-blue-950 ring-2 ring-amber-300' :
                    rankingItem.rank === 2 ? 'bg-slate-200 text-slate-900' :
                    rankingItem.rank === 3 ? 'bg-amber-700 text-white' : 'bg-slate-700 text-slate-300'
                  }`}>
                    #{rankingItem.rank}
                  </div>
                )}
              </div>

              {/* Middle: Puzzle Snapshot */}
              <div className="p-5 flex flex-col items-center justify-center flex-1">
                <div className="relative w-full aspect-[4/3] max-w-[280px] rounded-2xl overflow-hidden border border-blue-900/60 bg-black shadow-inner">
                  <img
                    src={room.imageUrl}
                    alt={room.imageTitle}
                    className="w-full h-full object-cover opacity-85"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-transparent flex items-end p-3">
                    <span className="text-xs font-bold text-white truncate">{room.imageTitle}</span>
                  </div>
                </div>

                {/* Progress Bar & Connected Pieces */}
                <div className="w-full mt-4">
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span className="text-slate-400">Progress</span>
                    <span className="text-amber-400 font-mono font-black">
                      {stats.lockedCount}/{room.totalPieces} ({stats.progressPercent}%)
                    </span>
                  </div>
                  <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-700">
                    <div
                      className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all duration-300"
                      style={{ width: `${stats.progressPercent}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Footer Status & Finish Clock */}
              <div className="p-4 bg-slate-950/60 border-t border-slate-700/60 flex items-center justify-between">
                <div className="text-xs text-slate-400">
                  {isCompleted ? (
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" /> Finished
                    </span>
                  ) : (
                    <span className="text-blue-300 font-bold flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
                      Racing
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 font-mono font-black text-amber-400 text-sm">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <span>
                    {formatMs(room.puzzleCompletedTime || room.totalDurationMs)}
                  </span>
                </div>
              </div>

            </div>
          );
        })}
      </main>

    </div>
  );
};
