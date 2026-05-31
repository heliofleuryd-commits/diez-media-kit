import { getFormationSlots } from '@/lib/football/formations';
import type { SceneState } from '@/lib/football/types';

const homeSlots = getFormationSlots('4-3-3', 'home').map(s => ({ ...s, playerId: null }));
const awaySlots = getFormationSlots('4-4-2', 'away').map(s => ({ ...s, playerId: null }));

export const TEST_SCENE: SceneState = {
  id: 'test-barca-vs-madrid',
  name: 'Barça 4-3-3 vs Madrid 4-4-2',
  mode: 'two-team',
  teams: {
    home: {
      formation: '4-3-3',
      primaryColor: '#a50044',   // Barça red ring
      secondaryColor: '#004d98', // Barça blue fill
      slots: homeSlots,
    },
    away: {
      formation: '4-4-2',
      primaryColor: '#ffd700',   // Madrid gold ring
      secondaryColor: '#f5f5f5', // Madrid white fill
      slots: awaySlots,
    },
  },
  ball: { ownerSlot: 'home.CM', position: null },
  markers: [],
};
