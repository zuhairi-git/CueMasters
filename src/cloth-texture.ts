import { length, pocketMouthRadius, pockets, width } from './physics';

/**
 * Paints the 3D bed's cloth once: woven fibres, the pool of light under the table lamp, the
 * shade the cushions and pocket drops leave on it, and the cut-outs for the six pockets.
 * The cloth colour is multiplied in by the material, so everything here is neutral.
 */
export function paintCloth(ctx: CanvasRenderingContext2D, texWidth: number, texHeight: number) {
  ctx.fillStyle = '#dde1dc';
  ctx.fillRect(0, 0, texWidth, texHeight);
  // Stagger the yarn highlights so the weave reads as fabric at close range.
  ctx.fillStyle = '#4b574b14';
  for (let y = 0; y < texHeight; y += 4) ctx.fillRect(0, y, texWidth, 1);
  ctx.fillStyle = '#ffffff25';
  for (let x = 0; x < texWidth; x += 4) {
    for (let y = x % 8 / 2; y < texHeight; y += 4) ctx.fillRect(x, y, 1, 2);
  }
  let seed = 1427;
  for (let i = 0; i < 48000; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const x = (seed >>> 16) % texWidth;
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const y = (seed >>> 16) % texHeight;
    ctx.fillStyle = i % 2 ? '#ffffff30' : '#00000021';
    ctx.fillRect(x, y, 1, 2);
  }
  // Lamp light: brightest under the fixture, falling away towards the rails. Matches the overhead table.
  ctx.save();
  ctx.translate(texWidth / 2, texHeight / 2);
  ctx.scale(texWidth, texHeight);
  const lamp = ctx.createRadialGradient(0, 0, 0, 0, 0, 0.72);
  const light = (offset: number, alpha: number) => lamp.addColorStop(offset, 'rgba(255,246,220,' + alpha + ')');
  const dusk = (offset: number, alpha: number) => lamp.addColorStop(offset, 'rgba(0,9,15,' + alpha + ')');
  light(0, 0.5); light(0.18, 0.43); light(0.36, 0.25); light(0.52, 0.09); light(0.64, 0);
  dusk(0.64, 0); dusk(0.76, 0.04); dusk(0.88, 0.14); dusk(1, 0.32);
  ctx.fillStyle = lamp;
  ctx.fillRect(-0.5, -0.5, 1, 1);
  ctx.restore();
  // Metres from here on, with the origin on the centre spot.
  ctx.save();
  ctx.translate(texWidth / 2, texHeight / 2);
  ctx.scale(texWidth / width, texHeight / length);
  // The cushions overhang the bed and shade a strip along each edge.
  const reach = 0.04;
  for (const [x, z] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const edgeX = x * width / 2, edgeZ = z * length / 2;
    const shade = ctx.createLinearGradient(edgeX, edgeZ, edgeX - x * reach, edgeZ - z * reach);
    shade.addColorStop(0, 'rgba(0,0,0,0.44)');
    shade.addColorStop(0.4, 'rgba(0,0,0,0.16)');
    shade.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = shade;
    if (x) ctx.fillRect(Math.min(edgeX, edgeX - x * reach), -length / 2, reach, length);
    else ctx.fillRect(-width / 2, Math.min(edgeZ, edgeZ - z * reach), width, reach);
  }
  for (const pocket of pockets) {
    const mouth = pocketMouthRadius(pocket);
    // The cloth darkens as it rolls over the slate into the drop.
    const fall = ctx.createRadialGradient(pocket.x, pocket.z, mouth * 0.8, pocket.x, pocket.z, mouth + 0.034);
    fall.addColorStop(0, 'rgba(0,0,0,0.5)');
    fall.addColorStop(0.5, 'rgba(0,0,0,0.2)');
    fall.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = fall;
    ctx.beginPath();
    ctx.arc(pocket.x, pocket.z, mouth + 0.034, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = '#000000';
  for (const pocket of pockets) {
    ctx.beginPath();
    ctx.arc(pocket.x, pocket.z, pocketMouthRadius(pocket), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.globalCompositeOperation = 'source-over';
}
