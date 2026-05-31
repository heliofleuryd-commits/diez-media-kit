'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { pitchToCanvas } from './Pitch';
import type { SceneState, Vec2 } from '@/lib/football/types';

// Pitch canvas constants (must match Pitch.tsx)
const PAD_X = 48, PAD_Y = 32, PW = 984, PH = 1088;
const PITCH_H_PX = 1152; // top 60% of 1920

interface PitchEditorProps {
  scene: SceneState;
  onUpdatePosition: (team: 'home' | 'away', slotId: string, pos: Vec2) => void;
  onSelectSlot: (team: 'home' | 'away', slotId: string) => void;
  selectedSlot: { team: 'home' | 'away'; slotId: string } | null;
  height?: number;
}

function screenToSVG(svg: SVGSVGElement, clientX: number, clientY: number) {
  const pt = svg.createSVGPoint();
  pt.x = clientX; pt.y = clientY;
  return pt.matrixTransform(svg.getScreenCTM()!.inverse());
}

function svgToPitch(svgX: number, svgY: number): Vec2 {
  const nx = Math.max(2, Math.min(98, (svgX - PAD_X) / PW * 100));
  const ny = Math.max(2, Math.min(98, (svgY - PAD_Y) / PH * 100));
  return [nx, ny];
}

// Striped pitch rendered inside the editor SVG
function EditorPitch() {
  const W = 1080, H = PITCH_H_PX;
  const STRIPE_COUNT = 10;
  const STRIPE_H = PH / STRIPE_COUNT;
  const LIGHT = '#4ba355', DARK = '#3d9148', LINE = 'rgba(255,255,255,0.92)';
  const LW = 3;

  const penaltyW = (40.32 / 68) * PW;
  const penaltyH = (16.5 / 105) * PH;
  const goalAreaW = (18.32 / 68) * PW;
  const goalAreaH = (5.5 / 105) * PH;
  const goalW = (7.32 / 68) * PW;
  const goalDepth = 18;
  const centerR = (9.15 / 68) * PW;
  const penSpotY = (11 / 105) * PH;
  const cx = PAD_X + PW / 2, cy = PAD_Y + PH / 2;
  const penL = PAD_X + (PW - penaltyW) / 2;
  const goalL = PAD_X + (PW - goalAreaW) / 2;
  const goalPostL = PAD_X + (PW - goalW) / 2;
  const cornerR = (1 / 68) * PW;
  const arcR = (9.15 / 105) * PH;

  return (
    <g>
      <rect width={W} height={H} fill={LIGHT} />
      {Array.from({ length: STRIPE_COUNT }, (_, i) => (
        <rect key={i} x={PAD_X} y={PAD_Y + i * STRIPE_H} width={PW} height={STRIPE_H} fill={i % 2 === 0 ? LIGHT : DARK} />
      ))}
      <rect x={PAD_X} y={PAD_Y} width={PW} height={PH} fill="none" stroke={LINE} strokeWidth={LW} />
      <line x1={PAD_X} y1={cy} x2={PAD_X + PW} y2={cy} stroke={LINE} strokeWidth={LW} />
      <circle cx={cx} cy={cy} r={centerR} fill="none" stroke={LINE} strokeWidth={LW} />
      <circle cx={cx} cy={cy} r={4} fill={LINE} />
      {/* Home penalty area */}
      <rect x={penL} y={PAD_Y + PH - penaltyH} width={penaltyW} height={penaltyH} fill="none" stroke={LINE} strokeWidth={LW} />
      <rect x={goalL} y={PAD_Y + PH - goalAreaH} width={goalAreaW} height={goalAreaH} fill="none" stroke={LINE} strokeWidth={LW} />
      <circle cx={cx} cy={PAD_Y + PH - penSpotY} r={4} fill={LINE} />
      <rect x={goalPostL} y={PAD_Y + PH} width={goalW} height={goalDepth} fill="none" stroke={LINE} strokeWidth={LW} />
      {/* Away penalty area */}
      <rect x={penL} y={PAD_Y} width={penaltyW} height={penaltyH} fill="none" stroke={LINE} strokeWidth={LW} />
      <rect x={goalL} y={PAD_Y} width={goalAreaW} height={goalAreaH} fill="none" stroke={LINE} strokeWidth={LW} />
      <circle cx={cx} cy={PAD_Y + penSpotY} r={4} fill={LINE} />
      <rect x={goalPostL} y={PAD_Y - goalDepth} width={goalW} height={goalDepth} fill="none" stroke={LINE} strokeWidth={LW} />
      {/* Arcs */}
      <path d={`M ${penL} ${PAD_Y + PH - penaltyH} A ${arcR} ${arcR} 0 0 0 ${penL + penaltyW} ${PAD_Y + PH - penaltyH}`} fill="none" stroke={LINE} strokeWidth={LW} clipPath="url(#ecb)" />
      <path d={`M ${penL} ${PAD_Y + penaltyH} A ${arcR} ${arcR} 0 0 1 ${penL + penaltyW} ${PAD_Y + penaltyH}`} fill="none" stroke={LINE} strokeWidth={LW} clipPath="url(#ect)" />
      <defs>
        <clipPath id="ecb"><rect x={0} y={0} width={W} height={PAD_Y + PH - penaltyH} /></clipPath>
        <clipPath id="ect"><rect x={0} y={PAD_Y + penaltyH} width={W} height={H} /></clipPath>
      </defs>
      {/* Corners */}
      <path d={`M ${PAD_X + cornerR} ${PAD_Y} A ${cornerR} ${cornerR} 0 0 0 ${PAD_X} ${PAD_Y + cornerR}`} fill="none" stroke={LINE} strokeWidth={LW} />
      <path d={`M ${PAD_X + PW - cornerR} ${PAD_Y} A ${cornerR} ${cornerR} 0 0 1 ${PAD_X + PW} ${PAD_Y + cornerR}`} fill="none" stroke={LINE} strokeWidth={LW} />
      <path d={`M ${PAD_X} ${PAD_Y + PH - cornerR} A ${cornerR} ${cornerR} 0 0 0 ${PAD_X + cornerR} ${PAD_Y + PH}`} fill="none" stroke={LINE} strokeWidth={LW} />
      <path d={`M ${PAD_X + PW} ${PAD_Y + PH - cornerR} A ${cornerR} ${cornerR} 0 0 1 ${PAD_X + PW - cornerR} ${PAD_Y + PH}`} fill="none" stroke={LINE} strokeWidth={LW} />
    </g>
  );
}

