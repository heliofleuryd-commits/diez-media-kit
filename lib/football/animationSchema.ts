import { z } from 'zod';

const Vec2 = z.tuple([z.number().min(0).max(100), z.number().min(0).max(100)]);
const timing = { start: z.number().min(0), end: z.number().min(0) };

const MoveAction = z.object({
  type: z.literal('move'),
  playerId: z.string(),
  from: Vec2,
  to: Vec2,
  ...timing,
  easing: z.string().optional(),
});

const PassAction = z.object({
  type: z.literal('pass'),
  fromPlayerId: z.string(),
  toPlayerId: z.string(),
  ...timing,
  curve: z.number().min(0).max(2).optional(),
});

const DribbleAction = z.object({
  type: z.literal('dribble'),
  playerId: z.string(),
  path: z.array(Vec2).min(2),
  ...timing,
});

const ZoneHighlightAction = z.object({
  type: z.literal('zoneHighlight'),
  bounds: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  ...timing,
  fadeIn: z.number().optional(),
  fadeOut: z.number().optional(),
});

const ArrowAction = z.object({
  type: z.literal('arrow'),
  from: Vec2,
  to: Vec2,
  ...timing,
  style: z.enum(['thick-white', 'thin-dashed', 'curved']).optional(),
});

const ArrowsBurstAction = z.object({
  type: z.literal('arrowsBurst'),
  positions: z.array(Vec2),
  direction: z.enum(['up', 'down', 'left', 'right']),
  ...timing,
});

const MarkerPulseAction = z.object({
  type: z.literal('markerPulse'),
  position: Vec2,
  color: z.string().optional(),
  ...timing,
});

const LabelAction = z.object({
  type: z.literal('label'),
  text: z.string().max(20),
  position: Vec2,
  ...timing,
});

const FormationShiftAction = z.object({
  type: z.literal('formationShift'),
  team: z.enum(['home', 'away']),
  toFormation: z.string(),
  ...timing,
});

export const AnimationActionSchema = z.discriminatedUnion('type', [
  MoveAction, PassAction, DribbleAction, ZoneHighlightAction,
  ArrowAction, ArrowsBurstAction, MarkerPulseAction, LabelAction, FormationShiftAction,
]);

export const AnimationPlanSchema = z.object({
  duration: z.number().min(1).max(12),
  actions: z.array(AnimationActionSchema),
});

export type AnimationPlan = z.infer<typeof AnimationPlanSchema>;

// Clip coords and timings to valid ranges
export function clampPlan(plan: AnimationPlan, validPlayerIds: Set<string>): AnimationPlan {
  const clipVec = (v: [number, number]): [number, number] =>
    [Math.max(0, Math.min(100, v[0])), Math.max(0, Math.min(100, v[1]))];

  const clipT = (t: number) => Math.max(0, Math.min(plan.duration, t));

  const actions = plan.actions
    .map(a => {
      const base = { ...a, start: clipT(a.start), end: clipT(a.end) };
      if (base.end <= base.start) return null;

      // Validate player IDs — drop unknowns
      if ('playerId' in base && !validPlayerIds.has(base.playerId as string)) return null;
      if ('fromPlayerId' in base && !validPlayerIds.has(base.fromPlayerId as string)) return null;
      if ('toPlayerId' in base && !validPlayerIds.has(base.toPlayerId as string)) return null;

      // Clip positions
      if ('from' in base) (base as { from: [number, number] }).from = clipVec(base.from as [number, number]);
      if ('to' in base) (base as { to: [number, number] }).to = clipVec(base.to as [number, number]);
      if ('position' in base) (base as { position: [number, number] }).position = clipVec(base.position as [number, number]);

      return base;
    })
    .filter(Boolean);

  return { ...plan, actions: actions as AnimationPlan['actions'] };
}
