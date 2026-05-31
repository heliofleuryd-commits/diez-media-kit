'use client';

interface BallProps {
  x: number;
  y: number;
  size?: number;
}

export function Ball({ x, y, size = 26 }: BallProps) {
  const r = size / 2;
  const uid = `b-${Math.round(x)}-${Math.round(y)}`;

  const patches = [
    { cx: 0, cy: 0, s: 0.36 },
    { cx: 0, cy: -0.52, s: 0.28 },
    { cx: 0.45, cy: -0.26, s: 0.28 },
    { cx: 0.45, cy: 0.26, s: 0.28 },
    { cx: 0, cy: 0.52, s: 0.28 },
    { cx: -0.45, cy: 0.26, s: 0.28 },
    { cx: -0.45, cy: -0.26, s: 0.28 },
  ];

  return (
    <g>
      <defs>
        <radialGradient id={`bd-${uid}`} cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="70%" stopColor="#f0f0f0" />
          <stop offset="100%" stopColor="#d5d5d5" />
        </radialGradient>
        <clipPath id={`bc-${uid}`}>
          <circle cx={x} cy={y} r={r - 0.5} />
        </clipPath>
      </defs>
      <circle cx={x} cy={y} r={r + 7} fill="rgba(255,255,255,0.09)" />
      <ellipse cx={x + 2} cy={y + r + 4} rx={r * 0.85} ry={r * 0.18} fill="rgba(0,0,0,0.45)" />
      <circle cx={x} cy={y} r={r} fill={`url(#bd-${uid})`} />
      <g clipPath={`url(#bc-${uid})`}>
        {patches.map((p, i) => {
          const pr = r * p.s;
          const px2 = x + p.cx * r;
          const py2 = y + p.cy * r;
          const pts = Array.from({ length: 5 }, (_, k) => {
            const a = (k * 72 - 90) * Math.PI / 180;
            return `${px2 + pr * Math.cos(a)},${py2 + pr * Math.sin(a)}`;
          }).join(' ');
          return <polygon key={i} points={pts} fill="#111" opacity="0.88" />;
        })}
      </g>
      <ellipse cx={x - r * 0.25} cy={y - r * 0.25} rx={r * 0.3} ry={r * 0.2}
        fill="rgba(255,255,255,0.65)" transform={`rotate(-30,${x - r * 0.25},${y - r * 0.25})`} />
      <ellipse cx={x - r * 0.38} cy={y - r * 0.36} rx={r * 0.1} ry={r * 0.07}
        fill="rgba(255,255,255,0.9)" />
    </g>
  );
}