interface TokenProps {
  x: number; y: number;
  primaryColor: string; ringColor: string;
  label: string; name?: string;
  selected: boolean;
  hasBall?: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
}

function EditToken({ x, y, primaryColor, ringColor, label, name, selected, hasBall, onPointerDown }: TokenProps) {
  const size = 52, r = size / 2, ringW = size * 0.12;
  return (
    <g
      onPointerDown={onPointerDown}
      style={{ cursor: 'grab', userSelect: 'none' }}
    >
      {/* selection ring */}
      {selected && <circle cx={x} cy={y} r={r + ringW + 8} fill="none" stroke="#facc15" strokeWidth={4} strokeDasharray="6 3" />}
      <circle cx={x + 2} cy={y + 3} r={r} fill="rgba(0,0,0,0.35)" />
      <circle cx={x} cy={y} r={r + ringW} fill={ringColor} />
      <circle cx={x} cy={y} r={r} fill={primaryColor} />
      <text x={x} y={y} textAnchor="middle" dominantBaseline="central"
        fontSize={size * 0.3} fontFamily="Arial" fontWeight="900" fill="white" style={{ userSelect: 'none', pointerEvents: 'none' }}>
        {label}
      </text>
      {/* name badge */}
      {name && (
        <g>
          <rect x={x - 40} y={y + r + ringW + 6} width={80} height={20} rx={4} fill="rgba(0,0,0,0.55)" />
          <text x={x} y={y + r + ringW + 17} textAnchor="middle" fontSize={12} fill="white" fontFamily="Arial" fontWeight="700" style={{ userSelect: 'none', pointerEvents: 'none' }}>
            {name}
          </text>
        </g>
      )}
      {hasBall && (
        <>
          <circle cx={x} cy={y + r + ringW + 5} r={7} fill="white" stroke="#111" strokeWidth={1.5} />
          <circle cx={x} cy={y + r + ringW + 5} r={3} fill="#111" />
        </>
      )}
    </g>
  );
}

