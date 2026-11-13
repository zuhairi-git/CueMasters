export const radius = 0.035;
export const width = 1.27;
export const length = 2.54;
export const cornerOpening = 0.13;
export const pockets = [-1, 1].flatMap(side =>
  [-1, 0, 1].map(end => ({
    x: side * (width / 2 + (end === 0 ? 0.024 : 0.016)),
    z: end === 0 ? 0 : end * (length / 2 + 0.016),
  }))
);

export const pocketMouthRadius = (pocket: { z: number }) => pocket.z === 0 ? 0.067 : 0.085;

function halfOverlapDistance(mouth: number) {
  // The overlap of the two discs is the sum of their circular segments.
  const segment = (r: number, offset: number) =>
    r * r * Math.acos(offset / r) - offset * Math.sqrt(Math.max(0, r * r - offset * offset));
  let low = mouth - radius;
  let high = mouth;
  const halfBallArea = Math.PI * radius * radius / 2;
  for (let i = 0; i < 40; i++) {
    const distance = (low + high) / 2;
    const chord = (distance * distance + radius * radius - mouth * mouth) / (2 * distance);
    const area = segment(radius, chord) + segment(mouth, distance - chord);
    if (area >= halfBallArea) low = distance;
    else high = distance;
  }
  return low;
}

const sideDropDistance = halfOverlapDistance(pocketMouthRadius({ z: 0 }));
const cornerDropDistance = halfOverlapDistance(pocketMouthRadius({ z: 1 }));
export const pocketDropDistance = (pocket: { z: number }) => pocket.z === 0 ? sideDropDistance : cornerDropDistance;

export type BallOrientation = [number, number, number, number];

export interface Ball {
  x: number;
  z: number;
  vx: number;
  vz: number;
  pocketed: boolean;
  spinX: number;
  spinZ: number;
  sideSpin: number;
  orientation?: BallOrientation;
}

export function rack(snooker = false, random?: () => number): Ball[] {
  const make = (x: number, z: number): Ball => ({ x, z, vx: 0, vz: 0, pocketed: false, spinX: 0, spinZ: 0, sideSpin: 0 });
  const balls = [make(0, -0.65)];
  // Leave room for millimetre-scale differences in how a new rack is set up.
  const spacing = 2 * radius + (random ? 0.0025 : 0.0005);
  for (let row = 0; row < 5; row++) {
    for (let column = 0; column <= row; column++) {
      const jitter = () => random && row ? (random() - 0.5) * 0.0016 : 0;
      balls.push(make((column - row / 2) * spacing + jitter(), 0.48 + row * spacing * Math.sqrt(3) / 2 + jitter()));
    }
  }
  if (!snooker) {
    // Eight in the centre; one solid and one stripe at the rear corners.
    [balls[5], balls[8]] = [balls[8], balls[5]];
    [balls[7], balls[11]] = [balls[11], balls[7]];
  }
  if (snooker) {
    balls[0] = make(-0.12, -0.77);
    balls.push(make(0.22, -0.74), make(-0.22, -0.74), make(0, -0.74), make(0, 0), make(0, 0.40), make(0, 1.05));
  }
  return balls;
}

// spinX/spinZ are the horizontal surface speeds produced by rotation, in m/s.
// sideSpin is angular velocity about the vertical axis, in radians/s.
export const rollingDeceleration = 0.25;
const slidingDeceleration = 1.96;
const ballRestitution = 0.96;
const cushionRestitution = 0.78;
const stopSpeed = 0.005;
export const maxShotSpeed = 4.3;
export const maxBallSpeed = 8;
export const shotSpeed = (power: number) => maxShotSpeed * Math.max(0, Math.min(1, Number.isFinite(power) ? power : 0)) ** 1.35;

