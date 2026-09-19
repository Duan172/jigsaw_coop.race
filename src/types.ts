export interface QuestionConfig {
  text: string;
  sampleAnswer: string;
  explanation?: string;
}

export interface EdgeProfile {
  type: number;      // 0 = flat edge, 1 = outward tab, -1 = inward blank
  center?: number;    // relative position along edge (e.g. 0.46 - 0.54)
  depth?: number;     // tab protrusion depth ratio (e.g. 0.18 - 0.25)
  neck?: number;      // neck width ratio (e.g. 0.16 - 0.22)
  head?: number;      // head width ratio (e.g. 0.28 - 0.36)
  tilt?: number;      // slight organic tilt / skew
}

export interface EdgeTabs {
  top: number;       // 0 = flat, 1 = tab (outer), -1 = blank (inner)
  right: number;
  bottom: number;
  left: number;
  topProfile?: EdgeProfile;
  rightProfile?: EdgeProfile;
  bottomProfile?: EdgeProfile;
  leftProfile?: EdgeProfile;
}

export interface PieceState {
  id: number;
  correctRow: number;
  correctCol: number;
  correctIndex: number;
  x: number; // board coordinate X
  y: number; // board coordinate Y
  clusterId: number; // connected group ID
  edgeTabs: EdgeTabs;
  isLocked: boolean; // true when locked into the target picture frame or completed
  lastMovedBy?: string;
}

export interface Member {
  socketId: string;
  name: string;
  color: string;
  joinedAt: number;
}

// Preset or custom puzzle set created by teacher
export interface PuzzleSet {
  id: string;
  title: string;
  imageUrl: string;
  gridRows: number;
  gridCols: number;
  question: QuestionConfig;
  createdAt?: number;
}

export interface RoomState {
  id: string;
  name: string;
  badge: string;
  color: string;
  accentColor: string;
  imageUrl: string;
  imageTitle: string;
  gridRows: number;
  gridCols: number;
  totalPieces: number;
  pieces: PieceState[];
  status: 'WAITING' | 'PLAYING' | 'QUESTION' | 'COMPLETED';
  question: QuestionConfig;
  members: Member[];
  startTime: number | null;
  puzzleCompletedTime: number | null; // ms from start
  questionCompletedTime: number | null; // ms from puzzle completion
  totalDurationMs: number | null; // total ms
  answerSubmitted: {
    answerText: string;
    answeredBy: string;
    submittedAt: number;
  } | null;
}

// Individual student score: number of successful piece connections / snaps
export interface StudentScore {
  name: string;
  piecesCount: number; // Backward compatibility
  snapsCount?: number; // Total snaps created by this student
  roomId: string;
  roomName: string;
  badge: string;
  color: string;
  lastPieceTime: number;
  rank?: number;
}

export interface TeamRanking {
  roomId: string;
  roomName: string;
  color: string;
  accentColor: string;
  badge: string;
  memberCount: number;
  status: 'WAITING' | 'PLAYING' | 'QUESTION' | 'COMPLETED';
  puzzleDurationMs: number | null;
  totalDurationMs: number | null;
  piecesPlaced: number;
  totalPieces: number;
  answerSubmitted?: {
    answerText: string;
    answeredBy: string;
  } | null;
  rank?: number;
}

