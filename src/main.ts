import { t } from './i18n';
import { cueArtwork } from './svg-cue';
import { ballBadge } from './svg-ball';
import { GameAudio } from './audio';
import { RemoteShot, remoteKey, remotePlacement, type RemoteKey } from './tv-controls';
import { SvgTable } from './svg-table';
import { TvTable, calledPocketBorderWidth, calledPocketColor } from './tv-table';
import { dismissDialog } from './tv-dialogs';
import { installFullscreenControl } from './fullscreen';
import { cueLength, cuePose } from './cue-geometry';
import { directionToBall, traceShot } from './aim-guide';
import { OnlineGame } from './online';
import { cities, onlineMedalName, resultMessage } from './circuit';
import { careerCityStatus, careerCue, careerCues, careerDifficulty, careerGoal, careerProgress, careerRank, careerStage, careerStages, careerStageStatus, finishCareerStage } from './career';
import { cityFinishes, tableFinish } from './table-finishes';
import { challengeLayout, completeChallenge, getChallenge } from './challenges';
import { clearSession, labelGame, launch, saveSession } from './home';
import type { Difficulty } from './difficulty';
import { groupOf, poolTargets, resolvePoolShot, type Groups } from './pool-rules';
import { validGame, type SavedGame } from './saved-game';
import { constrainOrbit } from './camera-bounds';
import {
  ArcRotateCamera, Camera, Color3, Color4, DirectionalLight, DynamicTexture, Engine, NullEngine,
  HemisphericLight, ShadowGenerator, Matrix, Mesh, VertexData, MeshBuilder, Quaternion, Scene, StandardMaterial, Vector3,
} from '@babylonjs/core';
import { furnishRoom, tableReflections } from './room';
import { buildPocket, buildStraightRail, pocketMouthRadius, railBase, railDepth, railGrain, railTop, sideOpening } from './table-trim';
import { chooseShot } from './opponent';
import { cushions, cornerOpening, isMoving, length, pockets, rack, radius, shotSpeed, step, strikeBall, width } from './physics';

const canvas = document.querySelector<HTMLCanvasElement>('#table')!;
const tvCanvas = document.querySelector<HTMLCanvasElement>('#tvTable')!;
const svgSurface = document.querySelector<SVGSVGElement>('#svgTable')!;
let tvTable: TvTable | SvgTable | undefined;
let overhead = true;
let viewMode = false;
let svgRenderer: SvgTable | undefined;
let canvasRenderer: TvTable | undefined;
const status = document.querySelector<HTMLElement>('#status')!;
const quality = document.querySelector<HTMLSelectElement>('#quality')!;
const mobileMenu = document.querySelector<HTMLButtonElement>('#mobileMenu')!;
const tableActions = document.querySelector<HTMLElement>('#tableActions')!;
const hudHeader = document.querySelector<HTMLElement>('header')!;
const menuDialog = document.querySelector<HTMLDialogElement>('#mobileGameMenu')!;
const menuActions = document.querySelector<HTMLElement>('#gameMenuActions')!;
const mobileLayout = window.matchMedia('(max-width: 600px)');
let tvEnabled = false;
const remote = new RemoteShot();
let tvContext = '';
let tvPresentation = '';
try { tvEnabled = localStorage.getItem('billiard-tv') === 'on'; } catch {}
if (document.documentElement.dataset.tvChoice) tvEnabled = document.documentElement.dataset.tvChoice === 'on';
const actionDescriptions: Record<string, string> = {
  fullscreen: t('Hide browser navigation while you play'),
  viewMode: t('Look around the table'),
  camera: t('Switch between top-down and 3D'),
  reset: t('Set up a fresh game'),
  openOnline: t('Your profile, QR code & online play'),
  openSettings: t('Game, equipment, sound & guides'),
  endGame: t('Return to game modes'),
};
for (const button of tableActions.querySelectorAll<HTMLButtonElement>('button')) {
  const description = document.createElement('span');
  description.className = 'menu-description';
  description.textContent = actionDescriptions[button.id];
  button.append(description);
}
installFullscreenControl(document.querySelector<HTMLButtonElement>('#fullscreen')!, document.querySelector<HTMLElement>('#fullscreenNotice')!);
function setMobileMenu(open: boolean, restoreFocus = false) {
  open = open && (mobileLayout.matches || tvEnabled);
  if (open && !menuDialog.open) {
    menuActions.append(tableActions);
    menuDialog.showModal();
  } else if (!open) {
    if (menuDialog.open) menuDialog.close();
    menuDialog.classList.remove('modal-parent');
    delete menuDialog.dataset.activeChild;
    if (tableActions.parentElement !== hudHeader) hudHeader.append(tableActions);
  }
  hudHeader.dataset.menuOpen = String(open);
  mobileMenu.setAttribute('aria-expanded', String(open));
  mobileMenu.setAttribute('aria-label', t(open ? 'Close game menu' : 'Open game menu'));
  if (restoreFocus && !document.querySelector('dialog[open]')) mobileMenu.focus();
}
mobileMenu.onclick = () => setMobileMenu(!menuDialog.open);
tableActions.addEventListener('click', event => {
  const button = (event.target as Element).closest('button');
  if (!menuDialog.open || !button || button.disabled) return;
  const childId = button.id === 'endGame' ? 'endGameConfirm' : button.id === 'openSettings' ? 'settings' : button.id === 'openOnline' ? 'online' : button.id === 'reset' && needsRerackConfirmation() ? 'rerackConfirm' : undefined;
  if (childId) {
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      button.animate([
        { transform: 'translateY(0) scale(1)' },
        { transform: 'translateY(2px) scale(.985)', offset: 0.35 },
        { transform: 'translateY(0) scale(1)' },
      ], { duration: 180, easing: 'ease-out' });
    }
    menuDialog.dataset.activeChild = childId;
    menuDialog.classList.add('modal-parent');
    document.getElementById(childId)!.classList.add('modal-child');
  } else setMobileMenu(false);
}, true);
for (const child of document.querySelectorAll<HTMLDialogElement>('#settings, #online, #rerackConfirm, #endGameConfirm')) {
  child.addEventListener('close', () => {
    child.classList.remove('modal-child');
    if (menuDialog.dataset.activeChild !== child.id) return;
    menuDialog.classList.remove('modal-parent');
    delete menuDialog.dataset.activeChild;
    if (child.id === 'settings' && child.returnValue === 'start' || child.id === 'rerackConfirm' && child.returnValue === 'rerack') setMobileMenu(false);
  });
}
document.querySelector<HTMLButtonElement>('#closeGameMenu')!.onclick = () => setMobileMenu(false, true);
menuDialog.addEventListener('cancel', event => {
  event.preventDefault();
  setMobileMenu(false, true);
});
menuDialog.addEventListener('close', () => {
  if (!menuDialog.open) setMobileMenu(false);
});
mobileLayout.addEventListener('change', () => setMobileMenu(false));
const zoomSlider = document.querySelector<HTMLInputElement>('#cameraZoom')!;
const zoomFit = document.querySelector<HTMLButtonElement>('#zoomFit')!;
const panButton = document.querySelector<HTMLButtonElement>('#panTable')!;
let cameraZoom = 1;
let panToggled = false;
let spaceHeld = false;
let panDrag: { canvas: HTMLCanvasElement; id: number; x: number; y: number } | undefined;
// Start fitted; zoom remains adjustable during this visit.
function zoomFov() { return 2 * Math.atan(Math.tan(1.1 / 2) / cameraZoom); }
function showZoom() {
  zoomSlider.value = String(cameraZoom);
  zoomSlider.setAttribute('aria-valuetext', cameraZoom.toFixed(1) + ' times zoom');
  zoomFit.textContent = cameraZoom.toFixed(1) + '×';
}
function setCameraZoom(value: number) {
  if (!Number.isFinite(value)) return;
  cameraZoom = Math.max(0.65, Math.min(2.5, Math.round(value * 20) / 20));
  showZoom();
  if (cameraZoom <= 1) svgRenderer?.resetPan();
  syncPanControls();
  if (overhead && !viewMode) fitOverheadCamera();
  else {
    camera.fov = zoomFov();
    panPerspectiveBy(0, 0);
  }
  try { localStorage.setItem('billiard-camera-zoom', String(cameraZoom)); } catch {}
}
zoomSlider.oninput = () => setCameraZoom(Number(zoomSlider.value));
document.querySelector<HTMLButtonElement>('#zoomIn')!.onclick = () => setCameraZoom(cameraZoom + 0.1);
document.querySelector<HTMLButtonElement>('#zoomOut')!.onclick = () => setCameraZoom(cameraZoom - 0.1);
zoomFit.onclick = () => setCameraZoom(1);
showZoom();
const guidesToggle = document.querySelector<HTMLButtonElement>('#guidesToggle')!;
let guidesEnabled = true;
try { guidesEnabled = localStorage.getItem('billiard-guides') !== 'off'; } catch {}
function updateGuides() {
  guidesToggle.textContent = t(guidesEnabled ? 'Guides on' : 'Guides off');
  guidesToggle.setAttribute('aria-pressed', String(guidesEnabled));
}
guidesToggle.onclick = () => {
  guidesEnabled = !guidesEnabled;
  try { localStorage.setItem('billiard-guides', guidesEnabled ? 'on' : 'off'); } catch {}
  updateGuides();
};
updateGuides();
const sound = new GameAudio();
const soundToggle = document.querySelector<HTMLButtonElement>('#soundToggle')!;
const volume = document.querySelector<HTMLInputElement>('#volume')!;
const volumeLabel = document.querySelector<HTMLOutputElement>('#volumeLabel')!;
function updateSound() {
  sound.configure(sound.enabled, Number(volume.value) / 100);
  soundToggle.textContent = t(sound.enabled ? 'Sound on' : 'Sound off');
  soundToggle.setAttribute('aria-pressed', String(sound.enabled));
  volumeLabel.value = volume.value + '%';
  try { localStorage.setItem('3dbilliard-sound', JSON.stringify({ enabled: sound.enabled, volume: sound.volume })); } catch {}
}
try {
  const saved = JSON.parse(localStorage.getItem('3dbilliard-sound') ?? 'null');
  if (saved && typeof saved.enabled === 'boolean' && typeof saved.volume === 'number' && Number.isFinite(saved.volume)) {
    sound.enabled = saved.enabled;
    volume.value = String(Math.max(0, Math.min(100, saved.volume * 100)));
  }
} catch {}
updateSound();
soundToggle.onclick = () => {
  sound.enabled = !sound.enabled;
  updateSound();
  void sound.unlock();
};
volume.oninput = updateSound;
document.addEventListener('pointerdown', () => { void sound.unlock(); });
document.addEventListener('keydown', () => { void sound.unlock(); });
let webglUnavailable = false;
const engine = (() => {
  // Retain the existing scene's state objects without creating a GPU context on TV.
  const headless = () => new NullEngine({ renderWidth: 1280, renderHeight: 720, textureSize: 512, deterministicLockstep: false, lockstepMaxSteps: 4 });
  if (tvEnabled) return headless();
  try { return new Engine(canvas, true); }
  catch {
    webglUnavailable = true;
    return headless();
  }
})();
const headlessGraphics = engine instanceof NullEngine;
function usesSvgTable() { return !tvEnabled && overhead && !viewMode; }
function uses2dTable() { return tvEnabled || headlessGraphics || usesSvgTable(); }
function syncTableSurface() {
  const svg = usesSvgTable();
  svgSurface.toggleAttribute('hidden', !svg);
  tvCanvas.hidden = !uses2dTable();
  canvas.hidden = uses2dTable();
  if (svg) tvTable = svgRenderer ??= new SvgTable(svgSurface);
  else if (uses2dTable()) tvTable = canvasRenderer ??= new TvTable(tvCanvas);
}
function activeTableCanvas() { return uses2dTable() ? tvCanvas : canvas; }
const scene = new Scene(engine);
scene.clearColor = new Color4(0.025, 0.045, 0.09, 1);
const camera = new ArcRotateCamera('camera', -Math.PI / 2, 0.025, 2.5, Vector3.Zero(), scene);
camera.lowerRadiusLimit = 0.7;
camera.lowerBetaLimit = 0.025;
camera.upperBetaLimit = 1.28;
camera.allowUpsideDown = false;
camera.panningSensibility = 0;
camera.minZ = 0.03;
camera.fov = zoomFov();
camera.onAfterCheckInputsObservable.add(() => {
  const safe = constrainOrbit(camera.alpha, camera.beta, camera.radius);
  if (safe.radius !== camera.radius) camera.inertialRadiusOffset = 0;
  if (safe.beta !== camera.beta) camera.inertialBetaOffset = 0;
  camera.radius = safe.radius;
  camera.beta = safe.beta;
});
camera.upperRadiusLimit = 6;
camera.wheelDeltaPercentage = 0.035;


const ambient = new HemisphericLight('room fill', Vector3.Up(), scene);
ambient.intensity = 0.60;
ambient.diffuse = Color3.FromHexString('#e8f0ff');
ambient.groundColor = Color3.FromHexString('#848086');
const lamp = new DirectionalLight('table light', new Vector3(-0.18, -1, 0.14), scene);
lamp.intensity = 0.86;
lamp.position.set(0.47, 2.62, -0.37);
lamp.diffuse = Color3.FromHexString('#fff1dd');
const shadows = new ShadowGenerator(1024, lamp);
shadows.useBlurExponentialShadowMap = true;
shadows.useKernelBlur = true;
shadows.blurKernel = 10;
shadows.darkness = 0.22;
shadows.bias = 0.0003;
shadows.normalBias = 0.002;

function material(name: string, hex: string, shine = 0.03) {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = Color3.FromHexString(hex);
  m.specularColor = new Color3(shine, shine, shine);
  m.specularPower = 80;
  return m;
}
const wood = material('graphite satin rails', '#182b43', 0.34);
wood.specularPower = 48;
const cloth = material('azure tournament cloth', '#258bd0', 0);
const rubber = material('cushion', '#125283', 0.015);
const leather = material('pocket leather', '#353037', 0.14);
leather.specularPower = 36;
const dark = material('pocket liner', '#0c1016', 0.015);
const brass = material('champagne metal', '#dfc48d', 0.65);
const pocketCallMaterial = material('called pocket marker', '#e8bd72');
pocketCallMaterial.disableLighting = true;
pocketCallMaterial.emissiveColor = Color3.FromHexString('#e8bd72');
const pearl = material('mother of pearl sights', '#e8dfc9', 0.4);
const trim = material('frame accents', '#0a1220', 0.3);
const floor = material('room floor', '#0b1427');

function box(name: string, x: number, y: number, z: number, w: number, h: number, d: number, m: StandardMaterial) {
  const mesh = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
  mesh.position.set(x, y, z);
  mesh.material = m;
  mesh.isPickable = false;
  mesh.receiveShadows = true;
  shadows.addShadowCaster(mesh);
  return mesh;
}

