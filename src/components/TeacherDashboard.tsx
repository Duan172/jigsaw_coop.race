import React, { useState, useEffect, useCallback } from 'react';
import { RoomState, TeamRanking, StudentScore, PuzzleSet } from '../types';
import { PRESET_IMAGES } from '../utils/defaultData';
import {
  Play,
  RotateCcw,
  Tv,
  Image as ImageIcon,
  Save,
  Users,
  Grid,
  Upload,
  Link,
  Sparkles,
  ArrowLeft,
  Settings2,
  Plus,
  Trash2,
  Edit3,
  Layers,
  Key,
  Trophy,
  Check,
  X,
  MessageSquare,
  AlertTriangle,
  Search,
  RefreshCw,
  UserCheck,
  Zap,
  Lock
} from 'lucide-react';
import { LeaderboardView } from './LeaderboardView';

interface TeacherDashboardProps {
  rooms: Record<string, RoomState>;
  rankings: TeamRanking[];
  studentScores: StudentScore[];
  puzzleSets: PuzzleSet[];
  onRefreshData: () => void;
  onOpenProjectorMode: () => void;
  onExitTeacher: () => void;
}

export interface ParticipatingStudent {
  name: string;
  roomId: string;
  roomName: string;
  badge: string;
  color: string;
  joinedAt: number;
  snapsCount: number;
  isOnline: boolean;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  rooms,
  rankings,
  studentScores = [],
  puzzleSets = [],
  onRefreshData,
  onOpenProjectorMode,
  onExitTeacher,
}) => {
  const [activeTab, setActiveTab] = useState<'sets' | 'rooms' | 'students' | 'leaderboard'>('sets');
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showNotice = (text: string, type: 'success' | 'error' = 'success') => {
    setNotice({ type, text });
    setTimeout(() => setNotice(null), 3500);
  };

  // --- PARTICIPATING STUDENTS ROSTER STATE ---
  const [participatingStudents, setParticipatingStudents] = useState<ParticipatingStudent[]>([]);
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const [studentRoomFilter, setStudentRoomFilter] = useState('all');
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);

  const fetchStudents = useCallback(async () => {
    setIsLoadingStudents(true);
    try {
      const res = await fetch('/api/teacher/students');
      if (res.ok) {
        const data: ParticipatingStudent[] = await res.json();
        setParticipatingStudents(data);
      }
    } catch (err) {
      console.error('Failed to fetch participating students:', err);
    } finally {
      setIsLoadingStudents(false);
    }
  }, []);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents, rooms]);

  // --- 1. CHANGE TEACHER PIN STATE & MODAL ---
  const [showPinModal, setShowPinModal] = useState(false);
  const [currentPin, setCurrentPin] = useState('1234');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);

  // --- 2. RESET DATA CONFIRMATION MODAL ---
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    fetch('/api/teacher/pin')
      .then(res => res.json())
      .then(data => {
        if (data.pin) setCurrentPin(data.pin);
      })
      .catch(() => {});
  }, []);

  const handleChangePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPinInput.trim()) {
      setPinError('Please enter a new PIN.');
      return;
    }
    if (newPinInput !== confirmPinInput) {
      setPinError('Confirmation PIN does not match.');
      return;
    }

    try {
      const res = await fetch('/api/teacher/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: newPinInput.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentPin(data.pin);
        try {
          localStorage.setItem('teacher_pin', data.pin);
        } catch {}
        setShowPinModal(false);
        setNewPinInput('');
        setConfirmPinInput('');
        setPinError(null);
        showNotice(`Teacher PIN updated successfully! (New PIN: ${data.pin})`);
      } else {
        setPinError('Unable to update PIN.');
      }
    } catch {
      setPinError('Server connection error.');
    }
  };

  // --- 3. PUZZLE SETS FORM STATE ---
  const [setTitle, setSetTitle] = useState('');
  const [setImageUrl, setSetImageUrl] = useState('');
  const [inputCols, setInputCols] = useState<number>(4);
  const [inputRows, setInputRows] = useState<number>(3);
  const [setQuestionText, setSetQuestionText] = useState('');
  const [setSampleAnswer, setSetSampleAnswer] = useState('');
  const [setExplanation, setSetExplanation] = useState('');
  const [isSavingSet, setIsSavingSet] = useState(false);

  // Quick preset loader
  const loadPresetIntoForm = (preset: typeof PRESET_IMAGES[0]) => {
    setSetTitle(preset.title);
    setSetImageUrl(preset.url);
    setInputCols(preset.gridCols);
    setInputRows(preset.gridRows);
    setSetQuestionText(preset.defaultQuestion.text);
    setSetSampleAnswer(preset.defaultQuestion.sampleAnswer || '');
    setSetExplanation(preset.defaultQuestion.explanation || '');
  };

  // File upload for Puzzle Set Image
  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      alert('Image file size exceeds 8MB. Please select a smaller file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = event => {
      const result = event.target?.result as string;
      if (result) {
        setSetImageUrl(result);
        if (!setTitle) {
          setSetTitle(file.name.replace(/\.[^/.]+$/, ''));
        }
      }
    };
    reader.readAsDataURL(file);
  };

  // Save new Puzzle Set
  const handleSavePuzzleSet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setTitle.trim() || !setImageUrl.trim()) {
      alert('Please enter a puzzle title and provide an image.');
      return;
    }

    const rows = Math.max(2, Math.min(10, Number(inputRows) || 3));
    const cols = Math.max(2, Math.min(12, Number(inputCols) || 4));

    setIsSavingSet(true);
    try {
      const res = await fetch('/api/puzzle-sets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: setTitle.trim(),
          imageUrl: setImageUrl.trim(),
          gridRows: rows,
          gridCols: cols,
          question: {
            text: setQuestionText.trim() || 'Observe the assembled puzzle and summarize the core principles shown:',
            sampleAnswer: setSampleAnswer.trim(),
            explanation: setExplanation.trim(),
          },
        }),
      });

      if (res.ok) {
        showNotice('Puzzle set added to library successfully!');
        onRefreshData();
        setSetTitle('');
        setSetImageUrl('');
        setSetQuestionText('');
        setSetSampleAnswer('');
        setSetExplanation('');
      } else {
        alert('Unable to save puzzle set.');
      }
    } catch (err) {
      console.error(err);
      alert('Network error while saving puzzle set.');
    } finally {
      setIsSavingSet(false);
    }
  };

  const handleDeletePuzzleSet = async (setId: string) => {
    if (!confirm('Are you sure you want to delete this puzzle set?')) return;
    try {
      const res = await fetch(`/api/puzzle-sets/${setId}`, { method: 'DELETE' });
      if (res.ok) {
        showNotice('Puzzle set removed from library.');
        onRefreshData();
      }
    } catch {
      alert('Network error.');
    }
  };

  // Assign a puzzle set to ANY specific room or ALL rooms
  const handleAssignPuzzleToRoom = async (setId: string, targetRoomId: string) => {
    try {
      const res = await fetch('/api/teacher/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetRoomId,
          puzzleSetId: setId,
        }),
      });
      if (res.ok) {
        const roomName = targetRoomId === 'all' ? 'All Teams' : rooms[targetRoomId]?.name || 'Team';
        showNotice(`Puzzle assigned successfully to ${roomName}! 🎉`);
        onRefreshData();
      }
    } catch {
      alert('Error assigning puzzle to room.');
    }
  };

  // --- 4. ROOM MANAGEMENT STATE ---
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [roomNameInput, setRoomNameInput] = useState('');
  const [roomBadgeInput, setRoomBadgeInput] = useState('⭐');
  const [showAddRoomModal, setShowAddRoomModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomBadge, setNewRoomBadge] = useState('🦁');
  const [newRoomColor, setNewRoomColor] = useState('indigo');

  const handleEditRoomSubmit = async (roomId: string) => {
    if (!roomNameInput.trim()) return;
    try {
      const res = await fetch(`/api/rooms/${roomId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: roomNameInput.trim(),
          badge: roomBadgeInput,
        }),
      });
      if (res.ok) {
        setEditingRoomId(null);
        showNotice('Team room updated!');
        onRefreshData();
      }
    } catch {
      alert('Error updating room.');
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) {
      alert('Please enter a team name.');
      return;
    }

    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newRoomName.trim(),
          badge: newRoomBadge,
          color: newRoomColor,
          puzzleSetId: puzzleSets[0]?.id,
        }),
      });
      if (res.ok) {
        setShowAddRoomModal(false);
        setNewRoomName('');
        showNotice('New team room created successfully!');
        onRefreshData();
      }
    } catch {
      alert('Error creating room.');
    }
  };

  const handleDeleteRoom = async (roomId: string) => {
    if (Object.keys(rooms).length <= 1) {
      alert('At least 1 team room must be maintained.');
      return;
    }
    if (!confirm('Are you sure you want to delete this team room?')) return;
    try {
      const res = await fetch(`/api/rooms/${roomId}`, { method: 'DELETE' });
      if (res.ok) {
        showNotice('Team room deleted.');
        onRefreshData();
      }
    } catch {
      alert('Error deleting room.');
    }
  };

  // --- 5. GAME RUNTIME CONTROLS ---
  const handleStartAll = async () => {
    try {
      const res = await fetch('/api/teacher/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: 'all' }),
      });
      if (res.ok) {
        showNotice('Start signal sent! All teams are now assembling their puzzles.');
        onRefreshData();
      }
    } catch {
      alert('Error sending start command.');
    }
  };

  const handleConfirmResetAll = async () => {
    setIsResetting(true);
    try {
      const res = await fetch('/api/teacher/reset-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        setShowResetConfirmModal(false);
        showNotice('All game data, pieces, and leaderboards have been reset! 🔄');
        onRefreshData();
      } else {
        alert('Failed to reset game data.');
      }
    } catch {
      alert('Error connecting to server.');
    } finally {
      setIsResetting(false);
    }
  };

  const handleResetSingleRoom = async (roomId: string) => {
    try {
      const res = await fetch('/api/teacher/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId }),
      });
      if (res.ok) {
        showNotice(`Reset puzzle board for ${rooms[roomId]?.name || 'team'}.`);
        onRefreshData();
      }
    } catch {
      alert('Error resetting room.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      
      {/* 1. Header: Royal Blue + White + Gold */}
      <header className="h-16 px-4 sm:px-6 bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-800 text-white shadow-md flex items-center justify-between z-30 sticky top-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onExitTeacher}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-blue-100 hover:text-white bg-blue-900/60 hover:bg-blue-900 border border-blue-400/30 transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Student View</span>
          </button>

          <div>
            <h1 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
              <span>Teacher Control Dashboard</span>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-400 text-blue-950 uppercase tracking-wider shadow-xs">
                Admin
              </span>
            </h1>
          </div>
        </div>

        {/* Action Buttons: Change PIN, Projector, Start All, Reset All Data */}
        <div className="flex items-center gap-2">
          {/* Change Teacher PIN Button */}
          <button
            type="button"
            onClick={() => {
              setNewPinInput('');
              setConfirmPinInput('');
              setPinError(null);
              setShowPinModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition cursor-pointer shadow-xs"
            title="Change teacher passcode PIN"
          >
            <Key className="w-3.5 h-3.5 text-amber-300" />
            <span className="hidden sm:inline">Change PIN</span>
          </button>

          <button
            type="button"
            onClick={onOpenProjectorMode}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition cursor-pointer shadow-xs"
            title="Open classroom live projector view"
          >
            <Tv className="w-4 h-4 text-amber-300" />
            <span className="hidden sm:inline">Projector</span>
          </button>

          {/* Reset All Data Button */}
          <button
            type="button"
            onClick={() => setShowResetConfirmModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 hover:text-white border border-rose-400/40 transition cursor-pointer shadow-xs"
            title="Reset all puzzle boards, scores, and timer data"
          >
            <RotateCcw className="w-3.5 h-3.5 text-rose-300" />
            <span className="hidden md:inline">Reset Data</span>
          </button>

          <button
            type="button"
            onClick={handleStartAll}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black bg-gradient-to-r from-amber-400 via-amber-500 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-blue-950 shadow-md transition cursor-pointer"
          >
            <Play className="w-4 h-4 fill-blue-950 text-blue-950" />
            <span>Start All Teams</span>
          </button>
        </div>
      </header>

      {/* 2. Notification Toast */}
      {notice && (
        <div className="fixed top-20 right-6 z-50 px-4 py-3 rounded-2xl bg-amber-400 text-blue-950 font-black text-xs shadow-xl flex items-center gap-2 animate-bounce border border-amber-300">
          <Sparkles className="w-4 h-4 text-blue-950" />
          <span>{notice.text}</span>
        </div>
      )}

      {/* 3. Navigation Tabs */}
      <div className="border-b border-blue-100 bg-white px-4 sm:px-6 shadow-xs">
        <div className="max-w-6xl mx-auto flex items-center gap-2 py-2.5">
          <button
            type="button"
            onClick={() => setActiveTab('sets')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'sets'
                ? 'bg-blue-700 text-white shadow-md'
                : 'text-slate-600 hover:text-blue-700 hover:bg-blue-50'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>1. Puzzle Sets & Questions</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-black">
              {puzzleSets.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('rooms')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'rooms'
                ? 'bg-blue-700 text-white shadow-md'
                : 'text-slate-600 hover:text-blue-700 hover:bg-blue-50'
            }`}
          >
            <Settings2 className="w-4 h-4" />
            <span>2. Team Rooms</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-black">
              {Object.keys(rooms).length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('students');
              fetchStudents();
            }}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'students'
                ? 'bg-blue-700 text-white shadow-md'
                : 'text-slate-600 hover:text-blue-700 hover:bg-blue-50'
            }`}
          >
            <Users className="w-4 h-4 text-emerald-500" />
            <span>3. Participating Students</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-black">
              {participatingStudents.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('leaderboard')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'leaderboard'
                ? 'bg-blue-700 text-white shadow-md'
                : 'text-slate-600 hover:text-blue-700 hover:bg-blue-50'
            }`}
          >
            <Trophy className="w-4 h-4 text-amber-500" />
            <span>4. Leaderboards</span>
          </button>
        </div>
      </div>

      {/* 4. Tab Contents */}
      <main className="max-w-6xl w-full mx-auto p-4 sm:p-6 flex-1">
        
        {/* TAB 1: PUZZLE SETS & QUESTIONS */}
        {activeTab === 'sets' && (
          <div className="space-y-8 animate-fadeIn">
            
            {/* Creation Form: White Card with Blue & Gold accents */}
            <div className="bg-white border border-blue-100 rounded-3xl p-6 sm:p-8 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-5 border-b border-blue-100 mb-6">
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-blue-950 flex items-center gap-2">
                    <ImageIcon className="w-5 h-5 text-blue-600" />
                    <span>Upload Puzzle Image & Set Dimensions</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Freely configure grid dimensions (Columns × Rows) and set the discussion question displayed upon completion.
                  </p>
                </div>

                {/* Preset quick pills */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs text-slate-500 font-bold mr-1">Presets:</span>
                  {PRESET_IMAGES.map((p, idx) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => loadPresetIntoForm(p)}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition cursor-pointer"
                    >
                      Set #{idx + 1}
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={handleSavePuzzleSet} className="space-y-6">
                
                {/* 1. Title & Grid Dimension Controls */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Topic / Puzzle Title *
                    </label>
                    <input
                      type="text"
                      required
                      value={setTitle}
                      onChange={e => setSetTitle(e.target.value)}
                      placeholder="e.g. Solar System, Rainforest, Ancient Monuments..."
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-blue-200 text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:border-blue-600 focus:bg-white"
                    />
                  </div>

                  {/* Long side x Short side dimensions */}
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-blue-700 uppercase tracking-wider mb-2">
                      Custom Dimensions (Long Side × Short Side)
                    </label>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div>
                        <div className="text-[11px] font-bold text-slate-600 mb-1">Columns (Width)</div>
                        <input
                          type="number"
                          min={2}
                          max={12}
                          value={inputCols}
                          onChange={e => setInputCols(Math.max(2, Math.min(12, Number(e.target.value))))}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-blue-200 text-blue-900 font-bold text-sm focus:outline-none focus:border-blue-600 focus:bg-white"
                        />
                      </div>

                      <div>
                        <div className="text-[11px] font-bold text-slate-600 mb-1">Rows (Height)</div>
                        <input
                          type="number"
                          min={2}
                          max={10}
                          value={inputRows}
                          onChange={e => setInputRows(Math.max(2, Math.min(10, Number(e.target.value))))}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-blue-200 text-blue-900 font-bold text-sm focus:outline-none focus:border-blue-600 focus:bg-white"
                        />
                      </div>

                      <div className="sm:col-span-2 flex items-center justify-between p-2.5 bg-blue-50/70 rounded-xl border border-blue-200">
                        <span className="text-xs text-blue-900 font-bold">Total Pieces:</span>
                        <span className="font-mono font-black text-amber-600 text-base">
                          {inputCols * inputRows} pieces
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Image Upload or URL */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Upload Image File (Drag & drop or click)
                    </label>
                    <label className="flex flex-col items-center justify-center border-2 border-dashed border-blue-200 hover:border-blue-500 rounded-2xl p-4 bg-blue-50/30 hover:bg-blue-50/70 transition cursor-pointer">
                      <Upload className="w-6 h-6 text-blue-600 mb-1" />
                      <span className="text-xs font-bold text-blue-800">Choose image file</span>
                      <span className="text-[10px] text-slate-400 mt-0.5">Supports PNG, JPG, WebP up to 8MB</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageFileUpload}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Or Direct Image Web Link (URL)
                    </label>
                    <div className="relative">
                      <input
                        type="url"
                        value={setImageUrl}
                        onChange={e => setSetImageUrl(e.target.value)}
                        placeholder="https://images.unsplash.com/..."
                        className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-50 border border-blue-200 text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:border-blue-600 focus:bg-white"
                      />
                      <Link className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    </div>

                    {setImageUrl && (
                      <div className="mt-2 flex items-center gap-3 p-2 bg-blue-50 rounded-xl border border-blue-100">
                        <img
                          src={setImageUrl}
                          alt="preview"
                          className="w-14 h-10 object-cover rounded-lg bg-black"
                          referrerPolicy="no-referrer"
                        />
                        <span className="text-xs text-blue-900 font-semibold truncate flex-1">Image loaded successfully</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 3. Open Question Announcement Prompt (Display-only notification, no ABCD) */}
                <div className="p-5 rounded-2xl bg-amber-50/60 border border-amber-200 space-y-4">
                  <div className="flex items-center gap-2 text-xs font-black text-amber-800 uppercase tracking-wider">
                    <MessageSquare className="w-4 h-4 text-amber-600" />
                    <span>Notification Question Box (Shown as a notification dialog when puzzle is solved)</span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Question Text *
                    </label>
                    <textarea
                      rows={2}
                      required
                      value={setQuestionText}
                      onChange={e => setSetQuestionText(e.target.value)}
                      placeholder="e.g. Based on the assembled image, discuss what key mechanism is depicted and explain its significance."
                      className="w-full px-4 py-2.5 rounded-xl bg-white border border-amber-300 text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:border-amber-500 resize-none shadow-2xs"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Sample Answer / Talking Points (Optional reference in dialog)
                      </label>
                      <textarea
                        rows={2}
                        value={setSampleAnswer}
                        onChange={e => setSetSampleAnswer(e.target.value)}
                        placeholder="Model response and key ideas for students to discuss..."
                        className="w-full px-4 py-2 rounded-xl bg-white border border-blue-200 text-slate-800 placeholder-slate-400 text-xs focus:outline-none focus:border-blue-500 resize-none shadow-2xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Explanation & Core Insights
                      </label>
                      <textarea
                        rows={2}
                        value={setExplanation}
                        onChange={e => setSetExplanation(e.target.value)}
                        placeholder="Deeper scientific or analytical context to conclude the lesson..."
                        className="w-full px-4 py-2 rounded-xl bg-white border border-blue-200 text-slate-800 placeholder-slate-400 text-xs focus:outline-none focus:border-blue-500 resize-none shadow-2xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Submit Action */}
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isSavingSet}
                    className="py-3 px-6 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm shadow-md shadow-blue-600/20 flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    <span>{isSavingSet ? 'Saving...' : 'Save Puzzle Set to Library'}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* List of Existing Puzzle Sets in Bank with DIRECT "Assign to Team" Selector */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-black text-blue-950 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-blue-600" />
                  <span>Available Puzzle Sets Library ({puzzleSets.length})</span>
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {puzzleSets.map(set => (
                  <div
                    key={set.id}
                    className="bg-white border border-blue-100 rounded-2xl p-5 flex flex-col justify-between shadow-xs hover:border-blue-300 transition"
                  >
                    <div className="flex gap-4">
                      <div className="w-28 h-20 rounded-xl overflow-hidden bg-black shrink-0 border border-blue-200 shadow-xs">
                        <img
                          src={set.imageUrl}
                          alt={set.title}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-blue-950 text-base truncate">{set.title}</h4>
                        <div className="text-xs text-amber-600 font-bold mt-0.5">
                          {set.gridCols} × {set.gridRows} ({set.gridCols * set.gridRows} pieces)
                        </div>
                        <p className="text-xs text-slate-500 line-clamp-2 mt-1">
                          {set.question.text}
                        </p>
                      </div>
                    </div>

                    {/* Dedicated Team Assignment Bar */}
                    <div className="mt-4 pt-4 border-t border-blue-50 flex items-center justify-between gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleDeletePuzzleSet(set.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                        title="Delete puzzle set"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      {/* Explicit Room Selector Dropdown */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-500">Assign to:</span>
                        <select
                          onChange={e => {
                            if (e.target.value) {
                              handleAssignPuzzleToRoom(set.id, e.target.value);
                              e.target.value = '';
                            }
                          }}
                          defaultValue=""
                          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 focus:outline-none cursor-pointer"
                        >
                          <option value="" disabled>Select team...</option>
                          <option value="all">⭐ All Teams</option>
                          {Object.values(rooms).map(r => (
                            <option key={r.id} value={r.id}>
                              {r.badge} {r.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* TAB 2: ROOM MANAGEMENT */}
        {activeTab === 'rooms' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-blue-950">Team Rooms Management</h2>
                <p className="text-xs text-slate-500">Monitor members, customize team badges and names, or assign specific puzzles</p>
              </div>

              <button
                type="button"
                onClick={() => setShowAddRoomModal(true)}
                className="px-3.5 py-2 rounded-xl bg-blue-700 hover:bg-blue-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Team Room</span>
              </button>
            </div>

            {/* Rooms Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.values(rooms).map(room => {
                const isEditing = editingRoomId === room.id;

                return (
                  <div
                    key={room.id}
                    className="bg-white border border-blue-100 rounded-3xl p-5 flex flex-col justify-between shadow-xs hover:border-blue-300 transition"
                  >
                    <div>
                      {/* Room Header */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        {isEditing ? (
                          <div className="flex items-center gap-2 flex-1">
                            <input
                              type="text"
                              maxLength={4}
                              value={roomBadgeInput}
                              onChange={e => setRoomBadgeInput(e.target.value)}
                              className="w-12 px-2 py-1 text-center bg-slate-50 border border-blue-200 rounded-lg text-lg"
                            />
                            <input
                              type="text"
                              value={roomNameInput}
                              onChange={e => setRoomNameInput(e.target.value)}
                              className="flex-1 px-3 py-1 bg-slate-50 border border-blue-200 rounded-lg text-slate-900 font-bold text-sm"
                            />
                            <button
                              type="button"
                              onClick={() => handleEditRoomSubmit(room.id)}
                              className="p-1.5 bg-emerald-600 text-white rounded-lg cursor-pointer"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingRoomId(null)}
                              className="p-1.5 bg-slate-100 text-slate-500 rounded-lg cursor-pointer"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <span className="text-3xl p-2 rounded-2xl bg-blue-50 border border-blue-100 shadow-2xs">
                              {room.badge}
                            </span>
                            <div>
                              <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                                {room.name}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingRoomId(room.id);
                                    setRoomNameInput(room.name);
                                    setRoomBadgeInput(room.badge);
                                  }}
                                  className="text-slate-400 hover:text-blue-600 p-0.5 cursor-pointer"
                                  title="Edit name and badge"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                              </h3>
                              <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                <Users className="w-3.5 h-3.5 text-blue-600" />
                                <span>{room.members.length} students connected</span>
                              </div>
                            </div>
                          </div>
                        )}

                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          room.status === 'COMPLETED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : room.status === 'PLAYING'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {room.status === 'COMPLETED' ? 'Completed 🏁' : room.status === 'PLAYING' ? 'Assembling ⚡' : 'Waiting to Start'}
                        </span>
                      </div>

                      {/* Puzzle Config Summary & Dedicated Dropdown to choose picture */}
                      <div className="p-3.5 bg-blue-50/60 rounded-2xl border border-blue-100 text-xs text-slate-700 space-y-2 mb-4">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500 font-bold">Current Puzzle:</span>
                          <span className="font-bold text-blue-900 truncate max-w-[200px]">{room.imageTitle}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500 font-bold">Dimensions:</span>
                          <span className="font-black text-amber-600">
                            {room.gridCols} × {room.gridRows} ({room.totalPieces} pieces)
                          </span>
                        </div>

                        {/* Direct Select Puzzle For This Room */}
                        <div className="pt-2 border-t border-blue-100/80 flex items-center justify-between gap-2">
                          <span className="text-blue-900 font-bold text-[11px]">Assign puzzle:</span>
                          <select
                            onChange={e => {
                              if (e.target.value) {
                                handleAssignPuzzleToRoom(e.target.value, room.id);
                              }
                            }}
                            value={puzzleSets.find(p => p.imageUrl === room.imageUrl)?.id || ''}
                            className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white text-blue-900 border border-blue-300 focus:outline-none cursor-pointer max-w-[200px] truncate"
                          >
                            <option value="" disabled>Choose from library...</option>
                            {puzzleSets.map(p => (
                              <option key={p.id} value={p.id}>
                                {p.title} ({p.gridCols}x{p.gridRows})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Room Footer Actions */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => handleDeleteRoom(room.id)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                        title="Delete room"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleResetSingleRoom(room.id)}
                          className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer flex items-center gap-1.5"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Reset Team</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add Room Modal */}
            {showAddRoomModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
                <div className="bg-white border border-blue-200 rounded-3xl p-6 max-w-md w-full shadow-2xl">
                  <h3 className="font-black text-slate-900 text-base mb-4">Create New Team Room</h3>
                  <form onSubmit={handleCreateRoom} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Team Name</label>
                      <input
                        type="text"
                        required
                        value={newRoomName}
                        onChange={e => setNewRoomName(e.target.value)}
                        placeholder="e.g. Phoenix Team..."
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-sm focus:outline-none focus:border-blue-600"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Badge Emoji</label>
                      <input
                        type="text"
                        maxLength={4}
                        value={newRoomBadge}
                        onChange={e => setNewRoomBadge(e.target.value)}
                        className="w-16 px-3 py-2 text-center text-lg rounded-xl bg-slate-50 border border-slate-300"
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowAddRoomModal(false)}
                        className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-700 text-white cursor-pointer"
                      >
                        Create Team
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: PARTICIPATING STUDENTS ROSTER */}
        {activeTab === 'students' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Header Card */}
            <div className="bg-white border border-blue-100 rounded-3xl p-6 sm:p-8 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-blue-100">
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-blue-950 flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-600" />
                    <span>Participating Students Roster</span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold">
                      {participatingStudents.length} Students
                    </span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Live roster of all students who entered competition rooms, tracking their real-time presence and puzzle snaps.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={fetchStudents}
                    disabled={isLoadingStudents}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition cursor-pointer"
                    title="Refresh student roster"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingStudents ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowResetConfirmModal(true)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition cursor-pointer"
                    title="Reset all competition data and scores"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                    <span>Reset Data</span>
                  </button>
                </div>
              </div>

              {/* 4 Stat Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-6">
                <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-100">
                  <div className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">Total Students</div>
                  <div className="text-2xl font-black text-blue-950 mt-1">{participatingStudents.length}</div>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-100">
                  <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Online Now</span>
                  </div>
                  <div className="text-2xl font-black text-emerald-900 mt-1">
                    {participatingStudents.filter(s => s.isOnline).length}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-100">
                  <div className="text-[11px] font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1">
                    <Zap className="w-3 h-3 text-amber-600" />
                    <span>Total Snaps</span>
                  </div>
                  <div className="text-2xl font-black text-amber-950 mt-1">
                    {participatingStudents.reduce((acc, s) => acc + (s.snapsCount || 0), 0)}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100">
                  <div className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider">Active Rooms</div>
                  <div className="text-2xl font-black text-indigo-950 mt-1">
                    {Object.keys(rooms).length}
                  </div>
                </div>
              </div>

              {/* Search & Filter Bar */}
              <div className="flex flex-col sm:flex-row items-center gap-3 mt-6 pt-6 border-t border-slate-100">
                <div className="relative flex-1 w-full">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={studentSearchTerm}
                    onChange={e => setStudentSearchTerm(e.target.value)}
                    placeholder="Search student by name..."
                    className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-800 focus:outline-none focus:border-blue-600"
                  />
                  {studentSearchTerm && (
                    <button
                      type="button"
                      onClick={() => setStudentSearchTerm('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <div className="w-full sm:w-64">
                  <select
                    value={studentRoomFilter}
                    onChange={e => setStudentRoomFilter(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-800 font-bold focus:outline-none focus:border-blue-600"
                  >
                    <option value="all">All Team Rooms ({participatingStudents.length})</option>
                    {Object.values(rooms).map(r => {
                      const count = participatingStudents.filter(s => s.roomId === r.id).length;
                      return (
                        <option key={r.id} value={r.id}>
                          {r.badge} {r.name} ({count})
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              {/* Students Table */}
              <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200">
                        <th className="py-3 px-4 w-12 text-center">#</th>
                        <th className="py-3 px-4">Student</th>
                        <th className="py-3 px-4">Assigned Room</th>
                        <th className="py-3 px-4 text-center">Status</th>
                        <th className="py-3 px-4 text-center">Snaps Created</th>
                        <th className="py-3 px-4 text-right">Joined Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                      {(() => {
                        const filtered = participatingStudents.filter(s => {
                          const matchesName = s.name.toLowerCase().includes(studentSearchTerm.toLowerCase());
                          const matchesRoom = studentRoomFilter === 'all' || s.roomId === studentRoomFilter;
                          return matchesName && matchesRoom;
                        });

                        if (filtered.length === 0) {
                          return (
                            <tr>
                              <td colSpan={6} className="py-12 text-center text-slate-400">
                                <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                                <div className="font-bold text-slate-600">No students found</div>
                                <div className="text-xs text-slate-400 mt-0.5">
                                  {studentSearchTerm || studentRoomFilter !== 'all'
                                    ? 'Try changing your search or room filter.'
                                    : 'Students will automatically appear here once they enter a team room.'}
                                </div>
                              </td>
                            </tr>
                          );
                        }

                        return filtered.map((student, idx) => {
                          const joinedDate = new Date(student.joinedAt);
                          const timeStr = joinedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                          return (
                            <tr key={`${student.name}-${student.roomId}`} className="hover:bg-blue-50/40 transition">
                              <td className="py-3 px-4 text-center font-bold text-slate-400 text-xs">
                                {idx + 1}
                              </td>

                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2.5">
                                  <div
                                    className="w-8 h-8 rounded-full flex items-center justify-center font-black text-xs text-white shadow-xs shrink-0"
                                    style={{ backgroundColor: student.color || '#3b82f6' }}
                                  >
                                    {student.name.slice(0, 2).toUpperCase()}
                                  </div>
                                  <div className="font-bold text-slate-900">
                                    {student.name}
                                  </div>
                                </div>
                              </td>

                              <td className="py-3 px-4">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-900 border border-blue-200">
                                  <span>{student.badge}</span>
                                  <span>{student.roomName}</span>
                                </span>
                              </td>

                              <td className="py-3 px-4 text-center">
                                {student.isOnline ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    <span>Online</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                                    <span>Offline</span>
                                  </span>
                                )}
                              </td>

                              <td className="py-3 px-4 text-center">
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl font-mono font-black text-xs bg-amber-50 text-amber-900 border border-amber-200">
                                  <Zap className="w-3 h-3 text-amber-500" />
                                  <span>{student.snapsCount || 0} snaps</span>
                                </span>
                              </td>

                              <td className="py-3 px-4 text-right text-xs text-slate-500 font-mono">
                                {timeStr}
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: DUAL LEADERBOARD */}
        {activeTab === 'leaderboard' && (
          <div className="animate-fadeIn">
            <LeaderboardView
              rankings={rankings}
              studentScores={studentScores}
              allRooms={rooms}
              onClose={() => setActiveTab('sets')}
            />
          </div>
        )}

      </main>

      {/* RESET ALL DATA CONFIRMATION MODAL */}
      {showResetConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-blue-950/70 backdrop-blur-xs animate-fadeIn">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 border-2 border-rose-400 text-slate-800">
            <button
              type="button"
              onClick={() => setShowResetConfirmModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-5">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 border border-rose-200 flex items-center justify-center mx-auto mb-3 shadow-xs">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="font-black text-slate-900 text-lg">Reset All Game Data?</h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                This will reset all puzzle boards back to waiting mode, reshuffle pieces, and clear team and individual leaderboards across all connected rooms.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowResetConfirmModal(false)}
                disabled={isResetting}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmResetAll}
                disabled={isResetting}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm shadow-md transition cursor-pointer flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                <span>{isResetting ? 'Resetting...' : 'Yes, Reset All Data'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CHANGE TEACHER PIN MODAL */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-blue-950/70 backdrop-blur-xs animate-fadeIn">
          <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6 border-2 border-blue-400 text-slate-800">
            <button
              type="button"
              onClick={() => setShowPinModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-5">
              <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-700 border border-blue-200 flex items-center justify-center mx-auto mb-3 shadow-xs">
                <Key className="w-6 h-6" />
              </div>
              <h3 className="font-black text-slate-900 text-lg">Change Teacher PIN</h3>
              <p className="text-xs text-slate-500 mt-1">
                Current PIN: <strong className="font-mono text-blue-700 text-sm">{currentPin}</strong>
              </p>
            </div>

            <form onSubmit={handleChangePinSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">New PIN:</label>
                <input
                  type="password"
                  required
                  placeholder="Enter new PIN (e.g. 5678)"
                  value={newPinInput}
                  onChange={e => setNewPinInput(e.target.value)}
                  autoFocus
                  className="w-full px-4 py-2.5 text-center text-base rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Confirm New PIN:</label>
                <input
                  type="password"
                  required
                  placeholder="Re-enter new PIN"
                  value={confirmPinInput}
                  onChange={e => setConfirmPinInput(e.target.value)}
                  className="w-full px-4 py-2.5 text-center text-base rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 font-mono font-bold"
                />
              </div>

              {pinError && (
                <p className="text-xs text-rose-600 font-bold text-center">
                  {pinError}
                </p>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPinModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm shadow-md transition cursor-pointer"
                >
                  Save New PIN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
