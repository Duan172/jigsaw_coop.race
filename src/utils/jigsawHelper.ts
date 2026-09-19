import { PieceState, EdgeTabs, EdgeProfile } from '../types';

export const PUZZLE_FRAME_CONFIG = {
  x: 260,
  y: 70,
  width: 600,
  height: 400,
};

/**
 * Generates interlocking edge tabs with rich natural variations for a rows x cols puzzle.
 * Creates distinct parameters per seam (center eccentricity, depth, neck width, bulb head size, and tilt)
 * ensuring that adjacent pieces fit together seamlessly while providing natural, varied shapes.
 */
export function generatePuzzleEdgeTabs(rows: number, cols: number): EdgeTabs[][] {
  // Horizontal seams: rows - 1 internal seams, each cols long
  const hSeams: EdgeProfile[][] = Array.from({ length: rows + 1 }, () => Array(cols));
  // Vertical seams: rows long, each cols - 1 internal seams
  const vSeams: EdgeProfile[][] = Array.from({ length: rows }, () => Array(cols + 1));

  // Border horizontal edges
  for (let c = 0; c < cols; c++) {
    hSeams[0][c] = { type: 0 };
    hSeams[rows][c] = { type: 0 };
  }

  // Border vertical edges
  for (let r = 0; r < rows; r++) {
    vSeams[r][0] = { type: 0 };
    vSeams[r][cols] = { type: 0 };
  }

  // Internal horizontal seams with randomized organic diversity
  for (let r = 1; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      hSeams[r][c] = {
        type: Math.random() < 0.5 ? 1 : -1,
        center: 0.46 + Math.random() * 0.08,        // 0.46 - 0.54 eccentricity
        depth: 0.19 + Math.random() * 0.05,         // Protrusion depth
        neck: 0.17 + Math.random() * 0.04,          // Neck width
        head: 0.28 + Math.random() * 0.07,          // Bulbous head size
        tilt: (Math.random() - 0.5) * 0.04,         // Subtle natural slant
      };
    }
  }

  // Internal vertical seams with randomized organic diversity
  for (let r = 0; r < rows; r++) {
    for (let c = 1; c < cols; c++) {
      vSeams[r][c] = {
        type: Math.random() < 0.5 ? 1 : -1,
        center: 0.46 + Math.random() * 0.08,
        depth: 0.19 + Math.random() * 0.05,
        neck: 0.17 + Math.random() * 0.04,
        head: 0.28 + Math.random() * 0.07,
        tilt: (Math.random() - 0.5) * 0.04,
      };
    }
  }

  const grid: EdgeTabs[][] = [];
  for (let r = 0; r < rows; r++) {
    const rowTabs: EdgeTabs[] = [];
    for (let c = 0; c < cols; c++) {
      const topP = hSeams[r][c];
      const bottomP = hSeams[r + 1][c];
      const leftP = vSeams[r][c];
      const rightP = vSeams[r][c + 1];

      rowTabs.push({
        top: -topP.type,
        bottom: bottomP.type,
        left: -leftP.type,
        right: rightP.type,
        topProfile: { ...topP },
        bottomProfile: { ...bottomP },
        leftProfile: { ...leftP },
        rightProfile: { ...rightP },
      });
    }
    grid.push(rowTabs);
  }
  return grid;
}

interface BezierSegment {
  p0: [number, number];
  cp1: [number, number];
  cp2: [number, number];
  p1: [number, number];
}

/**
 * Calculates symmetric, mathematically exact cubic Bézier segments for a jigsaw edge tab.
 * Origin u = 0, baseline v = 0.
 */
