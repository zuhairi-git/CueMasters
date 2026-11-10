import { roomBounds } from './camera-bounds';
import { Color3, DynamicTexture, MeshBuilder, Scene, StandardMaterial, Texture } from '@babylonjs/core';

const tableLight = { height: 2.62, width: 0.58, length: 1.85 };

export function tableReflections(scene: Scene) {
  const texture = new DynamicTexture('room reflections', { width: 512, height: 256 }, scene, true);
  const ctx = texture.getContext();
  const pixels = ctx.getImageData(0, 0, 512, 256);
  // Project the ceiling fixture onto a panorama as seen from the table.
  for (let y = 0; y < pixels.height; y++) {
    const latitude = (y + 0.5) / pixels.height * Math.PI;
    const up = Math.cos(latitude);
    const reach = tableLight.height * Math.tan(latitude);
    for (let x = 0; x < pixels.width; x++) {
      const longitude = ((x + 0.5) / pixels.width * 2 - 1) * Math.PI;
      const edge = Math.max(
        Math.abs(Math.cos(longitude) * reach) - tableLight.width / 2,
        Math.abs(Math.sin(longitude) * reach) - tableLight.length / 2,
      );
      const panel = up > 0 ? Math.max(0, Math.min(1, 0.5 - edge / 0.09)) : 0;
      const room = 8 + 18 * Math.max(0, up);
      const pixel = (y * pixels.width + x) * 4;
      pixels.data[pixel] = room + panel * 229;
      pixels.data[pixel + 1] = room + panel * 213;
      pixels.data[pixel + 2] = room + panel * 184;
      pixels.data[pixel + 3] = 255;
    }
  }
  ctx.putImageData(pixels, 0, 0);
  texture.coordinatesMode = Texture.EQUIRECTANGULAR_MODE;
  texture.wrapU = Texture.WRAP_ADDRESSMODE;
  texture.level = 0.32;
  texture.update();
  return texture;
}

