import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabase";

// ─── THEME ───────────────────────────────────────────────────────────────────
const T = {
  bg: "#060608",
  s1: "#0e0e12",
  s2: "#14141a",
  s3: "#1a1a22",
  bd: "rgba(255,255,255,0.07)",
  bd2: "rgba(255,255,255,0.13)",
  tx: "#e8e8e8",
  tx2: "#888",
  tx3: "#555",
  acc: "#c8922a",
  acc2: "#d4a847",
  accDim: "rgba(200,146,42,0.18)",
  g: "#4caf7d",
  y: "#d4a847",
  r: "#d95f5f",
  font: "'IBM Plex Sans', system-ui, sans-serif",
  mono: "'IBM Plex Mono', monospace",
  serif: "'Cinzel', serif",
};

// ─── FONT INJECTION ───────────────────────────────────────────────────────────
function useFonts() {
  useEffect(() => {
    const id = "celebrimbor-fonts";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=IBM+Plex+Sans:ital,wght@0,300;0,400;0,500;0,700;1,400&family=IBM+Plex+Mono:wght@400;500&display=swap";
    document.head.appendChild(link);
  }, []);
}

// ─── MATH UTILITIES ──────────────────────────────────────────────────────────

// Multiply two matrices (row-major, a is m×k, b is k×n, returns m×n flat array + dims)
function matMul(aData, aRows, aCols, bData, bRows, bCols) {
  const out = new Array(aRows * bCols).fill(0);
  for (let i = 0; i < aRows; i++)
    for (let j = 0; j < bCols; j++)
      for (let k = 0; k < aCols; k++)
        out[i * bCols + j] += aData[i * aCols + k] * bData[k * bCols + j];
  return { data: out, rows: aRows, cols: bCols };
}

// Transpose a matrix
function matT(data, rows, cols) {
  const out = new Array(rows * cols);
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < cols; j++)
      out[j * rows + i] = data[i * cols + j];
  return { data: out, rows: cols, cols: rows };
}

// Jacobi SVD on a real symmetric n×n matrix M.
// Returns { V } where M = V S V^T and V columns are eigenvectors.
// We only need V (eigenvectors); eigenvalues returned as array.
function jacobiEig(M, n) {
  // Copy M into working array
  const A = M.slice();
  // V starts as identity
  const V = new Array(n * n).fill(0);
  for (let i = 0; i < n; i++) V[i * n + i] = 1;

  const MAX_ITER = 200 * n * n;
  for (let iter = 0; iter < MAX_ITER; iter++) {
    // Find largest off-diagonal
    let p = 0, q = 1, maxVal = 0;
    for (let i = 0; i < n - 1; i++)
      for (let j = i + 1; j < n; j++) {
        const v = Math.abs(A[i * n + j]);
        if (v > maxVal) { maxVal = v; p = i; q = j; }
      }
    if (maxVal < 1e-12) break;

    // Jacobi rotation
    const App = A[p * n + p], Aqq = A[q * n + q], Apq = A[p * n + q];
    const tau = (Aqq - App) / (2 * Apq);
    const t = tau >= 0
      ? 1 / (tau + Math.sqrt(1 + tau * tau))
      : 1 / (tau - Math.sqrt(1 + tau * tau));
    const c = 1 / Math.sqrt(1 + t * t);
    const s = t * c;

    // Update A
    A[p * n + p] = App - t * Apq;
    A[q * n + q] = Aqq + t * Apq;
    A[p * n + q] = 0;
    A[q * n + p] = 0;
    for (let r = 0; r < n; r++) {
      if (r === p || r === q) continue;
      const Arp = A[r * n + p], Arq = A[r * n + q];
      A[r * n + p] = c * Arp - s * Arq;
      A[p * n + r] = c * Arp - s * Arq;
      A[r * n + q] = s * Arp + c * Arq;
      A[q * n + r] = s * Arp + c * Arq;
    }
    // Update V
    for (let r = 0; r < n; r++) {
      const Vrp = V[r * n + p], Vrq = V[r * n + q];
      V[r * n + p] = c * Vrp - s * Vrq;
      V[r * n + q] = s * Vrp + c * Vrq;
    }
  }

  const eigenvalues = Array.from({ length: n }, (_, i) => A[i * n + i]);
  return { eigenvalues, V };
}

// Find null vector of A (rows x 9) via SVD of A^T A.
// Returns the eigenvector corresponding to the smallest eigenvalue.
function nullVector9(A, rows) {
  // Form ATA (9x9)
  const ATA = new Array(81).fill(0);
  for (let i = 0; i < 9; i++)
    for (let j = 0; j < 9; j++)
      for (let r = 0; r < rows; r++)
        ATA[i * 9 + j] += A[r * 9 + i] * A[r * 9 + j];

  const { eigenvalues, V } = jacobiEig(ATA, 9);

  // Find index of smallest eigenvalue
  let minIdx = 0;
  for (let i = 1; i < 9; i++)
    if (eigenvalues[i] < eigenvalues[minIdx]) minIdx = i;

  // Return column minIdx of V
  const h = new Array(9);
  for (let i = 0; i < 9; i++) h[i] = V[i * 9 + minIdx];
  return h;
}

// Normalise 2D points for numerical stability (Hartley normalisation).
// Returns { pts: normalised points, T: 3x3 transform as flat array }
function normalise2D(pts) {
  const n = pts.length;
  const cx = pts.reduce((s, p) => s + p[0], 0) / n;
  const cy = pts.reduce((s, p) => s + p[1], 0) / n;
  const scale = pts.reduce((s, p) => s + Math.hypot(p[0] - cx, p[1] - cy), 0) / n;
  const sc = scale < 1e-10 ? 1 : Math.SQRT2 / scale;
  const normPts = pts.map(([x, y]) => [(x - cx) * sc, (y - cy) * sc]);
  // T = [ sc  0  -sc*cx ]
  //     [  0  sc  -sc*cy ]
  //     [  0   0    1   ]
  const T = [sc, 0, -sc * cx, 0, sc, -sc * cy, 0, 0, 1];
  return { pts: normPts, T };
}

// Invert a 3x3 matrix (flat row-major)
function inv3(m) {
  const [a,b,c,d,e,f,g,h,i] = m;
  const det = a*(e*i-f*h) - b*(d*i-f*g) + c*(d*h-e*g);
  if (Math.abs(det) < 1e-14) return null;
  const inv = 1/det;
  return [
    (e*i-f*h)*inv, (c*h-b*i)*inv, (b*f-c*e)*inv,
    (f*g-d*i)*inv, (a*i-c*g)*inv, (c*d-a*f)*inv,
    (d*h-e*g)*inv, (b*g-a*h)*inv, (a*e-b*d)*inv,
  ];
}

// Multiply 3x3 matrices (flat row-major)
function mul3(A, B) {
  const C = new Array(9);
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) {
      let s = 0;
      for (let k = 0; k < 3; k++) s += A[i*3+k] * B[k*3+j];
      C[i*3+j] = s;
    }
  return C;
}