function weave() {
  const texWidth = 1024, texHeight = 2048;
  const texture = new DynamicTexture('cloth weave', { width: texWidth, height: texHeight }, scene, true);
  const ctx = texture.getContext() as CanvasRenderingContext2D;
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
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = '#000000';
  for (const pocket of pockets) {
    ctx.save();
    ctx.translate((pocket.x / width + 0.5) * texWidth, (pocket.z / length + 0.5) * texHeight);
    ctx.scale(texWidth / width, texHeight / length);
    ctx.beginPath();
    ctx.arc(0, 0, pocketMouthRadius(pocket), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.globalCompositeOperation = 'source-over';
  texture.hasAlpha = true;
  texture.anisotropicFilteringLevel = 8;
  texture.update();
  return texture;
}
if (!headlessGraphics) {
  cloth.diffuseTexture = weave();
  wood.diffuseTexture = railGrain(scene);
  furnishRoom(scene, material('room walnut', '#63452e', 0.34), brass);
}
box('floor', 0, -0.79, 0, 15, 0.04, 15, floor);
const cabinetTop = railBase + 0.001;
box('cabinet', 0, (cabinetTop - 0.30) / 2, 0, width + 0.24, cabinetTop + 0.30, length + 0.24, wood);
box('lower frame', 0, -0.305, 0, width + 0.20, 0.035, length + 0.18, trim);
for (const side of [-1, 1]) {
  box('apron brass inlay', side * (width / 2 + 0.122), -0.16, 0, 0.003, 0.007, length + 0.12, brass);
  box('end apron inlay', 0, -0.16, side * (length / 2 + 0.112), width + 0.20, 0.007, 0.003, brass);
  box('apron inset', side * (width / 2 + 0.123), -0.245, 0, 0.006, 0.035, length - 0.32, trim);
}
for (const x of [-0.54, 0.54]) {
  for (const z of [-0.94, 0.94]) {
    const leg = MeshBuilder.CreateCylinder('leg', { height: 0.43, diameterTop: 0.24, diameterBottom: 0.16, tessellation: 4 }, scene);
    leg.position.set(x, -0.53, z);
    leg.rotation.y = Math.PI / 4;
    leg.material = wood;
    leg.isPickable = false;
    shadows.addShadowCaster(leg);
    box('leg collar', x, -0.34, z, 0.174, 0.045, 0.174, trim);
    box('leg brass band', x, -0.70, z, 0.12, 0.012, 0.12, brass);
    box('foot', x, -0.75, z, 0.17, 0.05, 0.18, brass);
  }
}
cloth.transparencyMode = 1;
const bed = MeshBuilder.CreateGround('playing surface', { width, height: length }, scene);
bed.material = cloth;
bed.receiveShadows = true;
bed.isPickable = true;
for (const side of [-1, 1]) {
  for (const end of [-1, 1]) {
    const railCenter = end * (sideOpening + length / 2 - cornerOpening) / 2;
    const railLength = length / 2 - cornerOpening - sideOpening;
    buildStraightRail(scene, wood, side, end, true);
    box('rail edge inlay', side * (width / 2 + railDepth - 0.011), railTop, railCenter, 0.0025, 0.001, railLength - 0.025, brass);
  }
  buildStraightRail(scene, wood, side, side, false);
  box('end edge inlay', 0, railTop, side * (length / 2 + railDepth - 0.011), width - 2 * cornerOpening - 0.025, 0.001, 0.0025, brass);
  for (const x of [-0.31, 0, 0.31]) {
    const sight = box('end rail sight', x, 0.064, side * (length / 2 + 0.078), 0.012, 0.002, 0.012, pearl);
    sight.rotation.y = Math.PI / 4;
  }
  for (const z of [-0.92, -0.63, -0.34, 0.34, 0.63, 0.92]) {
    const sight = box('rail sight', side * (width / 2 + 0.078), 0.064, z, 0.012, 0.002, 0.012, pearl);
    sight.rotation.y = Math.PI / 4;
  }
}
const pocketSelectors = pockets.map((pocket, index) => {
  const disc = MeshBuilder.CreateDisc('call pocket ' + index, {radius: 0.09, tessellation: 32, sideOrientation: 2}, scene);
  disc.rotation.x = Math.PI / 2;
  disc.position.set(pocket.x, 0.07, pocket.z);
  disc.visibility = 0;
  disc.isPickable = true;
  disc.setEnabled(false);
  return disc;
});
const pocketCallRings = pockets.map(pocket => {
  const ring = MeshBuilder.CreateTorus('pocket call selection', {diameter: 0.16, thickness: 0.003, tessellation: 48}, scene);
  ring.position.set(pocket.x, 0.035, pocket.z);
  ring.material = pocketCallMaterial;
  ring.isPickable = false;
  ring.isVisible = false;
  ring.visibility = 0.35;
  return ring;
});
const calledPocketRingRadius = 0.088;
const calledPocketRing = MeshBuilder.CreateTorus('called pocket highlight', {
  diameter: 2 * calledPocketRingRadius, thickness: calledPocketBorderWidth, tessellation: 48,
}, scene);
const calledPocketMaterial = material('called pocket highlight', calledPocketColor);
calledPocketMaterial.disableLighting = true;
calledPocketMaterial.emissiveColor = Color3.FromHexString(calledPocketColor);
calledPocketRing.material = calledPocketMaterial;
calledPocketRing.isPickable = false;
calledPocketRing.isVisible = false;
for (const pocket of pockets) buildPocket(scene, pocket, wood, leather, dark);
// One continuous beveled cushion per rail, with mitered pocket approaches.
for (const c of cushions.filter(c => !c.jaw)) {
  const distance = Math.hypot(c.bx - c.ax, c.bz - c.az);
  const tx = (c.bx - c.ax) / distance, tz = (c.bz - c.az) / distance;
  const nx = c.ax === c.bx ? Math.sign(c.ax) : 0;
  const nz = c.az === c.bz ? Math.sign(c.az) : 0;
  const outline = [
    [c.ax, 0.028, c.az], [c.bx, 0.028, c.bz],
    [c.bx + nx * 0.055 + tx * 0.035, 0.063, c.bz + nz * 0.055 + tz * 0.035],
    [c.ax + nx * 0.055 - tx * 0.035, 0.063, c.az + nz * 0.055 - tz * 0.035],
  ];
  const positions = [...outline.flat(), ...outline.flatMap(([x, , z]) => [x, 0.005, z])];
  const indices = [0, 1, 2, 0, 2, 3];
  for (let i = 0; i < 4; i++) {
    const next = (i + 1) % 4;
    indices.push(i, i + 4, next + 4, i, next + 4, next);
  }
  const normals: number[] = [];
  VertexData.ComputeNormals(positions, indices, normals);
  if (normals[1] < 0) {
    for (let i = 0; i < indices.length; i += 3) [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
    VertexData.ComputeNormals(positions, indices, normals);
  }
  const data = new VertexData();
  data.positions = positions; data.indices = indices; data.normals = normals;
  const mesh = new Mesh('continuous beveled cushion', scene);
  data.applyToMesh(mesh);
  mesh.material = rubber;
  mesh.isPickable = false;
  mesh.receiveShadows = true;
  shadows.addShadowCaster(mesh);
}
rubber.backFaceCulling = false;

const palette = ['#ffcb24', '#246fe5', '#ed354e', '#9552d8', '#ff8624', '#20ac77', '#a53657', '#101522'];
const reflections = headlessGraphics ? null : tableReflections(scene);
function resin(name: string, color: string) {
  const finish = material(name, color, 0.32);
  finish.specularPower = 128;
  finish.reflectionTexture = reflections;
  return finish;
}
const ballTextureRotation = Quaternion.RotationAxis(Vector3.Right(), Math.PI / 2);
const ballRotation = Quaternion.Identity();
const ballMeshes = rack(true).map((_, index) => {
  const mesh = MeshBuilder.CreateSphere('ball ' + index, { diameter: 2 * radius, segments: 48 }, scene);
  shadows.addShadowCaster(mesh);
  mesh.isPickable = false;
  mesh.rotationQuaternion = ballTextureRotation.clone();
  mesh.isVisible = index < 16;
  if (index > 15) return mesh;
  const finish = resin('polished resin ' + index, '#ffffff');
  mesh.material = finish;
  if (headlessGraphics) return mesh;
  const texture = new DynamicTexture('ball markings ' + index, { width: 1024, height: 512 }, scene, true);
  const ctx = texture.getContext() as CanvasRenderingContext2D;
  ctx.scale(2, 2);
  ctx.fillStyle = index === 0 || index > 8 ? '#f6eedc' : palette[(index - 1) % 8];
  ctx.fillRect(0, 0, 512, 256);
  if (index > 8) {
    ctx.fillStyle = palette[(index - 1) % 8];
    ctx.fillRect(0, 67, 512, 122);
  }
  for (const x of [128, 384]) {
    ctx.beginPath();
    ctx.arc(x, 128, index === 0 ? 6 : 40, 0, Math.PI * 2);
    ctx.fillStyle = index === 0 ? '#a6342c' : '#f6eedc';
    ctx.fill();
    if (index) {
      ctx.fillStyle = '#131719';
      ctx.font = 'bold 43px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(index), x, 130);
    }
  }
  texture.update();
  finish.diffuseTexture = texture;
  return mesh;
});
const poolFinishes = ballMeshes.map(mesh => mesh.material);
const redFinish = resin("snooker red", "#ef3348");
const colourFinishes = ["#e5bb25", "#26754d", "#754735", "#275d9e", "#e885a3", "#18191c"]
  .map((hex, index) => resin("snooker colour " + index, hex));

const contact = new DynamicTexture('soft contact', 64, scene, true);
const ctx = contact.getContext();
const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 31);
gradient.addColorStop(0, '#020918b8');
gradient.addColorStop(0.30, '#02091880');
gradient.addColorStop(0.62, '#02091824');
gradient.addColorStop(1, '#00000000');
ctx.fillStyle = gradient;
ctx.fillRect(0, 0, 64, 64);
contact.hasAlpha = true;
contact.update();
const shadow = material('contact shadow', '#ffffff', 0);
shadow.disableLighting = true;

shadow.diffuseTexture = contact;
shadow.useAlphaFromDiffuseTexture = true;
const contacts = ballMeshes.map(() => {
  const mesh = MeshBuilder.CreateGround('contact', { width: radius * 3, height: radius * 3 }, scene);
  mesh.material = shadow;
  mesh.isVisible = false;
  mesh.isPickable = false;
  return mesh;
});

const settings = document.querySelector<HTMLDialogElement>('#settings')!;
const select = (id: string) => document.querySelector<HTMLSelectElement>('#' + id)!;
const score = document.querySelector<HTMLElement>('#score')!;
const offlinePlayerTwoNameInput = document.querySelector<HTMLInputElement>('#offlinePlayerTwoName')!;
const offlinePlayerTwoNameRow = document.querySelector<HTMLElement>('#offlinePlayerTwoNameRow')!;
const offlinePlayerNameInput = document.querySelector<HTMLInputElement>('#offlinePlayerName')!;
const offlinePlayerNameRow = document.querySelector<HTMLElement>('#offlinePlayerNameRow')!;
const offlineAvatarPicker = document.querySelector<HTMLElement>('#offlineAvatarPicker')!;
const offlineAvatarOptions = document.querySelector<HTMLElement>('#offlineAvatarOptions')!;
let offlinePlayerOneName = '';
let offlinePlayerTwoName = 'Player 2';
const avatarOptions = [
  { id: 'man-classic', label: t('Male · Classic'), group: 'Male', background: '#8ad6e6', skin: '#f2c6a0', hair: '#26334a', shirt: '#315b8e', hairShape: 'M10 19C7 8 14 3 21 4c8 1 11 8 8 16l-4-4c-4 0-7-2-9-5-1 4-3 6-6 8Z', fringe: 'M10 13c4-1 6-4 7-7 2 4 5 6 10 6l1 5c-5-1-8-3-10-6-2 3-4 4-8 5Z', beard: '' },
  { id: 'man-curly', label: t('Male · Curls'), group: 'Male', background: '#b7a2ef', skin: '#bb7959', hair: '#182333', shirt: '#397b78', hairShape: 'M9 19C5 12 8 4 13 6c1-5 7-5 9-2 5-2 9 3 7 8 3 3 1 8-2 9l-2-7c-5 1-8-1-10-4-1 4-3 6-6 9Z', fringe: 'M10 14c2-5 5-5 6-9 2 4 5 5 10 4l2 7c-4-1-7-3-9-6-2 3-5 4-8 4Z', beard: 'M12 24c4 3 8 3 12 0l-2 5h-8Z' },
  { id: 'man-beard', label: t('Male · Beard'), group: 'Male', background: '#f3bd83', skin: '#e5b18c', hair: '#51372f', shirt: '#8a4c55', hairShape: 'M10 19C7 9 12 4 20 4c8 0 11 8 8 16l-4-4c-5 0-8-2-10-5-1 4-2 6-4 8Z', fringe: 'M10 14c4-1 6-4 7-7 2 4 5 6 10 6l1 5c-5-1-8-3-10-6-2 3-4 4-8 5Z', beard: 'M11 22c2 4 5 7 9 7s7-3 9-7l-2 8-7 5-7-5Z' },
  { id: 'woman-waves', label: t('Female · Waves'), group: 'Female', background: '#f3a5bb', skin: '#edc2a5', hair: '#48304d', shirt: '#a54f83', hairShape: 'M8 24C3 11 8 3 19 3c12 0 17 12 12 23l-4 5-1-16c-4 0-8-2-10-5-2 5-4 8-8 9Z', fringe: 'M9 14c4-1 6-5 7-9 2 4 6 6 11 6l1 7c-5-1-9-3-11-7-2 4-4 5-8 6Z', beard: '' },
  { id: 'woman-bob', label: t('Female · Bob'), group: 'Female', background: '#84c8b7', skin: '#bc8062', hair: '#202a42', shirt: '#396a85', hairShape: 'M8 22C5 8 11 3 20 3s15 7 12 20l-4 7-2-14c-5 0-9-2-11-5-1 5-3 8-6 10Z', fringe: 'M9 13c4 0 7-3 8-7 2 4 5 6 11 6l1 7c-5 0-9-3-11-6-2 3-4 4-8 5Z', beard: '' },
  { id: 'woman-curls', label: t('Female · Curls'), group: 'Female', background: '#e5a56e', skin: '#80503e', hair: '#211c2c', shirt: '#54734f', hairShape: 'M8 25C3 15 5 5 12 6c1-5 7-5 9-2 6-3 12 3 9 9 5 4 2 12-2 15l-1-14c-5 1-8-1-10-5-2 5-4 8-8 9Z', fringe: 'M9 14c2-5 5-5 6-9 2 4 5 5 10 4l2 8c-5-1-8-3-10-6-2 3-4 4-8 5Z', beard: '' },
] as const;
let offlinePlayerAvatars: [string, string] = ['man-classic', 'woman-waves'];
try {
  offlinePlayerOneName = localStorage.getItem('billiard-player-one-name')?.trim().slice(0, 24) || '';
  offlinePlayerTwoName = localStorage.getItem('billiard-player-two-name')?.trim().slice(0, 24) || offlinePlayerTwoName;
  for (const seat of [0, 1]) {
    const saved = localStorage.getItem('billiard-player-' + (seat + 1) + '-avatar');
    if (avatarOptions.some(option => option.id === saved)) offlinePlayerAvatars[seat] = saved!;
  }
} catch {}
offlinePlayerTwoNameInput.value = offlinePlayerTwoName;
function syncOfflinePlayerNameVisibility() {
  offlinePlayerTwoNameRow.hidden = select('opponent').value === 'computer';
}
select('opponent').onchange = syncOfflinePlayerNameVisibility;
let snooker = launch.state?.snooker ?? ('game' in launch.mode && launch.mode.game === 'snooker');
const hudToggle = document.querySelector<HTMLButtonElement>('#toggleHud')!;
const cameraZoomEl = document.querySelector<HTMLElement>('.camera-zoom');
cameraZoomEl?.addEventListener('click', event => {
  // Keep Space available after a pointer click while retaining keyboard focus.
  if (event.detail > 0 && event.target instanceof Element) event.target.closest<HTMLButtonElement>('.zoom-button')?.blur();
});
const footerEl = document.querySelector<HTMLElement>('footer')!;
const controlLayout = document.querySelector<HTMLSelectElement>('#controlLayout')!;
const controlSide = document.querySelector<HTMLSelectElement>('#controlSide')!;
try {
  controlLayout.value = localStorage.getItem('billiard-control-layout') === 'horizontal' ? 'horizontal' : 'vertical';
} catch {}
try {
  controlSide.value = localStorage.getItem('billiard-control-side') === 'left' ? 'left' : 'right';
} catch {}
document.body.classList.toggle('vertical-controls', controlLayout.value === 'vertical');
document.body.classList.toggle('vertical-controls-left', controlSide.value === 'left');
controlLayout.onchange = () => {
  document.body.classList.toggle('vertical-controls', controlLayout.value === 'vertical');
  try { localStorage.setItem('billiard-control-layout', controlLayout.value); } catch {}
  updateStrokeDirection();
  requestAnimationFrame(fitOverheadCamera);
};
controlSide.onchange = () => {
  document.body.classList.toggle('vertical-controls-left', controlSide.value === 'left');
  try { localStorage.setItem('billiard-control-side', controlSide.value); } catch {}
  requestAnimationFrame(fitOverheadCamera);
};
function syncZoomPlacement() {
  if (!cameraZoomEl || !hudToggle || !footerEl) return;
  if (mobileLayout.matches) {
    if (cameraZoomEl.parentElement !== footerEl) {
      hudToggle.after(cameraZoomEl);
    }
  } else {
    if (cameraZoomEl.parentElement === footerEl) {
      footerEl.before(cameraZoomEl);
    }
  }
}
syncZoomPlacement();
mobileLayout.addEventListener('change', syncZoomPlacement);
window.addEventListener('resize', syncZoomPlacement);
document.body.classList.add('compact-hud');
hudToggle.onclick = () => {
  const compact = document.body.classList.toggle('compact-hud');
  hudToggle.setAttribute('aria-expanded', String(!compact));
  hudToggle.setAttribute('aria-label', t(compact ? 'Expand game details' : 'Collapse game details'));
  hudToggle.innerHTML = compact ? '⌃<span></span>' : '⌄<span></span>';
  hudToggle.querySelector('span')!.textContent = t(compact ? 'Details' : 'Hide');
  requestAnimationFrame(fitOverheadCamera);
};
const baulkPoints = [new Vector3(-width / 2, 0.002, -0.74), new Vector3(width / 2, 0.002, -0.74)];
const dPoints = Array.from({ length: 65 }, (_, i) => {
  const a = i * Math.PI / 64;
  return new Vector3(Math.cos(a) * 0.22, 0.002, -0.74 - Math.sin(a) * 0.22);
});
const snookerLines = MeshBuilder.CreateLineSystem('snooker baulk and D', { lines: [baulkPoints, dPoints] }, scene);
snookerLines.color = Color3.FromHexString('#e7b5b0');
snookerLines.alpha = 0.55;
snookerLines.isPickable = false;
snookerLines.setEnabled(false);
let mode = launch.mode;
const isTournament = () => 'city' in mode || mode.kind === 'challenge';
const activeChallenge = () => mode.kind === 'challenge' ? getChallenge(mode.game, mode.challenge) : undefined;
const currentGame = () => snooker ? 'snooker' : 'pool';
let difficulty: Difficulty = mode.kind === 'computer' ? careerDifficulty(mode.city, mode.stage) : mode.kind === 'training' ? mode.difficulty : 'Medium';
const equippedCareerCue = mode.kind === 'computer' ? careerCue(mode.game) : undefined;
let careerAttempts = 0;
let careerBanked = false;
let careerClean = true;
let careerRacks: [number, number] = [0, 0];
let versusComputer = mode.kind === 'computer' || mode.kind === 'training' && mode.opponent === 'computer';
const online = new OnlineGame(mode.kind === 'computer' || mode.kind === 'challenge' || snooker);
let onlineMode = mode.kind === 'online';
let awaitingOnline = onlineMode && (!launch.state || launch.awaitingOnline === true);
let circuitMessage = '';
online.setCircuit(mode.kind === 'online' ? mode.city : undefined);
let wonByForfeit = false;
let returningHome = false;
let leavingMatch = false;
let groups: Groups = [null, null];
let winner: number | undefined;
let breaking = true;
let shotWasBreak = false;
let calledPocket: number | undefined;
let turn = 0;
let scores = [0, 0];
let colourAfterRed = false;
let finished = false;
let firstContact: number | undefined;
let shotTargets: number[] = [];
let previouslyPocketed: boolean[] = [];
let cpuWait = 0;
let balls = rack(false, Math.random);
function canControl() {
  return onlineMode ? online.active && turn === online.seat && online.remainingMs() > 0 : !versusComputer || turn === 0;
}
function playerName(seat: number) {
  return onlineMode ? seat === online.seat ? online.name : online.peerName : seat === 0 ? offlinePlayerOneName || online.name : versusComputer ? t('Computer') : offlinePlayerTwoName;
}
function avatarMarkup(id: string) {
  const avatar = avatarOptions.find(option => option.id === id) ?? avatarOptions[0];
  return `<svg viewBox="0 0 40 40" aria-hidden="true" focusable="false"><circle cx="20" cy="20" r="20" fill="${avatar.background}"/><path d="${avatar.hairShape}" fill="${avatar.hair}"/><rect x="17" y="23" width="6" height="9" rx="3" fill="${avatar.skin}"/><ellipse cx="20" cy="17" rx="8.5" ry="10" fill="${avatar.skin}"/><path d="${avatar.fringe}" fill="${avatar.hair}"/><path d="${avatar.beard}" fill="${avatar.hair}"/><path d="M16 17h1m6 0h1" stroke="#293142" stroke-width="1.5" stroke-linecap="round"/><path d="M18 22q2 1.5 4 0" fill="none" stroke="#a75450" stroke-width="1.2" stroke-linecap="round"/><path d="M6 40c1-7 5-10 11-11l3 3 3-3c6 1 10 4 11 11Z" fill="${avatar.shirt}"/></svg>`;
}
const colourNames = ['yellow', 'green', 'brown', 'blue', 'pink', 'black'];

function legalTargets() {
  const active = balls.flatMap((ball, index) => index && !ball.pocketed ? [index] : []);
  if (!snooker) return poolTargets(balls.map(ball => ball.pocketed), groups[turn]);
  const reds = active.filter(index => index <= 15);
  const colours = active.filter(index => index > 15);
  if (colourAfterRed) return colours;
  return reds.length ? reds : colours.slice(0, 1);
}

const playerDetails = document.querySelector<HTMLDialogElement>('#playerDetails')!;
let detailsSeat = 0;
document.getElementById('closePlayerDetails')!.onclick = () => playerDetails.close();
document.getElementById('openProfileFromDetails')?.addEventListener('click', () => {
  playerDetails.close();
  online.open();
});
function renderPlayerDetails() {
  document.getElementById('playerDetailsTitle')!.textContent = playerName(detailsSeat);
  offlinePlayerNameRow.hidden = onlineMode;
  offlineAvatarPicker.hidden = onlineMode;
  offlinePlayerNameInput.value = playerName(detailsSeat);
  offlineAvatarOptions.replaceChildren();
  for (const group of ['Male', 'Female']) {
    const category = document.createElement('div');
    category.className = 'avatar-choice-group';
    const label = document.createElement('span');
    label.textContent = t(group);
    const choices = document.createElement('div');
    choices.className = 'avatar-choice-buttons';
    for (const avatar of avatarOptions.filter(option => option.group === group)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'avatar-choice';
      button.setAttribute('aria-label', avatar.label);
      button.setAttribute('aria-pressed', String(offlinePlayerAvatars[detailsSeat] === avatar.id));
      button.title = avatar.label;
      button.innerHTML = avatarMarkup(avatar.id);
      button.onclick = () => {
        offlinePlayerAvatars[detailsSeat] = avatar.id;
        try { localStorage.setItem('billiard-player-' + (detailsSeat + 1) + '-avatar', avatar.id); } catch {}
        showScore();
      };
      choices.append(button);
    }
    category.append(label, choices);
    offlineAvatarOptions.append(category);
  }
  const current = finished ? winner === detailsSeat ? t('Winner') : t('Game finished') : turn === detailsSeat ? t('At the table now') : t('Waiting for their turn');
  const group = groups[detailsSeat];
  let summaryText = current + ' · ' + (snooker ? t('Score: {score}. Balls below are shared table totals.', { score: scores[detailsSeat] })
    : group ? t('{group} group', { group: t(group) }) : t('Open table · Groups unassigned. Showing all object balls.'));
  if (online.playerId && detailsSeat === (online.seat ?? 0)) {
    summaryText += ' · ID: ' + online.playerId;
  }
  document.getElementById('playerDetailsSummary')!.textContent = summaryText;
  const container = document.getElementById('playerDetailsBalls')!;
  container.replaceChildren();
  const indices = balls.flatMap((_, i) => i > 0 && (snooker || !group || groupOf(i) === group) ? [i] : []);
  for (const potted of [true, false]) {
    const numbers = indices.filter(i => balls[i].pocketed === potted);
    const section = document.createElement('section');
    section.className = 'player-ball-section';
    const heading = document.createElement('h3');
    heading.textContent = (potted ? t('Balls in') : t('Remaining')) + ' · ' + numbers.length;
    const tray = document.createElement('div');
    tray.className = 'player-detail-tray';
    for (const i of numbers) {
      const badge = ballBadge(i, snooker);
      const label = snooker ? t(i <= 15 ? 'Red' : colourNames[i - 16]) : t('Ball {number}', { number: i });
      badge.title = label;
      badge.setAttribute('aria-label', label);
      tray.append(badge);
    }
    if (!numbers.length) { const empty = document.createElement('small'); empty.textContent = potted ? t('No balls pocketed yet') : t('All cleared'); tray.append(empty); }
    section.append(heading, tray); container.append(section);
  }
  if (!snooker && group) {
    const eight = document.createElement('p');
    eight.textContent = balls[8].pocketed ? t('Black 8 · Pocketed') : t('Black 8') + ' · ' + t(indices.every(i => balls[i].pocketed) ? 'Clear to play — call a pocket' : 'Clear your group first');
    container.append(eight);
  }
}
function showScore() {
  if (playerDetails.open) renderPlayerDetails();
  score.replaceChildren(...[0, 1].map(seat => {
    const item = document.createElement('button');
    item.type = 'button';
    item.setAttribute('aria-haspopup', 'dialog');
    item.setAttribute('aria-controls', 'playerDetails');
    item.setAttribute('aria-label', t('{player}, view player details', { player: playerName(seat) }));
    item.onclick = () => { detailsSeat = seat; renderPlayerDetails(); playerDetails.showModal(); };
    item.className = 'player-score' + (turn === seat && !finished ? ' active' : '');
    if (turn === seat) item.setAttribute('aria-current', 'true');
    const marker = document.createElement('span');
    marker.className = 'group-marker ' + (snooker || !groups[seat] ? 'open' : groups[seat]!.toLowerCase());
    marker.setAttribute('aria-hidden', 'true');
    marker.classList.add('svg-group-marker');
    const icon = ballBadge(snooker ? 1 : groups[seat] === 'Stripes' ? 9 : groups[seat] === 'Solids' ? 1 : 0, snooker);
    marker.append(...icon.childNodes);
    const left = balls.filter((ball, index) => !ball.pocketed && groupOf(index) === groups[seat]).length;
    const name = document.createElement('strong');
    name.className = 'player-name';
    if (!onlineMode) {
      const avatar = document.createElement('span');
      avatar.className = 'player-avatar';
      avatar.innerHTML = avatarMarkup(offlinePlayerAvatars[seat]);
      name.append(avatar);
    }
    name.append(document.createTextNode(playerName(seat)));
    const detail = document.createElement('span');
    detail.className = 'player-group';
    const group = groups[seat];
    detail.textContent = snooker ? t('Score · {score}', { score: scores[seat] })
      : group ? t('{group} · {count} left', { group: t(group), count: left }) : t('Open table');
    const tray = document.createElement('span');
    tray.className = 'potted-balls';
    if (!snooker && groups[seat]) {
      const numbers = balls.flatMap((ball, index) => groupOf(index) === groups[seat] ? [{number: index, potted: ball.pocketed}] : []);
      numbers.sort((a, b) => Number(a.potted) - Number(b.potted) || a.number - b.number);
      for (const ball of numbers) {
        const badge = ballBadge(ball.number);
        badge.classList.add(ball.potted ? 'achieved' : 'pending');
        badge.title = t(ball.potted ? 'Ball {number} · pocketed' : 'Ball {number} · on table', { number: ball.number });
        badge.setAttribute('aria-label', badge.title);
        tray.append(badge);
      }
    } else {
      tray.classList.add('empty');
      tray.textContent = snooker ? 'Snooker' : t('Groups unassigned');
    }
    item.append(marker, name, detail, tray);
    if (turn === seat && !finished) {
      const turnBadge = document.createElement('span');
      turnBadge.className = 'player-turn';
      turnBadge.textContent = t('Playing');
      turnBadge.setAttribute('aria-label', t('Current player'));
      item.append(turnBadge);
    }
    return item;
  }));
}
offlinePlayerTwoNameInput.onchange = () => {
  offlinePlayerTwoName = offlinePlayerTwoNameInput.value.trim().slice(0, 24) || 'Player 2';
  offlinePlayerTwoNameInput.value = offlinePlayerTwoName;
  try { localStorage.setItem('billiard-player-two-name', offlinePlayerTwoName); } catch {}
  showScore();
};
offlinePlayerNameInput.onchange = () => {
  if (onlineMode) return;
  const name = offlinePlayerNameInput.value.trim().slice(0, 24) || (detailsSeat === 0 ? online.name : versusComputer ? 'Computer' : 'Player 2');
  if (detailsSeat === 0) {
    offlinePlayerOneName = name === online.name ? '' : name;
    try { localStorage.setItem('billiard-player-one-name', offlinePlayerOneName); } catch {}
  } else {
    offlinePlayerTwoName = name;
    offlinePlayerTwoNameInput.value = name;
    try { localStorage.setItem('billiard-player-two-name', name); } catch {}
  }
  offlinePlayerNameInput.value = name;
  showScore();
};

function respot(index: number) {
  const spot = rack(snooker)[index];
  const available = (x: number, z: number) => balls.every((ball, other) =>
    other === index || ball.pocketed || Math.hypot(ball.x - x, ball.z - z) >= 2 * radius + 0.001);
  let z = spot.z;
  if (!available(spot.x, z)) {
    for (let offset = 0.005; offset < length; offset += 0.005) {
      const candidate = [spot.z + offset, spot.z - offset].find(value =>
        Math.abs(value) < length / 2 - radius && available(spot.x, value));
      if (candidate !== undefined) {
        z = candidate;
        break;
      }
    }
  }
  Object.assign(balls[index], spot, { z });
  delete balls[index].orientation;
  ballMeshes[index].position.set(spot.x, radius, z);
}

function challengeResult(challenge: NonNullable<ReturnType<typeof activeChallenge>>) {
  if (winner !== 0) return t('Try again or return to challenges.');
  return t(completeChallenge(challenge) ? 'Challenge completed.' : 'Challenge completed. Progress could not be saved.');
}

function continueCareerSeries(roundWinner?: number) {
  if (mode.kind !== 'computer' || !careerStage(mode.city, mode.stage, mode.game).bestOfThree) return false;
  if (roundWinner === 0 || roundWinner === 1) {
    careerRacks[roundWinner]++;
    if (careerRacks[roundWinner] === 2) return false;
  }
  resetMatch(true);
  saveGame();
  return true;
}

function finishShot() {
  const potted = balls.flatMap((ball, index) => index && ball.pocketed && !previouslyPocketed[index] ? [index] : []);
  const scratch = balls[0].pocketed;
  if (mode.kind === 'computer' && turn === 0 && scratch) careerClean = false;
  const challenge = activeChallenge();
  if (challenge) {
    const clear = challenge.kind === 'clear';
    const legal = !scratch && (clear
      ? firstContact !== undefined && shotTargets.includes(firstContact) && potted.every(index => shotTargets.includes(index))
      : firstContact === 1 && potted.every(index => index === 1));
    const won = legal && (clear ? legalTargets().length === 0 : challenge.kind === 'contact' ||
      potted.includes(1) && (challenge.kind !== 'bank' || careerBanked));
    if (clear && legal && potted.length && !won) {
      showScore();
      showReadyStatus();
      saveGame();
      return;
    }
    careerAttempts++;
    if (!won && careerAttempts < challenge.attempts) {
      resetMatch(true);
    } else {
      winner = won ? 0 : 1;
      finished = true;
      circuitMessage = challengeResult(challenge);
      showScore();
    }
    showReadyStatus();
    saveGame();
    return;
  }
  if (!snooker) {
    const eightPocket = balls[8].pocketed ? pockets.reduce((closest, pocket, index) =>
      Math.hypot(pocket.x - balls[8].x, pocket.z - balls[8].z) < Math.hypot(pockets[closest].x - balls[8].x, pockets[closest].z - balls[8].z) ? index : closest, 0) : undefined;
    const result = resolvePoolShot({ turn, groups, targets: shotTargets, firstContact, potted, scratch, breaking: shotWasBreak, calledPocket, eightPocket });
    if (result.winner !== undefined && continueCareerSeries(result.winner)) return;
    groups = result.groups;
    winner = result.winner;
    finished = winner !== undefined;
    if (result.respotEight) respot(8);
    if (scratch) respot(0);
    if (!finished) turn = result.turn;
    placement = result.foul && !finished ? 'foul' : undefined;
    if (placement && canControl() && viewMode) viewToggle.click();
    breaking = false;
    calledPocket = undefined;
    cpuWait = 0.85;
    if (finished && isTournament()) {
      if (mode.kind === 'computer') recordComputerResult();
      else if (online.active && online.seat === 0) online.send({ type: 'state', state: gameState() });
      saveGame();
    }
    showScore();
    showReadyStatus();
    return;
  }
  const foul = scratch || firstContact === undefined || !shotTargets.includes(firstContact) ||
    potted.some(index => !shotTargets.includes(index)) || (colourAfterRed && potted.length > 1);
  const value = (index: number) => index <= 15 ? 1 : index - 14;
  if (foul) scores[1 - turn] += Math.max(4, value(shotTargets[0] ?? 0), value(firstContact ?? 0), ...potted.map(value));
  if (colourAfterRed || shotTargets[0] <= 15 || foul) {
    for (const index of potted) if (index > 15) respot(index);
  }
  colourAfterRed = !foul && potted.some(index => index <= 15);
  if (!foul) scores[turn] += potted.reduce((sum, index) => sum + value(index), 0);
  if (scratch) respot(0);
  breaking = false;
  finished = legalTargets().length === 0;
  if (finished) {
    winner = scores[0] === scores[1] ? undefined : scores[0] > scores[1] ? 0 : 1;
    if (continueCareerSeries(winner)) return;
    if (mode.kind === 'computer') {
      recordComputerResult();
      saveGame();
    }
  } else if (foul || !potted.length) {
    turn = 1 - turn;
  }
  if (foul && !finished) {
    placement = 'foul';
    if (canControl() && viewMode) viewToggle.click();
  }
  cpuWait = 0.85;
  showScore();
  showReadyStatus();

}
balls.forEach((ball, index) => ballMeshes[index].position.set(ball.x, radius, ball.z));
let aim = new Vector3(0, 0, 1);
let rolling = false;
let cameraTarget: number | undefined;
let accumulator = 0;
const fixedStep = 1 / 300;
const aimLine = MeshBuilder.CreateLines('aim guide', {
  points: [Vector3.Zero(), Vector3.Forward()], updatable: true,
}, scene);
aimLine.color = Color3.FromHexString('#f0e6ba');
aimLine.isPickable = false;
const objectGuide = MeshBuilder.CreateDashedLines('object ball path', { points: [Vector3.Zero(), Vector3.Forward()], dashNb: 36, updatable: true }, scene);
objectGuide.color = Color3.FromHexString('#83ded0');
objectGuide.isPickable = false;
const ghostBall = MeshBuilder.CreateTorus('predicted cue ball contact', {diameter: 2 * radius, thickness: 0.002, tessellation: 40}, scene);
ghostBall.material = material('contact guide', '#83ded0');
ghostBall.isPickable = false;
const pocketGuide = MeshBuilder.CreateTorus('lined up pocket', {diameter: 0.16, thickness: 0.004, tessellation: 48}, scene);
pocketGuide.material = ghostBall.material;
pocketGuide.isPickable = false;
const ballHand = document.querySelector<HTMLElement>('#ballHand')!;
const cue = MeshBuilder.CreateCylinder('cue', { height: cueLength, diameterTop: 0.011, diameterBottom: 0.027, tessellation: 32 }, scene);
cue.material = material('cue maple', '#cb9358', 0.26);
cue.isPickable = false;
const cueButt = material('cue butt', '#673925', 0.28);
if (!headlessGraphics) {
  // Coordinates run from the bumper to the tip along the cue's local Y axis.
  function cueSection(name: string, from: number, to: number, finish: StandardMaterial, thickness = 0.00035) {
    const diameter = (at: number) => 0.027 - 0.016 * at / cueLength + thickness * 2;
    const segment = MeshBuilder.CreateCylinder(name, {
      height: to - from, diameterTop: diameter(to), diameterBottom: diameter(from), tessellation: 32,
    }, scene);
    segment.parent = cue;
    segment.position.y = (from + to - cueLength) / 2;
    segment.material = finish;
    segment.isPickable = false;
  }
  cueSection('rubber bumper', 0, 0.012, trim);
  cueSection('finished butt sleeve', 0.012, 0.29, cueButt);
  cueSection('butt collar', 0.023, 0.027, brass, 0.00055);
  cueSection('joint collar', 0.286, 0.294, brass, 0.00055);
  cueSection('ivory ferrule', cueLength - 0.021, cueLength - 0.005, pearl);
  cueSection('chalked leather tip', cueLength - 0.005, cueLength, material('chalked tip', '#436785'));
}
let strike = 0;
let placement: "break" | "foul" | undefined = "break";
let shotPower = 0;
let tipX = 0, tipY = 0;
let pull = 0;
let strokePointer: number | undefined;
let strokeStart = 0;
const tip = document.querySelector<HTMLButtonElement>("#tip")!;
const mark = document.querySelector<HTMLElement>("#tipMark")!;
const spinDialog = document.querySelector<HTMLDialogElement>('#spinDialog')!;
const spinBall = document.querySelector<HTMLButtonElement>('#spinBall')!;
const spinMark = document.querySelector<HTMLElement>('#spinMark')!;
const spinValue = document.querySelector<HTMLOutputElement>('#spinValue')!;
const autoResetSpin = document.querySelector<HTMLButtonElement>('#autoResetSpin')!;
let resetSpinAfterShot = false;
try { resetSpinAfterShot = localStorage.getItem('billiard-reset-spin') === 'on'; } catch {}
autoResetSpin.setAttribute('aria-checked', String(resetSpinAfterShot));
autoResetSpin.onclick = () => {
  resetSpinAfterShot = !resetSpinAfterShot;
  autoResetSpin.setAttribute('aria-checked', String(resetSpinAfterShot));
  try { localStorage.setItem('billiard-reset-spin', resetSpinAfterShot ? 'on' : 'off'); } catch {}
};
const stroke = document.querySelector<HTMLButtonElement>("#stroke")!;
const powerValue = document.querySelector<HTMLOutputElement>("#powerValue")!;
function updateStrokeDirection() {
  const vertical = document.body.classList.contains('vertical-controls') && !mobileLayout.matches;
  stroke.setAttribute('aria-label', t(vertical ? 'Pull the cue down and release to shoot' : 'Pull the cue left and release to shoot'));
  stroke.setAttribute('title', t(vertical ? 'Pull down and release to shoot' : 'Pull left and release to shoot'));
}
function showPull() {
  const percent = Math.round(pull * 100);
  powerValue.value = percent + "%";
  stroke.style.setProperty("--power", percent + "%");
  stroke.style.setProperty("--cue-pull", -percent * 0.58 + "%");
}
updateStrokeDirection();
function setTip(x: number, y: number) {
  const limit = Math.max(1, Math.hypot(x, y) / 0.78);
  tipX = x / limit;
  tipY = y / limit;
  mark.style.left = (50 + tipX * 50) + "%";
  mark.style.top = (50 - tipY * 50) + "%";
  spinMark.style.left = mark.style.left;
  spinMark.style.top = mark.style.top;
  const horizontal = Math.abs(tipX) < 0.02 ? '' : Math.round(Math.abs(tipX) * 100) + '% ' + t(tipX < 0 ? 'left' : 'right');
  const vertical = Math.abs(tipY) < 0.02 ? '' : Math.round(Math.abs(tipY) * 100) + '% ' + t(tipY > 0 ? 'follow' : 'draw');
  spinValue.value = [horizontal, vertical].filter(Boolean).join(' · ') || t('Center ball · No spin');
  spinBall.setAttribute('aria-label', t('{spin}. Arrow keys adjust; Home resets to center.', { spin: spinValue.value }));
  tip.title = t('Contact offset: {x}% horizontal, {y}% vertical', { x: Math.round(tipX * 100), y: Math.round(tipY * 100) });
}
setTip(0, 0);
function selectTip(event: PointerEvent) {
  const bounds = spinBall.getBoundingClientRect();
  setTip(2 * (event.clientX - bounds.left) / bounds.width - 1, 1 - 2 * (event.clientY - bounds.top) / bounds.height);
}
tip.onclick = () => {
  if (!canControl() || rolling || strike || strokePointer !== undefined) return;
  spinDialog.showModal();
  tip.setAttribute('aria-expanded', 'true');
};
spinDialog.addEventListener('close', () => {
  tip.setAttribute('aria-expanded', 'false');
  tip.focus();
});
for (const id of ['closeSpin', 'applySpin']) document.getElementById(id)!.onclick = () => spinDialog.close();
document.getElementById('resetSpin')!.onclick = () => setTip(0, 0);
spinBall.onpointerdown = event => {
  if (!canControl() || !event.isPrimary || event.button !== 0 || rolling || strike || strokePointer !== undefined) return;
  spinBall.setPointerCapture(event.pointerId);
  selectTip(event);
};
spinBall.onpointermove = event => {
  if (canControl() && !rolling && !strike && strokePointer === undefined && spinBall.hasPointerCapture(event.pointerId)) selectTip(event);
};
spinBall.onkeydown = event => {
  if (!canControl() || rolling || strike || strokePointer !== undefined) return;
  const offsets: Record<string, [number, number]> = { ArrowLeft: [-0.1, 0], ArrowRight: [0.1, 0], ArrowUp: [0, 0.1], ArrowDown: [0, -0.1] };
  const offset = offsets[event.key];
  if (event.key === "Home") setTip(0, 0);
  else if (offset) setTip(tipX + offset[0], tipY + offset[1]);
  else return;
  event.preventDefault();
  event.stopPropagation();
};
function fire(strength: number) {
  if (rolling || strike) return;
  if (onlineMode && (!online.active || online.remainingMs() <= 0)) return;
  if (!snooker && legalTargets().includes(8) && calledPocket === undefined) {
    if (!tvEnabled) setPocketPickerOpen(true);
    return;
  }
  aimLocked = false;
  tableStroke = undefined;
  if (onlineMode && online.seat === 1) {
    online.send({ type: 'input', input: { action: 'shoot', strength, aim: [aim.x, aim.z], tip: [tipX, tipY], position: [balls[0].x, balls[0].z], calledPocket } });
    return;
  }
  shotWasBreak = breaking;
  placement = undefined;
  firstContact = undefined;
  careerBanked = false;
  shotTargets = legalTargets();
  previouslyPocketed = balls.map(ball => ball.pocketed);
  shotPower = Math.max(0, Math.min(1, Number.isFinite(strength) ? strength : 0));
  strike = 0.19;
}
stroke.onpointerdown = event => {
  if (!event.isPrimary || event.button !== 0 || rolling || strike || !canControl() || finished) return;
  if (strokePointer !== undefined || aimPointer !== undefined) return;
  strokePointer = event.pointerId;
  strokeStart = document.body.classList.contains('vertical-controls') && !mobileLayout.matches ? event.clientY : event.clientX;
  stroke.setPointerCapture(event.pointerId);
};
function updatePull(event: PointerEvent) {
  const vertical = document.body.classList.contains('vertical-controls') && !mobileLayout.matches;
  pull = Math.min(1, Math.max(0, (vertical ? event.clientY - strokeStart : strokeStart - event.clientX) / 110));
  showPull();
}
stroke.onpointermove = event => {
  if (strokePointer === event.pointerId) updatePull(event);
};
function clearStroke() {
  strokePointer = undefined;
  pull = 0;
  showPull();
}
stroke.onpointerup = event => {
  if (strokePointer !== event.pointerId) return;
  updatePull(event);
  const strength = pull;
  clearStroke();
  if (strength >= 0.08) fire(strength);
};
stroke.onlostpointercapture = event => {
  if (strokePointer === event.pointerId) clearStroke();
};
let aimPointer: number | undefined;
let aimTargetPointer: number | undefined;
let movingCueBall = false;
let aimPointerCueSide = false;
let aimLocked = false;
let lastCueTap = 0;
let tableStroke: { x: number; y: number; dx: number; dy: number } | undefined;
const viewToggle = document.querySelector<HTMLButtonElement>('#viewMode')!;
const lockButton = document.querySelector<HTMLButtonElement>('#lockAim')!;
const fineAim = document.querySelector<HTMLButtonElement>('#fineAim')!;
let fineAimPosition = 0;
function canFineAim() {
  return canControl() && !finished && !rolling && !strike && !viewMode && !aimLocked && strokePointer === undefined;
}
function fineAimCoordinate(event: PointerEvent) {
  return window.matchMedia('(max-width: 600px)').matches ? event.clientX : event.clientY;
}
function adjustFineAim(degrees: number) {
  const angle = Math.atan2(aim.x, aim.z) + degrees * Math.PI / 180;
  aim.set(Math.sin(angle), 0, Math.cos(angle));
}
fineAim.onpointerdown = event => {
  if (!canFineAim() || aimPointer !== undefined || !event.isPrimary || event.button !== 0) return;
  event.preventDefault();
  aimPointer = event.pointerId;
  fineAimPosition = fineAimCoordinate(event);
  fineAim.setPointerCapture(event.pointerId);
};
fineAim.onpointermove = event => {
  if (!fineAim.hasPointerCapture(event.pointerId) || aimPointer !== event.pointerId) return;
  const position = fineAimCoordinate(event);
  const direction = window.matchMedia('(max-width: 600px)').matches ? 1 : -1;
  if (canFineAim()) adjustFineAim((position - fineAimPosition) * direction * 0.08);
  fineAimPosition = position;
};
function endFineAim(event: PointerEvent) {
  if (aimPointer === event.pointerId) aimPointer = undefined;
  if (fineAim.hasPointerCapture(event.pointerId)) fineAim.releasePointerCapture(event.pointerId);
}
fineAim.onpointerup = endFineAim;
fineAim.onpointercancel = endFineAim;
fineAim.onlostpointercapture = endFineAim;
fineAim.onkeydown = event => {
  if (!['ArrowLeft', 'ArrowRight'].includes(event.key) || !canFineAim() || aimPointer !== undefined) return;
  event.preventDefault();
  adjustFineAim((event.key === 'ArrowLeft' ? -1 : 1) * (event.shiftKey ? 0.02 : 0.1));
};
document.addEventListener('keydown', event => {
  if (event.defaultPrevented || tvEnabled || event.ctrlKey || event.altKey || event.metaKey || document.querySelector('dialog[open]')) return;
  if ((event.target as Element)?.closest('input, select, textarea, [contenteditable="true"]')) return;
  if (!canFineAim() || aimPointer !== undefined) return;
  const direction = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -1, ArrowDown: 1 }[event.key];
  if (!direction) return;
  event.preventDefault();
  const fine = event.shiftKey || event.key === 'ArrowUp' || event.key === 'ArrowDown';
  adjustFineAim(direction * (fine ? 0.1 : 1));
});
const callPocket = document.querySelector<HTMLElement>('#callPocket')!;
const pocketPicker = document.querySelector<HTMLElement>('#pocketPicker')!;
const openPocketPicker = document.querySelector<HTMLButtonElement>('#openPocketPicker')!;
const pocketChoice = document.querySelector<HTMLSelectElement>('#pocketChoice')!;
function setPocketPickerOpen(open: boolean) {
  const moveFocus = callPocket.contains(document.activeElement);
  openPocketPicker.setAttribute('aria-expanded', String(open));
  pocketPicker.hidden = !open;
  openPocketPicker.hidden = open;
  if (moveFocus) (open ? pocketChoice : openPocketPicker).focus({ preventScroll: true });
}
openPocketPicker.onclick = () => setPocketPickerOpen(true);
document.querySelector<HTMLButtonElement>('#dismissPocketPicker')!.onclick = () => setPocketPickerOpen(false);
function selectPocket(pocket: number | undefined) {
  calledPocket = pocket;
  if (pocket !== undefined) callPocket.hidden = true;
  showReadyStatus();
}
pocketChoice.onchange = () => {
  if (!canControl() || rolling || strike || !legalTargets().includes(8)) return;
  selectPocket(pocketChoice.value === '' ? undefined : Number(pocketChoice.value));
};
function toggleAimLock() {
  if (!canControl() || rolling || strike || finished || viewMode) return;
  aimLocked = !aimLocked;
  lastCueTap = 0;
  tableStroke = undefined;
  clearStroke();
  showReadyStatus();
}
lockButton.onclick = toggleAimLock;

function showReadyStatus() {
  const objective = document.querySelector<HTMLElement>('#careerObjective')!;
  const challenge = activeChallenge();
  objective.hidden = (mode.kind !== 'computer' && !challenge) || finished;
  if (challenge && !finished) {
    objective.textContent = t(challenge.objective) + ' · ' + t('Attempts left: {count}', { count: challenge.attempts - careerAttempts });
  } else if (mode.kind === 'computer' && !finished) {
    const stage = careerStage(mode.city, mode.stage, mode.game);
    const counter = stage.bestOfThree ? t(snooker ? 'Frames won: You {player} · Computer {computer}'
      : 'Racks won: You {player} · Computer {computer}', { player: careerRacks[0], computer: careerRacks[1] }) : '';
    objective.textContent = [t(stage.objective), counter, careerClean ? t(careerGoal) : ''].filter(Boolean).join(' · ');
  }
  if (tvEnabled) { updateTvControls(); return; }
  if (online.departureDeadline !== undefined) {
    status.textContent = t('Opponent left. Waiting for their timer to expire…');
    return;
  }
  if (finished) {
    status.textContent = challenge ? t(winner === 0 ? 'Challenge completed' : 'Challenge failed')
      : winner !== undefined
      ? t(wonByForfeit ? '{player} wins by forfeit!' : '{player} wins!', { player: playerName(winner) })
      : scores[0] === scores[1] ? t('Match drawn.') : t('{player} wins!', { player: playerName(scores[0] > scores[1] ? 0 : 1) });
    return;
  }
  if (awaitingOnline) { status.textContent = t('Waiting for an opponent. Open Players to see matchmaking.'); return; }
  if (!canControl()) {
    status.textContent = onlineMode ? online.active ? t('{player} is lining up a shot.', { player: playerName(turn) })
      : t('Online game paused. Reconnect through Players or choose End game.') : t('Computer is lining up a shot.');
    return;
  }
  if (aimLocked && !viewMode) {
    status.textContent = t('Aim locked · Drag back on the table and release to shoot. Double-tap the cue ball to unlock.');
    return;
  }
  if (placement && !viewMode) {
    status.textContent = placement === 'break' ? t('Drag the cue ball behind the head string. Aim on the cloth.') : t('Ball in hand. Drag the cue ball or aim on the cloth.');
    return;
  }
  status.textContent = viewMode ? t('Drag to orbit. Pinch or scroll to zoom.')
    : t(window.matchMedia('(pointer: coarse)').matches
      ? '{player} · Tap to aim, slide Fine aim, then pull the cue to shoot.'
      : '{player} · ← → Aim · Shift + arrows for fine aim', { player: playerName(turn) });
}

function canPanTable() {
  return cameraZoom > 1 && !tvEnabled && !viewMode && (usesSvgTable() || !uses2dTable());
}
function endPanDrag() {
  if (!panDrag) return;
  const { canvas, id } = panDrag;
  panDrag = undefined;
  if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
  document.body.classList.remove('table-panning');
}
function syncPanControls() {
  const available = canPanTable();
  if (!available) panToggled = spaceHeld = false;
  const active = panToggled || spaceHeld;
  if (!active) endPanDrag();
  panButton.disabled = !available;
  panButton.setAttribute('aria-pressed', String(active));
  document.body.classList.toggle('table-pan-ready', active);
}
function panPerspectiveBy(dx: number, dy: number) {
  if (!canPanTable()) {
    camera.targetScreenOffset.set(0, 0);
    return;
  }
  const bounds = canvas.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return;
  const halfHeight = camera.radius * Math.tan(camera.fov / 2);
  const unitsPerPixel = halfHeight * 2 / bounds.height;
  const maxX = bounds.width * unitsPerPixel * (cameraZoom - 1) / 2;
  const maxY = halfHeight * (cameraZoom - 1);
  const offset = camera.targetScreenOffset;
  offset.set(
    Math.max(-maxX, Math.min(maxX, offset.x + dx * unitsPerPixel)),
    Math.max(-maxY, Math.min(maxY, offset.y - dy * unitsPerPixel)),
  );
}
panButton.onclick = () => {
  panToggled = !panToggled;
  syncPanControls();
};
document.addEventListener('keydown', event => {
  if (event.code !== 'Space' || event.defaultPrevented || !canPanTable() || event.ctrlKey || event.altKey || event.metaKey || document.querySelector('dialog[open]')) return;
  if ((event.target as Element)?.closest('input:not([type="range"]), select, textarea, [contenteditable], button:focus-visible, a:focus-visible')) return;
  event.preventDefault();
  if (spaceHeld) return;
  spaceHeld = true;
  syncPanControls();
});
document.addEventListener('keyup', event => {
  if (event.code !== 'Space' || !spaceHeld) return;
  spaceHeld = false;
  syncPanControls();
});
window.addEventListener('blur', () => {
  spaceHeld = false;
  endPanDrag();
  syncPanControls();
});
syncPanControls();

viewToggle.onclick = () => {

  viewMode = !viewMode;
  syncPanControls();
  syncTableSurface();
  viewToggle.querySelector<HTMLElement>('.hud-label')!.textContent = t(viewMode ? 'Orbit on' : 'Orbit');
  viewToggle.setAttribute('aria-pressed', String(viewMode));
  if (viewMode) {
    camera.targetScreenOffset.set(0, 0);
    camera.mode = Camera.PERSPECTIVE_CAMERA;
    camera.fov = zoomFov();
    camera.attachControl(canvas, true);
  } else {
    camera.detachControl();
    fitOverheadCamera();
  }
  if (!rolling && !strike) showReadyStatus();
};

function aimAtPointer(event: PointerEvent, starting = false) {
  if (aimLocked || viewMode || rolling || strike || !canControl() || finished || strokePointer !== undefined) return;
  const hit = tableHit(event);
  if (!hit) return;
  if (starting) {
    movingCueBall = Boolean(placement) && Math.hypot(hit.x - balls[0].x, hit.z - balls[0].z) <= 2.5 * radius;
    const pointerDirection = new Vector3(hit.x - balls[0].x, 0, hit.z - balls[0].z);
    aimPointerCueSide = pointerDirection.lengthSquared() > radius * radius && Vector3.Dot(pointerDirection, aim) < 0;
  }
  if (placement && movingCueBall) {
    if (starting) return;
    const xLimit = width / 2 - radius;
    const zLimit = length / 2 - radius;
    const x = Math.max(-xLimit, Math.min(xLimit, hit.x));
    const z = Math.max(-zLimit, Math.min(placement === "break" ? -length / 4 : zLimit, hit.z));
    if (pockets.some(pocket => Math.hypot(pocket.x - x, pocket.z - z) < 0.085)) return;
    if (balls.slice(1).some(ball => !ball.pocketed && Math.hypot(ball.x - x, ball.z - z) < 2 * radius + 0.001)) return;
    Object.assign(balls[0], { x, z });
    return;
  }
  const next = new Vector3(hit.x - balls[0].x, 0, hit.z - balls[0].z);
  if (next.lengthSquared() > radius * radius) aim = (aimPointerCueSide ? next.negate() : next).normalize();
}

function tableHit(event: PointerEvent, includeRails = false) {
  const bounds = activeTableCanvas().getBoundingClientRect();
  if (uses2dTable()) return tvTable?.pick(event.clientX - bounds.left, event.clientY - bounds.top, includeRails);
  return scene.pick(event.clientX - bounds.left, event.clientY - bounds.top, mesh => mesh === bed)?.pickedPoint;
}
function targetBallAtPointer(event: PointerEvent, bounds: DOMRect) {
  if (uses2dTable()) {
    const hit = tableHit(event);
    if (!hit) return undefined;
    let nearest: number | undefined;
    let nearestDistance = (radius * 1.5) ** 2;
    for (let index = 1; index < balls.length; index++) {
      if (balls[index].pocketed) continue;
      const distance = (balls[index].x - hit.x) ** 2 + (balls[index].z - hit.z) ** 2;
      if (distance <= nearestDistance) {
        nearest = index;
        nearestDistance = distance;
      }
    }
    return nearest;
  }
  const picked = scene.pick(event.clientX - bounds.left, event.clientY - bounds.top, mesh => ballMeshes.some(ballMesh => ballMesh === mesh));
  if (!picked?.hit || !picked.pickedMesh) return undefined;
  const index = ballMeshes.findIndex(mesh => mesh === picked.pickedMesh);
  return index > 0 && !balls[index].pocketed ? index : undefined;
}
for (const controlCanvas of [canvas, tvCanvas]) {
  controlCanvas.addEventListener('contextmenu', event => event.preventDefault());
  controlCanvas.addEventListener('pointerdown', event => {
    if (panDrag || strokePointer !== undefined || aimPointer !== undefined || !event.isPrimary || event.button !== 0) return;
    if (canPanTable() && (panToggled || spaceHeld)) {
      event.preventDefault();
      lastCueTap = 0;
      panDrag = { canvas: controlCanvas, id: event.pointerId, x: event.clientX, y: event.clientY };
      controlCanvas.setPointerCapture(event.pointerId);
      document.body.classList.add('table-panning');
      return;
    }
    if (viewMode || !canControl() || finished || rolling || strike) return;
    event.preventDefault();
    const bounds = controlCanvas.getBoundingClientRect();
    if (!snooker && legalTargets().includes(8)) {
      if (uses2dTable()) {
        const hit = tableHit(event, true);
        const index = hit ? pockets.findIndex(p => Math.hypot(p.x - hit.x, p.z - hit.z) <= 0.09) : -1;
        if (index >= 0) { selectPocket(index); return; }
      } else {
        const selected = scene.pick(event.clientX - bounds.left, event.clientY - bounds.top, mesh => pocketSelectors.some(selector => selector === mesh));
        if (selected?.pickedMesh) {
          selectPocket(pocketSelectors.findIndex(selector => selector === selected.pickedMesh));
          return;
        }
      }
    }
    const hit = tableHit(event);
    const cueTap = hit && Math.hypot(hit.x - balls[0].x, hit.z - balls[0].z) < 2.5 * radius;
    if (cueTap && event.timeStamp - lastCueTap < 350 && lastCueTap > 0) {
      toggleAimLock();
      return;
    }
    lastCueTap = cueTap ? event.timeStamp : 0;
    aimPointer = event.pointerId;
    controlCanvas.setPointerCapture(event.pointerId);
    movingCueBall = false;
    if (aimLocked) {
      const viewport = camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight());
      const origin = new Vector3(balls[0].x, radius, balls[0].z);
      const from = uses2dTable() ? tvTable!.project(origin.x, origin.z) : Vector3.Project(origin, Matrix.Identity(), scene.getTransformMatrix(), viewport);
      const to = uses2dTable() ? tvTable!.project(origin.x + aim.x, origin.z + aim.z) : Vector3.Project(origin.add(aim), Matrix.Identity(), scene.getTransformMatrix(), viewport);
      const dx = (to.x - from.x) * (uses2dTable() ? 1 : bounds.width / engine.getRenderWidth());
      const dy = (to.y - from.y) * (uses2dTable() ? 1 : bounds.height / engine.getRenderHeight());
      const magnitude = Math.max(1, Math.hypot(dx, dy));
      tableStroke = { x: event.clientX, y: event.clientY, dx: dx / magnitude, dy: dy / magnitude };
      return;
    }
    const target = targetBallAtPointer(event, bounds);
    if (target !== undefined) {
      const direction = directionToBall(balls[0], balls[target]);
      if (direction) {
        aim.set(direction.x, 0, direction.z);
        aimTargetPointer = target;
        return;
      }
    }
    aimAtPointer(event, true);
  });
  function updateTablePull(event: PointerEvent) {
    if (!tableStroke) return;
    pull = Math.max(0, Math.min(1, -((event.clientX - tableStroke.x) * tableStroke.dx + (event.clientY - tableStroke.y) * tableStroke.dy) / 110));
    showPull();
  }
  controlCanvas.addEventListener('pointermove', event => {
    if (panDrag?.id === event.pointerId) {
      const dx = event.clientX - panDrag.x;
      const dy = event.clientY - panDrag.y;
      panDrag.x = event.clientX;
      panDrag.y = event.clientY;
      if (tvTable instanceof SvgTable && usesSvgTable()) tvTable.panBy(dx, dy);
      else panPerspectiveBy(dx, dy);
      return;
    }
    if (aimPointer !== event.pointerId) return;
    if (tableStroke) updateTablePull(event);
    else if (aimTargetPointer !== undefined) return;
    else aimAtPointer(event);
  });
  controlCanvas.addEventListener('pointercancel', event => {
    if (panDrag?.id === event.pointerId) endPanDrag();
  });
  controlCanvas.addEventListener('pointerup', event => {
    if (panDrag?.id === event.pointerId) {
      endPanDrag();
      return;
    }
    if (aimPointer !== event.pointerId) return;
    aimPointer = undefined;
    if (tableStroke) {
      updateTablePull(event);
      const strength = pull;
      tableStroke = undefined;
      clearStroke();
      if (strength >= 0.08) fire(strength);
      return;
    }
    if (aimTargetPointer === undefined) aimAtPointer(event);
    aimTargetPointer = undefined;
    movingCueBall = false;
  });
  controlCanvas.addEventListener('lostpointercapture', event => {
    if (panDrag?.id === event.pointerId) endPanDrag();
    if (aimPointer !== event.pointerId) return;
    aimPointer = undefined;
    aimTargetPointer = undefined;
    movingCueBall = false;
    tableStroke = undefined;
    clearStroke();
  });
}

