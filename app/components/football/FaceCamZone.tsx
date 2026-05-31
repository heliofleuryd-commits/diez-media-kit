'use client';

// Bottom 40% of 1080×1920 — solid black placeholder for face-cam in Premiere
const DIVIDER_Y = 1152;
const CANVAS_H = 1920;
const CANVAS_W = 1080;

export function FaceCamZone() {
  return (
    <g>
      <rect
        x={0}
        y={DIVIDER_Y}
        width={CANVAS_W}
        height={CANVAS_H - DIVIDER_Y}
        fill="#000000"
      />
      {/* optional 1px divider line */}
      <line
        x1={0} y1={DIVIDER_Y}
        x2={CANVAS_W} y2={DIVIDER_Y}
        stroke="rgba(255,255,255,0.2)"
        strokeWidth={1}
      />
    </g>
  );
}