// DLT homography: compute H mapping src[i] -> dst[i] (pixel -> world or world -> pixel)
// Needs at least 4 correspondences. Returns null if degenerate.
function computeHomography(srcPts, dstPts) {
  if (srcPts.length < 4) return null;
  const n = srcPts.length;

  const { pts: srcN, T: Tsrc } = normalise2D(srcPts);
  const { pts: dstN, T: Tdst } = normalise2D(dstPts);

  // Build 2n x 9 matrix A
  const A = new Array(2 * n * 9).fill(0);
  for (let i = 0; i < n; i++) {
    const [sx, sy] = srcN[i];
    const [dx, dy] = dstN[i];
    // Row 2i
    A[(2*i)*9+0] = -sx; A[(2*i)*9+1] = -sy; A[(2*i)*9+2] = -1;
    A[(2*i)*9+6] = dx*sx; A[(2*i)*9+7] = dx*sy; A[(2*i)*9+8] = dx;
    // Row 2i+1
    A[(2*i+1)*9+3] = -sx; A[(2*i+1)*9+4] = -sy; A[(2*i+1)*9+5] = -1;
    A[(2*i+1)*9+6] = dy*sx; A[(2*i+1)*9+7] = dy*sy; A[(2*i+1)*9+8] = dy;
  }

  const h = nullVector9(A, 2 * n);
  // H_normalised = reshape h to 3x3
  const Hn = h;

  // Denormalise: H = inv(Tdst) * Hn * Tsrc
  const TdstInv = inv3(Tdst);
  if (!TdstInv) return null;
  const H = mul3(TdstInv, mul3(Hn, Tsrc));
  return H;
}

// Apply homography H to point (x, y), returns [wx, wy]
function applyH(H, x, y) {
  const w = H[6]*x + H[7]*y + H[8];
  if (Math.abs(w) < 1e-14) return [0, 0];
  return [(H[0]*x + H[1]*y + H[2])/w, (H[3]*x + H[4]*y + H[5])/w];
}

// Compute vanishing point from two lines, each defined by two [x,y] points.
// Returns homogeneous 2D point [a,b,c] (normalised to Euclidean if finite).
function vanishingPoint(l1p1, l1p2, l2p1, l2p2) {
  // Line as homogeneous cross product
  const l1 = crossH([l1p1[0],l1p1[1],1], [l1p2[0],l1p2[1],1]);
  const l2 = crossH([l2p1[0],l2p1[1],1], [l2p2[0],l2p2[1],1]);
  const vp = crossH(l1, l2);
  if (Math.abs(vp[2]) < 1e-10) return null; // parallel in image (vp at infinity)
  return [vp[0]/vp[2], vp[1]/vp[2]];
}

function crossH(a, b) {
  return [
    a[1]*b[2] - a[2]*b[1],
    a[2]*b[0] - a[0]*b[2],
    a[0]*b[1] - a[1]*b[0],
  ];
}

// Average multiple vanishing point estimates
function avgVanishingPoints(vpList) {
  const valid = vpList.filter(v => v !== null);
  if (valid.length === 0) return null;
  return [
    valid.reduce((s, v) => s + v[0], 0) / valid.length,
    valid.reduce((s, v) => s + v[1], 0) / valid.length,
  ];
}

// Measure real-world distance between two image points given homography H
function measureDistance(H, p1, p2) {
  const w1 = applyH(H, p1[0], p1[1]);
  const w2 = applyH(H, p2[0], p2[1]);
  return Math.hypot(w2[0] - w1[0], w2[1] - w1[1]);
}

// Cross-ratio height measurement (Criminisi et al.)
// vpV: vertical vanishing point [x,y]
// vpH: a horizontal vanishing point [x,y] (for the vanishing line)
// b: base point on floor [x,y] (image)
// t: top of object [x,y] (image)
// refB, refT: two reference points on a known-height vertical [x,y],[x,y]
// refHeight: known real height of that reference
function measureHeight(vpV, vpH1, vpH2, b, t, refB, refT, refHeight) {
  if (!vpV || !refB || !refT) return null;

  // The vanishing line is the line through vpH1 and vpH2 (horizon line)
  // For simplicity use the cross-ratio formula directly:
  // H_ref = cross_ratio(vpV, refB, refT, intersection) * refHeight
  // We compute the cross-ratio along the vertical pencil.

  // Line through vpV and b (base vertical line for object)
  // Intersect with line through refB and refT -> call it r
  const vpVH = [vpV[0], vpV[1], 1];
  const bH = [b[0], b[1], 1];
  const tH = [t[0], t[1], 1];
  const refBH = [refB[0], refB[1], 1];
  const refTH = [refT[0], refT[1], 1];

  // Line from vpV through b (the object's vertical ray)
  const lineVB = crossH(vpVH, bH);
  // Line from vpV through t
  const lineVT = crossH(vpVH, tH);

  // Line through refB and refT
  const lineRef = crossH(refBH, refTH);

  // Intersection of lineVT with lineRef -> point r (where top ray meets reference vertical)
  const rH = crossH(lineVT, lineRef);
  if (Math.abs(rH[2]) < 1e-10) return null;
  const r = [rH[0]/rH[2], rH[1]/rH[2]];

  // Now we have four collinear points on line through refB, refT:
  // vpV (at infinity along that line), refB, r, refT
  // Cross-ratio: CR(vpV_inf, refB, r, refT)
  // For a point at infinity along a line, cross-ratio simplifies to:
  // H = dist(refB, refT) / dist(refB, r)  [if vpV is at infinity; otherwise full formula]

  // Use full projective cross-ratio on the pencil through vpV:
  // sign distances from vpV
  function signedDistFromVpV(p) {
    return Math.hypot(p[0] - vpV[0], p[1] - vpV[1]) *
      (((p[1] - vpV[1]) > 0) ? 1 : -1);
  }

  const dRefB = signedDistFromVpV([refB[0], refB[1]]);
  const dRefT = signedDistFromVpV([refT[0], refT[1]]);
  const dR    = signedDistFromVpV(r);

  if (Math.abs(dRefT - dR) < 1e-10) return null;
  const ratio = (dRefB - dR) / (dRefB - dRefT);
  return Math.abs(ratio * refHeight);
}

// Reprojection error of H on a set of correspondences
function reprojectionError(H, srcPts, dstPts) {
  let totalErr = 0;
  for (let i = 0; i < srcPts.length; i++) {
    const [px, py] = applyH(H, srcPts[i][0], srcPts[i][1]);
    totalErr += Math.hypot(px - dstPts[i][0], py - dstPts[i][1]);
  }
  return totalErr / srcPts.length;
}

// ─── CALIBRATION ENGINE ──────────────────────────────────────────────────────

