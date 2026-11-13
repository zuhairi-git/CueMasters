import { cushions, pocketDropDistance, pockets, radius, type Ball } from './physics';
type Point = { x: number; z: number };
export function directionToBall(cue: Point, target: Point) {
  const x = target.x - cue.x, z = target.z - cue.z;
  const magnitude = Math.hypot(x, z);
  return magnitude > 1e-10 ? { x: x / magnitude, z: z / magnitude } : undefined;
}
function circle(origin: Point, dx: number, dz: number, center: Point, r: number) {
  const x = center.x - origin.x, z = center.z - origin.z;
  const along = x * dx + z * dz;
  const acrossSquared = Math.max(0, x * x + z * z - along * along);
  if (acrossSquared > r * r || along < 0) return Infinity;
  return Math.max(0, along - Math.sqrt(r * r - acrossSquared));
}
function railDistance(origin: Point, dx: number, dz: number) {
  let nearest = Infinity;
  for (const c of cushions) {
    const sx = c.bx - c.ax, sz = c.bz - c.az;
    const size = Math.hypot(sx, sz), nx = -sz / size, nz = sx / size;
    const denominator = dx * nx + dz * nz;
    if (Math.abs(denominator) > 1e-10) for (const side of [-1, 1]) {
      const t = (side * radius - (origin.x - c.ax) * nx - (origin.z - c.az) * nz) / denominator;
      const along = ((origin.x + dx * t - c.ax) * sx + (origin.z + dz * t - c.az) * sz) / (size * size);
      if (t >= 0 && along >= 0 && along <= 1) nearest = Math.min(nearest, t);
    }
    nearest = Math.min(nearest, circle(origin, dx, dz, {x: c.ax, z: c.az}, radius), circle(origin, dx, dz, {x: c.bx, z: c.bz}, radius));
  }
  return nearest;
}
function path(origin: Point, dx: number, dz: number) {
  let distance = Math.min(4, railDistance(origin, dx, dz));
  let pocket: Point | undefined;
  for (const p of pockets) {
    const t = circle(origin, dx, dz, p, pocketDropDistance(p));
    if (Number.isFinite(t) && t <= distance) { distance = t; pocket = p; }
  }
  return { end: {x: origin.x + dx * distance, z: origin.z + dz * distance}, distance, pocket };
}
export function traceShot(balls: Ball[], dx: number, dz: number) {
  const cue = balls[0];
  const initial = path(cue, dx, dz);
  let distance = initial.distance, target = -1;
  for (let i = 1; i < balls.length; i++) {
    if (balls[i].pocketed) continue;
    const t = circle(cue, dx, dz, balls[i], 2 * radius);
    if (t < distance) { distance = t; target = i; }
  }
  const impact = {x: cue.x + dx * distance, z: cue.z + dz * distance};
  if (target < 0) return { impact };
  const object = balls[target];
  const nx = object.x - impact.x, nz = object.z - impact.z;
  const magnitude = Math.hypot(nx, nz);
  if (magnitude < 1e-10) return { impact };
  const ndx = nx / magnitude, ndz = nz / magnitude;
  const predicted = path(object, ndx, ndz);
  // An intervening ball blocks the predicted pocket path too.
  for (let i = 1; i < balls.length; i++) {
    if (i === target || balls[i].pocketed) continue;
    const t = circle(object, ndx, ndz, balls[i], 2 * radius);
    if (t < predicted.distance) {
      predicted.distance = t;
      predicted.end = {x: object.x + ndx * t, z: object.z + ndz * t};
      predicted.pocket = undefined;
    }
  }
  return { impact, target, objectStart: {x: object.x + ndx * radius, z: object.z + ndz * radius}, objectEnd: predicted.end, pocket: predicted.pocket };
}
