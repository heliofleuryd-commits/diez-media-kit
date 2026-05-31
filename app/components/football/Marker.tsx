'use client';

interface MarkerProps {
  x: number;
  y: number;
  color?: string;
  size?: number;
  pulse?: boolean; // static for now; animated in Remotion composition
}

export function Marker({ x, y, color = '#e53e3e', size = 14 }: MarkerProps) {
  return (
    <g>
      {/* outer glow ring */}
      <circle cx={x} cy={y} r={size} fill={color} opacity={0.25} />
      {/* inner dot */}
      <circle cx={x} cy={y} r={size * 0.55} fill={color} />
    </g>
  );
}