// Given references[], compute calibration state.
// Returns { planes, vanishingPoints, errors }
function computeCalibration(references) {
  const planes = {
    frontWall: null,
    floor: null,
    leftWall: null,
    rightWall: null,
  };
  const vpCandidates = { vpH1: [], vpH2: [], vpV: [] };

  // Group references by plane and extract correspondences
  for (const ref of references) {
    if (ref.status === "invalid" || ref.points.length < 4) continue;

    if (ref.type === "rectangle") {
      // 4 pixel corners -> 4 world corners
      // World rectangle: (0,0), (w,0), (w,h), (0,h)
      const [ww, wh] = [ref.valueW, ref.valueH];
      const worldPts = [[0,0],[ww,0],[ww,wh],[0,wh]];
      const imgPts = ref.points.slice(0,4);
      const H = computeHomography(imgPts, worldPts);
      if (H) {
        planes[ref.plane] = { H, srcPts: imgPts, dstPts: worldPts, refs: [ref.id] };
        // Extract VPs from the rectangle edges
        // Horizontal edges: top (0->1) and bottom (3->2) -> vpH1
        const vpH1 = vanishingPoint(imgPts[0], imgPts[1], imgPts[3], imgPts[2]);
        if (vpH1) vpCandidates.vpH1.push(vpH1);
        // Vertical edges: left (0->3) and right (1->2) -> vpV (if frontWall) or vpH2 (if floor)
        const vpV = vanishingPoint(imgPts[0], imgPts[3], imgPts[1], imgPts[2]);
        if (vpV) {
          if (ref.plane === "frontWall" || ref.plane === "leftWall" || ref.plane === "rightWall") {
            vpCandidates.vpV.push(vpV);
          } else {
            vpCandidates.vpH2.push(vpV);
          }
        }
      }
    } else if (ref.type === "distance") {
      // Single known distance: weaker constraint, skip homography
      // Use to validate existing homography
    } else if (ref.type === "vpLines") {
      // User drew parallel lines to extract a VP
      if (ref.vpRole && ref.points.length >= 4) {
        for (let i = 0; i + 3 < ref.points.length; i += 4) {
          const vp = vanishingPoint(
            ref.points[i], ref.points[i+1],
            ref.points[i+2], ref.points[i+3]
          );
          if (vp) vpCandidates[ref.vpRole].push(vp);
        }
      }
    }
  }

  const vp = {
    vpH1: avgVanishingPoints(vpCandidates.vpH1),
    vpH2: avgVanishingPoints(vpCandidates.vpH2),
    vpV:  avgVanishingPoints(vpCandidates.vpV),
  };

  // Outlier detection: for each calibrated plane, re-check distance references on that plane
  const errors = [];
  for (const ref of references) {
    if (ref.type !== "distance" || !ref.points || ref.points.length < 2) continue;
    const plane = planes[ref.plane];
    if (!plane || !plane.H) continue;
    const computed = measureDistance(plane.H, ref.points[0], ref.points[1]);
    const stated = ref.valueW; // distance references use valueW for the single value
    if (stated > 0 && Math.abs(computed - stated) / stated > 0.15) {
      errors.push({ refId: ref.id, computed, stated, ratio: computed / stated });
    }
  }

  return { planes, vanishingPoints: vp, errors };
}

// ─── CONFIDENCE ───────────────────────────────────────────────────────────────

function measurementConfidence(mPts, calibration, plane) {
  if (!calibration || !calibration.planes[plane]) return "low";
  const planeData = calibration.planes[plane];
  if (!planeData || !planeData.srcPts) return "low";

  // Check if both measurement points are within the convex hull of reference points
  // Simplified: check bounding box of reference points
  const refPts = planeData.srcPts;
  const minX = Math.min(...refPts.map(p => p[0]));
  const maxX = Math.max(...refPts.map(p => p[0]));
  const minY = Math.min(...refPts.map(p => p[1]));
  const maxY = Math.max(...refPts.map(p => p[1]));
  const pad = 0.2 * Math.max(maxX - minX, maxY - minY);

  const inside = mPts.every(([x,y]) =>
    x >= minX - pad && x <= maxX + pad &&
    y >= minY - pad && y <= maxY + pad
  );
  const strictInside = mPts.every(([x,y]) =>
    x >= minX && x <= maxX && y >= minY && y <= maxY
  );

  if (strictInside) return "high";
  if (inside) return "medium";
  return "low";
}

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const PLANES = ["frontWall", "floor", "leftWall", "rightWall"];
const PLANE_LABELS = {
  frontWall: "Front wall",
  floor: "Floor",
  leftWall: "Left wall",
  rightWall: "Right wall",
};
const REF_TYPES = {
  rectangle: "Rectangle",
  distance: "Distance",
  vpLines: "Vanishing lines",
  roomDims: "Room dims",
};
const SNAP_RADIUS = 8; // px in screen space

// ─── UNIQUE ID ────────────────────────────────────────────────────────────────
let _idCounter = 0;
function uid() { return `id_${Date.now()}_${_idCounter++}`; }

// ─── COORDINATE HELPERS ───────────────────────────────────────────────────────

// Convert screen event coords to image coords given zoom/pan/imageRect
function screenToImage(screenX, screenY, zoom, pan, containerRect) {
  // The container is transformed: translate(pan.x, pan.y) scale(zoom)
  // So image point = (screen - containerRect.origin - pan) / zoom
  const ox = containerRect.left;
  const oy = containerRect.top;
  return [
    (screenX - ox - pan.x) / zoom,
    (screenY - oy - pan.y) / zoom,
  ];
}

// ─── SNAP ─────────────────────────────────────────────────────────────────────

function findSnap(imgPt, allPoints, zoom, thresholdPx = SNAP_RADIUS) {
  const thresh = thresholdPx / zoom;
  for (const pt of allPoints) {
    if (Math.hypot(pt[0] - imgPt[0], pt[1] - imgPt[1]) < thresh) return pt;
  }
  return null;
}

// Collect all placed points from references
function allPlacedPoints(references) {
  return references.flatMap(r => r.points || []);
}

// ─── ROOM DIAGRAM ─────────────────────────────────────────────────────────────

function RoomDiagram({ calibration }) {
  const pl = calibration?.planes || {};
  const lit = {
    frontWall: !!pl.frontWall,
    floor: !!pl.floor,
    leftWall: !!pl.leftWall,
    rightWall: !!pl.rightWall,
  };
  const vp = calibration?.vanishingPoints || {};
  const has3D = lit.floor && !!vp.vpV;

  const faceColor = (key) =>
    lit[key] ? T.acc : T.s3;
  const borderColor = (key) =>
    lit[key] ? T.acc2 : T.bd;

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontFamily: T.serif, fontSize: 10, color: T.acc, letterSpacing: 2, marginBottom: 6, textTransform: "uppercase" }}>
        Calibration
      </div>
      <svg viewBox="0 0 120 90" width="100%" style={{ display: "block" }}>
        {/* Floor */}
        <polygon
          points="20,65 60,80 100,65 60,50"
          fill={lit.floor ? "rgba(200,146,42,0.15)" : "rgba(255,255,255,0.03)"}
          stroke={borderColor("floor")}
          strokeWidth="1"
        />
        {/* Front wall */}
        <polygon
          points="20,30 60,30 60,65 20,65"
          fill={lit.frontWall ? "rgba(200,146,42,0.10)" : "rgba(255,255,255,0.02)"}
          stroke={borderColor("frontWall")}
          strokeWidth="1"
        />
        {/* Left wall */}
        <polygon
          points="20,30 20,65 10,58 10,23"
          fill={lit.leftWall ? "rgba(200,146,42,0.10)" : "rgba(255,255,255,0.02)"}
          stroke={borderColor("leftWall")}
          strokeWidth="1"
        />
        {/* Right wall */}
        <polygon
          points="60,30 60,65 70,58 70,23"
          fill={lit.rightWall ? "rgba(200,146,42,0.10)" : "rgba(255,255,255,0.02)"}
          stroke={borderColor("rightWall")}
          strokeWidth="1"
        />
        {/* Ceiling suggestion */}
        <polygon
          points="20,30 60,30 70,23 10,23"
          fill="rgba(255,255,255,0.01)"
          stroke={has3D ? "rgba(200,146,42,0.4)" : T.bd}
          strokeWidth="0.7"
          strokeDasharray="3,2"
        />
        {/* Labels */}
        <text x="38" y="50" fontSize="6" fill={lit.frontWall ? T.acc : T.tx3} textAnchor="middle">front</text>
        <text x="60" y="70" fontSize="6" fill={lit.floor ? T.acc : T.tx3} textAnchor="middle">floor</text>
        <text x="14" y="46" fontSize="5" fill={lit.leftWall ? T.acc : T.tx3} textAnchor="middle">L</text>
        <text x="66" y="46" fontSize="5" fill={lit.rightWall ? T.acc : T.tx3} textAnchor="middle">R</text>
      </svg>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
        {[
          { key: "vpH1", label: "VP horiz 1" },
          { key: "vpH2", label: "VP horiz 2" },
          { key: "vpV",  label: "VP vertical" },
        ].map(({ key, label }) => (
          <div key={key} style={{ fontSize: 9, color: vp[key] ? T.acc : T.tx3, background: vp[key] ? T.accDim : "transparent", border: `1px solid ${vp[key] ? T.acc : T.bd}`, borderRadius: 3, padding: "1px 4px" }}>
            {label}
          </div>
        ))}
        {has3D && (
          <div style={{ fontSize: 9, color: T.g, background: "rgba(76,175,125,0.12)", border: `1px solid ${T.g}`, borderRadius: 3, padding: "1px 4px" }}>
            3D heights
          </div>
        )}
      </div>
    </div>
  );
}

