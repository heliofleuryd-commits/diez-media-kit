'use client';

import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Pitch, pitchToCanvas } from './Pitch';
import { FaceCamZone } from './FaceCamZone';
import { PlayerToken } from './PlayerToken';
import { Marker } from './Marker';
import { Ball } from './Ball';
import { AnimationLayer } from './AnimationLayer';
import { getPlayerPos, getBallPos, getBallOwner } from '@/lib/football/animation';
import type { SceneState, AnimationAction } from '@/lib/football/types';

interface TacticsSceneProps {
  scene: SceneState;
  actions?: AnimationAction[];
}

export function TacticsScene({ scene, actions = [] }: TacticsSceneProps) {
  const frame = useCurrentFrame();
  const { teams, markers } = scene;

  const ballOwner = getBallOwner(frame, scene, actions);
  const ballNorm  = getBallPos(frame, scene, actions);
  const [ballX, ballY] = pitchToCanvas(ballNorm[0], ballNorm[1]);

  const renderTeam = (config: typeof teams.home, team: 'home' | 'away') => {
    return config.slots.map(slot => {
      const pid = `${team}.${slot.slotId}`;
      const pos = actions.length > 0
        ? getPlayerPos(pid, frame, scene, actions)
        : slot.position;
      const [cx, cy] = pitchToCanvas(pos[0], pos[1]);
      const hasBall = ballOwner === pid;

      return (
        <PlayerToken
          key={pid}
          x={cx}
          y={cy}
          primaryColor={config.secondaryColor}
          ringColor={config.primaryColor}
          label={slot.slotId}
          hasBall={hasBall}
        />
      );
    });
  };

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <svg
        width={1080}
        height={1920}
        viewBox="0 0 1080 1920"
        style={{ position: 'absolute', top: 0, left: 0 }}
      >
        {/* Pitch (top 60%) */}
        <Pitch />

        {/* Animation overlay: zones, arrows, labels */}
        <AnimationLayer actions={actions} />

        {/* Away team (rendered under home) */}
        {teams.away && renderTeam(teams.away, 'away')}

        {/* Home team */}
        {renderTeam(teams.home, 'home')}

        {/* Markers */}
        {markers.map(([mx, my], i) => {
          const [cx, cy] = pitchToCanvas(mx, my);
          return <Marker key={i} x={cx} y={cy} />;
        })}

        {/* Ball */}
        <Ball x={ballX} y={ballY} size={28} />

        {/* Face-cam black zone (bottom 40%) */}
        <FaceCamZone />
      </svg>
    </AbsoluteFill>
  );
}