function getEdgeSegments(L: number, depthPx: number, profile?: EdgeProfile): BezierSegment[] {
  const c = profile?.center !== undefined ? profile.center : 0.50;
  const neckRatio = profile?.neck !== undefined ? profile.neck : 0.18;
  const headRatio = profile?.head !== undefined ? profile.head : 0.30;
  const tilt = profile?.tilt !== undefined ? profile.tilt : 0;

  const uCenter = L * c + tilt * L;
  const halfNeck = (L * neckRatio) / 2;
  const halfHead = (L * headRatio) / 2;
  const shoulderSpan = halfHead * 1.35;

  const uShStart = Math.max(0, uCenter - shoulderSpan);
  const uNkStart = uCenter - halfNeck;
  const uNkEnd   = uCenter + halfNeck;
  const uShEnd   = Math.min(L, uCenter + shoulderSpan);

  const dy = depthPx;

  const p0: [number, number] = [uShStart, 0];
  const p1: [number, number] = [uNkStart, dy * 0.25];
  const p2: [number, number] = [uCenter, dy * 1.06];
  const p3: [number, number] = [uNkEnd, dy * 0.25];
  const p4: [number, number] = [uShEnd, 0];

  return [
    {
      p0,
      cp1: [uShStart + (uNkStart - uShStart) * 0.55, dy * 0.05],
      cp2: [uNkStart - halfNeck * 0.25, dy * 0.18],
      p1,
    },
    {
      p0: p1,
      cp1: [uNkStart - halfHead * 0.35, dy * 0.65],
      cp2: [uCenter - halfHead * 0.45, dy * 1.06],
      p1: p2,
    },
    {
      p0: p2,
      cp1: [uCenter + halfHead * 0.45, dy * 1.06],
      cp2: [uNkEnd + halfHead * 0.35, dy * 0.65],
      p1: p3,
    },
    {
      p0: p3,
      cp1: [uNkEnd + halfNeck * 0.25, dy * 0.18],
      cp2: [uShEnd - (uShEnd - uNkEnd) * 0.55, dy * 0.05],
      p1: p4,
    },
  ];
}

/**
 * Creates an authentic, diverse jigsaw SVG path with organic cubic Bézier curves for tabs & blanks.
 * Origin (0,0) is top-left of the piece's rectangle body.
 * Mathematically identical in forward and reverse to guarantee seamless interlocking.
 */
export function getJigsawPath(w: number, h: number, tabs: EdgeTabs): string {
  const tabDepthX = w * 0.20;
  const tabDepthY = h * 0.20;
  const r2 = (n: number) => Math.round(n * 100) / 100;

  let d = `M 0,0 `;

  // 1. TOP EDGE (from (0,0) to (w,0))
  if (tabs.top === 0) {
    d += `L ${w},0 `;
  } else {
    const sign = -tabs.top; // -1 = outward (upwards, negative y), +1 = inward
    const depth = sign * tabDepthY * (tabs.topProfile?.depth ? tabs.topProfile.depth / 0.20 : 1.0);
    const segs = getEdgeSegments(w, depth, tabs.topProfile);
    d += `L ${r2(segs[0].p0[0])},0 `;
    for (const s of segs) {
      d += `C ${r2(s.cp1[0])},${r2(s.cp1[1])} ${r2(s.cp2[0])},${r2(s.cp2[1])} ${r2(s.p1[0])},${r2(s.p1[1])} `;
    }
    d += `L ${w},0 `;
  }

  // 2. RIGHT EDGE (from (w,0) to (w,h))
  if (tabs.right === 0) {
    d += `L ${w},${h} `;
  } else {
    const sign = tabs.right; // +1 = outward (rightwards, positive x), -1 = inward
    const depth = sign * tabDepthX * (tabs.rightProfile?.depth ? tabs.rightProfile.depth / 0.20 : 1.0);
    const segs = getEdgeSegments(h, depth, tabs.rightProfile);
    d += `L ${r2(w + segs[0].p0[1])},${r2(segs[0].p0[0])} `;
    for (const s of segs) {
      d += `C ${r2(w + s.cp1[1])},${r2(s.cp1[0])} ${r2(w + s.cp2[1])},${r2(s.cp2[0])} ${r2(w + s.p1[1])},${r2(s.p1[0])} `;
    }
    d += `L ${w},${h} `;
  }

  // 3. BOTTOM EDGE (from (w,h) to (0,h))
  // Traversed in reverse from u = w down to u = 0. x = u, y = h + v
  if (tabs.bottom === 0) {
    d += `L 0,${h} `;
  } else {
    const sign = tabs.bottom; // +1 = outward (downwards, positive y), -1 = inward
    const depth = sign * tabDepthY * (tabs.bottomProfile?.depth ? tabs.bottomProfile.depth / 0.20 : 1.0);
    const segs = getEdgeSegments(w, depth, tabs.bottomProfile);
    d += `L ${r2(segs[3].p1[0])},${r2(h + segs[3].p1[1])} `;
    for (let i = segs.length - 1; i >= 0; i--) {
      const s = segs[i];
      d += `C ${r2(s.cp2[0])},${r2(h + s.cp2[1])} ${r2(s.cp1[0])},${r2(h + s.cp1[1])} ${r2(s.p0[0])},${r2(h + s.p0[1])} `;
    }
    d += `L 0,${h} `;
  }

  // 4. LEFT EDGE (from (0,h) to (0,0))
  // Traversed in reverse from u = h down to u = 0. x = v, y = u
  if (tabs.left === 0) {
    d += `L 0,0 `;
  } else {
    const sign = -tabs.left; // -1 = outward (leftwards, negative x), +1 = inward
    const depth = sign * tabDepthX * (tabs.leftProfile?.depth ? tabs.leftProfile.depth / 0.20 : 1.0);
    const segs = getEdgeSegments(h, depth, tabs.leftProfile);
    d += `L ${r2(segs[3].p1[1])},${r2(segs[3].p1[0])} `;
    for (let i = segs.length - 1; i >= 0; i--) {
      const s = segs[i];
      d += `C ${r2(s.cp2[1])},${r2(s.cp2[0])} ${r2(s.cp1[1])},${r2(s.cp1[0])} ${r2(s.p0[1])},${r2(s.p0[0])} `;
    }
    d += `L 0,0 `;
  }

  d += `Z`;
  return d;
}

