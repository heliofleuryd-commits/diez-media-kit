'use client';

import type { AnimationAction } from '@/lib/football/types';

const TYPE_COLOR: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  move:           { bg: '#dbeafe', border: '#3b82f6', text: '#1d4ed8', dot: '#3b82f6' },
  pass:           { bg: '#dcfce7', border: '#22c55e', text: '#15803d', dot: '#22c55e' },
  dribble:        { bg: '#fef9c3', border: '#eab308', text: '#a16207', dot: '#eab308' },
  zoneHighlight:  { bg: '#ffedd5', border: '#f97316', text: '#c2410c', dot: '#f97316' },
  arrow:          { bg: '#f1f5f9', border: '#94a3b8', text: '#475569', dot: '#94a3b8' },
  arrowsBurst:    { bg: '#f3e8ff', border: '#a855f7', text: '#7e22ce', dot: '#a855f7' },
  markerPulse:    { bg: '#fee2e2', border: '#ef4444', text: '#b91c1c', dot: '#ef4444' },
  label:          { bg: '#f8fafc', border: '#cbd5e1', text: '#64748b', dot: '#94a3b8' },
  formationShift: { bg: '#e0e7ff', border: '#6366f1', text: '#4338ca', dot: '#6366f1' },
};

const TYPE_ICON: Record<string, string> = {
  move: '→', pass: '⤷', dribble: '↝', zoneHighlight: '▭',
  arrow: '↑', arrowsBurst: '⤊', markerPulse: '◎', label: 'T', formationShift: '⊞',
};

function actionLabel(a: AnimationAction): string {
  switch (a.type) {
    case 'move':    return `${a.playerId.split('.')[1]} move`;
    case 'pass':    return `${a.fromPlayerId.split('.')[1]}→${a.toPlayerId.split('.')[1]}`;
    case 'dribble': return `${a.playerId.split('.')[1]} dribble`;
    case 'zoneHighlight': return 'zone';
    case 'arrow':   return 'arrow';
    case 'arrowsBurst': return 'burst';
    case 'markerPulse': return 'pulse';
    case 'label':   return `"${a.text}"`;
    case 'formationShift': return `→${a.toFormation}`;
    default: return (a as { type: string }).type;
  }
}

interface Props {
  actions: AnimationAction[];
  duration: number;
  selectedIdx: number | null;
  onSelect: (idx: number | null) => void;
}

const LABEL_W = 88; // px for the left label column
const ROW_H = 22;   // px per row
const RULER_H = 20; // px for ruler