// ─── REFERENCE FORM ───────────────────────────────────────────────────────────

function RefTypeTag({ type }) {
  const colors = {
    rectangle: { bg: "rgba(200,146,42,0.15)", tx: T.acc },
    distance:  { bg: "rgba(91,156,246,0.12)", tx: "#5b9cf6" },
    vpLines:   { bg: "rgba(76,175,125,0.12)", tx: T.g },
    roomDims:  { bg: "rgba(168,184,208,0.10)", tx: "#a8b8d0" },
  };
  const c = colors[type] || colors.distance;
  return (
    <span style={{ fontSize: 9, background: c.bg, color: c.tx, borderRadius: 3, padding: "1px 5px", fontFamily: T.mono }}>
      {REF_TYPES[type] || type}
    </span>
  );
}

// ─── CANVAS OVERLAY RENDERER ──────────────────────────────────────────────────

function CanvasOverlay({
  imageW, imageH,
  references, measurements, calibration,
  activeRef, pendingPoints, mode, hoverPt,
  units, onPointClick, onHandleDrag,
}) {
  const errRefIds = new Set((calibration?.errors || []).map(e => e.refId));

  function cmToDisplay(v) {
    if (units === "in") return (v / 2.54).toFixed(2) + '"';
    return v.toFixed(1) + " cm";
  }

  const confColor = { high: T.g, medium: T.y, low: T.r };

  return (
    <svg
      width={imageW} height={imageH}
      style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none", overflow: "visible" }}
    >
      {/* Existing references */}
      {references.map(ref => {
        const isErr = errRefIds.has(ref.id);
        const color = isErr ? T.r : (ref === activeRef ? T.acc2 : T.acc);
        const pts = ref.points || [];
        if (ref.type === "rectangle" && pts.length >= 2) {
          const lines = [];
          for (let i = 0; i < Math.min(pts.length, 4); i++) {
            const next = pts[(i+1) % Math.min(pts.length, 4)];
            lines.push(<line key={i} x1={pts[i][0]} y1={pts[i][1]} x2={next[0]} y2={next[1]} stroke={color} strokeWidth="1.5" strokeDasharray={pts.length < 4 ? "4,3" : "none"} opacity="0.8" />);
          }
          return <g key={ref.id}>{lines}{pts.map((p,i) => <circle key={i} cx={p[0]} cy={p[1]} r="4" fill="none" stroke={color} strokeWidth="1.5" opacity="0.9"/>)}</g>;
        }
        if ((ref.type === "distance") && pts.length >= 2) {
          const [p1, p2] = pts;
          const mx = (p1[0]+p2[0])/2, my = (p1[1]+p2[1])/2;
          return (
            <g key={ref.id}>
              <line x1={p1[0]} y1={p1[1]} x2={p2[0]} y2={p2[1]} stroke={color} strokeWidth="1.5" opacity="0.8"/>
              {[p1,p2].map((p,i) => <circle key={i} cx={p[0]} cy={p[1]} r="4" fill="none" stroke={color} strokeWidth="1.5"/>)}
              {isErr && (
                <text x={mx} y={my-6} fontSize="10" fill={T.r} textAnchor="middle" fontFamily={T.mono}>!</text>
              )}
            </g>
          );
        }
        if (ref.type === "vpLines" && pts.length >= 2) {
          const segs = [];
          for (let i = 0; i + 1 < pts.length; i += 2) {
            segs.push(<line key={i} x1={pts[i][0]} y1={pts[i][1]} x2={pts[i+1][0]} y2={pts[i+1][1]} stroke={T.g} strokeWidth="1" strokeDasharray="5,3" opacity="0.7"/>);
          }
          return <g key={ref.id}>{segs}{pts.map((p,i)=><circle key={i} cx={p[0]} cy={p[1]} r="3" fill="none" stroke={T.g} strokeWidth="1.2"/>)}</g>;
        }
        return null;
      })}

      {/* Pending points for active reference */}
      {pendingPoints && pendingPoints.map((p, i) => (
        <g key={`pp${i}`}>
          <circle cx={p[0]} cy={p[1]} r="5" fill={T.accDim} stroke={T.acc} strokeWidth="1.5"/>
          <text x={p[0]+7} y={p[1]-5} fontSize="9" fill={T.acc} fontFamily={T.mono}>{i+1}</text>
        </g>
      ))}
      {pendingPoints && pendingPoints.length > 1 && (
        pendingPoints.slice(1).map((p, i) => (
          <line key={`pl${i}`} x1={pendingPoints[i][0]} y1={pendingPoints[i][1]} x2={p[0]} y2={p[1]} stroke={T.acc} strokeWidth="1" strokeDasharray="4,3" opacity="0.6"/>
        ))
      )}
      {hoverPt && (
        <circle cx={hoverPt[0]} cy={hoverPt[1]} r="6" fill="none" stroke="rgba(200,146,42,0.5)" strokeWidth="1.5" strokeDasharray="3,2"/>
      )}

      {/* Measurement overlays */}
      {measurements.map(m => {
        if (!m.points || m.points.length < 2 || m.result === null || m.result === undefined) return null;
        const [p1, p2] = m.points;
        const mx = (p1[0]+p2[0])/2, my = (p1[1]+p2[1])/2;
        const cc = confColor[m.confidence] || T.tx2;
        return (
          <g key={m.id}>
            <line x1={p1[0]} y1={p1[1]} x2={p2[0]} y2={p2[1]} stroke={cc} strokeWidth="2" opacity="0.85"/>
            <circle cx={p1[0]} cy={p1[1]} r="4" fill={cc} opacity="0.85"/>
            <circle cx={p2[0]} cy={p2[1]} r="4" fill={cc} opacity="0.85"/>
            <rect x={mx-28} y={my-9} width={56} height={14} rx={3} fill="rgba(6,6,8,0.8)" stroke={cc} strokeWidth="0.7"/>
            <text x={mx} y={my+2} fontSize="9" fill={cc} textAnchor="middle" fontFamily={T.mono}>
              {cmToDisplay(m.result)}
            </text>
          </g>
        );
      })}

      {/* Vanishing points (visual indicator) */}
      {calibration?.vanishingPoints?.vpH1 && (() => {
        const vp = calibration.vanishingPoints.vpH1;
        return <circle cx={vp[0]} cy={vp[1]} r="7" fill="none" stroke="rgba(200,146,42,0.3)" strokeWidth="1" strokeDasharray="3,2"/>;
      })()}
      {calibration?.vanishingPoints?.vpV && (() => {
        const vp = calibration.vanishingPoints.vpV;
        return <circle cx={vp[0]} cy={vp[1]} r="7" fill="none" stroke="rgba(76,175,125,0.3)" strokeWidth="1" strokeDasharray="3,2"/>;
      })()}
    </svg>
  );
}