document.querySelector<HTMLButtonElement>('#camera')!.onclick = event => {
  endPanDrag();
  overhead = !overhead;
  syncPanControls();
  syncTableSurface();
  cameraTarget = overhead ? 0.025 : 0.83;
  if (overhead) fitOverheadCamera();
  else {
    camera.mode = Camera.PERSPECTIVE_CAMERA;
    camera.fov = zoomFov();
  }
  const button = event.currentTarget as HTMLButtonElement;
  button.querySelector<HTMLElement>('.hud-label')!.textContent = t(overhead ? '3D view' : 'Top view');
  button.setAttribute('aria-label', t(overhead ? 'Switch to perspective view' : 'Switch to top-down view'));
};
function resetMatch(continueCareer = false) {
  wonByForfeit = false;
  applyTableFinish();
  tvContext = '';
  if (!continueCareer) {
    careerAttempts = 0;
    careerClean = true;
    careerRacks = [0, 0];
  }
  const challenge = activeChallenge();
  const preset = challenge ? challengeLayout(challenge) : undefined;
  balls = preset ?? rack(snooker, Math.random);
  careerBanked = false;
  turn = 0;
  scores = [0, 0];
  groups = preset ? ['Solids', 'Stripes'] : [null, null];
  winner = undefined;
  breaking = !preset;
  calledPocket = undefined;
  shotWasBreak = false;
  firstContact = undefined;
  shotTargets = [];
  previouslyPocketed = [];
  shotPower = 0;
  aimLocked = false;
  lastCueTap = 0;
  tableStroke = undefined;
  finished = colourAfterRed = false;
  cpuWait = 0;
  setTip(0, 0);
  showScore();
  placement = preset ? undefined : 'break';
  aimPointer = undefined;
  aimTargetPointer = undefined;
  movingCueBall = false;
  if (viewMode) viewToggle.click();
  aim = Vector3.Forward();
  rolling = false;
  strike = accumulator = 0;
  clearStroke();
  showReadyStatus();
  ballMeshes.forEach((mesh, index) => {
    const ball = balls[index];
    mesh.isVisible = Boolean(ball) && !ball.pocketed;
    contacts[index].isVisible = Boolean(ball) && !ball.pocketed;
    if (!ball) return;
    mesh.material = snooker && index > 0 ? (index <= 15 ? redFinish : colourFinishes[index - 16]) : poolFinishes[index];
    mesh.position.set(ball.x, ball.pocketed ? -0.12 : radius, ball.z);
  });
}
function needsRerackConfirmation() {
  return !finished && (!breaking || rolling || strike > 0);
}
const rerackDialog = document.querySelector<HTMLDialogElement>('#rerackConfirm')!;
let pendingSettingsMatch = false;
function confirmNewGame(fromSettings: boolean) {
  pendingSettingsMatch = fromSettings;
  document.querySelector<HTMLElement>('#rerackTitle')!.textContent = t(fromSettings ? 'Start a new game?' : 'Re-rack this game?');
  document.querySelector<HTMLElement>('#rerackDescription')!.textContent = t(fromSettings
    ? 'A game is in progress. Starting a new game will discard your current progress and use your selected game and opponent settings.'
    : 'Your current progress will be lost. Re-racking starts a fresh game with both players back at the beginning.');
  rerackDialog.querySelector<HTMLButtonElement>('[value="rerack"]')!.textContent = t(fromSettings ? 'Start new game' : 'Re-rack');
  rerackDialog.returnValue = '';
  rerackDialog.showModal();
}
async function startSettingsMatch() {
  if (leavingMatch || isTournament()) return;
  if (onlineMode) {
    leavingMatch = true;
    try { await online.leave(!wonByForfeit); }
    catch { status.textContent = t('Could not end the online game. Try again.'); return; }
    finally { leavingMatch = false; }
    onlineMode = false;
  }
  snooker = select('game').value === 'snooker';
  versusComputer = select('opponent').value === 'computer';
  difficulty = select('difficulty').value as Difficulty;
  mode = { kind: 'training', game: currentGame(), opponent: versusComputer ? 'computer' : 'solo', difficulty };
  labelGame(mode);
  resetMatch();
}
document.querySelector<HTMLButtonElement>('#reset')!.onclick = () => {
  if (isTournament() || onlineMode && (online.seat !== 0 || !online.active)) return;
  if (needsRerackConfirmation()) {
    confirmNewGame(false);
  } else resetMatch();
};
rerackDialog.addEventListener('close', () => {
  const fromSettings = pendingSettingsMatch;
  pendingSettingsMatch = false;
  if (rerackDialog.returnValue !== 'rerack') {
    if (fromSettings) settings.showModal();
    return;
  }
  rerackDialog.returnValue = '';
  if (fromSettings) startSettingsMatch();
  else if (!onlineMode || online.seat === 0 && online.active) resetMatch();
});
document.querySelector<HTMLButtonElement>('#noticeRematch')!.onclick = () => {
  if (!isTournament() && (!onlineMode || online.active && online.seat === 0)) resetMatch();
};
const endGameDialog = document.querySelector<HTMLDialogElement>('#endGameConfirm')!;
const endGameStatus = document.querySelector<HTMLElement>('#endGameStatus')!;
const confirmEndGame = document.querySelector<HTMLButtonElement>('#confirmEndGame')!;
const saveAndExit = document.querySelector<HTMLButtonElement>('#saveAndExit')!;
const keepPlaying = document.querySelector<HTMLButtonElement>('#keepPlaying')!;
function openEndGame() {
  endGameStatus.hidden = true;
  saveAndExit.hidden = onlineMode || mode.kind === 'casual' || finished;
  document.querySelector<HTMLElement>('#endGameDescription')!.textContent =
    onlineMode && !awaitingOnline && !finished && online.departureDeadline === undefined
      ? t('You’ll return to game modes. Your opponent wins when your timer runs out.')
      : t(saveAndExit.hidden ? 'You’ll return to game modes. Your current game will be cleared.' : 'Save your current game for later or end it.');
  endGameDialog.showModal();
}
document.querySelector<HTMLButtonElement>('#endGame')!.onclick = openEndGame;
document.querySelector<HTMLButtonElement>('#leaveOnline')!.onclick = openEndGame;
endGameDialog.addEventListener('cancel', event => { if (confirmEndGame.disabled) event.preventDefault(); });
async function leaveGame(openShop = false, keepMatch = false) {
  if (leavingMatch) return;
  leavingMatch = confirmEndGame.disabled = keepPlaying.disabled = saveAndExit.disabled = true;
  try {
    await online.leave(onlineMode && !awaitingOnline && !wonByForfeit);
    if (keepMatch) saveGame();
    else clearSession(currentGame());
    returningHome = true;
    const home = new URL(location.href);
    home.searchParams.delete('join');
    home.searchParams.delete('table');
    home.searchParams.set('game', currentGame());
    if (!keepMatch && 'city' in mode) home.searchParams.set('circuit', mode.kind);
    if (!keepMatch && mode.kind === 'challenge') home.searchParams.set('circuit', 'challenges');
    if (!keepMatch && mode.kind === 'computer' && careerCityStatus(mode.city, careerProgress(mode.game), mode.game) !== 'Completed') home.searchParams.set('careerCity', mode.city.id);
    if (openShop) home.searchParams.set('careerShop', '1');
    location.replace(home.href);
  } catch {
    if (!endGameDialog.open) endGameDialog.showModal();
    endGameStatus.textContent = t('Could not reach the online game. Try again to end it.');
    endGameStatus.hidden = false;
    leavingMatch = confirmEndGame.disabled = keepPlaying.disabled = saveAndExit.disabled = false;
    confirmEndGame.focus();
  }
}
saveAndExit.onclick = () => { void leaveGame(false, true); };
confirmEndGame.onclick = () => { void leaveGame(); };
document.querySelector<HTMLButtonElement>('#noticeCircuit')!.onclick = () => confirmEndGame.click();
document.querySelector<HTMLButtonElement>('#noticeShop')!.onclick = () => { void leaveGame(true); };
function nextCareerStage() {
  if (mode.kind !== 'computer' || winner !== 0) return -1;
  const city = mode.city;
  const game = mode.game;
  const progress = careerProgress(game);
  return careerStages.findIndex((_, index) => careerStageStatus(city, index, progress, game) === 'Unlocked');
}
function restartCareerStage(stage: number) {
  if (mode.kind !== 'computer' || !finished || stage < 0) return;
  mode = { ...mode, stage, matchId: Array.from(crypto.getRandomValues(new Uint32Array(4))).join('-') };
  difficulty = careerDifficulty(mode.city, stage);
  labelGame(mode);
  circuitMessage = '';
  resetMatch();
  saveGame();
}
document.querySelector<HTMLButtonElement>('#noticeRetry')!.onclick = () => {
  if (mode.kind === 'computer' && winner !== 0) restartCareerStage(mode.stage);
  if (mode.kind === 'challenge') { circuitMessage = ''; resetMatch(); saveGame(); }
};
document.querySelector<HTMLButtonElement>('#noticeNext')!.onclick = () => restartCareerStage(nextCareerStage());
document.querySelector<HTMLButtonElement>('#openSettings')!.onclick = () => {
  select('game').value = snooker ? 'snooker' : 'pool';
  select('opponent').value = versusComputer ? 'computer' : 'solo';
  select('difficulty').value = difficulty;
  for (const field of ['game', 'opponent', 'difficulty']) select(field).disabled = isTournament();
  select('cueStyle').disabled = mode.kind === 'computer';
  refreshCityFinishes();
  describeCue();
  document.querySelector<HTMLButtonElement>('#newMatch')!.disabled = isTournament();
  offlinePlayerTwoNameInput.value = offlinePlayerTwoName;
  syncOfflinePlayerNameVisibility();
  settings.showModal();
};
settings.addEventListener('close', () => {
  if (settings.returnValue !== 'start' || isTournament()) return;
  settings.returnValue = '';
  if (needsRerackConfirmation()) confirmNewGame(true);
  else startSettingsMatch();
});

