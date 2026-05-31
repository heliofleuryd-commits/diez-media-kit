import { Composition } from 'remotion';
import { TacticsScene } from '../app/components/football/TacticsScene';
import type { SceneState, AnimationAction } from '../lib/football/types';
import { TEST_SCENE } from '../app/components/football/testScene';
import { SAMPLE_ANIMATION, SAMPLE_DURATION } from '../app/components/football/sampleAnimation';

interface TacticsProps {
  scene: SceneState;
  actions: AnimationAction[];
}

export function RemotionRoot() {
  return (
    <Composition<TacticsProps>
      id="TacticsScene"
      component={TacticsScene}
      width={1080}
      height={1920}
      fps={30}
      durationInFrames={SAMPLE_DURATION * 30}
      defaultProps={{ scene: TEST_SCENE, actions: SAMPLE_ANIMATION }}
    />
  );
}