// ─── ADD REFERENCE MODAL ─────────────────────────────────────────────────────

function AddRefModal({ onClose, onAdd, roomDims, setRoomDims }) {
  const [type, setType] = useState("rectangle");
  const [plane, setPlane] = useState("frontWall");
  const [valueW, setValueW] = useState("");
  const [valueH, setValueH] = useState("");
  const [vpRole, setVpRole] = useState("vpH1");
  const [label, setLabel] = useState("");

  function handleAdd() {
    const ref = {
      id: uid(),
      type,
      plane,
      label: label || `${REF_TYPES[type]} on ${PLANE_LABELS[plane]}`,
      points: [],
      status: "drawing",
      valueW: parseFloat(valueW) || 0,
      valueH: parseFloat(valueH) || 0,
      vpRole: type === "vpLines" ? vpRole : undefined,
    };
    onAdd(ref);
    onClose();
  }

  function handleRoomDims() {
    const w = parseFloat(roomDims.w) || 0;
    const h = parseFloat(roomDims.h) || 0;
    const d = parseFloat(roomDims.d) || 0;
    const newRefs = [];
    if (w > 0) newRefs.push({ id: uid(), type: "distance", plane: "frontWall", label: "Room width", points: [], status: "drawing", valueW: w, valueH: 0 });
    if (h > 0) newRefs.push({ id: uid(), type: "distance", plane: "frontWall", label: "Ceiling height", points: [], status: "drawing", valueW: h, valueH: 0 });
    if (d > 0) newRefs.push({ id: uid(), type: "distance", plane: "floor", label: "Room depth", points: [], status: "drawing", valueW: d, valueH: 0 });
    newRefs.forEach(onAdd);
    onClose();
  }

  const inputStyle = {
    background: T.s2, border: `1px solid ${T.bd2}`, borderRadius: 4,
    color: T.tx, fontFamily: T.mono, fontSize: 12, padding: "4px 8px",
    outline: "none", width: "100%", boxSizing: "border-box",
  };
  const labelStyle = { fontSize: 10, color: T.tx2, marginBottom: 3, display: "block" };
  const btnStyle = (active) => ({
    background: active ? T.accDim : T.s2, border: `1px solid ${active ? T.acc : T.bd}`,
    color: active ? T.acc : T.tx2, borderRadius: 4, padding: "3px 8px",
    fontSize: 10, fontFamily: T.mono, cursor: "pointer",
  });

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: T.s1, border: `1px solid ${T.bd2}`, borderRadius: 8, padding: 20, width: 320, fontFamily: T.font }}>
        <div style={{ fontFamily: T.serif, fontSize: 13, color: T.acc, marginBottom: 14, letterSpacing: 1 }}>Add Reference</div>

        <label style={labelStyle}>Type</label>
        <div style={{ display: "flex", gap: 4, marginBottom: 12, flexWrap: "wrap" }}>
          {["rectangle","distance","vpLines","roomDims"].map(t => (
            <button key={t} style={btnStyle(type===t)} onClick={() => setType(t)}>{REF_TYPES[t]}</button>
          ))}
        </div>

        {type === "roomDims" ? (
          <div>
            <div style={{ fontSize: 11, color: T.tx2, marginBottom: 10, lineHeight: 1.4 }}>
              Enter known room dimensions. Three distance references will be created (width, height, depth) -- you then click their endpoints on the image.
            </div>
            {[["w","Width (cm)"],["h","Ceiling height (cm)"],["d","Depth (cm)"]].map(([k,lab]) => (
              <div key={k} style={{ marginBottom: 8 }}>
                <label style={labelStyle}>{lab}</label>
                <input style={inputStyle} type="number" value={roomDims[k]} onChange={e => setRoomDims(r => ({...r,[k]:e.target.value}))} placeholder="cm"/>
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button style={{ ...btnStyle(false), flex:1 }} onClick={onClose}>Cancel</button>
              <button style={{ ...btnStyle(true), flex:1 }} onClick={handleRoomDims}>Create references</button>
            </div>
          </div>
        ) : (
          <div>
            <label style={labelStyle}>Plane</label>
            <div style={{ display: "flex", gap: 4, marginBottom: 12, flexWrap: "wrap" }}>
              {PLANES.map(p => (
                <button key={p} style={btnStyle(plane===p)} onClick={() => setPlane(p)}>{PLANE_LABELS[p]}</button>
              ))}
            </div>

            {type === "rectangle" && (
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Width (cm)</label>
                  <input style={inputStyle} type="number" value={valueW} onChange={e => setValueW(e.target.value)} placeholder="e.g. 380"/>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Height (cm)</label>
                  <input style={inputStyle} type="number" value={valueH} onChange={e => setValueH(e.target.value)} placeholder="e.g. 245"/>
                </div>
              </div>
            )}

            {type === "distance" && (
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Known distance (cm)</label>
                <input style={inputStyle} type="number" value={valueW} onChange={e => setValueW(e.target.value)} placeholder="e.g. 92"/>
              </div>
            )}

            {type === "vpLines" && (
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Vanishing point role</label>
                <div style={{ display: "flex", gap: 4 }}>
                  {["vpH1","vpH2","vpV"].map(r => (
                    <button key={r} style={btnStyle(vpRole===r)} onClick={() => setVpRole(r)}>{r}</button>
                  ))}
                </div>
                <div style={{ fontSize: 10, color: T.tx3, marginTop: 5 }}>
                  Click 4+ points on the image to define 2+ parallel lines. Each pair of consecutive points is one line.
                </div>
              </div>
            )}

            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Label (optional)</label>
              <input style={inputStyle} value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Front wall face"/>
            </div>

            <div style={{ marginBottom: 10, fontSize: 10, color: T.tx2, lineHeight: 1.4 }}>
              {type === "rectangle" ? "Click 4 corners on the image in order: top-left, top-right, bottom-right, bottom-left." : ""}
              {type === "distance" ? "Click 2 points on the image defining the known distance." : ""}
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button style={{ ...btnStyle(false), flex:1 }} onClick={onClose}>Cancel</button>
              <button style={{ ...btnStyle(true), flex:1 }}
                onClick={handleAdd}
                disabled={type==="rectangle" && (!valueW || !valueH)}
              >Start drawing</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── MEASURE MODAL ────────────────────────────────────────────────────────────

function MeasureModal({ onClose, onAdd, planes }) {
  const [plane, setPlane] = useState("frontWall");
  const [label, setLabel] = useState("");
  const calibratedPlanes = planes.filter(p => p.calibrated);

  const btnStyle = (active) => ({
    background: active ? T.accDim : T.s2, border: `1px solid ${active ? T.acc : T.bd}`,
    color: active ? T.acc : T.tx2, borderRadius: 4, padding: "3px 8px",
    fontSize: 10, fontFamily: T.mono, cursor: "pointer",
  });

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: T.s1, border: `1px solid ${T.bd2}`, borderRadius: 8, padding: 20, width: 300, fontFamily: T.font }}>
        <div style={{ fontFamily: T.serif, fontSize: 13, color: T.acc, marginBottom: 14, letterSpacing: 1 }}>New Measurement</div>

        {calibratedPlanes.length === 0 && (
          <div style={{ fontSize: 11, color: T.r, marginBottom: 14 }}>No surfaces calibrated yet. Add references first.</div>
        )}

        <div style={{ fontSize: 10, color: T.tx2, marginBottom: 6 }}>Surface</div>
        <div style={{ display: "flex", gap: 4, marginBottom: 14, flexWrap: "wrap" }}>
          {PLANES.map(p => (
            <button key={p} style={{ ...btnStyle(plane===p), opacity: !calibratedPlanes.find(c=>c.key===p) ? 0.4 : 1 }}
              onClick={() => setPlane(p)}
              disabled={!calibratedPlanes.find(c=>c.key===p)}
            >{PLANE_LABELS[p]}</button>
          ))}
        </div>

        <div style={{ fontSize: 10, color: T.tx2, marginBottom: 4 }}>Label (optional)</div>
        <input style={{ background: T.s2, border: `1px solid ${T.bd2}`, borderRadius: 4, color: T.tx, fontFamily: T.mono, fontSize: 12, padding: "4px 8px", outline: "none", width: "100%", boxSizing: "border-box", marginBottom: 14 }}
          value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Window width"/>

        <div style={{ fontSize: 10, color: T.tx2, marginBottom: 14 }}>Click 2 points on the image to measure the distance between them on the selected surface.</div>

        <div style={{ display: "flex", gap: 8 }}>
          <button style={{ ...btnStyle(false), flex:1 }} onClick={onClose}>Cancel</button>
          <button style={{ ...btnStyle(true), flex:1 }} onClick={() => { onAdd({ id: uid(), plane, label: label || "Measurement", points: [], result: null, confidence: "low" }); onClose(); }}
            disabled={calibratedPlanes.length === 0}
          >Start measuring</button>
        </div>
      </div>
    </div>
  );
}


// ─── MAIN APP ─────────────────────────────────────────────────────────────────

export default function CelebrimborRuler() {
  useFonts();
  const navigate = useNavigate();

  // Image state
  const [image, setImage] = useState(null); // { src, w, h }
  const fileInputRef = useRef(null);

  // Canvas transform
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const panStart = useRef(null);
  const containerRef = useRef(null);

  // References and measurements
  const [references, setReferences] = useState([]);
  const [measurements, setMeasurements] = useState([]);

  // Active drawing state
  const [mode, setMode] = useState("idle"); // idle | drawRef | drawMeasure
  const [activeRef, setActiveRef] = useState(null);    // ref being drawn
  const [activeMeasure, setActiveMeasure] = useState(null);
  const [pendingPoints, setPendingPoints] = useState([]);
  const [hoverPt, setHoverPt] = useState(null);

  // Modals
  const [showAddRef, setShowAddRef] = useState(false);
  const [showMeasure, setShowMeasure] = useState(false);
  const [roomDims, setRoomDims] = useState({ w: "", h: "", d: "" });

  // Units
  const [units, setUnits] = useState("cm");

  // Supabase session
  const [sessionId, setSessionId] = useState(null);
  const [sessionSaving, setSessionSaving] = useState(false);

  // Calibration (derived)
  const calibration = useMemo(() => {
    const completedRefs = references.filter(r => r.status === "done");
    return computeCalibration(completedRefs);
  }, [references]);

  const calibratedPlaneList = PLANES.map(p => ({
    key: p, calibrated: !!calibration?.planes[p]
  }));

  // ─── IMAGE LOADING ─────────────────────────────────────────────────────────

  function loadImageFromFile(file) {
    if (!file || !file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setImage({ src: url, w: img.naturalWidth, h: img.naturalHeight });
      // Fit to container
      if (containerRef.current) {
        const cr = containerRef.current.getBoundingClientRect();
        const scaleX = (cr.width - 40) / img.naturalWidth;
        const scaleY = (cr.height - 40) / img.naturalHeight;
        const initZoom = Math.min(scaleX, scaleY, 1);
        setZoom(initZoom);
        setPan({
          x: (cr.width - img.naturalWidth * initZoom) / 2,
          y: (cr.height - img.naturalHeight * initZoom) / 2,
        });
      }
    };
    img.src = url;
  }

  // Paste handler
  useEffect(() => {
    function onPaste(e) {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          loadImageFromFile(item.getAsFile());
          break;
        }
      }
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  // Drag & drop
  function onDrop(e) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    loadImageFromFile(file);
  }

  // ─── ZOOM / PAN ────────────────────────────────────────────────────────────

  function onWheel(e) {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = Math.max(0.1, Math.min(20, zoom * factor));
    // Zoom around mouse position
    if (!containerRef.current) return;
    const cr = containerRef.current.getBoundingClientRect();
    const mx = e.clientX - cr.left;
    const my = e.clientY - cr.top;
    // pan + (mouse - pan) * (1 - newZoom/zoom)
    setPan(prev => ({
      x: mx - (mx - prev.x) * (newZoom / zoom),
      y: my - (my - prev.y) * (newZoom / zoom),
    }));
    setZoom(newZoom);
  }

  function onMouseDown(e) {
    if (e.button === 1 || (e.button === 0 && mode === "idle" && !image)) {
      // Middle button or idle with no image: pan
      isPanning.current = true;
      panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      e.preventDefault();
      return;
    }
    if (e.button === 0 && mode === "idle" && image) {
      // Check if this could be pan (no active drawing)
      isPanning.current = true;
      panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    }
  }

  function onMouseMove(e) {
    if (isPanning.current && mode === "idle") {
      setPan({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y });
      return;
    }
    // Hover snap preview
    if ((mode === "drawRef" || mode === "drawMeasure") && containerRef.current && image) {
      const cr = containerRef.current.getBoundingClientRect();
      const imgPt = screenToImage(e.clientX, e.clientY, zoom, pan, cr);
      if (imgPt[0] >= 0 && imgPt[0] <= image.w && imgPt[1] >= 0 && imgPt[1] <= image.h) {
        const snap = findSnap(imgPt, allPlacedPoints(references), zoom);
        setHoverPt(snap || imgPt);
      } else {
        setHoverPt(null);
      }
    }
  }

  function onMouseUp() {
    isPanning.current = false;
  }

  // ─── POINT CLICKING ────────────────────────────────────────────────────────

  function getRequiredPoints(ref) {
    if (!ref) return 0;
    if (ref.type === "rectangle") return 4;
    if (ref.type === "distance") return 2;
    if (ref.type === "vpLines") return 4; // minimum 2 lines x 2 pts
    return 2;
  }

  function onCanvasClick(e) {
    if (!image || !containerRef.current) return;
    if (isPanning.current) return;
    if (mode !== "drawRef" && mode !== "drawMeasure") return;

    const cr = containerRef.current.getBoundingClientRect();
    const rawPt = screenToImage(e.clientX, e.clientY, zoom, pan, cr);
    const snap = findSnap(rawPt, allPlacedPoints(references), zoom);
    const pt = snap || rawPt;

    if (mode === "drawRef" && activeRef) {
      const newPending = [...pendingPoints, pt];
      const required = getRequiredPoints(activeRef);

      if (activeRef.type === "vpLines") {
        // Keep accepting points; "Done" button finalises
        setPendingPoints(newPending);
      } else if (newPending.length >= required) {
        // Complete this reference
        finishRef(activeRef, newPending);
      } else {
        setPendingPoints(newPending);
      }
    }

    if (mode === "drawMeasure" && activeMeasure) {
      const newPending = [...pendingPoints, pt];
      if (newPending.length >= 2) {
        finishMeasurement(activeMeasure, newPending);
      } else {
        setPendingPoints(newPending);
      }
    }
  }

  function finishRef(ref, points) {
    const completed = { ...ref, points, status: "done" };
    setReferences(prev => prev.map(r => r.id === ref.id ? completed : r).concat(
      prev.find(r => r.id === ref.id) ? [] : [completed]
    ));
    setActiveRef(null);
    setPendingPoints([]);
    setMode("idle");
    setHoverPt(null);
  }

  function finishMeasurement(m, points) {
    // Compute result
    const plane = calibration?.planes[m.plane];
    let result = null;
    if (plane?.H) {
      result = measureDistance(plane.H, points[0], points[1]);
    }
    const conf = measurementConfidence(points, calibration, m.plane);
    const completed = { ...m, points, result, confidence: conf };
    setMeasurements(prev => prev.map(x => x.id === m.id ? completed : x).concat(
      prev.find(x => x.id === m.id) ? [] : [completed]
    ));
    setActiveMeasure(null);
    setPendingPoints([]);
    setMode("idle");
    setHoverPt(null);
  }

  // ─── START DRAWING ─────────────────────────────────────────────────────────

  function startDrawingRef(ref) {
    setReferences(prev => [...prev.filter(r => r.id !== ref.id), ref]);
    setActiveRef(ref);
    setPendingPoints([]);
    setMode("drawRef");
  }

  function startDrawingMeasure(m) {
    setMeasurements(prev => [...prev.filter(x => x.id !== m.id), m]);
    setActiveMeasure(m);
    setPendingPoints([]);
    setMode("drawMeasure");
  }

  function cancelDrawing() {
    // Remove the incomplete reference/measurement
    if (activeRef) setReferences(prev => prev.filter(r => r.id !== activeRef.id));
    if (activeMeasure) setMeasurements(prev => prev.filter(x => x.id !== activeMeasure.id));
    setActiveRef(null);
    setActiveMeasure(null);
    setPendingPoints([]);
    setMode("idle");
    setHoverPt(null);
  }

  // ─── EXPORT ───────────────────────────────────────────────────────────────

  function exportPNG() {
    if (!image) return;
    const canvas = document.createElement("canvas");
    canvas.width = image.w;
    canvas.height = image.h;
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0);
      // Draw measurements
      const confColor = { high: "#4caf7d", medium: "#d4a847", low: "#d95f5f" };
      measurements.forEach(m => {
        if (!m.points || m.points.length < 2 || m.result === null) return;
        const [p1, p2] = m.points;
        const cc = confColor[m.confidence] || "#888";
        ctx.strokeStyle = cc;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p1[0], p1[1]);
        ctx.lineTo(p2[0], p2[1]);
        ctx.stroke();
        const mx = (p1[0]+p2[0])/2, my = (p1[1]+p2[1])/2;
        const label = units === "in" ? (m.result/2.54).toFixed(2)+'"' : m.result.toFixed(1)+" cm";
        ctx.fillStyle = "rgba(6,6,8,0.8)";
        ctx.fillRect(mx-30, my-10, 60, 16);
        ctx.fillStyle = cc;
        ctx.font = "11px monospace";
        ctx.textAlign = "center";
        ctx.fillText(label, mx, my+3);
      });
      const link = document.createElement("a");
      link.download = "celebrimbor-ruler.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    };
    img.src = image.src;
  }

  // ─── SUPABASE SAVE ────────────────────────────────────────────────────────

  async function saveSession() {
    setSessionSaving(true);
    try {
      const state = { references, measurements, units };
      if (sessionId) {
        await supabase.from("celebrimbor_sessions").update({ state, updated_at: new Date().toISOString() }).eq("id", sessionId);
      } else {
        const { data } = await supabase.from("celebrimbor_sessions").insert({ state }).select("id").single();
        if (data) setSessionId(data.id);
      }
    } catch (err) {
      console.error("Save failed:", err);
    }
    setSessionSaving(false);
  }

  async function loadSession(id) {
    const { data } = await supabase.from("celebrimbor_sessions").select("state").eq("id", id).single();
    if (data?.state) {
      setReferences(data.state.references || []);
      setMeasurements(data.state.measurements || []);
      setUnits(data.state.units || "cm");
      setSessionId(id);
    }
  }

  // ─── PANEL UI HELPERS ─────────────────────────────────────────────────────

  function cmToDisplay(v) {
    if (v === null || v === undefined) return "--";
    if (units === "in") return (v / 2.54).toFixed(2) + '"';
    return v.toFixed(1) + " cm";
  }

  const errRefIds = new Set((calibration?.errors || []).map(e => e.refId));

  const btnBase = {
    background: T.s2, border: `1px solid ${T.bd}`, borderRadius: 4,
    color: T.tx2, fontFamily: T.mono, fontSize: 11, padding: "4px 10px",
    cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
  };
  const btnAccent = {
    ...btnBase, background: T.accDim, border: `1px solid ${T.acc}`, color: T.acc,
  };

  const confDot = (c) => {
    const cols = { high: T.g, medium: T.y, low: T.r };
    return <span style={{ width: 6, height: 6, borderRadius: "50%", background: cols[c] || T.tx3, display: "inline-block", flexShrink: 0 }}/>;
  };

  // ─── RENDER ───────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", height: "100vh", background: T.bg, fontFamily: T.font, overflow: "hidden", color: T.tx }}>

      {/* ── Left: canvas area ── */}
      <div
        ref={containerRef}
        style={{ flex: 1, position: "relative", overflow: "hidden", cursor: mode === "idle" ? "grab" : "crosshair" }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onClick={onCanvasClick}
        onWheel={onWheel}
        onDrop={onDrop}
        onDragOver={e => e.preventDefault()}
      >
        {!image ? (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: T.tx2, userSelect: "none" }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={T.acc} strokeWidth="1" opacity="0.5">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
            <div style={{ fontSize: 14, color: T.tx2 }}>Paste a photo (Ctrl+V) or drag & drop</div>
            <div style={{ fontSize: 11, color: T.tx3 }}>or</div>
            <button style={btnBase} onClick={() => fileInputRef.current?.click()}>Browse file</button>
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => loadImageFromFile(e.target.files[0])}/>
          </div>
        ) : (
          <div style={{ position: "absolute", transformOrigin: "0 0", transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})` }}>
            <img
              src={image.src}
              width={image.w}
              height={image.h}
              style={{ display: "block", userSelect: "none", pointerEvents: "none" }}
              draggable={false}
              alt=""
            />
            <CanvasOverlay
              imageW={image.w}
              imageH={image.h}
              references={references}
              measurements={measurements}
              calibration={calibration}
              activeRef={activeRef}
              pendingPoints={pendingPoints}
              mode={mode}
              hoverPt={hoverPt}
              units={units}
            />
          </div>
        )}

        {/* Drawing mode status bar */}
        {mode !== "idle" && (
          <div style={{ position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)", background: "rgba(14,14,18,0.92)", border: `1px solid ${T.acc}`, borderRadius: 6, padding: "6px 14px", display: "flex", alignItems: "center", gap: 12, zIndex: 10 }}>
            <span style={{ fontSize: 11, color: T.acc, fontFamily: T.mono }}>
              {mode === "drawRef" && activeRef && `Drawing: ${activeRef.label} -- ${pendingPoints.length}/${getRequiredPoints(activeRef)} pts`}
              {mode === "drawMeasure" && activeMeasure && `Measuring: ${activeMeasure.label} -- click ${pendingPoints.length === 0 ? "start" : "end"} point`}
            </span>
            {mode === "drawRef" && activeRef?.type === "vpLines" && pendingPoints.length >= 4 && (
              <button style={{ ...btnAccent, fontSize: 10, padding: "2px 8px" }} onClick={() => finishRef(activeRef, pendingPoints)}>Done ({pendingPoints.length} pts)</button>
            )}
            <button style={{ ...btnBase, fontSize: 10, padding: "2px 8px", color: T.r, borderColor: T.r }} onClick={cancelDrawing}>Cancel</button>
          </div>
        )}

        {/* Zoom indicator */}
        {image && (
          <div style={{ position: "absolute", bottom: 16, right: 16, fontSize: 10, color: T.tx3, fontFamily: T.mono, background: "rgba(14,14,18,0.7)", borderRadius: 4, padding: "2px 6px" }}>
            {Math.round(zoom * 100)}% | scroll to zoom | drag to pan
          </div>
        )}
      </div>

      {/* ── Right: panel ── */}
      <div style={{ width: 300, background: T.s1, borderLeft: `1px solid ${T.bd}`, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ padding: "14px 16px 10px", borderBottom: `1px solid ${T.bd}`, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.acc} strokeWidth="1.5">
              <rect x="2" y="9" width="20" height="6" rx="1"/>
              <line x1="6" y1="9" x2="6" y2="12"/>
              <line x1="10" y1="9" x2="10" y2="11"/>
              <line x1="14" y1="9" x2="14" y2="11"/>
              <line x1="18" y1="9" x2="18" y2="12"/>
            </svg>
            <span style={{ fontFamily: T.serif, fontSize: 14, color: T.acc, letterSpacing: 1 }}>Celebrimbor's Ruler</span>
          </div>
          <div style={{ fontSize: 9, color: T.tx3, marginLeft: 26 }}>Single-image metrology</div>
          <button style={{ marginTop: 8, fontSize: 10, color: T.tx3, background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: T.mono }} onClick={() => navigate("/")}>
            -- hub
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>

          {/* Room diagram */}
          <RoomDiagram calibration={calibration}/>

          <div style={{ height: 1, background: T.bd, margin: "8px 0 12px" }}/>

          {/* References */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ fontFamily: T.serif, fontSize: 10, color: T.acc, letterSpacing: 2, textTransform: "uppercase" }}>References</div>
            <button style={btnAccent} onClick={() => { if (mode !== "idle") return; setShowAddRef(true); }}>+ Add</button>
          </div>

          {references.length === 0 && (
            <div style={{ fontSize: 11, color: T.tx3, marginBottom: 12 }}>No references yet. Add a rectangle, distance, or tile reference to calibrate a surface.</div>
          )}

          {references.map(ref => {
            const isErr = errRefIds.has(ref.id);
            return (
              <div key={ref.id} style={{ background: T.s2, border: `1px solid ${isErr ? T.r : (ref.status === "done" ? T.bd2 : T.acc)}`, borderRadius: 5, padding: "7px 10px", marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                  <RefTypeTag type={ref.type}/>
                  <span style={{ fontSize: 10, color: isErr ? T.r : (ref.status === "done" ? T.tx : T.acc), flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ref.label}</span>
                  <button style={{ background: "none", border: "none", cursor: "pointer", color: T.tx3, fontSize: 11, padding: 0 }}
                    onClick={() => { setReferences(prev => prev.filter(r => r.id !== ref.id)); }}>x</button>
                </div>
                <div style={{ fontSize: 9, color: T.tx3, fontFamily: T.mono }}>
                  {PLANE_LABELS[ref.plane]}
                  {ref.valueW > 0 && ` | ${ref.valueW}${ref.valueH > 0 ? ` x ${ref.valueH}` : ""} cm`}
                  {ref.status !== "done" && <span style={{ color: T.acc }}> -- drawing</span>}
                  {isErr && <span style={{ color: T.r, marginLeft: 4 }} title="Conflicts with other references">-- conflict</span>}
                </div>
                {ref.status !== "done" && (
                  <button style={{ ...btnBase, fontSize: 9, padding: "2px 6px", marginTop: 4 }} onClick={() => startDrawingRef(ref)}>Draw on image</button>
                )}
              </div>
            );
          })}

          <div style={{ height: 1, background: T.bd, margin: "10px 0 12px" }}/>

          {/* Measurements */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ fontFamily: T.serif, fontSize: 10, color: T.acc, letterSpacing: 2, textTransform: "uppercase" }}>Measurements</div>
            <button style={btnAccent} onClick={() => { if (mode !== "idle") return; setShowMeasure(true); }}>Measure</button>
          </div>

          {measurements.length === 0 && (
            <div style={{ fontSize: 11, color: T.tx3, marginBottom: 12 }}>No measurements yet. Calibrate at least one surface first, then click Measure.</div>
          )}

          {measurements.map(m => (
            <div key={m.id} style={{ background: T.s2, border: `1px solid ${T.bd}`, borderRadius: 5, padding: "7px 10px", marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {confDot(m.confidence)}
                <span style={{ fontSize: 11, color: T.tx, flex: 1 }}>{m.label}</span>
                <span style={{ fontSize: 12, fontFamily: T.mono, color: m.result !== null ? T.acc2 : T.tx3 }}>
                  {m.result !== null ? cmToDisplay(m.result) : "--"}
                </span>
                <button style={{ background: "none", border: "none", cursor: "pointer", color: T.tx3, fontSize: 11, padding: 0 }}
                  onClick={() => setMeasurements(prev => prev.filter(x => x.id !== m.id))}>x</button>
              </div>
              <div style={{ fontSize: 9, color: T.tx3, marginTop: 2, fontFamily: T.mono }}>
                {PLANE_LABELS[m.plane]}
                {m.confidence && <span style={{ marginLeft: 6, color: { high: T.g, medium: T.y, low: T.r }[m.confidence] }}>{m.confidence} confidence</span>}
              </div>
            </div>
          ))}
        </div>

        {/* Footer controls */}
        <div style={{ borderTop: `1px solid ${T.bd}`, padding: "10px 16px", flexShrink: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          {/* Units toggle */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 10, color: T.tx2 }}>Units</span>
            {["cm","in"].map(u => (
              <button key={u} style={{ ...btnBase, ...(units === u ? { background: T.accDim, borderColor: T.acc, color: T.acc } : {}), fontSize: 11, padding: "3px 10px" }}
                onClick={() => setUnits(u)}>{u}</button>
            ))}
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 6 }}>
            <button style={{ ...btnBase, flex: 1, justifyContent: "center", fontSize: 11 }} onClick={exportPNG} disabled={!image}>Export PNG</button>
            <button style={{ ...btnBase, flex: 1, justifyContent: "center", fontSize: 11 }} onClick={saveSession} disabled={sessionSaving}>
              {sessionSaving ? "Saving..." : "Save session"}
            </button>
          </div>

          {sessionId && (
            <div style={{ fontSize: 9, color: T.tx3, fontFamily: T.mono, wordBreak: "break-all" }}>
              Session: {sessionId}
            </div>
          )}

          {/* Load session input */}
          <div style={{ display: "flex", gap: 4 }}>
            <input
              style={{ flex: 1, background: T.s2, border: `1px solid ${T.bd}`, borderRadius: 4, color: T.tx3, fontFamily: T.mono, fontSize: 9, padding: "3px 6px", outline: "none" }}
              placeholder="Paste session ID to load"
              onKeyDown={e => { if (e.key === "Enter") loadSession(e.target.value.trim()); }}
            />
          </div>
        </div>
      </div>

      {/* Modals */}
      {showAddRef && (
        <AddRefModal
          onClose={() => setShowAddRef(false)}
          onAdd={ref => startDrawingRef(ref)}
          roomDims={roomDims}
          setRoomDims={setRoomDims}
        />
      )}
      {showMeasure && (
        <MeasureModal
          onClose={() => setShowMeasure(false)}
          onAdd={m => startDrawingMeasure(m)}
          planes={calibratedPlaneList}
        />
      )}
    </div>
  );
}