/**
 * Initializes jigsaw pieces with randomized scatter positions on the board canvas
 * and individual cluster IDs.
 */
export function createJigsawPieces(
  rows: number,
  cols: number,
  canvasWidth: number = 940,
  canvasHeight: number = 600,
  solvedWidth: number = 600,
  solvedHeight: number = 400
): PieceState[] {
  const edgeGrid = generatePuzzleEdgeTabs(rows, cols);
  const pieces: PieceState[] = [];
  const total = rows * cols;
  const pw = solvedWidth / cols;
  const ph = solvedHeight / rows;

  // Scatter zones around the canvas margins so the central frame remains clear
  for (let i = 0; i < total; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;

    // Distribute loose pieces around the perimeter of the frame
    const side = i % 4;
    let randomX = 40;
    let randomY = 40;

    if (side === 0) {
      // Left tray
      randomX = 20 + Math.random() * 160;
      randomY = 60 + Math.random() * 480;
    } else if (side === 1) {
      // Right tray
      randomX = 890 + Math.random() * 180;
      randomY = 60 + Math.random() * 480;
    } else if (side === 2) {
      // Bottom tray
      randomX = 140 + Math.random() * 760;
      randomY = 510 + Math.random() * 120;
    } else {
      // Top tray
      randomX = 140 + Math.random() * 760;
      randomY = 10 + Math.random() * 45;
    }

    pieces.push({
      id: i,
      correctRow: r,
      correctCol: c,
      correctIndex: i,
      x: Math.round(randomX),
      y: Math.round(randomY),
      clusterId: i, // Initially each piece is its own cluster
      edgeTabs: edgeGrid[r][c],
      isLocked: false,
    });
  }

  return pieces;
}

export interface SnapResult {
  hasSnapped: boolean;
  adjustDx: number;
  adjustDy: number;
  targetClusterId: number;
  sourceClusterId: number;
  sourcePieceId: number;
  targetPieceId: number;
}

/**
 * Checks if any piece in the dragged cluster aligns strictly along a complementary edge
 * of a piece in another cluster.
 */
