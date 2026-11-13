import { pockets, radius, type Ball } from './physics';

export const pocketDropDuration = 0.28;
export const pocketDropImpact = 0.13;

export function startPocketDrop(ball: Ball, strength: number) {
  const pocket = pockets.reduce((closest, candidate) =>
    Math.hypot(ball.x - candidate.x, ball.z - candidate.z) < Math.hypot(ball.x - closest.x, ball.z - closest.z)
      ? candidate : closest);
  return { x: ball.x, z: ball.z, pocket, strength, elapsed: 0 };
}

export function pocketDropPose(drop: ReturnType<typeof startPocketDrop>) {
  const progress = Math.min(1, drop.elapsed / pocketDropDuration);
  const inward = 1 - (1 - progress) ** 2;
  return {
    x: drop.x + (drop.pocket.x - drop.x) * inward,
    z: drop.z + (drop.pocket.z - drop.z) * inward,
    y: radius - 0.17 * progress ** 2,
    scale: 1 - 0.8 * progress ** 2,
    opacity: 1 - progress ** 2,
  };
}

export type PocketDropPose = ReturnType<typeof pocketDropPose>;