const cueStyles: Record<string, [string, string]> = {
  'Classic Maple': ['#cb9358', '#673925'],
  Rosewood: ['#a95d45', '#572922'],
  'Carbon Black': ['#525762', '#171b23'],
};
function describeCue() {
  const note = document.querySelector<HTMLElement>('#trainingCueNote')!;
  note.hidden = mode.kind !== 'training';
  const style = careerCues.find(entry => entry.id === select('cueStyle').value);
  if (!style || note.hidden) return;
  const percent = new Intl.NumberFormat(document.documentElement.lang, { style: 'percent' });
  const power = percent.format(1 - shotSpeed(.5 ** style.power) / shotSpeed(.5));
  const spin = percent.format(style.spin - 1);
  const effect = style.power !== 1 ? t('{amount} less cue-ball speed at half power', { amount: power })
    : style.spin !== 1 ? t('{amount} more spin at half tip offset', { amount: spin }) : t(style.description);
  note.textContent = t('Training preview: {effect}', { effect });
}
function updateCueStyle() {
  const [shaft, butt] = cueStyles[select('cueStyle').value];
  (cue.material as StandardMaterial).diffuseColor = Color3.FromHexString(shaft);
  cueButt.diffuseColor = Color3.FromHexString(butt);
  stroke.style.setProperty('--cue-shaft', shaft);
  stroke.style.setProperty('--cue-butt', butt);
  stroke.querySelector('.cue-stick')!.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1260 -14 1265 32" preserveAspectRatio="none">' + cueArtwork(select('cueStyle').value) + '</svg>';
  const direction = document.body.classList.contains('vertical-controls') && !mobileLayout.matches ? 'down' : 'left';
  stroke.setAttribute('title', select('cueStyle').value + ' · Pull ' + direction + ' and release to shoot');
  describeCue();
}
select('cueStyle').onchange = updateCueStyle;
if (equippedCareerCue) select('cueStyle').value = equippedCareerCue.id;
updateCueStyle();
function applyTableFinish() {
  const [felt, cushion, rail] = tableFinish(select('tableStyle').value, snooker);
  document.body.classList.toggle('snooker-game', snooker);
  snookerLines.setEnabled(snooker);
  cloth.diffuseColor = Color3.FromHexString(felt);
  rubber.diffuseColor = Color3.FromHexString(cushion);
  wood.diffuseColor = Color3.FromHexString(rail);
  requestAnimationFrame(fitOverheadCamera);
}
function refreshCityFinishes() {
  const field = select('tableStyle');
  const game = currentGame();
  const progress = careerProgress(game);
  for (const city of cities) {
    if (careerCityStatus(city, progress, game) !== 'Completed' || [...field.options].some(option => option.value === city.id)) continue;
    field.add(new Option(t(cityFinishes[city.id].name), city.id));
  }
}
refreshCityFinishes();
try {
  const savedFinish = localStorage.getItem('billiard-table-finish');
  if ([...select('tableStyle').options].some(option => option.value === savedFinish)) select('tableStyle').value = savedFinish!;
} catch {}
select('tableStyle').onchange = () => {
  applyTableFinish();
  try { localStorage.setItem('billiard-table-finish', select('tableStyle').value); } catch {}
};
function gameState(): SavedGame {
  return { version: 1, balls, snooker, versusComputer, onlineMode, turn, scores, groups, winner, breaking, shotWasBreak,
    colourAfterRed, finished, firstContact, shotTargets, previouslyPocketed, rolling, placement, aim: [aim.x, aim.z],
    strike, shotPower, tip: [tipX, tipY], aimLocked, calledPocket,
    ...(mode.kind === 'computer' ? { careerClean, careerRacks }
      : mode.kind === 'challenge' ? { careerAttempts, careerBanked } : {}) };
}
function applyGame(s: SavedGame, preserveLocalAim = false) {
  balls = s.balls.map(ball => ({ ...ball }));
  const gameChanged = snooker !== s.snooker;
  snooker = s.snooker;
  if (gameChanged) applyTableFinish();
  versusComputer = s.versusComputer;
  turn = s.turn;
  scores = [...s.scores];
  careerAttempts = s.careerAttempts ?? 0;
  careerBanked = s.careerBanked ?? false;
  careerClean = s.careerClean ?? false;
  careerRacks = s.careerRacks ? [...s.careerRacks] : [0, 0];
  groups = [...s.groups];
  winner = s.winner;
  breaking = s.breaking;
  shotWasBreak = s.shotWasBreak;
  colourAfterRed = s.colourAfterRed;
  finished = s.finished;
  firstContact = s.firstContact;
  shotTargets = [...s.shotTargets];
  previouslyPocketed = [...s.previouslyPocketed];
  rolling = s.rolling;
  placement = s.placement;
  strike = s.strike;
  shotPower = s.shotPower;
  if (!preserveLocalAim) {
    aim.set(s.aim[0], 0, s.aim[1]).normalize();
    setTip(...s.tip);
    aimLocked = s.aimLocked;
    calledPocket = s.calledPocket;
  }
  if (rolling || strike) aimLocked = false;
  accumulator = 0;
  ballMeshes.forEach((mesh, i) => {
    mesh.isVisible = Boolean(balls[i]) && !balls[i].pocketed;
    contacts[i].isVisible = Boolean(balls[i]) && !balls[i].pocketed;
    if (!balls[i]) return;
    mesh.material = snooker && i > 0 ? i <= 15 ? redFinish : colourFinishes[i - 16] : poolFinishes[i];
    mesh.position.set(balls[i].x, balls[i].pocketed ? -0.12 : radius, balls[i].z);
  });
  showScore();
  if (!rolling && !strike) showReadyStatus();
  else status.textContent = t('Balls in motion');
}
function saveGame() {
  if (returningHome || wonByForfeit) return;
  saveSession(mode, gameState(), awaitingOnline);
}
function recordComputerResult() {
  if (mode.kind === 'computer') {
    circuitMessage = winner === undefined ? t('Match drawn. Try again.')
      : finishCareerStage(mode.city, mode.stage, mode.matchId, winner === 0, careerClean, mode.game);
    showCareerProfile();
  }
}
function trackCareerRail(ball: typeof balls[number]) {
  if (activeChallenge()?.kind === 'bank' && ball === balls[1]) careerBanked = true;
}
online.onPaired = (resume, cityId) => {
  const city = cities.find(entry => entry.id === cityId);
  mode = city ? { kind: 'online', city } : { kind: 'casual' };
  labelGame(mode);
  online.setCircuit(city);
  awaitingOnline = false;
  circuitMessage = '';
  setMobileMenu(false);
  wonByForfeit = false;
  onlineMode = true;
  versusComputer = false;
  snooker = false;
  if (validGame(resume)) applyGame(resume);
  else resetMatch();
  saveGame();
};
online.onCircuitResult = result => {
  if (mode.kind === 'online' && result) {
    const won = online.seat === result.winner;
    circuitMessage = resultMessage(mode.city, won, result.firstWin);
    if (won && result.firstWin) {
      circuitMessage += ' ' + t('Online medal earned: {medal}.', { medal: onlineMedalName(mode.city) });
      void online.refreshMedals();
    }
  }
};
online.onCircuitSaveError = () => { circuitMessage = t('The server could not save your tournament result.'); };
online.onProfile = showScore;
online.onTimeout = expiredTurn => {
  if (!onlineMode || online.seat !== 0 || !online.active || turn !== expiredTurn || rolling || strike || finished) return;
  turn = 1 - turn;
  calledPocket = undefined;
  aimLocked = false;
  tableStroke = undefined;
  clearStroke();
  placement = 'foul';
  showScore();
  showReadyStatus();
  online.send({ type: 'state', state: gameState() });
  saveGame();
};
online.onState = value => {
  if (!onlineMode || online.seat !== 1 || !validGame(value)) return;
  const keepAim = canControl() && !value.rolling && !value.strike && turn === value.turn;
  applyGame(value, keepAim);
};
online.onInput = value => {
  if (!onlineMode || online.seat !== 0 || turn !== 1 || rolling || strike || finished || !value || typeof value !== 'object') return;
  const input = value as { action?: string; strength?: number; aim?: number[]; tip?: number[]; position?: number[]; calledPocket?: number };
  const pair = (v: unknown): v is number[] => Array.isArray(v) && v.length === 2 && v.every(n => typeof n === 'number' && Number.isFinite(n));
  if (!pair(input.aim) || !pair(input.tip) || !pair(input.position)) return;
  const direction = new Vector3(input.aim[0], 0, input.aim[1]);
  if (direction.lengthSquared() < 0.5 || direction.lengthSquared() > 1.5) return;
  aim = direction.normalize();
  setTip(input.tip[0], input.tip[1]);
  if (!snooker && legalTargets().includes(8)) {
    calledPocket = Number.isInteger(input.calledPocket) && input.calledPocket! >= 0 && input.calledPocket! < 6 ? input.calledPocket : undefined;
  }
  if (placement) {
    const [x, z] = input.position;
    const legal = Math.abs(x) <= width / 2 - radius && Math.abs(z) <= length / 2 - radius &&
      (placement !== 'break' || z <= -length / 4) &&
      !pockets.some(p => Math.hypot(p.x - x, p.z - z) < 0.085) &&
      !balls.slice(1).some(b => !b.pocketed && Math.hypot(b.x - x, b.z - z) < 2 * radius + 0.001);
    if (legal) Object.assign(balls[0], { x, z });
  }
  if (input.action === 'shoot' && typeof input.strength === 'number' && Number.isFinite(input.strength) && input.strength >= 0.08 && input.strength <= 1) fire(input.strength);
};
online.onDeparture = () => {
  rolling = false;
  strike = 0;
  showScore();
  online.onEnded();
};
online.onEnded = winningSeat => {
  if (!onlineMode) return;
  clearStroke();
  tableStroke = undefined;
  aimPointer = undefined;
  if (winningSeat === 0 || winningSeat === 1) {
    wonByForfeit = finished = true;
    winner = winningSeat;
    rolling = false;
    strike = 0;
    clearSession(currentGame());
    showScore();
    showReadyStatus();
  } else if (online.seat === undefined) { onlineMode = false; resetMatch(); }
  else showReadyStatus();
};
if (launch.state) {
  onlineMode = launch.state.onlineMode || mode.kind === 'online';
  applyTableFinish();
  applyGame(launch.state);
  if (mode.kind === 'computer' && finished) recordComputerResult();
  const challenge = activeChallenge();
  if (challenge && finished) circuitMessage = challengeResult(challenge);
} else resetMatch();
function showCareerProfile() {
  const { points } = careerProgress(currentGame());
  const profile = document.querySelector<HTMLElement>('#careerProfile')!;
  profile.textContent = t('{rank} · {points} career points', { rank: t(careerRank(points)), points });
}
showCareerProfile();
if (onlineMode || mode.kind === 'casual') online.open();
if (awaitingOnline) void online.findMatch();
saveGame();
window.addEventListener('pagehide', saveGame);
document.addEventListener('visibilitychange', () => { if (document.hidden) saveGame(); });
showScore();
showReadyStatus();