export function AnimationTimeline({ actions, duration, selectedIdx, onSelect }: Props) {
  if (actions.length === 0) {
    return (
      <div className="w-full flex items-center justify-center h-14 text-[10px] text-gray-300 border-t border-gray-200 bg-gray-50">
        No actions · generate or load a sample animation
      </div>
    );
  }

  const totalSec = Math.max(duration, 1);
  // Build tick marks
  const ticks: number[] = [];
  const step = totalSec <= 6 ? 0.5 : totalSec <= 12 ? 1 : 2;
  for (let t = 0; t <= totalSec; t += step) ticks.push(Math.round(t * 10) / 10);

  const totalH = RULER_H + actions.length * ROW_H;

  return (
    <div className="w-full border-t border-gray-200 bg-[#16181c] select-none overflow-hidden flex flex-col">
      {/* Column layout: fixed label col + scrollable track area */}
      <div className="flex overflow-x-auto overflow-y-hidden" style={{ minHeight: totalH, maxHeight: 240 }}>
        {/* Label column */}
        <div className="shrink-0 flex flex-col" style={{ width: LABEL_W }}>
          {/* Ruler corner */}
          <div style={{ height: RULER_H }} className="border-b border-r border-[#2a2d35] bg-[#1a1c22]" />
          {/* Row labels */}
          {actions.map((a, i) => {
            const c = TYPE_COLOR[a.type] ?? TYPE_COLOR.arrow;
            const isSelected = selectedIdx === i;
            return (
              <div
                key={i}
                onClick={() => onSelect(isSelected ? null : i)}
                style={{ height: ROW_H, borderBottom: '1px solid #1e2128', background: isSelected ? '#1e2535' : '#16181c' }}
                className="flex items-center gap-1 px-2 cursor-pointer hover:bg-[#1e2128] transition-colors border-r border-[#2a2d35]"
              >
                <span style={{ color: c.dot, fontSize: 9, lineHeight: 1 }}>{TYPE_ICON[a.type] ?? '·'}</span>
                <span style={{ color: isSelected ? '#e2e8f0' : '#94a3b8', fontSize: 9, fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 62 }}>
                  {actionLabel(a)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Scrollable track area */}
        <div className="flex-1 relative overflow-x-auto overflow-y-hidden" style={{ minWidth: 0 }}>
          {/* We'll use a container whose width = fill available, no explicit px width needed */}
          <div className="relative" style={{ minWidth: '100%', height: totalH }}>
            {/* Ruler */}
            <div
              style={{ height: RULER_H, position: 'sticky', top: 0, zIndex: 10 }}
              className="border-b border-[#2a2d35] bg-[#1a1c22] relative overflow-hidden"
            >
              {ticks.map(t => (
                <div
                  key={t}
                  style={{ position: 'absolute', left: `${(t / totalSec) * 100}%`, top: 0, bottom: 0 }}
                  className="flex flex-col items-start"
                >
                  <div style={{ width: 1, height: t % 1 === 0 ? 8 : 4, background: t % 1 === 0 ? '#4b5563' : '#374151', marginTop: RULER_H - (t % 1 === 0 ? 8 : 4) }} />
                  {t % 1 === 0 && (
                    <span style={{ position: 'absolute', top: 2, left: 3, fontSize: 8, color: '#6b7280', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                      {t}s
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Vertical grid lines */}
            {ticks.filter(t => t % 1 === 0).map(t => (
              <div
                key={t}
                style={{ position: 'absolute', left: `${(t / totalSec) * 100}%`, top: RULER_H, bottom: 0, width: 1, background: '#1e2128', pointerEvents: 'none' }}
              />
            ))}

            {/* Action rows */}
            {actions.map((a, i) => {
              const c = TYPE_COLOR[a.type] ?? TYPE_COLOR.arrow;
              const isSelected = selectedIdx === i;
              const startPct = Math.max(0, Math.min(100, ((a.start as number) / totalSec) * 100));
              const endPct   = Math.max(0, Math.min(100, ((a.end   as number) / totalSec) * 100));
              const widthPct = Math.max(0.5, endPct - startPct);

              return (
                <div
                  key={i}
                  onClick={() => onSelect(isSelected ? null : i)}
                  style={{
                    position: 'absolute',
                    top: RULER_H + i * ROW_H,
                    left: 0,
                    right: 0,
                    height: ROW_H,
                    borderBottom: '1px solid #1e2128',
                    background: isSelected ? '#1e2535' : 'transparent',
                    cursor: 'pointer',
                  }}
                  className="hover:bg-[#1e2128] transition-colors"
                >
                  {/* Bar */}
                  <div
                    style={{
                      position: 'absolute',
                      left: `${startPct}%`,
                      width: `${widthPct}%`,
                      top: 3,
                      bottom: 3,
                      background: isSelected ? c.border : c.bg,
                      border: `1px solid ${c.border}`,
                      borderRadius: 3,
                      opacity: isSelected ? 1 : 0.85,
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      paddingLeft: 4,
                      minWidth: 6,
                    }}
                  >
                    <span style={{ fontSize: 8, color: isSelected ? '#fff' : c.text, fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {actionLabel(a)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer: selected action detail */}
      {selectedIdx !== null && actions[selectedIdx] && (() => {
        const a = actions[selectedIdx];
        const c = TYPE_COLOR[a.type] ?? TYPE_COLOR.arrow;
        return (
          <div style={{ borderTop: '1px solid #2a2d35', background: '#1a1c22' }} className="px-3 py-1.5 flex items-center gap-3 shrink-0">
            <span style={{ color: c.dot, fontSize: 10 }}>{TYPE_ICON[a.type]}</span>
            <span style={{ color: '#e2e8f0', fontSize: 9, fontFamily: 'monospace', fontWeight: 'bold' }}>{a.type}</span>
            <span style={{ color: '#6b7280', fontSize: 9 }}>
              {(a.start as number).toFixed(1)}s → {(a.end as number).toFixed(1)}s
              {' · '}
              {((a.end as number) - (a.start as number)).toFixed(1)}s duration
            </span>
            {'playerId' in a && <span style={{ color: '#94a3b8', fontSize: 9, fontFamily: 'monospace' }}>{(a as { playerId: string }).playerId}</span>}
            {'fromPlayerId' in a && <span style={{ color: '#94a3b8', fontSize: 9, fontFamily: 'monospace' }}>{(a as { fromPlayerId: string; toPlayerId: string }).fromPlayerId} → {(a as { fromPlayerId: string; toPlayerId: string }).toPlayerId}</span>}
            {'text' in a && <span style={{ color: '#94a3b8', fontSize: 9 }}>"{(a as { text: string }).text}"</span>}
          </div>
        );
      })()}
    </div>
  );
}
