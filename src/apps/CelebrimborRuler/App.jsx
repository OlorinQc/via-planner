import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabase";

// ─── THEME ────────────────────────────────────────────────────────────────────
const T = {
  bg:"#060608", s1:"#0e0e12", s2:"#14141a", s3:"#1a1a22",
  bd:"rgba(255,255,255,0.07)", bd2:"rgba(255,255,255,0.13)",
  tx:"#e8e8e8", tx2:"#888", tx3:"#555",
  acc:"#c8922a", acc2:"#d4a847", accDim:"rgba(200,146,42,0.18)",
  g:"#4caf7d", y:"#d4a847", r:"#d95f5f", blue:"#5b9cf6",
  font:"'IBM Plex Sans', system-ui, sans-serif",
  mono:"'IBM Plex Mono', monospace",
  serif:"'Cinzel', serif",
};

// ─── FONTS ────────────────────────────────────────────────────────────────────
function useFonts() {
  useEffect(() => {
    const id = "celebrimbor-fonts";
    if (document.getElementById(id)) return;
    const l = document.createElement("link");
    l.id = id; l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=IBM+Plex+Sans:ital,wght@0,300;0,400;0,500;0,700;1,400&family=IBM+Plex+Mono:wght@400;500&display=swap";
    document.head.appendChild(l);
  }, []);
}

// ─── MATH ─────────────────────────────────────────────────────────────────────

function jacobiEig(M, n) {
  const A = M.slice();
  const V = new Array(n * n).fill(0);
  for (let i = 0; i < n; i++) V[i * n + i] = 1;
  for (let iter = 0; iter < 200 * n * n; iter++) {
    let p = 0, q = 1, maxVal = 0;
    for (let i = 0; i < n - 1; i++)
      for (let j = i + 1; j < n; j++) {
        const v = Math.abs(A[i * n + j]);
        if (v > maxVal) { maxVal = v; p = i; q = j; }
      }
    if (maxVal < 1e-12) break;
    const App = A[p*n+p], Aqq = A[q*n+q], Apq = A[p*n+q];
    const tau = (Aqq - App) / (2 * Apq);
    const t = tau >= 0 ? 1/(tau+Math.sqrt(1+tau*tau)) : 1/(tau-Math.sqrt(1+tau*tau));
    const c = 1/Math.sqrt(1+t*t), s = t*c;
    A[p*n+p] = App - t*Apq; A[q*n+q] = Aqq + t*Apq;
    A[p*n+q] = 0; A[q*n+p] = 0;
    for (let r = 0; r < n; r++) {
      if (r === p || r === q) continue;
      const Arp = A[r*n+p], Arq = A[r*n+q];
      A[r*n+p] = c*Arp - s*Arq; A[p*n+r] = c*Arp - s*Arq;
      A[r*n+q] = s*Arp + c*Arq; A[q*n+r] = s*Arp + c*Arq;
    }
    for (let r = 0; r < n; r++) {
      const Vrp = V[r*n+p], Vrq = V[r*n+q];
      V[r*n+p] = c*Vrp - s*Vrq; V[r*n+q] = s*Vrp + c*Vrq;
    }
  }
  return { eigenvalues: Array.from({length:n},(_,i)=>A[i*n+i]), V };
}

function nullVector9(A, rows) {
  const ATA = new Array(81).fill(0);
  for (let i = 0; i < 9; i++)
    for (let j = 0; j < 9; j++)
      for (let r = 0; r < rows; r++)
        ATA[i*9+j] += A[r*9+i] * A[r*9+j];
  const { eigenvalues, V } = jacobiEig(ATA, 9);
  let minIdx = 0;
  for (let i = 1; i < 9; i++) if (eigenvalues[i] < eigenvalues[minIdx]) minIdx = i;
  return Array.from({length:9}, (_,i) => V[i*9+minIdx]);
}

function normalise2D(pts) {
  const n = pts.length;
  const cx = pts.reduce((s,p)=>s+p[0],0)/n, cy = pts.reduce((s,p)=>s+p[1],0)/n;
  const scale = pts.reduce((s,p)=>s+Math.hypot(p[0]-cx,p[1]-cy),0)/n;
  const sc = scale < 1e-10 ? 1 : Math.SQRT2/scale;
  return { pts: pts.map(([x,y])=>[(x-cx)*sc,(y-cy)*sc]), T:[sc,0,-sc*cx, 0,sc,-sc*cy, 0,0,1] };
}

function inv3(m) {
  const [a,b,c,d,e,f,g,h,i] = m;
  const det = a*(e*i-f*h)-b*(d*i-f*g)+c*(d*h-e*g);
  if (Math.abs(det)<1e-14) return null;
  const inv = 1/det;
  return [(e*i-f*h)*inv,(c*h-b*i)*inv,(b*f-c*e)*inv,
          (f*g-d*i)*inv,(a*i-c*g)*inv,(c*d-a*f)*inv,
          (d*h-e*g)*inv,(b*g-a*h)*inv,(a*e-b*d)*inv];
}

function mul3(A, B) {
  const C = new Array(9);
  for (let i=0;i<3;i++) for (let j=0;j<3;j++) { let s=0; for (let k=0;k<3;k++) s+=A[i*3+k]*B[k*3+j]; C[i*3+j]=s; }
  return C;
}

function computeHomographyDLT(srcPts, dstPts) {
  if (srcPts.length < 4) return null;
  const n = srcPts.length;
  const {pts:srcN, T:Tsrc} = normalise2D(srcPts);
  const {pts:dstN, T:Tdst} = normalise2D(dstPts);
  const A = new Array(2*n*9).fill(0);
  for (let i=0;i<n;i++) {
    const [sx,sy]=srcN[i], [dx,dy]=dstN[i];
    A[(2*i)*9+0]=-sx; A[(2*i)*9+1]=-sy; A[(2*i)*9+2]=-1;
    A[(2*i)*9+6]=dx*sx; A[(2*i)*9+7]=dx*sy; A[(2*i)*9+8]=dx;
    A[(2*i+1)*9+3]=-sx; A[(2*i+1)*9+4]=-sy; A[(2*i+1)*9+5]=-1;
    A[(2*i+1)*9+6]=dy*sx; A[(2*i+1)*9+7]=dy*sy; A[(2*i+1)*9+8]=dy;
  }
  const h = nullVector9(A, 2*n);
  const TdstInv = inv3(Tdst);
  if (!TdstInv) return null;
  return mul3(TdstInv, mul3(h, Tsrc));
}

function crossH(a, b) {
  return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
}

function applyH(H, x, y) {
  const w = H[6]*x+H[7]*y+H[8];
  if (Math.abs(w)<1e-14) return [0,0];
  return [(H[0]*x+H[1]*y+H[2])/w, (H[3]*x+H[4]*y+H[5])/w];
}