function fitOverheadCamera() {
  syncTableSurface();
  const header = hudHeader.getBoundingClientRect();
  document.documentElement.style.setProperty('--notice-top', header.bottom + 8 + 'px');
  if (!overhead || viewMode) {
    if (!viewMode) panPerspectiveBy(0, 0);
    return;
  }
  camera.targetScreenOffset.set(0, 0);
  const bounds = activeTableCanvas().getBoundingClientRect();
  if (!bounds.width || !bounds.height) return;
  const footer = document.querySelector('footer')!.getBoundingClientRect();

  // Phones keep the long axis vertical, including when held sideways.
  const mobile = window.matchMedia('(max-width: 600px), (pointer: coarse) and (max-height: 600px)').matches;
  const landscape = (uses2dTable() || !mobile) && bounds.width > bounds.height;
  const top = header.bottom - bounds.top + 6;
  document.documentElement.style.setProperty('--shot-controls-height', bounds.bottom - footer.top + 'px');
  const verticalDock = !mobileLayout.matches && document.body.classList.contains('vertical-controls');
  const zoomTop = mobileLayout.matches && !document.body.classList.contains('compact-hud') && (!uses2dTable() || usesSvgTable()) ? (cameraZoomEl?.closest('footer') === footerEl ? footer.top : document.querySelector('.camera-zoom')!.getBoundingClientRect().top) : footer.top;
  const bottom = verticalDock ? bounds.height - 6 : Math.min(footer.top, zoomTop) - bounds.top - 6;
  if (uses2dTable()) {
    if (tvTable instanceof SvgTable) tvTable.resize(bounds.width, bounds.height, top, bottom, cameraZoom);
    else tvTable?.resize(bounds.width, bounds.height, top, bottom);
  }
  const availableHeight = Math.max(1, bottom - top);
  const availableWidth = Math.max(1, bounds.width - 16);
  const tableWidth = (landscape ? length : width) + 0.27;
  const tableHeight = (landscape ? width : length) + 0.27;
  const unitsPerPixel = Math.max(tableWidth / availableWidth, tableHeight / availableHeight) / cameraZoom;
  const centerY = (top + bottom) / 2;
  // Orthographic framing fills the usable area without perspective shrinkage.
  camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
  camera.alpha = landscape ? 0 : -Math.PI / 2;
  camera.beta = 0.025;
  camera.radius = 2.5;
  cameraTarget = undefined;
  camera.orthoLeft = -bounds.width * unitsPerPixel / 2;
  camera.orthoRight = bounds.width * unitsPerPixel / 2;
  camera.orthoTop = centerY * unitsPerPixel;
  camera.orthoBottom = -(bounds.height - centerY) * unitsPerPixel;
}