type Sound = (kind: 'ball' | 'rail' | 'pocket', strength: number, ball?: Ball) => void;
type Cushion = { ax: number; az: number; bx: number; bz: number; jaw?: boolean };
// Match the six visible cushions, leaving actual openings at all six pockets.
export const cushions: Cushion[] = [];
for (const side of [-1, 1]) {
  const x = side * (width / 2 - 0.005);
  const z = side * (length / 2 - 0.005);
  for (const end of [-1, 1]) {
    cushions.push({ ax: x, az: end * 0.085, bx: x, bz: end * (length / 2 - cornerOpening) });
  }
  cushions.push({ ax: -width / 2 + cornerOpening, az: z, bx: width / 2 - cornerOpening, bz: z });
  // Angled jaws funnel balls into the wells instead of leaving gaps into the room.
  const sidePocket = pockets.find(p => Math.sign(p.x) === side && p.z === 0)!;
  for (const end of [-1, 1]) {
    cushions.push({ ax: x, az: end * 0.085, bx: sidePocket.x + side * 0.04, bz: end * 0.045, jaw: true });
    const corner = pockets.find(p => Math.sign(p.x) === side && Math.sign(p.z) === end)!;
    cushions.push({ ax: x, az: end * (length / 2 - cornerOpening), bx: corner.x + side * 0.04, bz: corner.z - end * 0.035, jaw: true });
    cushions.push({ ax: side * (width / 2 - cornerOpening), az: end * (length / 2 - 0.005), bx: corner.x - side * 0.035, bz: corner.z + end * 0.04, jaw: true });
  }
}

export function strikeBall(ball: Ball, dx: number, dz: number, speed: number, tipX = 0, tipY = 0) {
  const directionLength = Math.hypot(dx, dz);
  if (!Number.isFinite(directionLength) || directionLength < 1e-10 || ball.pocketed) return;
  dx /= directionLength;
  dz /= directionLength;
  speed = Math.max(0, Math.min(maxShotSpeed, Number.isFinite(speed) ? speed : 0));
  tipX = Number.isFinite(tipX) ? tipX : 0;
  tipY = Number.isFinite(tipY) ? tipY : 0;
  const tipScale = Math.max(1, Math.hypot(tipX, tipY) / 0.78);
  tipX /= tipScale;
  tipY /= tipScale;
  ball.vx = dx * speed;
  ball.vz = dz * speed;
  ball.spinX = dx * speed * tipY * 1.8;
  ball.spinZ = dz * speed * tipY * 1.8;
  ball.sideSpin = -tipX * speed * 0.65 / radius;
}

function guardBall(ball: Ball) {
  if (ball.pocketed) { ball.vx = ball.vz = ball.spinX = ball.spinZ = ball.sideSpin = 0; return; }
  if (![ball.x, ball.z, ball.vx, ball.vz, ball.spinX, ball.spinZ, ball.sideSpin].every(Number.isFinite)) {
    ball.x = Number.isFinite(ball.x) ? ball.x : 0;
    ball.z = Number.isFinite(ball.z) ? ball.z : 0;
    ball.vx = ball.vz = ball.spinX = ball.spinZ = ball.sideSpin = 0;
  }
  const scale = Math.max(1, Math.hypot(ball.vx, ball.vz) / maxBallSpeed);
  ball.vx /= scale;
  ball.vz /= scale;
  const spinScale = Math.max(1, Math.hypot(ball.spinX, ball.spinZ) / (maxBallSpeed * 1.5));
  ball.spinX /= spinScale;
  ball.spinZ /= spinScale;
  ball.sideSpin = Math.max(-200, Math.min(200, ball.sideSpin));
  // Last-resort containment: pocket throats may extend behind the cloth edge,
  // but no active ball may cross the outside of the frame, even after a bad input.
  const inMouth = pockets.some(p => Math.hypot(p.x - ball.x, p.z - ball.z) < cornerOpening);
  const xLimit = inMouth ? width / 2 + 0.04 : width / 2 - radius - 0.005;
  const zLimit = inMouth ? length / 2 + 0.04 : length / 2 - radius - 0.005;
  if (Math.abs(ball.x) > xLimit) {
    const side = Math.sign(ball.x);
    ball.x = side * xLimit;
    if (ball.vx * side > 0) ball.vx *= -cushionRestitution;
  }
  if (Math.abs(ball.z) > zLimit) {
    const side = Math.sign(ball.z);
    ball.z = side * zLimit;
    if (ball.vz * side > 0) ball.vz *= -cushionRestitution;
  }
}