function vanishingPoint(p1, p2, q1, q2) {
  const l1 = crossH([p1[0],p1[1],1],[p2[0],p2[1],1]);
  const l2 = crossH([q1[0],q1[1],1],[q2[0],q2[1],1]);
  const vp = crossH(l1, l2);
  if (Math.abs(vp[2]) < 1e-10) return null;
  return [vp[0]/vp[2], vp[1]/vp[2]];
}

function avgVPs(list) {
  const v = list.filter(Boolean);
  if (!v.length) return null;
  return [v.reduce((s,p)=>s+p[0],0)/v.length, v.reduce((s,p)=>s+p[1],0)/v.length];
}

function measureDistance(H, p1, p2) {
  const [x1,y1] = applyH(H,p1[0],p1[1]);
  const [x2,y2] = applyH(H,p2[0],p2[1]);
  return Math.hypot(x2-x1, y2-y1);
}

// ─── CALIBRATION ──────────────────────────────────────────────────────────────

function computeVPsFromCorners(corners) {
  const done = corners.filter(c=>c.vertex&&c.left&&c.right&&c.up);
  const h1=[], h2=[], v=[];
  for (let i=0;i<done.length;i++) for (let j=i+1;j<done.length;j++) {
    const ci=done[i], cj=done[j];
    const vH1 = vanishingPoint(ci.vertex,ci.left, cj.vertex,cj.left);
    if (vH1) h1.push(vH1);
    const vH2 = vanishingPoint(ci.vertex,ci.right, cj.vertex,cj.right);
    if (vH2) h2.push(vH2);
    const vV  = vanishingPoint(ci.vertex,ci.up,    cj.vertex,cj.up);
    if (vV) v.push(vV);
  }
  return { vpH1:avgVPs(h1), vpH2:avgVPs(h2), vpV:avgVPs(v) };
}

// Affine-rectify using VP pair then scale via known distances
function affineHFromVPs(vp1, vp2, dists) {
  if (!vp1||!vp2) return null;
  const l = crossH([vp1[0],vp1[1],1],[vp2[0],vp2[1],1]);
  if (Math.abs(l[2])<1e-10) return null;
  // H_aff: sends vanishing line to line at infinity
  const Ha = [1,0,0, 0,1,0, l[0]/l[2],l[1]/l[2],1];
  let sN=0, sD=0;
  for (const d of dists) {
    if (!d.points||d.points.length<2||!(d.value>0)) continue;
    const [r1x,r1y]=applyH(Ha,d.points[0][0],d.points[0][1]);
    const [r2x,r2y]=applyH(Ha,d.points[1][0],d.points[1][1]);
    const rd=Math.hypot(r2x-r1x,r2y-r1y);
    if (rd>0.01) { sN+=d.value; sD+=rd; }
  }
  if (sD<1e-10) return null;
  const sc=sN/sD;
  const H=[...Ha]; H[0]*=sc;H[1]*=sc;H[2]*=sc;H[3]*=sc;H[4]*=sc;H[5]*=sc;
  return H;
}

function computeCalibration(corners, distances) {
  const vps = computeVPsFromCorners(corners);
  const VP_FOR_PLANE = {
    floor:     [vps.vpH1, vps.vpH2],
    frontWall: [vps.vpH1, vps.vpV ],
    leftWall:  [vps.vpH2, vps.vpV ],
    rightWall: [vps.vpH1, vps.vpV ],
  };
  const planes = {};
  for (const [plane, [vp1,vp2]] of Object.entries(VP_FOR_PLANE)) {
    const pd = distances.filter(d=>d.plane===plane&&d.points?.length===2&&d.value>0);
    const H = affineHFromVPs(vp1,vp2,pd);
    if (H) planes[plane] = { H, srcPts: pd.flatMap(d=>d.points), method:"vp" };
  }
  // Outlier check
  const errors = [];
  for (const d of distances) {
    const pl = planes[d.plane];
    if (!pl?.H||!d.points||d.points.length<2||!(d.value>0)) continue;
    const comp = measureDistance(pl.H,d.points[0],d.points[1]);
    if (Math.abs(comp-d.value)/d.value>0.15) errors.push({distId:d.id,comp,stated:d.value});
  }
  return { planes, vanishingPoints:vps, errors };
}

function measConfidence(pts, cal, plane) {
  if (!cal?.planes[plane]) return "low";
  const src = cal.planes[plane].srcPts;
  if (!src||src.length<2) return "medium";
  const xs=src.map(p=>p[0]),ys=src.map(p=>p[1]);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  const pad=0.2*Math.max(maxX-minX,maxY-minY);
  const strict=pts.every(([x,y])=>x>=minX&&x<=maxX&&y>=minY&&y<=maxY);
  const loose=pts.every(([x,y])=>x>=minX-pad&&x<=maxX+pad&&y>=minY-pad&&y<=maxY+pad);
  return strict?"high":loose?"medium":"low";
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const PLANES = ["frontWall","floor","leftWall","rightWall"];
const PL = { frontWall:"Front wall", floor:"Floor", leftWall:"Left wall", rightWall:"Right wall" };
const CORNER_STEPS = [
  "Click the corner vertex",
  "Click left edge endpoint",
  "Click right edge endpoint",
  "Click up edge endpoint",
];
const SNAP_PX = 10;
let _id = 0;
function uid() { return `r${Date.now()}_${_id++}`; }

function screenToImg(sx,sy,zoom,pan,cr) {
  return [(sx-cr.left-pan.x)/zoom, (sy-cr.top-pan.y)/zoom];
}
function imgToContainer(pt,zoom,pan) {
  return [pt[0]*zoom+pan.x, pt[1]*zoom+pan.y];
}
function snapPoints(corners,distances) {
  const pts=[];
  for (const c of corners) { if(c.vertex)pts.push(c.vertex);if(c.left)pts.push(c.left);if(c.right)pts.push(c.right);if(c.up)pts.push(c.up); }
  for (const d of distances) for(const p of(d.points||[])) pts.push(p);
  return pts;
}
function findSnap(pt,pool,zoom) {
  const t=SNAP_PX/zoom;
  for(const p of pool) if(Math.hypot(p[0]-pt[0],p[1]-pt[1])<t) return p;
  return null;
}


// ─── ROOM DIAGRAM ─────────────────────────────────────────────────────────────
function RoomDiagram({ cal }) {
  const pl = cal?.planes||{};
  const vp = cal?.vanishingPoints||{};
  const lit = k => !!pl[k];
  const fc = k => lit(k)?"rgba(200,146,42,0.13)":"rgba(255,255,255,0.02)";
  const sc = k => lit(k)?T.acc:T.bd;
  const has3D = lit("floor")&&!!vp.vpV;
  return (
    <div style={{marginBottom:10}}>
      <div style={{fontFamily:T.serif,fontSize:9,color:T.acc,letterSpacing:2,marginBottom:5,textTransform:"uppercase"}}>Calibration</div>
      <svg viewBox="0 0 120 90" width="100%" style={{display:"block"}}>
        <polygon points="20,65 60,80 100,65 60,50" fill={fc("floor")} stroke={sc("floor")} strokeWidth="1"/>
        <polygon points="20,30 60,30 60,65 20,65" fill={fc("frontWall")} stroke={sc("frontWall")} strokeWidth="1"/>
        <polygon points="20,30 20,65 10,58 10,23" fill={fc("leftWall")} stroke={sc("leftWall")} strokeWidth="1"/>
        <polygon points="60,30 60,65 70,58 70,23" fill={fc("rightWall")} stroke={sc("rightWall")} strokeWidth="1"/>
        <polygon points="20,30 60,30 70,23 10,23" fill="rgba(255,255,255,0.01)" stroke={has3D?"rgba(200,146,42,0.4)":T.bd} strokeWidth="0.7" strokeDasharray="3,2"/>
        <text x="38" y="50" fontSize="6" fill={lit("frontWall")?T.acc:T.tx3} textAnchor="middle">front</text>
        <text x="60" y="70" fontSize="6" fill={lit("floor")?T.acc:T.tx3} textAnchor="middle">floor</text>
        <text x="13" y="45" fontSize="5" fill={lit("leftWall")?T.acc:T.tx3} textAnchor="middle">L</text>
        <text x="67" y="45" fontSize="5" fill={lit("rightWall")?T.acc:T.tx3} textAnchor="middle">R</text>
      </svg>
      <div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:2}}>
        {[["vpH1","VP L"],["vpH2","VP R"],["vpV","VP up"]].map(([k,lab])=>(
          <span key={k} style={{fontSize:8,color:vp[k]?T.acc:T.tx3,background:vp[k]?T.accDim:"transparent",border:`1px solid ${vp[k]?T.acc:T.bd}`,borderRadius:3,padding:"1px 4px"}}>
            {lab}
          </span>
        ))}
        {has3D&&<span style={{fontSize:8,color:T.g,background:"rgba(76,175,125,0.12)",border:`1px solid ${T.g}`,borderRadius:3,padding:"1px 4px"}}>3D heights</span>}
      </div>
    </div>
  );
}