const graphicsPresets: Record<string, { scale: number; pixels: number; shadowSize: number }> = {
  Low: { scale: 0.65, pixels: 2_100_000, shadowSize: 0 },
  Medium: { scale: 0.9, pixels: 4_200_000, shadowSize: 1024 },
  High: { scale: 2, pixels: 10_000_000, shadowSize: 2048 },
  Ultra: { scale: 3, pixels: 16_600_000, shadowSize: 4096 },
};
shadows.getShadowMap()!.renderList = scene.meshes.filter(mesh => mesh.name.startsWith('ball ') ||
  ['cabinet', 'leg', 'side rail', 'end rail', 'solid pocket surround', 'continuous beveled cushion'].includes(mesh.name));

function resize() {
  updateStrokeDirection();
  if (!headlessGraphics && !canvas.hidden) {
    const { width, height } = canvas.getBoundingClientRect();
    if (width > 0 && height > 0) {
      const preset = graphicsPresets[quality.value];
      const dpr = window.devicePixelRatio || 1;
      const requestedScale = quality.value === 'Ultra' ? Math.max(2, dpr * 1.5)
        : quality.value === 'High' ? Math.max(1.25, dpr) : dpr;
      const maxSize = engine.getCaps().maxTextureSize;
      // Bound framebuffer memory on high-DPI and large desktop displays.
      const scale = Math.min(requestedScale, preset.scale, Math.sqrt(preset.pixels / (width * height)), maxSize / Math.max(width, height));
      const level = 1 / scale;
      if (engine.getHardwareScalingLevel() !== level) engine.setHardwareScalingLevel(level);
      else engine.resize();
    }
  }
  fitOverheadCamera();
}
function applyGraphicsPreset() {
  if (!headlessGraphics) {
    const { shadowSize } = graphicsPresets[quality.value];
    scene.shadowsEnabled = shadowSize > 0;
    if (shadowSize) shadows.mapSize = Math.min(shadowSize, engine.getCaps().maxTextureSize);
  }
  resize();
}
quality.onchange = applyGraphicsPreset;
window.addEventListener('resize', resize);
new ResizeObserver(resize).observe(canvas);
new ResizeObserver(fitOverheadCamera).observe(tvCanvas);
const controlsObserver = new ResizeObserver(fitOverheadCamera);
controlsObserver.observe(document.querySelector('header')!);
controlsObserver.observe(document.querySelector('footer')!);
applyGraphicsPreset();

