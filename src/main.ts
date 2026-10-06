import * as THREE from 'three';
import './style.css';
import { ThirdPersonCamera } from './camera/ThirdPersonCamera';
import { Player } from './entities/Player';
import { InputController } from './input/InputController';
import { ChairSystem } from './systems/ChairSystem';
import { CollisionSystem } from './systems/CollisionSystem';
import { NpcSystem } from './systems/NpcSystem';
import { Park } from './world/Park';
import { COLORS, CONFIG } from './config';

const app = document.querySelector<HTMLDivElement>('#app');
const status = document.querySelector<HTMLElement>('#status');
const crosshair = document.querySelector<HTMLElement>('#crosshair');
if (!app || !status || !crosshair) throw new Error('Game UI failed to initialize.');
const statusElement = status;
const crosshairElement = crosshair;

const scene = new THREE.Scene();
scene.background = new THREE.Color(COLORS.sky);
scene.fog = new THREE.Fog(COLORS.sky, 55, 100);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.append(renderer.domElement);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 140);
const followCamera = new ThirdPersonCamera(camera);
const input = new InputController(renderer.domElement);
const park = new Park();
const player = new Player();
const chairSystem = new ChairSystem(scene);
const npcSystem = new NpcSystem(scene, chairSystem);

scene.add(park.group, player.group);
chairSystem.seed();
npcSystem.seed();

const hemisphere = new THREE.HemisphereLight(0xffffff, 0x3f6212, 2.1);
scene.add(hemisphere);
const sun = new THREE.DirectionalLight(0xfff7d6, 3.2);
sun.position.set(-25, 38, 18);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -45;
sun.shadow.camera.right = 45;
sun.shadow.camera.top = 45;
sun.shadow.camera.bottom = -45;
scene.add(sun);

let messageTimer = 0;
const showMessage = (message: string, seconds = 2.4): void => {
  statusElement.textContent = message;
  messageTimer = seconds;
};
const collisions = new CollisionSystem(chairSystem, npcSystem, player, showMessage);
const clock = new THREE.Clock();
const previousPlayerPosition = new THREE.Vector3();
const projectedAim = new THREE.Vector3();
const cameraFacing = new THREE.Vector3();

function animate(): void {
  const delta = Math.min(clock.getDelta(), 0.05);
  previousPlayerPosition.copy(player.group.position);
  player.update(delta, input);
  park.update(delta);
  park.resolvePlayerPosition(player.group.position, previousPlayerPosition);
  npcSystem.resolvePlayerPosition(player.group.position, previousPlayerPosition);
  chairSystem.resolvePlayerPosition(player.group.position, previousPlayerPosition);
  followCamera.update(delta, player.group.position, input);
  camera.getWorldDirection(cameraFacing);
  player.faceDirection(cameraFacing);
  projectedAim
    .copy(player.aimOrigin)
    .addScaledVector(player.facing, 10)
    .project(camera);
  const aimVisible = projectedAim.z >= -1 && projectedAim.z <= 1;
  crosshairElement.style.visibility = aimVisible ? 'visible' : 'hidden';
  crosshairElement.style.left = `${THREE.MathUtils.clamp(
    (projectedAim.x * 0.5 + 0.5) * 100,
    3,
    97,
  )}%`;
  crosshairElement.style.top = `${THREE.MathUtils.clamp(
    (-projectedAim.y * 0.5 + 0.5) * 100,
    3,
    97,
  )}%`;

  if (input.consumePressed('Space')) {
    const action = chairSystem.handlePlayerAction(player);
    if (action === 'picked-up') showMessage('Chair ready. Face an NPC and press Space!');
    if (action === 'thrown') showMessage('Chair away!');
    if (action === 'none') showMessage('Move closer to a white chair.');
  }

  npcSystem.update(delta, player);
  chairSystem.update(delta);
  collisions.update();
  chairSystem.finalizeLandings();

  messageTimer -= delta;
  if (messageTimer <= 0) {
    const nearest = chairSystem.findNearestIdle(player.group.position, CONFIG.chair.pickupRange);
    statusElement.textContent = chairSystem.playerChair
      ? 'Holding chair — Space to throw'
      : nearest
        ? 'Chair in range — Space to pick up'
        : 'Find a white chair!';
  }

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

function onResize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener('resize', onResize);
window.addEventListener('beforeunload', () => {
  input.dispose();
  renderer.dispose();
});

followCamera.update(1, player.group.position, input);
showMessage('Click the park, then use the arrow keys to explore.', 4);
animate();