export function checkClusterSnap(
  draggedClusterId: number,
  allPieces: PieceState[],
  pieceWidth: number,
  pieceHeight: number,
  snapThreshold: number = 26
): SnapResult | null {
  const draggedClusterPieces = allPieces.filter(p => p.clusterId === draggedClusterId);
  const otherPieces = allPieces.filter(p => p.clusterId !== draggedClusterId && !p.isLocked);

  if (draggedClusterPieces.length === 0 || otherPieces.length === 0) {
    return null;
  }

  let bestMatch: SnapResult | null = null;
  let minDistance = Infinity;

  for (const pA of draggedClusterPieces) {
    for (const pB of otherPieces) {
      let expectedDx = 0;
      let expectedDy = 0;
      let isStrictEdgeMatch = false;

      // 1. pB is RIGHT neighbor of pA
      if (pB.correctRow === pA.correctRow && pB.correctCol === pA.correctCol + 1) {
        if (pA.edgeTabs.right !== 0 && (pA.edgeTabs.right + pB.edgeTabs.left === 0)) {
          expectedDx = pieceWidth;
          expectedDy = 0;
          isStrictEdgeMatch = true;
        }
      }
      // 2. pB is LEFT neighbor of pA
      else if (pB.correctRow === pA.correctRow && pB.correctCol === pA.correctCol - 1) {
        if (pA.edgeTabs.left !== 0 && (pA.edgeTabs.left + pB.edgeTabs.right === 0)) {
          expectedDx = -pieceWidth;
          expectedDy = 0;
          isStrictEdgeMatch = true;
        }
      }
      // 3. pB is BOTTOM neighbor of pA
      else if (pB.correctRow === pA.correctRow + 1 && pB.correctCol === pA.correctCol) {
        if (pA.edgeTabs.bottom !== 0 && (pA.edgeTabs.bottom + pB.edgeTabs.top === 0)) {
          expectedDx = 0;
          expectedDy = pieceHeight;
          isStrictEdgeMatch = true;
        }
      }
      // 4. pB is TOP neighbor of pA
      else if (pB.correctRow === pA.correctRow - 1 && pB.correctCol === pA.correctCol) {
        if (pA.edgeTabs.top !== 0 && (pA.edgeTabs.top + pB.edgeTabs.bottom === 0)) {
          expectedDx = 0;
          expectedDy = -pieceHeight;
          isStrictEdgeMatch = true;
        }
      }

      if (isStrictEdgeMatch) {
        const currentDx = pB.x - pA.x;
        const currentDy = pB.y - pA.y;

        const errorX = currentDx - expectedDx;
        const errorY = currentDy - expectedDy;
        const dist = Math.hypot(errorX, errorY);

        if (dist <= snapThreshold && dist < minDistance) {
          minDistance = dist;
          bestMatch = {
            hasSnapped: true,
            adjustDx: errorX,
            adjustDy: errorY,
            targetClusterId: pB.clusterId,
            sourceClusterId: draggedClusterId,
            sourcePieceId: pA.id,
            targetPieceId: pB.id,
          };
        }
      }
    }
  }

  return bestMatch;
}

export interface FrameSnapResult {
  hasSnapped: boolean;
  piecesToLock: Array<{ id: number; x: number; y: number; isLocked: boolean; clusterId: number }>;
}

/**
 * Checks if a piece or cluster of pieces has been dragged near its corresponding target
 * position inside the Puzzle Frame (khung tranh).
 * When snapped into the frame:
 * 1. Every piece in the cluster aligns mathematically to its exact frame cell.
 * 2. It becomes permanently locked (`isLocked: true`), preventing any further movement.
 */
export function checkFrameSnap(
  draggedClusterId: number,
  allPieces: PieceState[],
  frameX: number,
  frameY: number,
  pieceWidth: number,
  pieceHeight: number,
  snapThreshold: number = 40
): FrameSnapResult | null {
  const draggedClusterPieces = allPieces.filter(p => p.clusterId === draggedClusterId && !p.isLocked);
  if (draggedClusterPieces.length === 0) return null;

  // 1. Direct alignment to the target slots on the frame
  for (const p of draggedClusterPieces) {
    const targetX = frameX + p.correctCol * pieceWidth;
    const targetY = frameY + p.correctRow * pieceHeight;

    const diffX = targetX - p.x;
    const diffY = targetY - p.y;
    const dist = Math.hypot(diffX, diffY);

    if (dist <= snapThreshold) {
      // Cluster snaps into the frame!
      const piecesToLock = draggedClusterPieces.map(piece => {
        const exactX = Math.round(frameX + piece.correctCol * pieceWidth);
        const exactY = Math.round(frameY + piece.correctRow * pieceHeight);
        return {
          id: piece.id,
          x: exactX,
          y: exactY,
          isLocked: true,
          clusterId: -1, // Frame cluster
        };
      });

      return {
        hasSnapped: true,
        piecesToLock,
      };
    }
  }

  // 2. Neighbor alignment to already locked pieces in the frame
  const lockedPieces = allPieces.filter(p => p.isLocked && p.clusterId !== draggedClusterId);
  if (lockedPieces.length > 0) {
    for (const pA of draggedClusterPieces) {
      for (const pB of lockedPieces) {
        let expDx = 0;
        let expDy = 0;
        let isNeighbor = false;

        if (pB.correctRow === pA.correctRow && pB.correctCol === pA.correctCol + 1) {
          expDx = pieceWidth; expDy = 0; isNeighbor = true;
        } else if (pB.correctRow === pA.correctRow && pB.correctCol === pA.correctCol - 1) {
          expDx = -pieceWidth; expDy = 0; isNeighbor = true;
        } else if (pB.correctRow === pA.correctRow + 1 && pB.correctCol === pA.correctCol) {
          expDx = 0; expDy = pieceHeight; isNeighbor = true;
        } else if (pB.correctRow === pA.correctRow - 1 && pB.correctCol === pA.correctCol) {
          expDx = 0; expDy = -pieceHeight; isNeighbor = true;
        }

        if (isNeighbor) {
          const curDx = pB.x - pA.x;
          const curDy = pB.y - pA.y;
          const dist = Math.hypot(curDx - expDx, curDy - expDy);

          if (dist <= snapThreshold) {
            const piecesToLock = draggedClusterPieces.map(piece => ({
              id: piece.id,
              x: Math.round(frameX + piece.correctCol * pieceWidth),
              y: Math.round(frameY + piece.correctRow * pieceHeight),
              isLocked: true,
              clusterId: -1,
            }));

            return {
              hasSnapped: true,
              piecesToLock,
            };
          }
        }
      }
    }
  }

  return null;
}