const tvToggle = document.querySelector<HTMLButtonElement>('#tvToggle')!;
const tvPanel = document.querySelector<HTMLElement>('#tvControls')!;
function updateTvControls() {
  if (!tvEnabled) return;
  const busy = rolling || strike > 0 || !canControl();
  const context = [turn, placement, busy, finished, breaking].join(':');
  if (context !== tvContext) { remote.reset(Boolean(placement)); tvContext = context; }
  const labels = {
    place: [t('Place the cue ball'), t('↑ ↓ ← → Move ball · OK Keep position · Back Menu')],
    aim: [t('Aim your shot'), t('← → Aim · ↑ ↓ Fine aim · OK Set power · Back Menu')],
    pocket: [t('Call a pocket for the 8'), t('← → Choose pocket · OK Confirm · Back Aim')],
    power: [t('Set power, then shoot'), t('↑ ↓ Power · OK Shoot · Back Aim')],
  };
  const [title, help] = labels[remote.stage];
  const stepText = online.departureDeadline !== undefined ? t('Opponent left. Waiting for their timer.') : finished ? t('Game finished') : busy ? rolling || strike ? t('Balls in motion') : t('Waiting for opponent') : title;
  const helpText = finished || busy ? t('Back Menu') : remote.stage === 'pocket' ? help + ' · ' + pocketChoice.options[(calledPocket ?? 0) + 1].text : help;
  const powerText = Math.round(remote.power * 100) + '%';
  const presentation = [stepText, helpText, powerText].join('|');
  if (tvPresentation === presentation) return;
  tvPresentation = presentation;
  status.textContent = stepText;
  document.querySelector<HTMLElement>('#tvStep')!.textContent = stepText;
  document.querySelector<HTMLElement>('#tvHelp')!.textContent = helpText;
  document.querySelector<HTMLOutputElement>('#tvPower')!.value = powerText;
}
function applyTvMode() {
  document.body.classList.toggle('tv-mode', tvEnabled);
  document.body.classList.toggle('compatibility-table', webglUnavailable);
  tvPanel.hidden = !tvEnabled;
  syncTableSurface();
  tvToggle.textContent = t(tvEnabled ? 'TV on' : 'TV off');
  tvToggle.setAttribute('aria-pressed', String(tvEnabled));
  const compatibility = document.querySelector<HTMLElement>('#tvCompatibility')!;
  compatibility.hidden = !webglUnavailable;
  compatibility.textContent = webglUnavailable ? t('This browser could not start 3D. The compatibility table is active; you can turn TV controls on or off.') : '';
  tvContext = '';
  if (tvEnabled) {
    if (viewMode) viewToggle.click();
    if (!overhead) document.querySelector<HTMLButtonElement>('#camera')!.click();
    aimLocked = false;
    tableStroke = undefined;
    clearStroke();
    setTip(0, 0);
    setCameraZoom(1);
    updateTvControls();
  } else if (!rolling && !strike) showReadyStatus();
  requestAnimationFrame(fitOverheadCamera);
}
tvToggle.onclick = () => {
  tvEnabled = !tvEnabled;
  try { localStorage.setItem('billiard-tv', tvEnabled ? 'on' : 'off'); } catch {}
  if (!tvEnabled && headlessGraphics && !webglUnavailable) {
    // The 3D scene needs a real engine. Restore this match after restarting it.
    saveGame();
    const url = new URL(location.href);
    url.searchParams.set('table', '3d');
    url.searchParams.set('game', currentGame());
    location.replace(url.href);
    return;
  }
  applyTvMode();
};
document.querySelector<HTMLButtonElement>('#tvMenu')!.onclick = () => setMobileMenu(true);
function navigateTvDialog(dialog: HTMLDialogElement, key: RemoteKey) {
  if (key === 'back') {
    dismissDialog(dialog);
    return;
  }
  const controls = [...dialog.querySelectorAll<HTMLElement>('button, input, select, a[href]')]
    .filter(el => !el.matches(':disabled') && el.getClientRects().length > 0);
  const active = document.activeElement as HTMLElement;
  const index = controls.indexOf(active);
  if (key === 'left' || key === 'right') {
    const direction = key === 'right' ? 1 : -1;
    if (active instanceof HTMLSelectElement) {
      active.selectedIndex = Math.max(0, Math.min(active.options.length - 1, active.selectedIndex + direction));
      active.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }
    if (active instanceof HTMLInputElement && active.type === 'range') {
      direction > 0 ? active.stepUp() : active.stepDown();
      active.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }
  }
  if (key === 'ok' && index >= 0 && !(active instanceof HTMLSelectElement)) { active.click(); return; }
  const next = controls[(index + (key === 'up' || key === 'left' ? -1 : 1) + controls.length) % controls.length];
  next?.focus();
  next?.scrollIntoView({ block: 'nearest' });
}
document.addEventListener('keydown', event => {
  if (!tvEnabled && !webglUnavailable) return;
  const key = remoteKey(event.key, event.keyCode);
  if (!key) return;
  const dialogs = [...document.querySelectorAll<HTMLDialogElement>('dialog[open]')];
  const dialog = endGameDialog.open ? endGameDialog : dialogs.find(d => d.classList.contains('modal-child')) ?? dialogs[dialogs.length - 1];
  if (!tvEnabled && !dialog) return;
  // Text fields keep normal typing and their platform's on-screen keyboard.
  if (dialog && event.target instanceof HTMLInputElement && !['range', 'checkbox', 'button'].includes(event.target.type) && event.key !== 'Escape' && key !== 'ok' && !['up', 'down'].includes(key) && event.keyCode !== 10009 && event.keyCode !== 461) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if ((key === 'ok' || key === 'back') && event.repeat) return;
  if (dialog) { navigateTvDialog(dialog, key); return; }
  updateTvControls();
  if (key === 'back' && (rolling || strike || !canControl() || finished)) { setMobileMenu(true); return; }
  if (rolling || strike || !canControl() || finished) return;
  if (strokePointer !== undefined || aimPointer !== undefined) return;
  const stage = remote.stage;
  const needsPocket = !snooker && legalTargets().includes(8);
  if (stage === 'place' && placement && ['left', 'right', 'up', 'down'].includes(key)) {
    const position = remotePlacement(balls, placement, key, camera.alpha);
    if (position) Object.assign(balls[0], position);
  } else if (stage === 'aim' && ['left', 'right', 'up', 'down'].includes(key)) {
    const angle = Math.atan2(aim.x, aim.z) + (key === 'left' ? -1 : key === 'right' ? 1 : key === 'up' ? -0.1 : 0.1) * Math.PI / 180;
    aim.set(Math.sin(angle), 0, Math.cos(angle));
  } else if (stage === 'pocket' && ['left', 'right', 'up', 'down'].includes(key)) {
    calledPocket = ((calledPocket ?? 0) + (key === 'left' || key === 'up' ? 5 : 1)) % 6;
  }
  const action = remote.press(key, needsPocket);
  if (remote.stage === 'pocket') calledPocket ??= 0;
  if (action === 'menu') setMobileMenu(true);
  if (action === 'shoot') { fire(remote.power); remote.reset(Boolean(placement)); }
  updateTvControls();
}, true);
applyTvMode();