export function isMoving(ball: Ball) {
  return !ball.pocketed && (Math.hypot(ball.vx, ball.vz) > 0 || Math.hypot(ball.spinX, ball.spinZ) > 0);
}

function clothFriction(ball: Ball, dt: number) {
  const slipX = ball.vx - ball.spinX;
  const slipZ = ball.vz - ball.spinZ;
  const slip = Math.hypot(slipX, slipZ);
  // A solid sphere's rotational response is 5/2 of its translational response.
  // Stop sliding exactly at rolling contact so friction never overshoots.
  const slidingTime = Math.min(dt, slip / (3.5 * slidingDeceleration));
  if (slip > 1e-10) {
    const change = slidingDeceleration * slidingTime / slip;
    ball.vx -= slipX * change;
    ball.vz -= slipZ * change;
    ball.spinX += slipX * change * 2.5;
    ball.spinZ += slipZ * change * 2.5;
  }
  if (slidingTime < dt) {
    const speed = Math.hypot(ball.vx, ball.vz);
    const remaining = Math.max(0, speed - rollingDeceleration * (dt - slidingTime));
    const scale = speed ? remaining / speed : 0;
    ball.vx *= scale;
    ball.vz *= scale;
    ball.spinX = ball.vx;
    ball.spinZ = ball.vz;
  }
  ball.sideSpin *= Math.exp(-dt * 1.5);
  if (Math.hypot(ball.vx, ball.vz) < stopSpeed && Math.hypot(ball.spinX, ball.spinZ) < stopSpeed) {
    ball.vx = ball.vz = ball.spinX = ball.spinZ = 0;
  }
}

function cushionContact(ball: Ball, cushion: Cushion, sound?: Sound) {
  const dx = cushion.bx - cushion.ax, dz = cushion.bz - cushion.az;
  const t = Math.max(0, Math.min(1, ((ball.x - cushion.ax) * dx + (ball.z - cushion.az) * dz) / (dx * dx + dz * dz)));
  const px = ball.x - cushion.ax - t * dx;
  const pz = ball.z - cushion.az - t * dz;
  const distance = Math.hypot(px, pz);
  if (distance >= radius || distance < 1e-10) return;
  const nx = px / distance, nz = pz / distance;
  ball.x += nx * (radius - distance);
  ball.z += nz * (radius - distance);
  const normalSpeed = ball.vx * nx + ball.vz * nz;
  if (normalSpeed >= 0) return;
  const impactSpeed = -normalSpeed;
  const impulse = -(1 + cushionRestitution) * normalSpeed;
  sound?.('rail', impactSpeed);
  ball.vx += nx * impulse;
  ball.vz += nz * impulse;
  const tx = -nz, tz = nx;
  const slip = ball.vx * tx + ball.vz * tz + radius * ball.sideSpin;
  const maxFriction = 0.12 * impulse;
  const friction = Math.max(-maxFriction, Math.min(maxFriction, -slip / 3.5));
  ball.vx += tx * friction;
  ball.vz += tz * friction;
  ball.sideSpin += 2.5 * friction / radius;
  return true;
}

function rotateBall(ball: Ball, x: number, y: number, z: number, dt: number) {
  const angularSpeed = Math.hypot(x, y, z);
  if (angularSpeed < 1e-8) return;
  const halfAngle = angularSpeed * dt / 2;
  const scale = Math.sin(halfAngle) / angularSpeed;
  x *= scale;
  y *= scale;
  z *= scale;
  const w = Math.cos(halfAngle);
  const [a, b, c, d] = ball.orientation ?? [0, 0, 0, 1];
  const next: BallOrientation = [
    w * a + x * d + y * c - z * b,
    w * b - x * c + y * d + z * a,
    w * c + x * b - y * a + z * d,
    w * d - x * a - y * b - z * c,
  ];
  const norm = Math.hypot(...next);
  ball.orientation = [next[0] / norm, next[1] / norm, next[2] / norm, next[3] / norm];
}