export function PitchEditor({ scene, onUpdatePosition, onSelectSlot, selectedSlot, height = 620 }: PitchEditorProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef<{ team: 'home' | 'away'; slotId: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  // Track if this was a drag (vs click)
  const didMove = useRef(false);

  const handlePointerDown = useCallback((team: 'home' | 'away', slotId: string, e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragging.current = { team, slotId };
    didMove.current = false;
    setIsDragging(true);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragging.current || !svgRef.current) return;
    didMove.current = true;
    const pt = screenToSVG(svgRef.current, e.clientX, e.clientY);
    // Only allow dragging within pitch area (top 60%)
    if (pt.y > PITCH_H_PX) return;
    const pos = svgToPitch(pt.x, pt.y);
    onUpdatePosition(dragging.current.team, dragging.current.slotId, pos);
  }, [onUpdatePosition]);

  const handlePointerUp = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (dragging.current && !didMove.current) {
      // It was a click → open picker
      onSelectSlot(dragging.current.team, dragging.current.slotId);
    }
    dragging.current = null;
    setIsDragging(false);
  }, [onSelectSlot]);

  const width = Math.round((height * 9) / 16);
  const viewH = 1920; // show full canvas including black zone

  const isSelected = (team: 'home' | 'away', slotId: string) =>
    selectedSlot?.team === team && selectedSlot?.slotId === slotId;

  const renderTeam = (config: typeof scene.teams.home, team: 'home' | 'away') =>
    config.slots.map(slot => {
      const [cx, cy] = pitchToCanvas(slot.position[0], slot.position[1]);
      const hasBall = scene.ball.ownerSlot === `${team}.${slot.slotId}`;
      // Show player name if assigned
      const playerName = slot.playerId
        ? slot.playerId.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).split(' ').slice(-1)[0]
        : undefined;
      return (
        <EditToken
          key={`${team}-${slot.slotId}`}
          x={cx} y={cy}
          primaryColor={config.secondaryColor}
          ringColor={config.primaryColor}
          label={slot.playerId ? slot.slotId : slot.slotId}
          name={playerName}
          selected={isSelected(team, slot.slotId)}
          hasBall={hasBall}
          onPointerDown={(e) => handlePointerDown(team, slot.slotId, e)}
        />
      );
    });

  return (
    <div
      style={{ width, height, flexShrink: 0, cursor: isDragging ? 'grabbing' : 'default' }}
      className="rounded-xl overflow-hidden shadow-2xl ring-1 ring-black/10"
    >
      <svg
        ref={svgRef}
        width={width}
        height={height}
        viewBox={`0 0 1080 ${viewH}`}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{ display: 'block', touchAction: 'none' }}
      >
        {/* Pitch */}
        <EditorPitch />

        {/* Away team */}
        {scene.teams.away && renderTeam(scene.teams.away, 'away')}
        {/* Home team */}
        {renderTeam(scene.teams.home, 'home')}

        {/* Black face-cam zone */}
        <rect x={0} y={PITCH_H_PX} width={1080} height={1920 - PITCH_H_PX} fill="#000" />
        <line x1={0} y1={PITCH_H_PX} x2={1080} y2={PITCH_H_PX} stroke="rgba(255,255,255,0.2)" strokeWidth={1} />

        {/* Hint text in black zone */}
        <text x={540} y={1152 + 60} textAnchor="middle" fontSize={28} fill="rgba(255,255,255,0.2)" fontFamily="Arial">
          face-cam zone (Premiere)
        </text>
      </svg>
    </div>
  );
}
