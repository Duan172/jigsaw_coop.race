import React, { useState, useEffect } from 'react';
import { TeamRanking, StudentScore, RoomState } from '../types';
import {
  Trophy,
  Medal,
  Clock,
  ArrowLeft,
  Users,
  Sparkles,
  Flame,
  Crown,
  CheckCircle2
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface LeaderboardViewProps {
  rankings: TeamRanking[];
  studentScores: StudentScore[];
  allRooms: Record<string, RoomState>;
  onClose: () => void;
  isProjectorMode?: boolean;
  defaultTab?: 'teams' | 'students';
}

export const LeaderboardView: React.FC<LeaderboardViewProps> = ({
  rankings,
  studentScores = [],
  allRooms,
  onClose,
  isProjectorMode = false,
  defaultTab = 'teams',
}) => {
  const [activeTab, setActiveTab] = useState<'teams' | 'students'>(defaultTab);

  const allFinished = rankings.length > 0 && rankings.every(r => r.status === 'COMPLETED');

  useEffect(() => {
    if (allFinished && activeTab === 'teams') {
      try {
        confetti({
          particleCount: 100,
          spread: 80,
          origin: { y: 0.5 },
          colors: ['#3b82f6', '#fbbf24', '#ffffff', '#60a5fa', '#f59e0b'],
        });
      } catch {
        // ignore
      }
    }
  }, [allFinished, activeTab]);

  const formatMs = (ms: number | null) => {
    if (ms === null || ms === undefined) return '--:--';
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getRankBadge = (rank?: number) => {
    switch (rank) {
      case 1:
        return {
          icon: <Trophy className="w-5 h-5 text-amber-500" />,
          label: 'Champion (1st)',
          bg: 'bg-amber-400 text-blue-950 font-black',
        };
      case 2:
        return {
          icon: <Medal className="w-5 h-5 text-slate-400" />,
          label: 'Runner-up (2nd)',
          bg: 'bg-slate-200 text-slate-800 font-bold',
        };
      case 3:
        return {
          icon: <Medal className="w-5 h-5 text-amber-700" />,
          label: '3rd Place',
          bg: 'bg-amber-100 text-amber-900 font-bold',
        };
      default:
        return {
          icon: <span className="font-bold text-slate-400">#{rank || 4}</span>,
          label: `Rank ${rank || 4}`,
          bg: 'bg-blue-50 text-blue-800 font-bold',
        };
    }
  };

  return (
    <div className="w-full min-h-screen bg-slate-50 text-slate-800 p-4 sm:p-8 font-sans">
      <div className="max-w-5xl mx-auto flex flex-col gap-6">
        
        {/* Top Header Navigation */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 self-start sm:self-center">
            {!isProjectorMode && (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-blue-50 text-blue-900 border border-blue-200 text-sm font-bold shadow-xs transition cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Puzzle Board</span>
              </button>
            )}
          </div>

          <div className="text-center flex-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-xs font-black uppercase tracking-wider mb-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>{activeTab === 'teams' ? 'Team Completion Race' : 'Top Individual Snappers'}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-blue-950 tracking-tight">
              Live Competition Leaderboard
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Real-time updates on individual contributions and team completion records
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                try {
                  confetti({
                    particleCount: 90,
                    spread: 70,
                    origin: { y: 0.6 },
                    colors: ['#3b82f6', '#fbbf24', '#ffffff', '#60a5fa', '#f59e0b'],
                  });
                } catch {}
              }}
              className="p-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-blue-950 transition shadow-md cursor-pointer"
              title="Celebration confetti"
            >
              🎉
            </button>
          </div>
        </div>

        {/* 2 Tabs: Individual Piece Connectors vs Team Race Time */}
        <div className="flex items-center justify-center">
          <div className="p-1.5 rounded-2xl bg-white border border-blue-200 flex items-center gap-1.5 max-w-lg w-full shadow-xs">
            <button
              type="button"
              onClick={() => setActiveTab('students')}
              className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer ${
                activeTab === 'students'
                  ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-blue-950 shadow-md font-black'
                  : 'text-slate-600 hover:text-blue-700 hover:bg-blue-50'
              }`}
            >
              <Flame className="w-4 h-4 text-amber-600" />
              <span>Top Students</span>
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-black ${
                activeTab === 'students' ? 'bg-blue-950/15 text-blue-950' : 'bg-blue-50 text-blue-800'
              }`}>
                {studentScores.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('teams')}
              className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer ${
                activeTab === 'teams'
                  ? 'bg-blue-700 text-white shadow-md font-black'
                  : 'text-slate-600 hover:text-blue-700 hover:bg-blue-50'
              }`}
            >
              <Trophy className="w-4 h-4 text-amber-300" />
              <span>Team Race Times</span>
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-black ${
                activeTab === 'teams' ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-800'
              }`}>
                {rankings.length}
              </span>
            </button>
          </div>
        </div>

        {/* TAB 1: INDIVIDUAL TOP CONNECTORS */}
        {activeTab === 'students' && (
          <div className="space-y-4 animate-fadeIn">
            {studentScores.length > 0 && (
              <div className="grid grid-cols-3 gap-2 sm:gap-4 items-end pt-4 pb-2 max-w-xl mx-auto w-full">
                
                {/* 2nd place student */}
                {studentScores[1] && (
                  <div className="flex flex-col items-center order-1">
                    <div className="w-10 h-10 rounded-full bg-slate-200 text-slate-800 border-2 border-slate-300 flex items-center justify-center font-black text-sm mb-1 shadow-xs">
                      #{studentScores[1].rank}
                    </div>
                    <div className="font-bold text-xs sm:text-sm text-center truncate w-full text-slate-800">
                      {studentScores[1].name}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate flex items-center gap-1">
                      <span>{studentScores[1].badge}</span>
                      <span>{studentScores[1].roomName}</span>
                    </div>
                    <div className="w-full h-20 sm:h-24 bg-gradient-to-t from-slate-300 to-slate-200 rounded-t-2xl mt-2 flex flex-col items-center justify-center text-slate-900 shadow-sm border-t border-slate-300">
                      <span className="font-black text-lg sm:text-2xl">{studentScores[1].snapsCount ?? studentScores[1].piecesCount}</span>
                      <span className="text-[10px] uppercase font-bold tracking-wider opacity-80">snaps</span>
                    </div>
                  </div>
                )}

                {/* 1st place student */}
                {studentScores[0] && (
                  <div className="flex flex-col items-center order-2">
                    <Crown className="w-8 h-8 text-amber-500 mb-1 animate-bounce" />
                    <div className="w-12 h-12 rounded-full bg-amber-400 text-blue-950 ring-4 ring-amber-300 flex items-center justify-center font-black text-base mb-1 shadow-md">
                      #1
                    </div>
                    <div className="font-black text-sm sm:text-base text-center truncate w-full text-blue-950">
                      {studentScores[0].name}
                    </div>
                    <div className="text-xs text-slate-600 truncate flex items-center gap-1">
                      <span>{studentScores[0].badge}</span>
                      <span className="font-bold text-blue-800">{studentScores[0].roomName}</span>
                    </div>
                    <div className="w-full h-28 sm:h-32 bg-gradient-to-t from-amber-400 to-amber-300 rounded-t-2xl mt-2 flex flex-col items-center justify-center text-blue-950 shadow-md ring-2 ring-amber-400">
                      <span className="font-black text-2xl sm:text-3xl">{studentScores[0].snapsCount ?? studentScores[0].piecesCount}</span>
                      <span className="text-[11px] uppercase font-black tracking-wider">snaps created</span>
                    </div>
                  </div>
                )}

                {/* 3rd place student */}
                {studentScores[2] && (
                  <div className="flex flex-col items-center order-3">
                    <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-900 border-2 border-amber-300 flex items-center justify-center font-black text-sm mb-1 shadow-xs">
                      #{studentScores[2].rank}
                    </div>
                    <div className="font-bold text-xs sm:text-sm text-center truncate w-full text-slate-800">
                      {studentScores[2].name}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate flex items-center gap-1">
                      <span>{studentScores[2].badge}</span>
                      <span>{studentScores[2].roomName}</span>
                    </div>
                    <div className="w-full h-16 sm:h-20 bg-gradient-to-t from-amber-200 to-amber-100 rounded-t-2xl mt-2 flex flex-col items-center justify-center text-amber-950 shadow-sm border-t border-amber-300">
                      <span className="font-black text-lg sm:text-2xl">{studentScores[2].snapsCount ?? studentScores[2].piecesCount}</span>
                      <span className="text-[10px] uppercase font-bold tracking-wider opacity-80">snaps</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* List of all students */}
            <div className="space-y-2.5 mt-4">
              {studentScores.length > 0 ? (
                studentScores.map(student => (
                  <div
                    key={`${student.name}-${student.roomId}`}
                    className={`rounded-2xl p-4 bg-white border border-blue-100 transition-all flex items-center justify-between gap-3 shadow-xs ${
                      student.rank === 1 ? 'ring-2 ring-amber-400 bg-amber-50/40' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${
                        student.rank === 1 ? 'bg-amber-400 text-blue-950' :
                        student.rank === 2 ? 'bg-slate-200 text-slate-800' :
                        student.rank === 3 ? 'bg-amber-100 text-amber-900' : 'bg-blue-50 text-blue-800'
                      }`}>
                        #{student.rank}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-sm sm:text-base text-slate-900 truncate">
                            {student.name}
                          </h3>
                          {student.rank === 1 && (
                            <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 text-[10px] font-black border border-amber-300">
                              Top Snapper 🥇
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5 truncate">
                          <span>{student.badge}</span>
                          <span className="truncate font-semibold text-blue-800">{student.roomName}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-mono font-black text-base sm:text-lg text-amber-600">
                        {student.snapsCount ?? student.piecesCount} <span className="text-xs font-bold text-slate-500">snaps</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center bg-white rounded-2xl border border-blue-100 text-slate-400">
                  No puzzle snaps created yet. Seamlessly match puzzle edges or snap pieces into the frame to climb the leaderboard!
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: TEAM RACE RANKING (Completion Time) */}
        {activeTab === 'teams' && (
          <div className="space-y-4 animate-fadeIn">
            {rankings.map(team => {
              const rankInfo = getRankBadge(team.rank);
              const isCompleted = team.status === 'COMPLETED';

              return (
                <div
                  key={team.roomId}
                  className={`rounded-3xl p-5 sm:p-6 bg-white border-2 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm ${
                    team.rank === 1 && isCompleted
                      ? 'border-amber-400 ring-4 ring-amber-100'
                      : isCompleted
                      ? 'border-blue-200'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    {/* Rank Pill */}
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${rankInfo.bg}`}>
                      {rankInfo.icon}
                    </div>

                    {/* Team Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-2xl">{team.badge}</span>
                        <h3 className="font-black text-lg sm:text-xl text-blue-950 truncate">
                          {team.roomName}
                        </h3>
                        {isCompleted && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-300">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Finished 🏁</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                        <span>Puzzle: <strong className="text-slate-800">{allRooms[team.roomId]?.imageTitle || 'Jigsaw'}</strong></span>
                        <span>•</span>
                        <span>{team.memberCount} members</span>
                        <span>•</span>
                        <span>{team.totalPieces} pieces</span>
                      </div>
                    </div>
                  </div>

                  {/* Progress or Time */}
                  <div className="flex items-center justify-between sm:justify-end gap-6 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    <div className="text-left sm:text-right">
                      <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-0.5">
                        {isCompleted ? 'Completion Time' : 'Assembly Progress'}
                      </div>

                      {isCompleted ? (
                        <div className="font-mono font-black text-xl sm:text-2xl text-amber-600 flex items-center sm:justify-end gap-1.5">
                          <Clock className="w-5 h-5 text-amber-500" />
                          <span>{formatMs(team.puzzleDurationMs || team.totalDurationMs)}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2.5 rounded-full bg-blue-50 overflow-hidden border border-blue-200">
                            <div
                              className="h-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-300"
                              style={{ width: `${Math.round((team.piecesPlaced / (team.totalPieces || 1)) * 100)}%` }}
                            />
                          </div>
                          <span className="font-mono font-bold text-sm text-slate-700">
                            {Math.round((team.piecesPlaced / (team.totalPieces || 1)) * 100)}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
};
