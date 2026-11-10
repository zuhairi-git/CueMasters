import type { BallOrientation } from './physics';

type Point = [number, number];

// Project a spherical cap onto the unit disc. Its boundary follows the
// cap's small circle on the front of the ball and the silhouette behind it.
function cap(x: number, depth: number, y: number): Point[] {
  const edge = 0.48;
  const capRadius = Math.sqrt(1 - edge ** 2);
  if (depth <= -capRadius) return [];
  const tilt = Math.hypot(x, y);
  const ux = tilt ? x / tilt : 1, uy = tilt ? y / tilt : 0;
  const project = (u: number, v: number): Point => [u * ux - v * uy, u * uy + v * ux];
  const clipped = depth < capRadius;
  const arc = clipped ? Math.acos(Math.max(-1, Math.min(1, -edge * depth / (capRadius * tilt)))) : Math.PI;
  const points: Point[] = [];
  for (let i = 0; i <= 24; i++) {
    const angle = arc * (i / 12 - 1);
    points.push(project(edge * tilt - capRadius * depth * Math.cos(angle), capRadius * Math.sin(angle)));
  }
  if (clipped) {
    const limb = Math.acos(Math.min(1, edge / tilt));
    for (let i = 1; i < 12; i++) {
      const angle = limb * (1 - i / 6);
      points.push(project(Math.cos(angle), Math.sin(angle)));
    }
  }
  return points;
}

export function ballMarkings(orientation: BallOrientation | undefined, striped: boolean, cue: boolean) {
  const [x, y, z, w] = orientation ?? [0, 0, 0, 1];
  // The local Y axis faces the viewer at rest. Local Z is the stripe pole.
  const frontX = 2 * (x * y - z * w);
  const frontY = 1 - 2 * (x * x + z * z);
  const frontZ = 2 * (y * z + x * w);
  const poleX = 2 * (x * z + y * w);
  const poleY = 2 * (y * z - x * w);
  const poleZ = 1 - 2 * (x * x + y * y);
  const facing = frontY >= 0 ? 1 : -1;
  const offset = cue ? 0.998 : 0.92;
  const mark: [number, number, number, number, number, number] = [
    facing * (1 - 2 * (y * y + z * z)),
    facing * -2 * (x * z - y * w),
    -poleX, poleZ,
    facing * offset * frontX, -facing * offset * frontZ,
  ];
  return { mark, caps: striped ? [cap(poleX, poleY, -poleZ), cap(-poleX, -poleY, poleZ)] : [] };
}
