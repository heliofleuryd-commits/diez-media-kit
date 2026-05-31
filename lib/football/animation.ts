import { interpolate, Easing } from 'remotion';
import type { SceneState, AnimationAction, Vec2 } from './types';

// Smooth deceleration — players accelerate then coast to a stop, like real football movement
const EASE = Easing.bezier(0.4, 0, 0.25, 1);

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

// Parse "home.CM" → { team: 'home', slotId: 'CM' }
export function parsePlayerId(pid: string): { team: 'home' | 'away'; slotId: string } | null {
  const [team, ...rest] = pid.split('.');
  if (team !== 'home' && team !== 'away') return null;
  return { team: team as 'home' | 'away', slotId: rest.join('.') };
}

// Base position of a player slot in the scene
function basePos(pid: string, scene: SceneState): Vec2 {
  const parsed = parsePlayerId(pid);
  if (!parsed) return [50, 50];
  const team = scene.teams[parsed.team];
  if (!team) return [50, 50];
  const slot = team.slots.find(s => s.slotId === parsed.slotId);
  return slot ? slot.position : [50, 50];
}

// Get a player's position at a given frame, applying all move + dribble actions
export function getPlayerPos(pid: string, frame: number, scene: SceneState, actions: AnimationAction[]): Vec2 {
  let pos: Vec2 = basePos(pid, scene);

  for (const a of actions) {
    if (a.type === 'move' && a.playerId === pid) {
      const sf = (a.start as number) * 30;
      const ef = (a.end as number) * 30;
      if (frame < sf) continue;
      if (frame >= ef) { pos = a.to as Vec2; continue; }
      const t = interpolate(frame, [sf, ef], [0, 1], { easing: EASE, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
      pos = [lerp((a.from as Vec2)[0], (a.to as Vec2)[0], t), lerp((a.from as Vec2)[1], (a.to as Vec2)[1], t)];
    }

    if (a.type === 'dribble' && a.playerId === pid) {
      const path = a.path as Vec2[];
      if (!path || path.length < 2) continue;
      const sf = (a.start as number) * 30;
      const ef = (a.end as number) * 30;
      if (frame < sf) continue;
      if (frame >= ef) { pos = path[path.length - 1]; continue; }
      const t = interpolate(frame, [sf, ef], [0, 1], { easing: EASE, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
      const totalSegs = path.length - 1;
      const scaled = t * totalSegs;
      const segIdx = Math.min(Math.floor(scaled), totalSegs - 1);
      const segT = scaled - segIdx;
      pos = [lerp(path[segIdx][0], path[segIdx + 1][0], segT), lerp(path[segIdx][1], path[segIdx + 1][1], segT)];
    }
  }

  return pos;
}

// Resolve the effective ball owner at a given frame by chaining completed passes
function resolveOwner(frame: number, scene: SceneState, actions: AnimationAction[]): string | null {
  // Sort passes by start time so we process them in chronological order
  const passes = actions
    .filter(a => a.type === 'pass')
    .sort((a, b) => (a.start as number) - (b.start as number));

  let owner: string | null = scene.ball.ownerSlot ?? null;

  for (const p of passes) {
    const ef = (p.end as number) * 30;
    // Once this pass has fully completed, transfer ownership
    if (frame > ef) {
      owner = p.toPlayerId as string;
    }
  }

  return owner;
}

// Get ball position at a given frame
export function getBallPos(frame: number, scene: SceneState, actions: AnimationAction[]): Vec2 {
  const passes = actions
    .filter(a => a.type === 'pass')
    .sort((a, b) => (a.start as number) - (b.start as number));

  // Check for an active pass — ball is in flight along a bezier arc
  for (const p of passes) {
    const sf = (p.start as number) * 30;
    const ef = (p.end as number) * 30;
    if (frame < sf || frame > ef) continue;

    const fromPos = getPlayerPos(p.fromPlayerId as string, sf, scene, actions);
    const toPos   = getPlayerPos(p.toPlayerId   as string, ef, scene, actions);
    const t = interpolate(frame, [sf, ef], [0, 1], { easing: EASE, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

    // Arc: midpoint lifted toward attacking direction
    const curve = (p.curve as number) ?? 0.4;
    const mx = lerp(fromPos[0], toPos[0], 0.5);
    const my = lerp(fromPos[1], toPos[1], 0.5) - curve * 10;
    const bx = (1-t)*(1-t)*fromPos[0] + 2*(1-t)*t*mx + t*t*toPos[0];
    const by = (1-t)*(1-t)*fromPos[1] + 2*(1-t)*t*my + t*t*toPos[1];
    return [bx, by];
  }

  // Ball stays with dribbling player during a dribble
  for (const d of actions) {
    if (d.type !== 'dribble') continue;
    const sf = (d.start as number) * 30;
    const ef = (d.end as number) * 30;
    if (frame >= sf && frame <= ef) {
      return getPlayerPos(d.playerId as string, frame, scene, actions);
    }
  }

  // Default: follow the effective owner (accounts for completed passes)
  const owner = resolveOwner(frame, scene, actions);
  if (owner) return getPlayerPos(owner, frame, scene, actions);

  return scene.ball.position ?? [50, 50];
}

// Ball owner at a given frame (used for the indicator dot on player tokens)
export function getBallOwner(frame: number, scene: SceneState, actions: AnimationAction[]): string | null {
  const passes = actions
    .filter(a => a.type === 'pass')
    .sort((a, b) => (a.start as number) - (b.start as number));

  // During an active pass the ball is airborne — no player "has" it
  for (const p of passes) {
    const sf = (p.start as number) * 30;
    const ef = (p.end as number) * 30;
    if (frame >= sf && frame <= ef) return null;
  }

  // Use the same ownership chain as getBallPos
  return resolveOwner(frame, scene, actions);
}

// Opacity for elements that fade in/out within a time window
export function windowOpacity(frame: number, start: number, end: number, fadeIn = 0.3, fadeOut = 0.4): number {
  const sf = start * 30;
  const ef = end * 30;
  if (frame < sf || frame > ef) return 0;
  const fadeInFrames  = fadeIn  * 30;
  const fadeOutFrames = fadeOut * 30;
  if (frame < sf + fadeInFrames)  return interpolate(frame, [sf, sf + fadeInFrames], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  if (frame > ef - fadeOutFrames) return interpolate(frame, [ef - fadeOutFrames, ef], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return 1;
}

// Arrow "draw-on" progress (0 = not drawn, 1 = fully drawn)
export function arrowProgress(frame: number, start: number, end: number): number {
  const sf = start * 30;
  const ef = end * 30;
  if (frame < sf) return 0;
  if (frame > ef) return 1;
  return interpolate(frame, [sf, sf + Math.min(18, (ef-sf) * 0.5)], [0, 1], { easing: EASE, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
}