function dropIntoPocket(ball: Ball, sound?: Sound) {
  for (const pocket of pockets) {
    const dx = pocket.x - ball.x, dz = pocket.z - ball.z;
    const distance = pocketDropDistance(pocket);
    if (dx * dx + dz * dz > distance * distance) continue;
    sound?.('pocket', Math.max(0.6, Math.hypot(ball.vx, ball.vz)), ball);
    ball.pocketed = true;
    ball.vx = ball.vz = ball.spinX = ball.spinZ = ball.sideSpin = 0;
    return true;
  }
  return false;
}

function substep(balls: Ball[], dt: number, sound?: Sound, onRail?: (ball: Ball) => void) {
  for (const ball of balls) {
    if (ball.pocketed) continue;
    if (dropIntoPocket(ball, sound)) continue;
    const { spinX, spinZ, sideSpin } = ball;
    clothFriction(ball, dt);
    // Use angular velocity at the cloth, including the transition from skid to roll.
    rotateBall(ball, (spinZ + ball.spinZ) / (2 * radius),
      (sideSpin + ball.sideSpin) / 2, -(spinX + ball.spinX) / (2 * radius), dt);
    ball.x += ball.vx * dt;
    ball.z += ball.vz * dt;
    dropIntoPocket(ball, sound);
  }
  let firstContact: number | undefined;
  // Revisit contacts so a packed rack transmits impulses during the same step.
  for (let iteration = 0; iteration < 6; iteration++) {
    for (let i = 0; i < balls.length; i++) {
      const a = balls[i];
      if (a.pocketed) continue;
      for (let j = i + 1; j < balls.length; j++) {
        const b = balls[j];
        if (b.pocketed) continue;
        const dx = b.x - a.x, dz = b.z - a.z;
        const squared = dx * dx + dz * dz;
        if (squared > 4 * radius * radius) continue;
        const distance = Math.sqrt(squared);
        const nx = distance ? dx / distance : 1, nz = distance ? dz / distance : 0;
        const correction = (2 * radius - distance) / 2;
        a.x -= nx * correction;
        a.z -= nz * correction;
        b.x += nx * correction;
        b.z += nz * correction;
        const closing = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;
        if (closing <= 1e-8) continue;
        if (i === 0) firstContact ??= j;
        sound?.('ball', closing);
        const impulse = closing * (1 + ballRestitution) / 2;
        a.vx -= impulse * nx;
        a.vz -= impulse * nz;
        b.vx += impulse * nx;
        b.vz += impulse * nz;
      }
    }
    for (const ball of balls) {
      if (ball.pocketed || dropIntoPocket(ball, sound)) continue;
      for (const cushion of cushions) {
        if (cushionContact(ball, cushion, sound) && !cushion.jaw) onRail?.(ball);
      }
      if (dropIntoPocket(ball, sound)) continue;
      guardBall(ball);
    }
  }
  return firstContact;
}

export function step(balls: Ball[], dt: number, sound?: Sound, onRail?: (ball: Ball) => void) {
  if (!Number.isFinite(dt) || dt <= 0) return;
  dt = Math.min(dt, 0.1);
  for (const ball of balls) guardBall(ball);
  const fastest = Math.max(0, ...balls.filter(ball => !ball.pocketed).map(ball => Math.max(
    Math.hypot(ball.vx, ball.vz), Math.hypot(ball.spinX, ball.spinZ),
  )));
  // Limit both elapsed time and distance travelled to prevent tunnelling.
  const count = Math.max(1, Math.ceil(dt / Math.min(1 / 300, radius * 0.2 / Math.max(fastest, 0.01))));
  let firstContact: number | undefined;
  for (let i = 0; i < count; i++) {
    const contact = substep(balls, dt / count, sound, onRail);
    firstContact ??= contact;
  }
  return firstContact;
}
