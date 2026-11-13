import { DynamicTexture, Mesh, MeshBuilder, Scene, StandardMaterial, Vector3 } from '@babylonjs/core';
import { cornerOpening, length, pocketMouthRadius, width } from './physics';

type Point = [number, number];
type Pocket = { x: number; z: number };

export const railDepth = 0.122;
export const railTop = 0.063;
export const railBase = -0.143;
export const railBevel = 0.006;
export const sideOpening = 0.085;

export function railGrain(scene: Scene) {
  const texture = new DynamicTexture('satin rail grain', { width: 1024, height: 256 }, scene, true);
  const ctx = texture.getContext();
  ctx.fillStyle = '#eee8e4';
  ctx.fillRect(0, 0, 1024, 256);
  for (let y = -6; y < 262; y += 1.3) {
    const strength = Math.sin(y * 2.37) * Math.cos(y * 0.13);
    ctx.strokeStyle = strength > 0 ? `rgba(68,42,26,${strength * 0.24})` : `rgba(255,255,255,${-strength * 0.56})`;
    ctx.beginPath();
    for (let x = 0; x <= 1024; x += 8) {
      const grain = y + 2.4 * Math.sin(x / 103 + y / 27) + 0.8 * Math.sin(x / 31 - y / 17);
      if (x === 0) ctx.moveTo(x, grain);
      else ctx.lineTo(x, grain);
    }
    ctx.stroke();
  }
  texture.anisotropicFilteringLevel = 8;
  texture.update();
  return texture;
}

function finish(mesh: Mesh, material: StandardMaterial) {
  mesh.material = material;
  mesh.isPickable = false;
  mesh.receiveShadows = true;
  return mesh;
}

export function buildStraightRail(scene: Scene, material: StandardMaterial, side: number, end: number, alongSide: boolean) {
  const edge = alongSide ? width / 2 : length / 2;
  const start = alongSide ? sideOpening : -width / 2 + cornerOpening;
  const stop = alongSide ? length / 2 - cornerOpening : width / 2 - cornerOpening;
  const facing = alongSide ? side : end;
  const profile = (position: number) => {
    const along = alongSide ? end * position : position;
    const at = (out: number, y: number) => alongSide
      ? new Vector3(facing * (edge + out), y, along)
      : new Vector3(along, y, facing * (edge + out));
    return [
      at(0, railBase), at(0, railTop), at(railDepth - railBevel, railTop),
      at(railDepth, railTop - railBevel), at(railDepth, railBase + railBevel),
      at(railDepth - railBevel, railBase),
    ];
  };
  const mesh = MeshBuilder.CreateRibbon(alongSide ? 'side rail' : 'end rail', {
    pathArray: [profile(start), profile(stop)], closePath: true, invertUV: true, sideOrientation: Mesh.DOUBLESIDE,
  }, scene);
  return finish(mesh.convertToFlatShadedMesh(), material);
}

function distanceToEdge(hull: Point[], [dx, dz]: Point) {
  for (let i = 0; i < hull.length; i++) {
    const [x, z] = hull[i];
    const [nextX, nextZ] = hull[(i + 1) % hull.length];
    const ex = nextX - x, ez = nextZ - z;
    const cross = dx * ez - dz * ex;
    if (Math.abs(cross) < 1e-9) continue;
    const fraction = (x * dz - z * dx) / cross;
    const distance = (x * ez - z * ex) / cross;
    if (fraction >= -1e-9 && fraction <= 1 + 1e-9 && distance > 0) return distance;
  }
  throw new Error('Pocket surround must enclose the pocket centre');
}

export function buildPocket(scene: Scene, pocket: Pocket, wood: StandardMaterial, leather: StandardMaterial, liner: StandardMaterial) {
  const side = Math.sign(pocket.x);
  const end = Math.sign(pocket.z) || 1;
  const middle = pocket.z === 0;
  const radius = pocketMouthRadius(pocket);
  const innerX = width / 2 - Math.abs(pocket.x);
  const innerZ = length / 2 - Math.abs(pocket.z);
  const outerX = innerX + railDepth, outerZ = innerZ + railDepth;
  // The diagonal jaw retreats into the mouth, leaving the approach from the bed open.
  const hull: Point[] = middle
    ? [[innerX, -sideOpening], [outerX, -sideOpening], [outerX, sideOpening], [innerX, sideOpening]]
    : [
        [innerX - cornerOpening, innerZ], [-0.058, -0.039], [-0.039, -0.058],
        [innerX, innerZ - cornerOpening], [outerX, innerZ - cornerOpening],
        [outerX, outerZ], [innerX - cornerOpening, outerZ],
      ];
  const angles = [
    ...Array.from({ length: 128 }, (_, i) => i * Math.PI / 64),
    ...hull.map(([x, z]) => (Math.atan2(z, x) + 2 * Math.PI) % (2 * Math.PI)),
  ].sort((a, b) => a - b);
  const rays = angles.map(angle => {
    const direction: Point = [Math.cos(angle), Math.sin(angle)];
    return { direction, distance: distanceToEdge(hull, direction) };
  });
  const at = (x: number, y: number, z: number) => new Vector3(pocket.x + side * x, y, pocket.z + end * z);
  function ring(y: number, inset: number, inside = false) {
    return rays.map(({ direction: [dx, dz], distance }) => {
      const reach = inside ? Math.min(distance, radius + 0.006) : distance;
      const x = Math.min(dx * reach, outerX - inset);
      const z = middle ? dz * reach : Math.min(dz * reach, outerZ - inset);
      return at(x, y, z);
    });
  }
  const outerPaths = [
    ring(railTop, 0, true), ring(railTop, railBevel), ring(railTop - railBevel, 0),
    ring(railBase + railBevel, 0), ring(railBase, railBevel), ring(railBase, 0, true),
  ];
  // The outer wall stops where the mouth cuts through the inner edge of the surround.
  for (let i = 0; i < rays.length; i++) {
    if (rays[i].distance >= radius + 0.006) continue;
    for (const path of outerPaths) path[i].copyFrom(outerPaths[0][i]);
  }
  function wrap(name: string, paths: Vector3[][], material: StandardMaterial) {
    return finish(MeshBuilder.CreateRibbon(name, {
      pathArray: paths, closePath: true, sideOrientation: Mesh.DOUBLESIDE,
    }, scene), material);
  }
  const surround = wrap('solid pocket surround', outerPaths, wood).convertToFlatShadedMesh();
  const lip = (r: number, offset: number) => rays.map(({ direction: [dx, dz], distance }) => {
    const support = Math.max(0, Math.min(1, (distance - radius + 0.004) / 0.016));
    return at(dx * r, 0.001 + (railTop - 0.001) * support + offset, dz * r);
  });
  const level = (r: number, y: number) => rays.map(({ direction: [dx, dz] }) => at(dx * r, y, dz * r));
  const throat = level(radius - 0.003, -0.024);
  wrap('rolled leather pocket lip', [lip(radius + 0.006, -0.003), lip(radius + 0.002, 0.001),
    lip(radius - 0.003, -0.004), throat], leather);
  const baseRadius = radius * 0.58;
  const base = -0.141;
  wrap('tapered pocket liner', [throat, level(radius * 0.87, -0.07), level(baseRadius, base)], liner);
  const bottom = MeshBuilder.CreateDisc('fitted pocket bottom', { radius: baseRadius, tessellation: 128, sideOrientation: Mesh.DOUBLESIDE }, scene);
  bottom.rotation.x = Math.PI / 2;
  bottom.position.set(pocket.x, base, pocket.z);
  finish(bottom, liner);
  return surround;
}