// ─── CANVAS OVERLAY ───────────────────────────────────────────────────────────
function Overlay({ imageW, imageH, corners, distances, measurements,
                   mode, pendingPoints, hoverPt, isSnapping, zoom, units, cal }) {
  const z = n => n/zoom; // screen-consistent size
  const cc = {high:T.g,medium:T.y,low:T.r};
  const disp = v => v==null?"--":units==="in"?(v/2.54).toFixed(2)+'"':v.toFixed(1)+" cm";
  const errIds = new Set((cal?.errors||[]).map(e=>e.distId));

  // Current rubber-band source depends on mode + step
  const rbSrc = mode==="corner"&&pendingPoints.length>=1 ? pendingPoints[0]
              : mode==="distance"&&pendingPoints.length===1 ? pendingPoints[0]
              : mode==="measure"&&pendingPoints.length===1  ? pendingPoints[0]
              : null;

  // Color for current corner edge being drawn
  const cornerEdgeColor = ["","","",T.acc,T.acc2,T.g][Math.min(5,pendingPoints.length+2)];

  return (
    <svg width={imageW} height={imageH}
         style={{position:"absolute",top:0,left:0,pointerEvents:"none",overflow:"visible"}}>

      {/* ── Completed corners (permanent scaffold) ── */}
      {corners.map(c=>{
        if (!c.vertex) return null;
        return (
          <g key={c.id}>
            {c.left  && <line x1={c.vertex[0]} y1={c.vertex[1]} x2={c.left[0]}  y2={c.left[1]}  stroke={T.acc}  strokeWidth={z(2)}  opacity={0.85}/>}
            {c.right && <line x1={c.vertex[0]} y1={c.vertex[1]} x2={c.right[0]} y2={c.right[1]} stroke={T.acc2} strokeWidth={z(2)}  opacity={0.85}/>}
            {c.up    && <line x1={c.vertex[0]} y1={c.vertex[1]} x2={c.up[0]}    y2={c.up[1]}    stroke={T.g}    strokeWidth={z(2)}  opacity={0.85}/>}
            {/* Vertex – bright white filled dot */}
            <circle cx={c.vertex[0]} cy={c.vertex[1]} r={z(6)} fill="#ffffff" stroke={T.acc} strokeWidth={z(1.5)} opacity={0.95}/>
            {/* Edge endpoint dots */}
            {c.left  && <circle cx={c.left[0]}  cy={c.left[1]}  r={z(4)} fill="none" stroke={T.acc}  strokeWidth={z(1.5)}/>}
            {c.right && <circle cx={c.right[0]} cy={c.right[1]} r={z(4)} fill="none" stroke={T.acc2} strokeWidth={z(1.5)}/>}
            {c.up    && <circle cx={c.up[0]}    cy={c.up[1]}    r={z(4)} fill="none" stroke={T.g}    strokeWidth={z(1.5)}/>}
            {/* Edge labels */}
            {c.left  && <text x={c.left[0]+z(7)}  y={c.left[1]+z(4)}  fontSize={z(11)} fill={T.acc}  fontFamily={T.mono}>L</text>}
            {c.right && <text x={c.right[0]+z(7)} y={c.right[1]+z(4)} fontSize={z(11)} fill={T.acc2} fontFamily={T.mono}>R</text>}
            {c.up    && <text x={c.up[0]+z(7)}    y={c.up[1]+z(4)}    fontSize={z(11)} fill={T.g}    fontFamily={T.mono}>U</text>}
            {c.label && <text x={c.vertex[0]+z(9)} y={c.vertex[1]-z(7)} fontSize={z(10)} fill={T.tx2} fontFamily={T.mono}>{c.label}</text>}
          </g>
        );
      })}

      {/* ── Pending corner being drawn ── */}
      {mode==="corner"&&pendingPoints.length>0&&(()=>{
        const [vtx,lft,rgt] = pendingPoints;
        const edgeColor = pendingPoints.length===1?T.acc:pendingPoints.length===2?T.acc2:T.g;
        return (
          <g>
            {lft && <line x1={vtx[0]} y1={vtx[1]} x2={lft[0]} y2={lft[1]} stroke={T.acc}  strokeWidth={z(2)}/>}
            {rgt && <line x1={vtx[0]} y1={vtx[1]} x2={rgt[0]} y2={rgt[1]} stroke={T.acc2} strokeWidth={z(2)}/>}
            {/* Rubber band: always from vertex to cursor */}
            {hoverPt&&pendingPoints.length<4&&(
              <line x1={vtx[0]} y1={vtx[1]} x2={hoverPt[0]} y2={hoverPt[1]}
                    stroke={edgeColor} strokeWidth={z(1.2)}
                    strokeDasharray={`${z(6)},${z(3)}`} opacity={0.55}/>
            )}
            {/* Placed point dots */}
            <circle cx={vtx[0]} cy={vtx[1]} r={z(6)} fill="#ffffff" stroke={T.acc} strokeWidth={z(1.5)} opacity={0.95}/>
            {lft && <circle cx={lft[0]} cy={lft[1]} r={z(4)} fill="none" stroke={T.acc}  strokeWidth={z(1.5)}/>}
            {rgt && <circle cx={rgt[0]} cy={rgt[1]} r={z(4)} fill="none" stroke={T.acc2} strokeWidth={z(1.5)}/>}
          </g>
        );
      })()}

      {/* ── Pending distance / measure ── */}
      {(mode==="distance"||mode==="measure")&&pendingPoints.length>0&&(()=>{
        const col = mode==="distance"?T.blue:T.acc;
        const p0 = pendingPoints[0];
        return (
          <g>
            <circle cx={p0[0]} cy={p0[1]} r={z(5)} fill={col} opacity={0.9}/>
            {hoverPt&&(
              <line x1={p0[0]} y1={p0[1]} x2={hoverPt[0]} y2={hoverPt[1]}
                    stroke={col} strokeWidth={z(1.2)} strokeDasharray={`${z(6)},${z(3)}`} opacity={0.6}/>
            )}
          </g>
        );
      })()}

      {/* ── Hover / snap indicator ── */}
      {hoverPt&&mode!=="idle"&&(
        isSnapping
          ? <g>
              <circle cx={hoverPt[0]} cy={hoverPt[1]} r={z(9)} fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth={z(1)}/>
              <line x1={hoverPt[0]-z(6)} y1={hoverPt[1]} x2={hoverPt[0]+z(6)} y2={hoverPt[1]} stroke="rgba(255,255,255,0.8)" strokeWidth={z(1)}/>
              <line x1={hoverPt[0]} y1={hoverPt[1]-z(6)} x2={hoverPt[0]} y2={hoverPt[1]+z(6)} stroke="rgba(255,255,255,0.8)" strokeWidth={z(1)}/>
            </g>
          : <circle cx={hoverPt[0]} cy={hoverPt[1]} r={z(5)} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth={z(1)}/>
      )}

      {/* ── Completed distances ── */}
      {distances.map(d=>{
        if(!d.points||d.points.length<2) return null;
        const [p1,p2]=d.points;
        const mx=(p1[0]+p2[0])/2, my=(p1[1]+p2[1])/2;
        const isErr=errIds.has(d.id);
        const col=isErr?T.r:T.blue;
        return (
          <g key={d.id}>
            <line x1={p1[0]} y1={p1[1]} x2={p2[0]} y2={p2[1]} stroke={col} strokeWidth={z(1.8)} opacity={0.85}/>
            <circle cx={p1[0]} cy={p1[1]} r={z(4)} fill={col} opacity={0.9}/>
            <circle cx={p2[0]} cy={p2[1]} r={z(4)} fill={col} opacity={0.9}/>
            <rect x={mx-z(26)} y={my-z(9)} width={z(52)} height={z(15)} rx={z(3)} fill="rgba(6,6,8,0.88)" stroke={col} strokeWidth={z(0.8)}/>
            <text x={mx} y={my+z(3)} fontSize={z(10)} fill={col} textAnchor="middle" fontFamily={T.mono}>{d.value} cm{isErr?" !":" "}</text>
          </g>
        );
      })}

      {/* ── Completed measurements ── */}
      {measurements.map(m=>{
        if(!m.points||m.points.length<2||m.result==null) return null;
        const [p1,p2]=m.points;
        const mx=(p1[0]+p2[0])/2, my=(p1[1]+p2[1])/2;
        const col=cc[m.confidence]||T.tx2;
        return (
          <g key={m.id}>
            <line x1={p1[0]} y1={p1[1]} x2={p2[0]} y2={p2[1]} stroke={col} strokeWidth={z(2.5)} opacity={0.9}/>
            <circle cx={p1[0]} cy={p1[1]} r={z(5)} fill={col} opacity={0.9}/>
            <circle cx={p2[0]} cy={p2[1]} r={z(5)} fill={col} opacity={0.9}/>
            <rect x={mx-z(32)} y={my-z(10)} width={z(64)} height={z(16)} rx={z(3)} fill="rgba(6,6,8,0.9)" stroke={col} strokeWidth={z(0.8)}/>
            <text x={mx} y={my+z(4)} fontSize={z(11)} fill={col} textAnchor="middle" fontFamily={T.mono}>{disp(m.result)}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── INLINE FORM ──────────────────────────────────────────────────────────────
function InlineForm({ form, zoom, pan, onSubmit, onCancel }) {
  const { type, draft } = form;
  const anchor = type==="corner" ? draft.vertex : draft.points[1];
  const [cx,cy] = imgToContainer(anchor,zoom,pan);

  const [label,setLabel]     = useState("");
  const [leftLen,setLeftLen] = useState("");
  const [rightLen,setRightLen]=useState("");
  const [upLen,setUpLen]     = useState("");
  const [val,setVal]         = useState("");
  const [plane,setPlane]     = useState("floor");

  const inp = {background:T.s3,border:`1px solid ${T.bd2}`,borderRadius:4,color:T.tx,
    fontFamily:T.mono,fontSize:11,padding:"3px 7px",outline:"none",width:"100%",boxSizing:"border-box"};
  const lbl = {fontSize:9,color:T.tx2,marginBottom:2,display:"block"};
  const btn = (acc)=>({background:acc?T.accDim:T.s2,border:`1px solid ${acc?T.acc:T.bd}`,
    color:acc?T.acc:T.tx2,borderRadius:4,padding:"4px 10px",fontSize:10,fontFamily:T.mono,cursor:"pointer"});
  const pbtn = (active)=>({...btn(active),flex:1,padding:"2px 0",textAlign:"center"});

  function submit() {
    onSubmit({label,leftLen:parseFloat(leftLen)||0,rightLen:parseFloat(rightLen)||0,
              upLen:parseFloat(upLen)||0,val:parseFloat(val)||0,plane});
  }

  // Position: right of anchor, clamped
  const left = Math.min(cx+14, window.innerWidth-260);
  const top  = Math.max(8, cy-60);

  return (
    <div style={{position:"absolute",left,top,width:230,background:T.s1,border:`1px solid ${T.acc}`,
                 borderRadius:7,padding:14,zIndex:20,fontFamily:T.font,boxShadow:"0 4px 24px rgba(0,0,0,0.6)"}}>
      <div style={{fontFamily:T.serif,fontSize:11,color:T.acc,marginBottom:10,letterSpacing:1}}>
        {type==="corner"?"Corner":""}
        {type==="distance"?"Distance":""}
        {type==="measure"?"Measurement":""}
      </div>

      <div style={{marginBottom:8}}>
        <label style={lbl}>Label (optional)</label>
        <input style={inp} value={label} onChange={e=>setLabel(e.target.value)} placeholder={
          type==="corner"?`Corner ${Date.now()%100}`:type==="distance"?"e.g. Wall width":"e.g. Window"
        } autoFocus/>
      </div>

      {type==="corner"&&(
        <div>
          <div style={{fontSize:9,color:T.tx2,marginBottom:6}}>Enter edge lengths if known (cm)</div>
          <div style={{display:"flex",gap:6,marginBottom:6}}>
            <div style={{flex:1}}>
              <label style={{...lbl,color:T.acc}}>Left (L)</label>
              <input style={inp} type="number" value={leftLen} onChange={e=>setLeftLen(e.target.value)} placeholder="cm"/>
            </div>
            <div style={{flex:1}}>
              <label style={{...lbl,color:T.acc2}}>Right (R)</label>
              <input style={inp} type="number" value={rightLen} onChange={e=>setRightLen(e.target.value)} placeholder="cm"/>
            </div>
            <div style={{flex:1}}>
              <label style={{...lbl,color:T.g}}>Up (U)</label>
              <input style={inp} type="number" value={upLen} onChange={e=>setUpLen(e.target.value)} placeholder="cm"/>
            </div>
          </div>
        </div>
      )}

      {type==="distance"&&(
        <div style={{marginBottom:8}}>
          <label style={lbl}>Distance (cm) *</label>
          <input style={inp} type="number" value={val} onChange={e=>setVal(e.target.value)} placeholder="e.g. 380"/>
        </div>
      )}

      {(type==="distance"||type==="measure")&&(
        <div style={{marginBottom:10}}>
          <label style={lbl}>Surface</label>
          <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
            {PLANES.map(p=>(
              <button key={p} style={pbtn(plane===p)} onClick={()=>setPlane(p)}>{PL[p].split(" ")[0]}</button>
            ))}
          </div>
        </div>
      )}

      <div style={{display:"flex",gap:8,marginTop:4}}>
        <button style={btn(false)} onClick={onCancel}>Cancel</button>
        <button style={{...btn(true),flex:1}} onClick={submit}
          disabled={type==="distance"&&!(parseFloat(val)>0)}>
          {type==="measure"?"Measure":"Save"}
        </button>
      </div>
    </div>
  );
}


// ─── TOOLBAR BUTTON ───────────────────────────────────────────────────────────
function ToolBtn({ label, icon, active, danger, onClick }) {
  return (
    <button onClick={onClick} style={{
      display:"flex",alignItems:"center",gap:5,padding:"5px 10px",
      background:active?T.accDim:danger?"rgba(217,95,95,0.15)":T.s2,
      border:`1px solid ${active?T.acc:danger?T.r:T.bd2}`,
      color:active?T.acc:danger?T.r:T.tx2,
      borderRadius:5,fontSize:11,fontFamily:T.mono,cursor:"pointer",
      transition:"all 0.12s",
    }}>
      {icon}{label}
    </button>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function CelebrimborRuler() {
  useFonts();
  const navigate = useNavigate();

  // Data
  const [corners,     setCorners]     = useState([]);
  const [distances,   setDistances]   = useState([]);
  const [measurements,setMeasurements]= useState([]);
  const [image,       setImage]       = useState(null);

  // Canvas transform
  const [zoom, setZoom] = useState(1);
  const [pan,  setPan]  = useState({x:0,y:0});

  // Drawing
  const [mode,          setMode]          = useState("idle");
  const [pendingPoints, setPendingPoints] = useState([]);
  const [hoverPt,       setHoverPt]       = useState(null);
  const [isSnapping,    setIsSnapping]    = useState(false);
  const [inlineForm,    setInlineForm]    = useState(null);

  // Units / persistence
  const [units,    setUnits]    = useState("cm");
  const [sessId,   setSessId]   = useState(null);
  const [saving,   setSaving]   = useState(false);

  // Refs
  const containerRef = useRef(null);
  const fileRef      = useRef(null);
  const isPanning    = useRef(false);
  const panButton    = useRef(null); // which button triggered pan: 0=left,1=mid,2=right
  const panStart     = useRef(null);
  const didDrag      = useRef(false);
  const mouseDownPos = useRef(null);

  // Calibration (derived)
  const cal = useMemo(()=>computeCalibration(corners,distances),[corners,distances]);

  // ── Image loading ──────────────────────────────────────────────────────────
  function loadFile(file) {
    if (!file||!file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setImage({src:url, w:img.naturalWidth, h:img.naturalHeight});
      if (!containerRef.current) return;
      const cr = containerRef.current.getBoundingClientRect();
      const z = Math.min((cr.width-40)/img.naturalWidth,(cr.height-40)/img.naturalHeight,1);
      setZoom(z);
      setPan({x:(cr.width-img.naturalWidth*z)/2, y:(cr.height-img.naturalHeight*z)/2});
    };
    img.src = url;
  }

  useEffect(()=>{
    const fn = e => { const item=[...e.clipboardData.items].find(i=>i.type.startsWith("image/")); if(item)loadFile(item.getAsFile()); };
    window.addEventListener("paste",fn);
    return ()=>window.removeEventListener("paste",fn);
  },[]);

  // ── Zoom / pan ─────────────────────────────────────────────────────────────
  function onWheel(e) {
    e.preventDefault();
    const f = e.deltaY<0?1.12:1/1.12;
    const nz = Math.max(0.05,Math.min(20,zoom*f));
    const cr = containerRef.current.getBoundingClientRect();
    const mx=e.clientX-cr.left, my=e.clientY-cr.top;
    setPan(prev=>({x:mx-(mx-prev.x)*(nz/zoom), y:my-(my-prev.y)*(nz/zoom)}));
    setZoom(nz);
  }

  function onMouseDown(e) {
    if (e.button===1||e.button===2) { // middle or right -- always pan, any mode
      isPanning.current=true; panButton.current=e.button;
      panStart.current={x:e.clientX-pan.x,y:e.clientY-pan.y};
      e.preventDefault(); return;
    }
    if (e.button===0) {
      mouseDownPos.current={x:e.clientX,y:e.clientY}; didDrag.current=false;
      if (mode==="idle") { // left drag pans only in idle
        isPanning.current=true; panButton.current=0;
        panStart.current={x:e.clientX-pan.x,y:e.clientY-pan.y};
      }
    }
  }

  function onMouseMove(e) {
    // Track drag distance (left button)
    if (mouseDownPos.current&&(e.buttons&1)) {
      if (Math.hypot(e.clientX-mouseDownPos.current.x,e.clientY-mouseDownPos.current.y)>5)
        didDrag.current=true;
    }
    // Pan: right/middle pans in any mode; left pans only in idle
    if (isPanning.current&&(panButton.current!==0||mode==="idle"))
      setPan({x:e.clientX-panStart.current.x, y:e.clientY-panStart.current.y});
    // Hover for draw modes
    if (mode!=="idle"&&!inlineForm&&containerRef.current&&image) {
      const cr=containerRef.current.getBoundingClientRect();
      const raw=screenToImg(e.clientX,e.clientY,zoom,pan,cr);
      const pool=snapPoints(corners,distances);
      const snapped=findSnap(raw,pool,zoom);
      setHoverPt(snapped||raw); setIsSnapping(!!snapped);
    } else { setHoverPt(null); setIsSnapping(false); }
  }

  function onMouseUp() { isPanning.current=false; mouseDownPos.current=null; }

  // ── Point placement ────────────────────────────────────────────────────────
  function onCanvasClick(e) {
    if (!image||!containerRef.current) return;
    if (mode==="idle"||inlineForm) return;
    if (didDrag.current) return;
    if (e.button!==0) return;

    const cr=containerRef.current.getBoundingClientRect();
    const raw=screenToImg(e.clientX,e.clientY,zoom,pan,cr);
    const pool=snapPoints(corners,distances);
    const pt=findSnap(raw,pool,zoom)||raw;
    const newPts=[...pendingPoints,pt];

    if (mode==="corner") {
      if (newPts.length<4) { setPendingPoints(newPts); return; }
      const [vertex,left,right,up]=newPts;
      setInlineForm({type:"corner", draft:{vertex,left,right,up}});
      setPendingPoints([]);
    }
    if (mode==="distance") {
      if (newPts.length<2) { setPendingPoints(newPts); return; }
      setInlineForm({type:"distance", draft:{points:newPts.slice(0,2)}});
      setPendingPoints([]);
    }
    if (mode==="measure") {
      if (newPts.length<2) { setPendingPoints(newPts); return; }
      setInlineForm({type:"measure", draft:{points:newPts.slice(0,2)}});
      setPendingPoints([]);
    }
  }

  // ── Inline form submit ─────────────────────────────────────────────────────
  function submitForm(values) {
    if (!inlineForm) return;
    const {type,draft} = inlineForm;

    if (type==="corner") {
      const {vertex,left,right,up}=draft;
      const id=uid();
      setCorners(prev=>[...prev,{id,label:values.label||`Corner ${prev.length+1}`,vertex,left,right,up}]);
      // Auto-create distance refs from entered edge lengths
      const autoDists=[];
      if (values.leftLen>0) autoDists.push({id:uid(),label:"Left edge",plane:"floor",points:[vertex,left],value:values.leftLen});
      if (values.rightLen>0) autoDists.push({id:uid(),label:"Right edge",plane:"floor",points:[vertex,right],value:values.rightLen});
      if (values.upLen>0) autoDists.push({id:uid(),label:"Up edge",plane:"frontWall",points:[vertex,up],value:values.upLen});
      if (autoDists.length) setDistances(prev=>[...prev,...autoDists]);
    }

    if (type==="distance") {
      if (!(values.val>0)) { closeForm(); return; }
      setDistances(prev=>[...prev,{id:uid(),label:values.label||`Ref ${prev.length+1}`,plane:values.plane,points:draft.points,value:values.val}]);
    }

    if (type==="measure") {
      const pl=cal?.planes[values.plane];
      const result=pl?.H?measureDistance(pl.H,draft.points[0],draft.points[1]):null;
      const conf=measConfidence(draft.points,cal,values.plane);
      setMeasurements(prev=>[...prev,{id:uid(),label:values.label||`M${prev.length+1}`,plane:values.plane,points:draft.points,result,confidence:conf}]);
    }

    closeForm();
  }

  function closeForm() {
    setInlineForm(null); setMode("idle"); setPendingPoints([]);
  }

  function startMode(m) {
    setMode(m); setPendingPoints([]); setInlineForm(null);
  }

  function cancelMode() {
    setMode("idle"); setPendingPoints([]); setInlineForm(null); setHoverPt(null);
  }

  // ── Export ─────────────────────────────────────────────────────────────────
  function exportPNG() {
    if (!image) return;
    const cv=document.createElement("canvas");
    cv.width=image.w; cv.height=image.h;
    const ctx=cv.getContext("2d");
    const img=new Image();
    img.onload=()=>{
      ctx.drawImage(img,0,0);
      const cc={high:T.g,medium:T.y,low:T.r};
      // Draw corners
      for (const c of corners) {
        if (!c.vertex) continue;
        ctx.lineWidth=2;
        const pairs=[[c.left,T.acc],[c.right,T.acc2],[c.up,T.g]];
        for (const [ep,col] of pairs) {
          if (!ep) continue;
          ctx.strokeStyle=col; ctx.beginPath(); ctx.moveTo(c.vertex[0],c.vertex[1]); ctx.lineTo(ep[0],ep[1]); ctx.stroke();
        }
        ctx.fillStyle="#ffffff"; ctx.beginPath(); ctx.arc(c.vertex[0],c.vertex[1],6,0,Math.PI*2); ctx.fill();
      }
      // Draw measurements
      for (const m of measurements) {
        if (!m.points||m.points.length<2||m.result==null) continue;
        const [p1,p2]=m.points;
        const col=cc[m.confidence]||"#888";
        ctx.strokeStyle=col; ctx.lineWidth=2.5;
        ctx.beginPath(); ctx.moveTo(p1[0],p1[1]); ctx.lineTo(p2[0],p2[1]); ctx.stroke();
        const mx=(p1[0]+p2[0])/2,my=(p1[1]+p2[1])/2;
        const lab=units==="in"?(m.result/2.54).toFixed(2)+'"':m.result.toFixed(1)+" cm";
        ctx.fillStyle="rgba(6,6,8,0.85)"; ctx.fillRect(mx-36,my-11,72,18);
        ctx.fillStyle=col; ctx.font="12px monospace"; ctx.textAlign="center"; ctx.fillText(lab,mx,my+4);
      }
      const a=document.createElement("a"); a.download="celebrimbor-ruler.png"; a.href=cv.toDataURL("image/png"); a.click();
    };
    img.src=image.src;
  }

  // ── Supabase ───────────────────────────────────────────────────────────────
  async function saveSession() {
    setSaving(true);
    try {
      const state={corners,distances,measurements,units};
      if (sessId) { await supabase.from("celebrimbor_sessions").update({state,updated_at:new Date().toISOString()}).eq("id",sessId); }
      else { const {data}=await supabase.from("celebrimbor_sessions").insert({state}).select("id").single(); if(data)setSessId(data.id); }
    } catch(err){console.error(err);}
    setSaving(false);
  }

  // ── Rendering helpers ──────────────────────────────────────────────────────
  const disp = v => v==null?"--":units==="in"?(v/2.54).toFixed(2)+'"':v.toFixed(1)+" cm";
  const confCol = {high:T.g,medium:T.y,low:T.r};

  const calPlanes = PLANES.filter(p=>!!cal?.planes[p]);
  const errIds = new Set((cal?.errors||[]).map(e=>e.distId));

  const PanelSection = ({label,count,children})=>(
    <div style={{marginBottom:14}}>
      <div style={{fontFamily:T.serif,fontSize:9,color:T.acc,letterSpacing:2,textTransform:"uppercase",marginBottom:6,display:"flex",alignItems:"center",gap:6}}>
        {label}{count>0&&<span style={{fontSize:8,color:T.tx3,background:T.s3,borderRadius:10,padding:"0 5px"}}>{count}</span>}
      </div>
      {children}
    </div>
  );

  const DelBtn = ({onClick})=>(
    <button onClick={onClick} style={{background:"none",border:"none",color:T.tx3,cursor:"pointer",fontSize:12,padding:"0 2px",lineHeight:1,flexShrink:0}}>x</button>
  );

  const statusMsg = () => {
    if (!image) return null;
    if (mode==="corner") return CORNER_STEPS[pendingPoints.length]||"";
    if (mode==="distance") return pendingPoints.length===0?"Click start point":"Click end point";
    if (mode==="measure") return pendingPoints.length===0?"Click start point":"Click end point";
    return null;
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{display:"flex",height:"100vh",background:T.bg,fontFamily:T.font,overflow:"hidden",color:T.tx}}>

      {/* ── Canvas ── */}
      <div ref={containerRef}
           style={{flex:1,position:"relative",overflow:"hidden",
                   cursor:mode==="idle"?"grab":"crosshair"}}
           onMouseDown={onMouseDown} onMouseMove={onMouseMove}
           onMouseUp={onMouseUp}   onMouseLeave={onMouseUp}
           onClick={onCanvasClick}  onWheel={onWheel}
           onDrop={e=>{e.preventDefault();loadFile(e.dataTransfer.files[0]);}}
           onDragOver={e=>e.preventDefault()}
           onContextMenu={e=>e.preventDefault()}>

        {/* Drop/paste prompt */}
        {!image&&(
          <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12,color:T.tx2,userSelect:"none"}}>
            <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke={T.acc} strokeWidth="0.9" opacity="0.45">
              <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
            </svg>
            <div style={{fontSize:13}}>Paste a photo (Ctrl+V) or drag &amp; drop</div>
            <button style={{background:T.s2,border:`1px solid ${T.bd2}`,color:T.tx2,borderRadius:4,padding:"5px 14px",fontSize:11,fontFamily:T.mono,cursor:"pointer"}}
              onClick={()=>fileRef.current?.click()}>Browse file</button>
            <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>loadFile(e.target.files[0])}/>
          </div>
        )}

        {/* Image + overlay */}
        {image&&(
          <div style={{position:"absolute",transformOrigin:"0 0",transform:`translate(${pan.x}px,${pan.y}px) scale(${zoom})`}}>
            <img src={image.src} width={image.w} height={image.h}
                 style={{display:"block",userSelect:"none",pointerEvents:"none"}} draggable={false} alt=""/>
            <Overlay imageW={image.w} imageH={image.h}
                     corners={corners} distances={distances} measurements={measurements}
                     mode={mode} pendingPoints={pendingPoints}
                     hoverPt={hoverPt} isSnapping={isSnapping}
                     zoom={zoom} units={units} cal={cal}/>
          </div>
        )}

        {/* Toolbar */}
        {image&&!inlineForm&&(
          <div style={{position:"absolute",top:12,left:12,display:"flex",gap:6,zIndex:10}}>
            <ToolBtn label="Corner" active={mode==="corner"} onClick={()=>mode==="corner"?cancelMode():startMode("corner")}
              icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 5v14M5 12h14"/></svg>}/>
            <ToolBtn label="Distance" active={mode==="distance"} onClick={()=>mode==="distance"?cancelMode():startMode("distance")}
              icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="9" x2="4" y2="15"/><line x1="20" y1="9" x2="20" y2="15"/></svg>}/>
            {calPlanes.length>0&&(
              <ToolBtn label="Measure" active={mode==="measure"} onClick={()=>mode==="measure"?cancelMode():startMode("measure")}
                icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="9" width="20" height="6" rx="1"/><line x1="6" y1="9" x2="6" y2="12"/><line x1="10" y1="9" x2="10" y2="11"/><line x1="14" y1="9" x2="14" y2="11"/><line x1="18" y1="9" x2="18" y2="12"/></svg>}/>
            )}
          </div>
        )}

        {/* Status bar */}
        {statusMsg()&&!inlineForm&&(
          <div style={{position:"absolute",bottom:16,left:"50%",transform:"translateX(-50%)",
                       background:"rgba(14,14,18,0.92)",border:`1px solid ${T.acc}`,
                       borderRadius:6,padding:"6px 16px",display:"flex",alignItems:"center",gap:14,zIndex:10}}>
            <span style={{fontSize:11,color:T.acc,fontFamily:T.mono}}>{statusMsg()}</span>
            <button style={{background:"none",border:`1px solid ${T.bd}`,color:T.tx3,borderRadius:4,padding:"2px 8px",fontSize:10,fontFamily:T.mono,cursor:"pointer"}}
              onClick={cancelMode}>Cancel</button>
          </div>
        )}

        {/* Zoom hint */}
        {image&&(
          <div style={{position:"absolute",bottom:14,right:14,fontSize:9,color:T.tx3,fontFamily:T.mono,background:"rgba(14,14,18,0.7)",borderRadius:4,padding:"2px 7px"}}>
            {Math.round(zoom*100)}% &nbsp;· scroll=zoom · drag=pan · mid-click=pan
          </div>
        )}

        {/* Inline form (positioned in canvas space) */}
        {inlineForm&&(
          <InlineForm form={inlineForm} zoom={zoom} pan={pan}
                      onSubmit={submitForm} onCancel={closeForm}/>
        )}
      </div>

      {/* ── Right panel ── */}
      <div style={{width:288,background:T.s1,borderLeft:`1px solid ${T.bd}`,display:"flex",flexDirection:"column",overflow:"hidden"}}>

        {/* Header */}
        <div style={{padding:"13px 15px 9px",borderBottom:`1px solid ${T.bd}`,flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:1}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.acc} strokeWidth="1.5">
              <rect x="2" y="9" width="20" height="6" rx="1"/><line x1="6" y1="9" x2="6" y2="12"/>
              <line x1="10" y1="9" x2="10" y2="11"/><line x1="14" y1="9" x2="14" y2="11"/>
              <line x1="18" y1="9" x2="18" y2="12"/>
            </svg>
            <span style={{fontFamily:T.serif,fontSize:13,color:T.acc,letterSpacing:1}}>Celebrimbor's Ruler</span>
          </div>
          <div style={{fontSize:9,color:T.tx3,marginLeft:23}}>Single-image metrology</div>
          <button onClick={()=>navigate("/")} style={{marginTop:7,fontSize:9,color:T.tx3,background:"none",border:"none",cursor:"pointer",padding:0,fontFamily:T.mono}}>-- hub</button>
        </div>

        {/* Scrollable body */}
        <div style={{flex:1,overflowY:"auto",padding:"12px 14px"}}>
          <RoomDiagram cal={cal}/>
          <div style={{height:1,background:T.bd,margin:"8px 0 12px"}}/>

          {/* Corners */}
          <PanelSection label="Corners" count={corners.length}>
            {corners.length===0&&<div style={{fontSize:10,color:T.tx3,marginBottom:8}}>Use the Corner tool to draw room corners. Each corner anchors the 3D geometry.</div>}
            {corners.map(c=>(
              <div key={c.id} style={{background:T.s2,border:`1px solid ${T.bd2}`,borderRadius:5,padding:"6px 9px",marginBottom:5}}>
                <div style={{display:"flex",alignItems:"center",gap:5}}>
                  <svg width="9" height="9" viewBox="0 0 12 12"><circle cx="6" cy="6" r="5" fill="#ffffff" stroke={T.acc} strokeWidth="1.5"/></svg>
                  <span style={{fontSize:11,color:T.tx,flex:1}}>{c.label}</span>
                  <DelBtn onClick={()=>setCorners(p=>p.filter(x=>x.id!==c.id))}/>
                </div>
                <div style={{fontSize:9,color:T.tx3,marginTop:2,fontFamily:T.mono,display:"flex",gap:8}}>
                  <span style={{color:T.acc}}>L ✓</span>
                  <span style={{color:T.acc2}}>R ✓</span>
                  <span style={{color:T.g}}>U ✓</span>
                </div>
              </div>
            ))}
          </PanelSection>

          {/* Distances */}
          <PanelSection label="References" count={distances.length}>
            {distances.length===0&&<div style={{fontSize:10,color:T.tx3,marginBottom:8}}>Add reference distances to calibrate real-world scale. Use the Distance tool, or enter edge lengths when placing a corner.</div>}
            {distances.map(d=>{
              const isErr=errIds.has(d.id);
              return (
                <div key={d.id} style={{background:T.s2,border:`1px solid ${isErr?T.r:T.bd}`,borderRadius:5,padding:"6px 9px",marginBottom:5}}>
                  <div style={{display:"flex",alignItems:"center",gap:5}}>
                    <span style={{fontSize:11,color:isErr?T.r:T.tx,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.label}</span>
                    <span style={{fontSize:10,fontFamily:T.mono,color:T.acc2,flexShrink:0}}>{d.value} cm</span>
                    <DelBtn onClick={()=>setDistances(p=>p.filter(x=>x.id!==d.id))}/>
                  </div>
                  <div style={{fontSize:9,color:isErr?T.r:T.tx3,fontFamily:T.mono,marginTop:2}}>
                    {PL[d.plane]}{isErr&&" -- conflicts with other refs"}
                  </div>
                </div>
              );
            })}
          </PanelSection>

          {/* Measurements */}
          <PanelSection label="Measurements" count={measurements.length}>
            {measurements.length===0&&(
              <div style={{fontSize:10,color:T.tx3,marginBottom:8}}>
                {calPlanes.length===0?"Calibrate at least one surface first (2 corners + a reference distance).":"Use the Measure tool to click two points and get a real-world distance."}
              </div>
            )}
            {measurements.map(m=>(
              <div key={m.id} style={{background:T.s2,border:`1px solid ${T.bd}`,borderRadius:5,padding:"6px 9px",marginBottom:5}}>
                <div style={{display:"flex",alignItems:"center",gap:5}}>
                  <span style={{width:7,height:7,borderRadius:"50%",background:confCol[m.confidence]||T.tx3,display:"inline-block",flexShrink:0}}/>
                  <span style={{fontSize:11,color:T.tx,flex:1}}>{m.label}</span>
                  <span style={{fontSize:12,fontFamily:T.mono,color:m.result!=null?T.acc2:T.tx3,flexShrink:0}}>{disp(m.result)}</span>
                  <DelBtn onClick={()=>setMeasurements(p=>p.filter(x=>x.id!==m.id))}/>
                </div>
                <div style={{fontSize:9,color:T.tx3,marginTop:2,fontFamily:T.mono}}>
                  {PL[m.plane]} &nbsp;
                  <span style={{color:confCol[m.confidence]||T.tx3}}>{m.confidence} conf.</span>
                </div>
              </div>
            ))}
          </PanelSection>
        </div>

        {/* Footer */}
        <div style={{borderTop:`1px solid ${T.bd}`,padding:"10px 14px",flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
            <span style={{fontSize:10,color:T.tx2,marginRight:2}}>Units</span>
            {["cm","in"].map(u=>(
              <button key={u} style={{background:units===u?T.accDim:T.s2,border:`1px solid ${units===u?T.acc:T.bd}`,color:units===u?T.acc:T.tx2,borderRadius:4,padding:"3px 10px",fontSize:10,fontFamily:T.mono,cursor:"pointer"}}
                onClick={()=>setUnits(u)}>{u}</button>
            ))}
          </div>
          <div style={{display:"flex",gap:6,marginBottom:6}}>
            <button style={{flex:1,background:T.s2,border:`1px solid ${T.bd}`,color:T.tx2,borderRadius:4,padding:"5px",fontSize:10,fontFamily:T.mono,cursor:"pointer"}}
              onClick={exportPNG} disabled={!image}>Export PNG</button>
            <button style={{flex:1,background:T.s2,border:`1px solid ${T.bd}`,color:T.tx2,borderRadius:4,padding:"5px",fontSize:10,fontFamily:T.mono,cursor:"pointer"}}
              onClick={saveSession} disabled={saving}>{saving?"Saving...":"Save session"}</button>
          </div>
          {sessId&&<div style={{fontSize:8,color:T.tx3,fontFamily:T.mono,wordBreak:"break-all"}}>Session: {sessId}</div>}
        </div>
      </div>
    </div>
  );
}