let networkElapsed = 0, saveElapsed = 0;
let noticeKey = '';
const notice = document.querySelector<HTMLElement>('#gameNotice')!;
const confetti = document.querySelector<HTMLElement>('#victoryConfetti')!;
let celebratedWin = false;
let confettiCleanup: number | undefined;
function celebrateWin() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  confetti.replaceChildren();
  window.clearTimeout(confettiCleanup);
  const colors = ['#eac16a', '#fff0b7', '#61baa0', '#e29872', '#f5e8ce'];
  const pieces = document.createDocumentFragment();
  for (let i = 0; i < 54; i++) {
    const piece = document.createElement('span');
    piece.className = 'confetti-piece';
    piece.style.left = (i / 54 * 100) + '%';
    piece.style.setProperty('--confetti-color', colors[i % colors.length]);
    piece.style.setProperty('--fall-time', (2.7 + Math.random() * 1.1) + 's');
    piece.style.setProperty('--fall-delay', (Math.random() * 0.65) + 's');
    piece.style.setProperty('--drift', (Math.random() * 140 - 70) + 'px');
    piece.style.setProperty('--spin', (Math.random() * 900 - 450) + 'deg');
    pieces.append(piece);
  }
  confetti.append(pieces);
  confettiCleanup = window.setTimeout(() => confetti.replaceChildren(), 4600);
}
function updateGameNotice() {
  const kind = finished ? 'win' : '';
  const winningPlayer = winner ?? (scores[0] === scores[1] ? undefined : scores[0] > scores[1] ? 0 : 1);
  const key = [kind, turn, winningPlayer, online.active, online.seat, playerName(0), playerName(1), placement, tvEnabled, circuitMessage].join(':');
  if (key === noticeKey) return;
  noticeKey = key;
  notice.hidden = !kind;
  notice.dataset.kind = kind;
  notice.dataset.outcome = winningPlayer === undefined ? 'draw' : 'winner';
  if (kind === 'win' && winningPlayer !== undefined && (!isTournament() || winningPlayer === 0) && !celebratedWin) {
    celebratedWin = true;
    celebrateWin();
  } else if (kind !== 'win') {
    celebratedWin = false;
    window.clearTimeout(confettiCleanup);
    confetti.replaceChildren();
  }
  const rematch = document.querySelector<HTMLButtonElement>('#noticeRematch')!;
  const circuitButton = document.querySelector<HTMLButtonElement>('#noticeCircuit')!;
  circuitButton.hidden = kind !== 'win' || !isTournament();
  circuitButton.textContent = t(mode.kind === 'challenge' ? 'Return to challenges' : mode.kind === 'computer' && careerCityStatus(mode.city, careerProgress(mode.game), mode.game) !== 'Completed' ? 'Return to games' : 'Return to cities');
  const retry = document.querySelector<HTMLButtonElement>('#noticeRetry')!;
  retry.hidden = kind !== 'win' || (mode.kind !== 'computer' && mode.kind !== 'challenge') || (mode.kind === 'computer' && winner === 0);
  retry.textContent = t(mode.kind === 'challenge' && winner === 0 ? 'Replay' : 'Try again');
  document.querySelector<HTMLButtonElement>('#noticeNext')!.hidden = kind !== 'win' || nextCareerStage() < 0;
  const progress = kind === 'win' && mode.kind === 'computer' && winner === 0 ? careerProgress(mode.game) : undefined;
  document.querySelector<HTMLButtonElement>('#noticeShop')!.hidden = !progress ||
    !careerCues.some(cue => !progress.owned.includes(cue.id) && cue.price <= progress.coins);
  rematch.hidden = isTournament() || kind !== 'win' || wonByForfeit || onlineMode && online.seat !== 0;
  rematch.disabled = onlineMode && !online.active;
  document.querySelector<HTMLElement>('#noticeLabel')!.textContent = mode.kind === 'challenge' ? t('Challenges') : mode.kind === 'computer' ? t('Computer Career')
    : winningPlayer === undefined ? t('HONOURS EVEN') : t('VICTORY');
  document.querySelector<HTMLElement>('#noticeTitle')!.textContent = mode.kind === 'challenge' ? t(winner === 0 ? 'Challenge completed' : 'Challenge failed')
    : mode.kind === 'computer' ? t(winner === undefined ? 'Match drawn' : winner === 0 ? 'Game cleared' : 'Game failed')
    : winningPlayer === undefined ? t('Match drawn') : t('{player} wins!', { player: playerName(winningPlayer) });
  document.querySelector<HTMLElement>('#noticeDetail')!.textContent = isTournament() ? circuitMessage || t('Saving tournament result…') : wonByForfeit ? t('Your opponent left and their timer expired.') : onlineMode && online.seat !== 0 ? t('What a game! Waiting for the host to start the next round.') : winningPlayer === undefined ? t('A close match. Time for a rematch?') : t('What a finish. Ready for another round?');
}
engine.runRenderLoop(() => {
  updateTvControls();
  updateGameNotice();
  const clock = document.querySelector<HTMLElement>('#shotClock')!;
  clock.hidden = !onlineMode;
  const departureTime = online.departureDeadline === undefined ? undefined : Math.max(0, online.departureDeadline - performance.now());
  clock.textContent = departureTime !== undefined ? Math.ceil(departureTime / 1000) + 's' : finished ? t('Finished') : !online.active ? t('Paused') : rolling || strike ? t('In motion') : Math.ceil(online.remainingMs() / 1000) + 's';
  clock.classList.toggle('urgent', departureTime !== undefined ? departureTime <= 10000 : online.active && !rolling && !strike && online.remainingMs() <= 10000);
  const callEligible = !snooker && !finished && !rolling && !strike && legalTargets().includes(8);
  const showPocketPicker = callEligible && canControl() && !tvEnabled && calledPocket === undefined;
  if (showPocketPicker && callPocket.hidden) setPocketPickerOpen(true);
  callPocket.hidden = !showPocketPicker;
  pocketChoice.value = calledPocket === undefined ? '' : String(calledPocket);
  pocketSelectors.forEach((mesh, index) => {
    mesh.setEnabled(callEligible && canControl() && !viewMode);
    pocketCallRings[index].isVisible = callEligible && index !== calledPocket;
  });
  const selectedPocket = callEligible && calledPocket !== undefined ? pockets[calledPocket] : undefined;
  calledPocketRing.isVisible = Boolean(selectedPocket);
  if (selectedPocket) {
    const scale = (pocketMouthRadius(selectedPocket) + 0.003) / calledPocketRingRadius;
    calledPocketRing.position.set(selectedPocket.x, railTop + calledPocketBorderWidth / 2, selectedPocket.z);
    calledPocketRing.scaling.set(scale, 1, scale);
  }
  stroke.disabled = rolling || strike > 0 || !canControl() || finished;
  tip.disabled = stroke.disabled;
  if (tip.disabled && spinDialog.open) spinDialog.close();
  lockButton.disabled = stroke.disabled || viewMode;
  fineAim.disabled = !canFineAim();
  lockButton.querySelector<HTMLElement>('.hud-label')!.textContent = t(aimLocked ? 'Locked' : 'Aim lock');
  lockButton.setAttribute('aria-label', aimLocked ? t('Unlock aim') : t('Lock aim'));
  lockButton.setAttribute('aria-pressed', String(aimLocked));
  document.querySelector<HTMLButtonElement>('#reset')!.disabled = isTournament() || onlineMode && (online.seat !== 0 || !online.active);
  const dt = Math.min(engine.getDeltaTime() / 1000, 0.05);
  const authoritative = !onlineMode || online.active && online.seat === 0;
  const cueBall = balls[0];
  if (versusComputer && !onlineMode && turn === 1 && !finished && !rolling && !strike && !settings.open && !endGameDialog.open) {
    cpuWait -= dt;
    if (cpuWait <= 0) {
      const shot = chooseShot(balls, legalTargets(), difficulty);
      if (shot) {
        if (!snooker && legalTargets().includes(8)) {
          calledPocket = shot.pocket ?? pockets.reduce((best, p, index) => Math.hypot(p.x - balls[8].x, p.z - balls[8].z) < Math.hypot(pockets[best].x - balls[8].x, pockets[best].z - balls[8].z) ? index : best, 0);
        }
        aim.set(Math.sin(shot.angle), 0, Math.cos(shot.angle));
        setTip(0, 0);
        fire(shot.power);
      }
    }
  }
  if (strike && authoritative) {
    strike = Math.max(0, strike - dt);
    if (!strike) {
      const cue = mode.kind === 'computer' && turn === 0 ? equippedCareerCue
        : mode.kind === 'training' && (turn === 0 || !versusComputer)
          ? careerCues.find(entry => entry.id === select('cueStyle').value) : undefined;
      const speed = shotSpeed(shotPower ** (cue?.power ?? 1));
      strikeBall(cueBall, aim.x, aim.z, speed, tipX * (cue?.spin ?? 1), tipY * (cue?.spin ?? 1));
      sound.queue('cue', speed);
      if (resetSpinAfterShot) setTip(0, 0);
      rolling = true;
      status.textContent = t('Balls in motion');
    }
  }
  if (rolling && authoritative) {
    accumulator += dt;
    while (accumulator >= fixedStep) {
      const contact = step(balls, fixedStep, sound.queue, trackCareerRail);
      firstContact ??= contact;
      accumulator -= fixedStep;
    }
    if (!balls.some(isMoving)) {
      rolling = false;
      accumulator = 0;
      finishShot();
    }
  }
  if (!uses2dTable()) {
    balls.forEach((ball, index) => {
      const mesh = ballMeshes[index];
      if (ball.orientation) {
        ballRotation.copyFromFloats(...ball.orientation);
        ballRotation.multiplyToRef(ballTextureRotation, mesh.rotationQuaternion!);
      } else mesh.rotationQuaternion!.copyFrom(ballTextureRotation);
      mesh.position.set(ball.x, ball.pocketed ? Math.max(-0.12, mesh.position.y - dt * 0.48) : radius, ball.z);
      mesh.isVisible = mesh.position.y > -0.04;
      contacts[index].position.set(ball.x, 0.0008, ball.z);
      contacts[index].isVisible = !ball.pocketed;
    });
    aimLine.isVisible = guidesEnabled && !rolling && !strike && !movingCueBall && !finished;
    cue.setEnabled(!rolling && !movingCueBall && !finished);
    objectGuide.isVisible = ghostBall.isVisible = pocketGuide.isVisible = false;
    if (!rolling) {
      const origin = new Vector3(cueBall.x, radius, cueBall.z);
      const pose = cuePose(balls, aim.x, aim.z, tipX, tipY, strike * shotPower * 0.9 + pull * 0.16);
      cue.position.set(pose.center.x, pose.center.y, pose.center.z);
      const direction = new Vector3(pose.direction.x, pose.direction.y, pose.direction.z);
      const rotationAxis = Vector3.Cross(Vector3.Up(), direction).normalize();
      cue.rotationQuaternion = Quaternion.RotationAxis(rotationAxis, Math.acos(direction.y));
      const guide = traceShot(balls, aim.x, aim.z);
      MeshBuilder.CreateLines('aim guide', { points: [origin.add(aim.scale(radius)), new Vector3(guide.impact.x, radius, guide.impact.z)], instance: aimLine });
      if (aimLine.isVisible && guide.objectStart && guide.objectEnd) {
        objectGuide.isVisible = ghostBall.isVisible = true;
        ghostBall.position.set(guide.impact.x, 0.004, guide.impact.z);
        MeshBuilder.CreateDashedLines('object ball path', {points: [new Vector3(guide.objectStart.x, radius, guide.objectStart.z), new Vector3(guide.objectEnd.x, radius, guide.objectEnd.z)], instance: objectGuide});
        if (guide.pocket) {
          pocketGuide.isVisible = true;
          pocketGuide.position.set(guide.pocket.x, 0.035, guide.pocket.z);
        }
      }
    }
    if (cameraTarget !== undefined) {
      camera.beta += (cameraTarget - camera.beta) * Math.min(dt * 7, 1);
      if (Math.abs(cameraTarget - camera.beta) < 0.003) cameraTarget = undefined;
    }
  }
  sound.updateMotion(balls);
  sound.flush();
  updateSession(dt);
  if (uses2dTable()) tvTable?.draw({
    balls, aim, rolling, finished, placement: Boolean(placement), guides: guidesEnabled,
    callEligible: callEligible && canControl(), calledPocket, snooker,
    tableStyle: select('tableStyle').value, cueStyle: select('cueStyle').value,
    pull: strike ? strike * shotPower * 5 : tvEnabled ? remote.stage === 'power' ? remote.power : 0 : pull,
  });
  else scene.render();
  ballHand.hidden = !placement || finished || rolling || strike > 0;
  if (!ballHand.hidden) {
    const bounds = activeTableCanvas().getBoundingClientRect();
    const point = uses2dTable() ? tvTable!.project(balls[0].x, balls[0].z) : Vector3.Project(
      new Vector3(balls[0].x, radius * 2, balls[0].z), Matrix.Identity(), scene.getTransformMatrix(),
      camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight()));
    if ('z' in point && (Number(point.z) < 0 || Number(point.z) > 1)) ballHand.hidden = true;
    ballHand.style.left = bounds.left + point.x * (uses2dTable() ? 1 : bounds.width / engine.getRenderWidth()) + 'px';
    ballHand.style.top = bounds.top + point.y * (uses2dTable() ? 1 : bounds.height / engine.getRenderHeight()) + 'px';
  }
});

function updateSession(dt: number) {
  networkElapsed += dt;
  saveElapsed += dt;
  if (networkElapsed >= 0.05) {
    networkElapsed = 0;
    if (onlineMode && online.active) {
      if (online.seat === 0) online.send({ type: 'state', state: gameState() });
      else if (canControl() && !rolling && !strike) online.send({ type: 'input', input: { action: 'aim', aim: [aim.x, aim.z], tip: [tipX, tipY], position: [balls[0].x, balls[0].z], calledPocket } });
    }
  }
  if (saveElapsed >= 0.5) { saveElapsed = 0; saveGame(); }
}
