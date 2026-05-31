import type { AnimationAction } from '@/lib/football/types';

// Home = bottom half (y > 50), attacks UP. Positions match new wider formations.ts coords.
// LB[12,76] LCM[28,62] LW[14,38] CM[50,58] RCB[65,79] ST[50,32] RW[86,38]

export const SAMPLE_ANIMATION: AnimationAction[] = [
  // Left side press: LB, LCM, LW converge toward left channel
  {
    type: 'move',
    playerId: 'home.LB',
    from: [12, 76], to: [24, 62],
    start: 0, end: 2.0,
  },
  {
    type: 'move',
    playerId: 'home.LCM',
    from: [28, 62], to: [22, 52],
    start: 0.2, end: 2.2,
  },
  {
    type: 'move',
    playerId: 'home.LW',
    from: [14, 38], to: [18, 48],
    start: 0.3, end: 2.1,
  },

  // Press zone highlight — left channel
  {
    type: 'zoneHighlight',
    bounds: [5, 40, 38, 70],
    start: 0.8, end: 5.5,
    fadeIn: 0.4,
    fadeOut: 0.6,
  },

  // Label on the press zone
  {
    type: 'label',
    text: 'PRESS',
    position: [18, 50],
    start: 1.4, end: 5.0,
  },

  // CM passes to RCB at 2.4-3.4s
  {
    type: 'pass',
    fromPlayerId: 'home.CM',
    toPlayerId: 'home.RCB',
    start: 2.4,
    end: 3.4,
    curve: 0.25,
  },

  // RCB receives and drives forward
  {
    type: 'move',
    playerId: 'home.RCB',
    from: [65, 79], to: [62, 70],
    start: 3.5, end: 4.5,
  },

  // Front line push up
  {
    type: 'arrowsBurst',
    positions: [[86, 38], [50, 32], [18, 48]],
    direction: 'up',
    start: 3.8,
    end: 5.8,
  },

  // ST pushes into space
  {
    type: 'move',
    playerId: 'home.ST',
    from: [50, 32], to: [50, 22],
    start: 4.0, end: 5.5,
  },

  // RW tucks wider
  {
    type: 'move',
    playerId: 'home.RW',
    from: [86, 38], to: [90, 26],
    start: 4.1, end: 5.6,
  },

  // Marker on anticipated ball receipt zone
  {
    type: 'markerPulse',
    position: [50, 22],
    color: '#e53e3e',
    start: 4.8, end: 6.2,
  },
];

export const SAMPLE_DURATION = 7; // seconds
