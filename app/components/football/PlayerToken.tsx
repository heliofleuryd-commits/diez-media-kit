'use client';

interface PlayerTokenProps {
  x: number;
  y: number;
  primaryColor: string;
  ringColor: string;
  label: string;
  hasBall?: boolean;
  imageUrl?: string | null;
  size?: number;
}

const DEFAULT_SIZE = 42;

export function PlayerToken({
  x, y,
  primaryColor, ringColor,
  label, hasBall = false,
  size = DEFAULT_SIZE,
}: PlayerTokenProps) {
  const r = size / 2;
  // Unique IDs per token position to avoid SVG filter conflicts
  const uid = `${label}-${Math.round(x)}-${Math.round(y)}`;
  const gradId     = `pg-${uid}`;
  const glowId     = `gl-${uid}`;

  const innerR = r * 0.88;
  const ringW  = r * 0.22;
  const fontSize = r * 0.68;

  return (
    <g>
      <defs>
        <radialGradient id={gradId} cx="38%" cy="32%" r="70%">
          <stop offset="0%"   stopColor="#ffffff" stopOpacity="0.25" />
          <stop offset="60%"  stopColor={primaryColor} stopOpacity="1" />
          <stop offset="100%" stopColor={primaryColor} stopOpacity="1" />
        </radialGradient>
        <filter id={glowId} x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Ambient glow halo */}
      <circle cx={x} cy={y} r={r + ringW + 8} fill={ringColor} opacity="0.15" />

      {/* Ground shadow */}
      <ellipse cx={x + 3} cy={y + r + ringW + 3} rx={r * 0.9} ry={r * 0.18} fill="rgba(0,0,0,0.5)" />

      {/* Glowing ring */}
      <circle cx={x} cy={y} r={r + ringW} fill={ringColor} filter={`url(#${glowId})`} />

      {/* Inner edge */}
      <circle cx={x} cy={y} r={r + 1.5} fill="rgba(0,0,0,0.3)" />

      {/* Disc */}
      <circle cx={x} cy={y} r={innerR} fill={`url(#${gradId})`} />

      {/* Glass sheen */}
      <ellipse
        cx={x - r * 0.1} cy={y - r * 0.2}
        rx={r * 0.4} ry={r * 0.2}
        fill="rgba(255,255,255,0.2)"
        transform={`rotate(-25,${x - r * 0.1},${y - r * 0.2})`}
      />

      {/* Label */}
      <text
        x={x} y={y}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={fontSize}
        fontFamily="'Arial Black','Arial',sans-serif"
        fontWeight="900"
        fill="#ffffff"
        stroke="rgba(0,0,0,0.45)"
        strokeWidth={fontSize * 0.07}
        paintOrder="stroke"
        style={{ userSelect: 'none' }}
      >
        {label}
      </text>

      {/* Ball indicator */}
      {hasBall && (
        <g>
          <circle cx={x} cy={y + r + ringW + 11} r={9} fill="rgba(255,215,0,0.3)" />
          <circle cx={x} cy={y + r + ringW + 11} r={5.5}
            fill="#ffe566" stroke="rgba(0,0,0,0.55)" strokeWidth={1.5} />
        </g>
      )}
    </g>
  );
}
