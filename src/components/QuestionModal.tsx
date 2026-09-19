import React, { useState, useEffect } from 'react';
import { RoomState } from '../types';
import { Trophy, Sparkles, Eye, BookOpen, MessageSquare, X, Clock } from 'lucide-react';
import confetti from 'canvas-confetti';

interface QuestionModalProps {
  room: RoomState;
  studentName: string;
  onSubmitAnswer?: (answerText: string) => void;
  onViewLeaderboard: () => void;
  onCloseModal?: () => void;
}

export const QuestionModal: React.FC<QuestionModalProps> = ({
  room,
  studentName,
  onViewLeaderboard,
  onCloseModal,
}) => {
  const [showFullImage, setShowFullImage] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);

  useEffect(() => {
    try {
      confetti({
        particleCount: 90,
        spread: 80,
        origin: { y: 0.55 },
        colors: ['#3b82f6', '#fbbf24', '#ffffff', '#60a5fa', '#f59e0b'],
      });
    } catch {
      // ignore
    }
  }, []);

  const formatMs = (ms: number | null) => {
    if (ms === null || ms === undefined) return '--:--';
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-blue-950/75 backdrop-blur-sm overflow-y-auto animate-fadeIn">
      <div className="relative w-full max-w-xl bg-white text-slate-900 rounded-3xl shadow-2xl border-2 border-amber-400 my-auto overflow-hidden">
        
        {/* Close button if user wants to close dialog and review the puzzle board */}
        {onCloseModal && (
          <button
            type="button"
            onClick={onCloseModal}
            className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-white/20 hover:bg-white/40 text-white flex items-center justify-center transition cursor-pointer"
            title="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Top Header Banner: Blue + Gold */}
        <div className="relative bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 p-6 text-center text-white">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/90 text-blue-950 text-xs font-black uppercase tracking-wider mb-2.5 shadow-md">
            <Sparkles className="w-3.5 h-3.5 text-blue-950" />
            <span>Puzzle Completed!</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center justify-center gap-2">
            <span>{room.badge} {room.name}</span>
          </h2>

          <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-900/60 border border-blue-400/30 text-xs text-blue-100">
            <Clock className="w-3.5 h-3.5 text-amber-300" />
            <span>Completion Time:</span>
            <strong className="text-amber-300 font-mono text-sm font-black">
              {formatMs(room.puzzleCompletedTime || room.totalDurationMs)}
            </strong>
          </div>
        </div>

        {/* Content Body: White background with Blue & Gold accents */}
        <div className="p-6 space-y-5 bg-white">
          
          {/* Assembled Image Card */}
          <div className="flex items-center gap-4 p-3.5 bg-blue-50/80 rounded-2xl border border-blue-100">
            <div className="relative w-20 h-16 sm:w-24 sm:h-18 rounded-xl overflow-hidden shrink-0 shadow-sm border border-blue-200 bg-black">
              <img
                src={room.imageUrl}
                alt={room.imageTitle}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">Completed Artwork</div>
              <div className="font-bold text-slate-800 text-sm sm:text-base truncate">{room.imageTitle}</div>
              <button
                type="button"
                onClick={() => setShowFullImage(!showFullImage)}
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-semibold mt-1 transition cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>{showFullImage ? 'Hide full image' : 'View full artwork'}</span>
              </button>
            </div>
          </div>

          {/* Full Image Expand */}
          {showFullImage && (
            <div className="rounded-2xl overflow-hidden border border-blue-200 max-h-64 sm:max-h-80 bg-slate-950 shadow-inner">
              <img
                src={room.imageUrl}
                alt={room.imageTitle}
                className="w-full h-full object-contain mx-auto"
                referrerPolicy="no-referrer"
              />
            </div>
          )}

          {/* Announcement Question Dialog Card: Display-only prompt */}
          <div className="p-5 rounded-2xl bg-amber-50 border-2 border-amber-300/80 shadow-xs">
            <div className="flex items-center gap-2 text-xs font-black text-amber-700 tracking-wider uppercase mb-2">
              <MessageSquare className="w-4 h-4 text-amber-600" />
              <span>Discussion Question for Your Team</span>
            </div>

            <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-relaxed">
              {room.question?.text || 'Observe the completed image and discuss the key concepts with your team!'}
            </h3>
          </div>

          {/* Optional Model / Key Concepts Guidance */}
          {(room.question?.sampleAnswer || room.question?.explanation) && (
            <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-blue-800 flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-blue-600" />
                  <span>Key Insights & Discussion Reference</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowExplanation(!showExplanation)}
                  className="text-blue-600 hover:text-blue-800 font-bold cursor-pointer"
                >
                  {showExplanation ? 'Hide details' : 'View details'}
                </button>
              </div>

              {showExplanation && (
                <div className="mt-3 pt-3 border-t border-blue-100 text-slate-700 space-y-2 text-xs sm:text-sm">
                  {room.question.sampleAnswer && (
                    <p>
                      <strong className="text-blue-900">Discussion Talking Points:</strong> {room.question.sampleAnswer}
                    </p>
                  )}
                  {room.question.explanation && (
                    <p className="text-slate-600">
                      <strong className="text-blue-900">Concept Summary:</strong> {room.question.explanation}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Action Buttons: Yellow/Gold & Blue */}
          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={onViewLeaderboard}
              className="flex-1 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-blue-950 font-black text-sm sm:text-base shadow-md shadow-amber-400/30 flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Trophy className="w-5 h-5 text-blue-950" />
              <span>View Leaderboard</span>
            </button>

            {onCloseModal && (
              <button
                type="button"
                onClick={onCloseModal}
                className="py-3.5 px-5 rounded-2xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-sm transition cursor-pointer border border-blue-200"
              >
                Close & Review Board
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};