/**
 * Merges source cluster into target cluster and mathematically locks ALL pieces
 * in the combined cluster to exact grid coordinates relative to the target anchor piece.
 */
export function mergeAndLockClusters(
  pieces: PieceState[],
  snap: SnapResult,
  pieceWidth: number,
  pieceHeight: number
): {
  updatedPieces: PieceState[];
  updates: Array<{ id: number; x: number; y: number; clusterId: number; isLocked?: boolean }>;
} {
  const targetAnchor = pieces.find(p => p.id === snap.targetPieceId) || pieces.find(p => p.clusterId === snap.targetClusterId);
  if (!targetAnchor) {
    return { updatedPieces: pieces, updates: [] };
  }

  const updates: Array<{ id: number; x: number; y: number; clusterId: number; isLocked?: boolean }> = [];

  const updatedPieces = pieces.map(p => {
    if (p.clusterId === snap.targetClusterId || p.clusterId === snap.sourceClusterId) {
      const lockedX = Math.round(targetAnchor.x + (p.correctCol - targetAnchor.correctCol) * pieceWidth);
      const lockedY = Math.round(targetAnchor.y + (p.correctRow - targetAnchor.correctRow) * pieceHeight);

      updates.push({
        id: p.id,
        x: lockedX,
        y: lockedY,
        clusterId: snap.targetClusterId,
        isLocked: p.isLocked || targetAnchor.isLocked,
      });

      return {
        ...p,
        x: lockedX,
        y: lockedY,
        clusterId: snap.targetClusterId,
        isLocked: p.isLocked || targetAnchor.isLocked,
      };
    }
    return p;
  });

  return { updatedPieces, updates };
}

/**
 * Calculates cluster statistics: number of connected clusters and size of the largest cluster.
 * Also accounts for pieces locked in the target picture frame.
 */
export function getClusterStats(pieces: PieceState[], totalPieces: number) {
  const lockedCount = pieces.filter(p => p.isLocked).length;

  const clusterCounts: Record<number, number> = {};
  pieces.forEach(p => {
    clusterCounts[p.clusterId] = (clusterCounts[p.clusterId] || 0) + 1;
  });

  const clusterIds = Object.keys(clusterCounts);
  const maxClusterSize = Math.max(...Object.values(clusterCounts), lockedCount);

  // Puzzle is completed only when all pieces are in their exact position and locked in the frame
  const isFullySolved = totalPieces > 0 && lockedCount === totalPieces;

  // Progress is strictly calculated based on the number of pieces placed correctly on the frame
  const progressRatio = totalPieces > 0 ? lockedCount / totalPieces : 0;
  const progressPercent = Math.min(100, Math.round(progressRatio * 100));

  return {
    clusterCount: clusterIds.length,
    maxClusterSize,
    lockedCount,
    isFullySolved,
    progressPercent,
  };
}

