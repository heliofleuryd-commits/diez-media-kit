export type Vec2 = [number, number]; // normalized 0-100 pitch coords

export interface PlayerSlot {
  slotId: string;
  position: Vec2;
  playerId: string | null;
}

export interface TeamConfig {
  formation: string;
  primaryColor: string;
  secondaryColor: string;
  slots: PlayerSlot[];
}

export interface BallState {
  ownerSlot: string | null;
  position: Vec2 | null;
}

export interface SceneState {
  id: string;
  name: string;
  mode: 'single-team' | 'two-team';
  teams: {
    home: TeamConfig;
    away?: TeamConfig;
  };
  ball: BallState;
  markers: Vec2[];
}

export interface AnimationAction {
  type: 'move' | 'pass' | 'dribble' | 'zoneHighlight' | 'arrow' | 'arrowsBurst' | 'markerPulse' | 'label' | 'formationShift';
  [key: string]: unknown;
}

export interface Player {
  id: string;
  name: string;
  fullName?: string;
  club: string;
  position: string;
  positionGroup?: 'GK' | 'DEF' | 'MID' | 'ATT';
  imageUrl: string | null;
  isCustom: boolean;
}
