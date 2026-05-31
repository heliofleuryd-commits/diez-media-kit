'use client';

import { useCurrentFrame } from 'remotion';
import { pitchToCanvas } from './Pitch';
import { windowOpacity, arrowProgress } from '@/lib/football/animation';
import type { AnimationAction } from '@/lib/football/types';

interface AnimationLayerProps {
  actions: AnimationAction[];
}

// ── Zone Highlight ──────────────────────────────────────────────────────────
function ZoneHighlight({ action, frame }: { action: AnimationAction; frame: number }) {
  const { bounds, start, end, fadeIn, fadeOut } = action as { bounds: number[]; start: number; end: number; fadeIn?: number; fadeOut?: number };
  const opacity = windowOpacity(frame, start, end, fadeIn ?? 0.4, fadeOut ?? 0.5);
  if (opacity === 0) return null;

  const [x1, y1, x2, y2] = bounds;
  const [cx1, cy1] = pitchToCanvas(x1, y1);
  const [cx2, cy2] = pitchToCanvas(x2, y2);

  return (
    <g opacity={opacity}>
      <rect
        x={cx1} y={cy1}
        width={cx2 - cx1} height={cy2 - cy1}
        fill="rgba(255,80,0,0.28)"
        stroke="#cc2200"
        strokeWidth={3}
        rx={4}
      />
    </g>
  );
}

// ── Arrow helper (SVG arrowhead + line) ─────────────────────────────────────
function ArrowShape({
  from, to, style = 'thick-white', progress = 1,
}: {
  from: [number, number]; to: [number, number]; style?: string; progress?: number;
}) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const len = Math.sqrt(dx*dx + dy*dy);
  if (len === 0) return null;

  const ux = dx / len;
  const uy = dy / len;

  // Shorten tip by arrowhead size
  const headLen = style === 'thick-white' ? 28 : 16;
  const ex = from[0] + dx * progress;
  const ey = from[1] + dy * progress;
  const tipX = ex - ux * headLen * progress;
  const tipY = ey - uy * headLen * progress;

  const isThick = style === 'thick-white';
  const strokeW = isThick ? 8 : 3;
  const strokeColor = 'white';
  const dashArray = style === 'thin-dashed' ? '10,6' : undefined;

  // Perpendicular for arrowhead wings
  const pw = isThick ? 14 : 8;
  const nx = -uy; const ny = ux;

  const arrowPts = [
    `${ex},${ey}`,
    `${tipX + nx*pw},${tipY + ny*pw}`,
    `${tipX - nx*pw},${tipY - ny*pw}`,
  ].join(' ');

  return (
    <g filter="url(#arrowShadow)">
      <line
        x1={from[0]} y1={from[1]}
        x2={tipX} y2={tipY}
        stroke={strokeColor}
        strokeWidth={strokeW}
        strokeDasharray={dashArray}
        strokeLinecap="round"
      />
      <polygon points={arrowPts} fill={strokeColor} />
    </g>
  );
}

// ── Arrow ────────────────────────────────────────────────────────────────────
function Arrow({ action, frame }: { action: AnimationAction; frame: number }) {
  const { from, to, start, end, style } = action as { from: number[]; to: number[]; start: number; end: number; style?: string };
  const opacity = windowOpacity(frame, start, end, 0.3, 0.4);
  if (opacity === 0) return null;
  const prog = arrowProgress(frame, start, end);

  const [fx, fy] = pitchToCanvas(from[0], from[1]);
  const [tx, ty] = pitchToCanvas(to[0], to[1]);

  return (
    <g opacity={opacity}>
      <ArrowShape from={[fx, fy]} to={[tx, ty]} style={(style as string) || 'thick-white'} progress={prog} />
    </g>
  );
}

// ── ArrowsBurst ─────────────────────────────────────────────────────────────
function ArrowsBurst({ action, frame }: { action: AnimationAction; frame: number }) {
  const { positions, direction, start, end } = action as {
    positions: number[][];
    direction: 'up' | 'down' | 'left' | 'right';
    start: number; end: number;
  };
  const opacity = windowOpacity(frame, start, end, 0.3, 0.4);
  if (opacity === 0) return null;
  const prog = arrowProgress(frame, start, end);

  const offsets: Record<string, [number, number]> = {
    up:    [0,  -14],
    down:  [0,   14],
    left:  [-14,  0],
    right: [ 14,  0],
  };
  const [ox, oy] = offsets[direction] ?? [0, -14];

  return (
    <g opacity={opacity}>
      {positions.map((pos, i) => {
        const [cx, cy] = pitchToCanvas(pos[0], pos[1]);
        return (
          <ArrowShape key={i} from={[cx, cy]} to={[cx + ox * 5, cy + oy * 5]} style="thick-white" progress={prog} />
        );
      })}
    </g>
  );
}

// ── MarkerPulse ──────────────────────────────────────────────────────────────
function MarkerPulse({ action, frame }: { action: AnimationAction; frame: number }) {
  const { position, color = '#e53e3e', start, end } = action as { position: number[]; color?: string; start: number; end: number };
  const opacity = windowOpacity(frame, start, end, 0.2, 0.3);
  if (opacity === 0) return null;

  const [cx, cy] = pitchToCanvas(position[0], position[1]);
  // Pulse: radius oscillates
  const sf = start * 30;
  const pf = ((frame - sf) % 30) / 30; // 0-1 per second
  const pulseR = 10 + pf * 14;
  const pulseOp = (1 - pf) * 0.5;

  return (
    <g opacity={opacity}>
      <circle cx={cx} cy={cy} r={pulseR} fill={color} opacity={pulseOp} />
      <circle cx={cx} cy={cy} r={8}  fill={color} />
      <circle cx={cx} cy={cy} r={3}  fill="white" />
    </g>
  );
}

// ── Label ────────────────────────────────────────────────────────────────────
function Label({ action, frame }: { action: AnimationAction; frame: number }) {
  const { text, position, start, end } = action as { text: string; position: number[]; start: number; end: number };
  const opacity = windowOpacity(frame, start, end, 0.25, 0.35);
  if (opacity === 0) return null;

  const [cx, cy] = pitchToCanvas(position[0], position[1]);

  return (
    <g opacity={opacity}>
      <rect x={cx - 40} y={cy - 15} width={80} height={28} rx={5} fill="rgba(0,0,0,0.65)" />
      <text
        x={cx} y={cy + 5}
        textAnchor="middle"
        fontSize={18}
        fontFamily="'Arial Black', Arial, sans-serif"
        fontWeight="900"
        fill="white"
        letterSpacing={1}
      >
        {text as string}
      </text>
    </g>
  );
}

// ── Master AnimationLayer ─────────────────────────────────────────────────────
export function AnimationLayer({ actions }: AnimationLayerProps) {
  const frame = useCurrentFrame();

  return (
    <>
      <defs>
        <filter id="arrowShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="rgba(0,0,0,0.5)" />
        </filter>
      </defs>
      {actions.map((action, i) => {
        switch (action.type) {
          case 'zoneHighlight': return <ZoneHighlight key={i} action={action} frame={frame} />;
          case 'arrow':         return <Arrow         key={i} action={action} frame={frame} />;
          case 'arrowsBurst':   return <ArrowsBurst   key={i} action={action} frame={frame} />;
          case 'markerPulse':   return <MarkerPulse   key={i} action={action} frame={frame} />;
          case 'label':         return <Label         key={i} action={action} frame={frame} />;
          default:              return null;
        }
      })}
    </>
  );
}
