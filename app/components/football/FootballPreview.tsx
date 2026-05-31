'use client';

import dynamic from 'next/dynamic';
import { TacticsScene } from './TacticsScene';
import type { SceneState, AnimationAction } from '@/lib/football/types';

const Player = dynamic(
  () => import('@remotion/player').then(m => m.Player),
  { ssr: false }
);

interface FootballPreviewProps {
  scene: SceneState;
  actions?: AnimationAction[];
  durationSeconds?: number;
  height?: number;
  playerKey?: string;
  fill?: boolean; // fills 100% of parent container
}

export function FootballPreview({ scene, actions = [], durationSeconds = 6, height = 720, playerKey, fill }: FootballPreviewProps) {
  const durationInFrames = durationSeconds * 30;
  const key = playerKey ?? `${durationInFrames}`;

  if (fill) {
    return (
      <div className="w-full h-full overflow-hidden">
        <Player
          key={key}
          component={TacticsScene}
          compositionWidth={1080}
          compositionHeight={1920}
          durationInFrames={durationInFrames}
          fps={30}
          inputProps={{ scene, actions }}
          style={{ width: '100%', height: '100%' }}
          controls
          loop
          autoPlay
        />
      </div>
    );
  }

  const width = Math.round((height * 9) / 16);
  return (
    <div style={{ width, height, flexShrink: 0 }} className="rounded-xl shadow-2xl ring-1 ring-black/10">
      <Player
        key={key}
        component={TacticsScene}
        compositionWidth={1080}
        compositionHeight={1920}
        durationInFrames={durationInFrames}
        fps={30}
        inputProps={{ scene, actions }}
        style={{ width: '100%', height: '100%' }}
        controls
        loop
        autoPlay
      />
    </div>
  );
}