export function furnishRoom(scene: Scene, wood: StandardMaterial, brass: StandardMaterial) {
  function finish(name: string, color: string) {
    const material = new StandardMaterial(name, scene);
    material.diffuseColor = Color3.FromHexString(color);
    material.specularColor = Color3.FromHexString('#151515');
    return material;
  }
  function block(name: string, x: number, y: number, z: number, w: number, h: number, d: number, material: StandardMaterial) {
    const mesh = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
    mesh.position.set(x, y, z);
    mesh.material = material;
    mesh.isPickable = false;
    mesh.receiveShadows = true;
    return mesh;
  }

  const grain = new DynamicTexture('walnut grain', { width: 512, height: 256 }, scene, true);
  const ctx = grain.getContext();
  ctx.fillStyle = '#d7c6af';
  ctx.fillRect(0, 0, 512, 256);
  for (let y = 0; y < 256; y++) {
    ctx.strokeStyle = y % 5 === 0 ? '#34241830' : '#ffffff18';
    ctx.beginPath();
    for (let x = 0; x <= 512; x += 8) {
      const offset = Math.sin(x * Math.PI / 256 + y * 0.18) * 2 + Math.sin(x * Math.PI / 128) * 1.5;
      if (!x) ctx.moveTo(x, y + offset);
      else ctx.lineTo(x, y + offset);
    }
    ctx.stroke();
  }
  grain.update();
  wood.diffuseTexture = grain;
  const plaster = finish('sand limewash', '#938b7c');
  const stone = finish('warm limestone', '#182438');
  const charcoal = finish('charcoal architectural metal', '#24282a');
  const ceiling = finish('soft ivory ceiling', '#c4bbac');
  const fabric = finish('linen upholstery', '#b2a18b');
  const rug = finish('oatmeal woven rug', '#12283d');
  const roomWalnut = finish('smoked oak joinery', '#64513e');
  roomWalnut.diffuseTexture = grain;
  const glow = finish('warm concealed lighting', '#ffe0a6');
  glow.emissiveColor = Color3.FromHexString('#c9a06b');
  const glass = finish('evening window', '#526776');
  glass.emissiveColor = Color3.FromHexString('#192c3a');

  const diffuser = finish('table light diffuser', '#ffefd6');
  diffuser.disableLighting = true;
  diffuser.emissiveColor = diffuser.diffuseColor;
  block('table light housing', 0, tableLight.height + 0.04, 0, tableLight.width + 0.045, 0.075, tableLight.length + 0.045, charcoal);
  block('table light panel', 0, tableLight.height, 0, tableLight.width, 0.01, tableLight.length, diffuser);

  // Large slabs and a restrained rug keep the table visually prominent.
  for (let x = 0; x < 6; x++) {
    for (let z = 0; z < 6; z++) {
      block('limestone slab', -3 + x * 1.2, -0.78, -3.25 + z * 1.3, 1.196, 0.03, 1.296, stone);
    }
  }
  block('tailored rug', 0, -0.757, 0, 2.8, 0.012, 4.1, rug);
  const rugTexture = new DynamicTexture('linen weave', 256, scene, true);
  const weave = rugTexture.getContext();
  weave.fillStyle = '#d9d1bd';
  weave.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 256; i += 2) {
    weave.fillStyle = i % 4 ? '#ffffff18' : '#00000018';
    weave.fillRect(i, 0, 1, 256);
    weave.fillRect(0, i, 256, 1);
  }
  rugTexture.update();
  rugTexture.uScale = 6;
  rugTexture.vScale = 9;
  rug.diffuseTexture = rugTexture;

  const height = roomBounds.ceiling - roomBounds.floor;
  const center = (roomBounds.ceiling + roomBounds.floor) / 2;
  block('ceiling', 0, roomBounds.ceiling + 0.06, 0, 7.32, 0.12, 7.92, ceiling);
  for (const side of [-1, 1]) {
    block('end wall', 0, center, side * 3.96, 7.32, height, 0.12, plaster);
    block('side wall', side * 3.66, center, 0, 0.12, height, 7.92, plaster);
    block('side shadow gap', side * 3.56, -0.7, 0, 0.04, 0.09, 7.8, charcoal);
    block('end shadow gap', 0, -0.7, side * 3.86, 7.2, 0.09, 0.04, charcoal);
    block('ceiling cove', side * 3.5, 2.69, 0, 0.15, 0.08, 7.8, ceiling);
    block('cove light', side * 3.48, 2.74, 0, 0.018, 0.02, 7.7, glow);
  }
  // A slatted oak feature wall and built-in banquette replace the old panelled room.
  block('feature wall backing', 0, center, 3.82, 7.1, height - 0.1, 0.04, charcoal);
  for (let i = 0; i < 60; i++) {
    block('oak wall slat', -3.48 + i * 0.118, center, 3.77, 0.065, height - 0.15, 0.07, roomWalnut);
  }
  block('banquette plinth', 0, -0.55, 3.29, 5.7, 0.35, 0.66, roomWalnut);
  block('banquette cushion', 0, -0.31, 3.25, 5.65, 0.15, 0.62, fabric);
  block('banquette back', 0, 0.02, 3.53, 5.65, 0.60, 0.13, fabric);
  for (let x = -2.3; x < 2.4; x += 1.15) {
    block('upholstery seam', x, 0.02, 3.455, 0.006, 0.55, 0.004, rug);
  }
  // Window-like illuminated panels add cool evening contrast to the warm joinery.
  for (const side of [-1, 1]) {
    block('window frame', side * 3.55, 1.0, -0.6, 0.09, 2.0, 3.25, charcoal);
    block('evening glazing', side * 3.49, 1.0, -0.6, 0.015, 1.88, 3.12, glass);
    for (const z of [-1.15, -0.05]) block('window mullion', side * 3.47, 1.0, z, 0.035, 1.88, 0.035, charcoal);
    block('window sill', side * 3.46, -0.03, -0.6, 0.2, 0.06, 3.3, roomWalnut);
  }
  for (const x of [-2.5, 2.5]) {
    block('front wall light', x, 1.0, -3.82, 0.045, 1.45, 0.04, glow);
    block('light housing', x + 0.04, 1.0, -3.80, 0.035, 1.5, 0.07, charcoal);
  }
  block('equipment console', 0, -0.34, -3.65, 2.2, 0.65, 0.40, roomWalnut);
  block('console stone top', 0, 0.005, -3.64, 2.25, 0.04, 0.44, stone);
  for (const x of [-0.55, 0.55]) block('cabinet pull', x, -0.12, -3.43, 0.22, 0.012, 0.018, brass);
  block('cue display backing', 0, 1.05, -3.84, 1.25, 1.65, 0.03, charcoal);
  for (let i = 0; i < 5; i++) {
    const cue = MeshBuilder.CreateCylinder('display cue', { height: 1.48, diameterTop: 0.012, diameterBottom: 0.025, tessellation: 12 }, scene);
    cue.position.set(-0.4 + i * 0.2, 1.05, -3.78);
    cue.material = wood;
    cue.isPickable = false;
  }
  const chalk = finish('blue cue chalk', '#5f8ba3');
  block('chalk', 0.69, 0.079, -0.65, 0.025, 0.027, 0.025, chalk);
  for (const mesh of scene.meshes) {
    if (mesh.name.startsWith('oak wall') || mesh.name.startsWith('limestone')) mesh.freezeWorldMatrix();
  }
}
