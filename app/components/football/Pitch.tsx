'use client';

// Pitch fills 1080×1152 (top 60% of 1080×1920 canvas)
// Inner pitch area with 40px H padding, 28px V padding

const W = 1080;
const H = 1152;
const PAD_X = 48;
const PAD_Y = 32;

const PW = W - PAD_X * 2; // 984
const PH = H - PAD_Y * 2; // 1088

const STRIPE_COUNT = 10;
const STRIPE_H = PH / STRIPE_COUNT;

const LIGHT = '#4ba355';
const DARK  = '#3d9148';
const LINE  = 'rgba(255,255,255,0.92)';
const LINE_W = 3;

// pitch-relative helpers
function px(x: number) { return PAD_X + (x / 100) * PW; }
function py(y: number) { return PAD_Y + (y / 100) * PH; }

export function Pitch() {
  const penaltyW = (40.32 / 68) * PW;
  const penaltyH = (16.5 / 105) * PH;
  const goalAreaW = (18.32 / 68) * PW;
  const goalAreaH = (5.5 / 105) * PH;
  const goalW     = (7.32 / 68) * PW;
  const goalDepth = 18;
  const centerR   = (9.15 / 68) * PW;
  const spotR     = 4;
  const cornerR   = (1 / 68) * PW;
  const penSpotY  = (11 / 105) * PH;

  const penL = PAD_X + (PW - penaltyW) / 2;
  const goalL = PAD_X + (PW - goalAreaW) / 2;
  const goalPostL = PAD_X + (PW - goalW) / 2;
  const cx = PAD_X + PW / 2;
  const cy = PAD_Y + PH / 2;

  const arcRadius = (9.15 / 105) * PH;

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      style={{ display: 'block' }}
    >
      {/* background */}
      <rect width={W} height={H} fill={LIGHT} />

      {/* alternating horizontal stripes */}
      {Array.from({ length: STRIPE_COUNT }, (_, i) => (
        <rect
          key={i}
          x={PAD_X}
          y={PAD_Y + i * STRIPE_H}
          width={PW}
          height={STRIPE_H}
          fill={i % 2 === 0 ? LIGHT : DARK}
        />
      ))}

      {/* ── lines ── */}

      {/* outer boundary */}
      <rect x={PAD_X} y={PAD_Y} width={PW} height={PH} fill="none" stroke={LINE} strokeWidth={LINE_W} />

      {/* halfway line */}
      <line x1={PAD_X} y1={cy} x2={PAD_X + PW} y2={cy} stroke={LINE} strokeWidth={LINE_W} />

      {/* center circle */}
      <circle cx={cx} cy={cy} r={centerR} fill="none" stroke={LINE} strokeWidth={LINE_W} />

      {/* center spot */}
      <circle cx={cx} cy={cy} r={spotR} fill={LINE} />

      {/* ── HOME penalty area (bottom) ── */}
      <rect
        x={penL} y={PAD_Y + PH - penaltyH}
        width={penaltyW} height={penaltyH}
        fill="none" stroke={LINE} strokeWidth={LINE_W}
      />
      {/* HOME goal area */}
      <rect
        x={goalL} y={PAD_Y + PH - goalAreaH}
        width={goalAreaW} height={goalAreaH}
        fill="none" stroke={LINE} strokeWidth={LINE_W}
      />
      {/* HOME penalty spot */}
      <circle cx={cx} cy={PAD_Y + PH - penSpotY} r={spotR} fill={LINE} />
      {/* HOME penalty arc */}
      <path
        d={`M ${penL} ${PAD_Y + PH - penaltyH} A ${arcRadius} ${arcRadius} 0 0 0 ${penL + penaltyW} ${PAD_Y + PH - penaltyH}`}
        fill="none" stroke={LINE} strokeWidth={LINE_W}
        clipPath="url(#clipBottom)"
      />
      <defs>
        <clipPath id="clipBottom">
          <rect x={0} y={0} width={W} height={PAD_Y + PH - penaltyH} />
        </clipPath>
      </defs>

      {/* HOME goal */}
      <rect
        x={goalPostL} y={PAD_Y + PH}
        width={goalW} height={goalDepth}
        fill="none" stroke={LINE} strokeWidth={LINE_W}
      />

      {/* ── AWAY penalty area (top) ── */}
      <rect
        x={penL} y={PAD_Y}
        width={penaltyW} height={penaltyH}
        fill="none" stroke={LINE} strokeWidth={LINE_W}
      />
      {/* AWAY goal area */}
      <rect
        x={goalL} y={PAD_Y}
        width={goalAreaW} height={goalAreaH}
        fill="none" stroke={LINE} strokeWidth={LINE_W}
      />
      {/* AWAY penalty spot */}
      <circle cx={cx} cy={PAD_Y + penSpotY} r={spotR} fill={LINE} />
      {/* AWAY penalty arc */}
      <path
        d={`M ${penL} ${PAD_Y + penaltyH} A ${arcRadius} ${arcRadius} 0 0 1 ${penL + penaltyW} ${PAD_Y + penaltyH}`}
        fill="none" stroke={LINE} strokeWidth={LINE_W}
        clipPath="url(#clipTop)"
      />
      <defs>
        <clipPath id="clipTop">
          <rect x={0} y={PAD_Y + penaltyH} width={W} height={H} />
        </clipPath>
      </defs>

      {/* AWAY goal */}
      <rect
        x={goalPostL} y={PAD_Y - goalDepth}
        width={goalW} height={goalDepth}
        fill="none" stroke={LINE} strokeWidth={LINE_W}
      />

      {/* corner arcs */}
      <path d={`M ${PAD_X + cornerR} ${PAD_Y} A ${cornerR} ${cornerR} 0 0 0 ${PAD_X} ${PAD_Y + cornerR}`} fill="none" stroke={LINE} strokeWidth={LINE_W} />
      <path d={`M ${PAD_X + PW - cornerR} ${PAD_Y} A ${cornerR} ${cornerR} 0 0 1 ${PAD_X + PW} ${PAD_Y + cornerR}`} fill="none" stroke={LINE} strokeWidth={LINE_W} />
      <path d={`M ${PAD_X} ${PAD_Y + PH - cornerR} A ${cornerR} ${cornerR} 0 0 0 ${PAD_X + cornerR} ${PAD_Y + PH}`} fill="none" stroke={LINE} strokeWidth={LINE_W} />
      <path d={`M ${PAD_X + PW} ${PAD_Y + PH - cornerR} A ${cornerR} ${cornerR} 0 0 1 ${PAD_X + PW - cornerR} ${PAD_Y + PH}`} fill="none" stroke={LINE} strokeWidth={LINE_W} />
    </svg>
  );
}

// Convert normalized 0-100 pitch coords to canvas pixel coords (within 1080×1152)
export function pitchToCanvas(x: number, y: number): [number, number] {
  return [PAD_X + (x / 100) * PW, PAD_Y + (y / 100) * PH];
}
