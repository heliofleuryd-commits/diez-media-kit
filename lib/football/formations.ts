import type { PlayerSlot } from './types';

export const FORMATIONS: Record<string, { slots: Omit<PlayerSlot, 'playerId'>[] }> = {
  '4-3-3': {
    slots: [
      { slotId: 'GK',  position: [50, 93] },
      { slotId: 'RB',  position: [88, 76] },
      { slotId: 'RCB', position: [65, 79] },
      { slotId: 'LCB', position: [35, 79] },
      { slotId: 'LB',  position: [12, 76] },
      { slotId: 'RCM', position: [72, 62] },
      { slotId: 'CM',  position: [50, 58] },
      { slotId: 'LCM', position: [28, 62] },
      { slotId: 'RW',  position: [86, 38] },
      { slotId: 'ST',  position: [50, 32] },
      { slotId: 'LW',  position: [14, 38] },
    ],
  },
  '4-4-2': {
    slots: [
      { slotId: 'GK',  position: [50, 93] },
      { slotId: 'RB',  position: [88, 76] },
      { slotId: 'RCB', position: [65, 79] },
      { slotId: 'LCB', position: [35, 79] },
      { slotId: 'LB',  position: [12, 76] },
      { slotId: 'RM',  position: [86, 60] },
      { slotId: 'RCM', position: [63, 62] },
      { slotId: 'LCM', position: [37, 62] },
      { slotId: 'LM',  position: [14, 60] },
      { slotId: 'RST', position: [64, 36] },
      { slotId: 'LST', position: [36, 36] },
    ],
  },
  '4-2-3-1': {
    slots: [
      { slotId: 'GK',  position: [50, 93] },
      { slotId: 'RB',  position: [88, 76] },
      { slotId: 'RCB', position: [65, 79] },
      { slotId: 'LCB', position: [35, 79] },
      { slotId: 'LB',  position: [12, 76] },
      { slotId: 'RDM', position: [64, 67] },
      { slotId: 'LDM', position: [36, 67] },
      { slotId: 'RAM', position: [76, 50] },
      { slotId: 'CAM', position: [50, 48] },
      { slotId: 'LAM', position: [24, 50] },
      { slotId: 'ST',  position: [50, 32] },
    ],
  },
  '3-5-2': {
    slots: [
      { slotId: 'GK',  position: [50, 93] },
      { slotId: 'RCB', position: [72, 79] },
      { slotId: 'CB',  position: [50, 80] },
      { slotId: 'LCB', position: [28, 79] },
      { slotId: 'RWB', position: [90, 62] },
      { slotId: 'RCM', position: [68, 60] },
      { slotId: 'CM',  position: [50, 57] },
      { slotId: 'LCM', position: [32, 60] },
      { slotId: 'LWB', position: [10, 62] },
      { slotId: 'RST', position: [65, 36] },
      { slotId: 'LST', position: [35, 36] },
    ],
  },
  '3-4-3': {
    slots: [
      { slotId: 'GK',  position: [50, 93] },
      { slotId: 'RCB', position: [72, 79] },
      { slotId: 'CB',  position: [50, 80] },
      { slotId: 'LCB', position: [28, 79] },
      { slotId: 'RWB', position: [88, 62] },
      { slotId: 'RCM', position: [65, 62] },
      { slotId: 'LCM', position: [35, 62] },
      { slotId: 'LWB', position: [12, 62] },
      { slotId: 'RW',  position: [82, 38] },
      { slotId: 'ST',  position: [50, 32] },
      { slotId: 'LW',  position: [18, 38] },
    ],
  },
  '4-3-2-1': {
    slots: [
      { slotId: 'GK',  position: [50, 93] },
      { slotId: 'RB',  position: [88, 76] },
      { slotId: 'RCB', position: [65, 79] },
      { slotId: 'LCB', position: [35, 79] },
      { slotId: 'LB',  position: [12, 76] },
      { slotId: 'RCM', position: [70, 65] },
      { slotId: 'CM',  position: [50, 63] },
      { slotId: 'LCM', position: [30, 65] },
      { slotId: 'RAM', position: [68, 48] },
      { slotId: 'LAM', position: [32, 48] },
      { slotId: 'ST',  position: [50, 32] },
    ],
  },
  '4-1-4-1': {
    slots: [
      { slotId: 'GK',  position: [50, 93] },
      { slotId: 'RB',  position: [88, 76] },
      { slotId: 'RCB', position: [65, 79] },
      { slotId: 'LCB', position: [35, 79] },
      { slotId: 'LB',  position: [12, 76] },
      { slotId: 'DM',  position: [50, 68] },
      { slotId: 'RM',  position: [86, 56] },
      { slotId: 'RCM', position: [63, 57] },
      { slotId: 'LCM', position: [37, 57] },
      { slotId: 'LM',  position: [14, 56] },
      { slotId: 'ST',  position: [50, 32] },
    ],
  },
  '5-3-2': {
    slots: [
      { slotId: 'GK',  position: [50, 93] },
      { slotId: 'RWB', position: [90, 74] },
      { slotId: 'RCB', position: [72, 79] },
      { slotId: 'CB',  position: [50, 81] },
      { slotId: 'LCB', position: [28, 79] },
      { slotId: 'LWB', position: [10, 74] },
      { slotId: 'RCM', position: [67, 58] },
      { slotId: 'CM',  position: [50, 56] },
      { slotId: 'LCM', position: [33, 58] },
      { slotId: 'RST', position: [65, 36] },
      { slotId: 'LST', position: [35, 36] },
    ],
  },
  '5-4-1': {
    slots: [
      { slotId: 'GK',  position: [50, 93] },
      { slotId: 'RWB', position: [90, 74] },
      { slotId: 'RCB', position: [72, 79] },
      { slotId: 'CB',  position: [50, 81] },
      { slotId: 'LCB', position: [28, 79] },
      { slotId: 'LWB', position: [10, 74] },
      { slotId: 'RM',  position: [82, 58] },
      { slotId: 'RCM', position: [62, 60] },
      { slotId: 'LCM', position: [38, 60] },
      { slotId: 'LM',  position: [18, 58] },
      { slotId: 'ST',  position: [50, 36] },
    ],
  },
  '4-4-1-1': {
    slots: [
      { slotId: 'GK',  position: [50, 93] },
      { slotId: 'RB',  position: [88, 76] },
      { slotId: 'RCB', position: [65, 79] },
      { slotId: 'LCB', position: [35, 79] },
      { slotId: 'LB',  position: [12, 76] },
      { slotId: 'RM',  position: [82, 60] },
      { slotId: 'RCM', position: [62, 62] },
      { slotId: 'LCM', position: [38, 62] },
      { slotId: 'LM',  position: [18, 60] },
      { slotId: 'SS',  position: [50, 47] },
      { slotId: 'ST',  position: [50, 33] },
    ],
  },
};

export function mirrorFormation(slots: Omit<PlayerSlot, 'playerId'>[]): Omit<PlayerSlot, 'playerId'>[] {
  return slots.map(s => ({
    slotId: s.slotId,
    position: [s.position[0], 100 - s.position[1]] as [number, number],
  }));
}

export function getFormationSlots(formation: string, team: 'home' | 'away'): Omit<PlayerSlot, 'playerId'>[] {
  const base = FORMATIONS[formation]?.slots ?? FORMATIONS['4-3-3'].slots;
  return team === 'away' ? mirrorFormation(base) : base;
}
