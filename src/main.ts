import * as THREE from 'three';
import './style.css';
import { ThirdPersonCamera } from './camera/ThirdPersonCamera';
import { Player } from './entities/Player';
import { InputController } from './input/InputController';
import { TouchControls } from './input/TouchControls';
import { AudioSystem } from './systems/AudioSystem';
import { ChairSystem } from './systems/ChairSystem';
import { CollisionSystem } from './systems/CollisionSystem';
import { NpcSystem } from './systems/NpcSystem';
import { ScooterSystem } from './systems/ScooterSystem';
import { Park } from './world/Park';
import { COLORS, CONFIG } from './config';

const app = document.querySelector<HTMLDivElement>('#app');
const status = document.querySelector<HTMLElement>('#status');
const crosshair = document.querySelector<HTMLElement>('#crosshair');
const touchControlsRoot = document.querySelector<HTMLElement>('#touch-controls');
const victoryScreen = document.querySelector<HTMLElement>('#victory-screen');
const restartButton = document.querySelector<HTMLButtonElement>('#restart-game');
if (
  !app ||
  !status ||
  !crosshair ||
  !touchControlsRoot ||
  !victoryScreen ||
  !restartButton
) {
  throw new Error('Game UI failed to initialize.');
}
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
const touchControls = new TouchControls(touchControlsRoot, input);
const audio = new AudioSystem();
const park = new Park();
const player = new Player();
const chairSystem = new ChairSystem(scene);
const npcSystem = new NpcSystem(scene, chairSystem);
const scooterSystem = new ScooterSystem(scene);

scene.add(park.group, player.group);
chairSystem.seed();
npcSystem.seed();
scooterSystem.seed();

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
let victoryShown = false;
const showMessage = (message: string, seconds = 2.4): void => {
  statusElement.textContent = message;
  messageTimer = seconds;
};
const showVictory = (): void => {
  if (victoryShown) return;
  victoryShown = true;
  victoryScreen.hidden = false;
  if (document.pointerLockElement) void document.exitPointerLock();
  restartButton.focus();
};
const restartGame = (): void => window.location.reload();
restartButton.addEventListener('click', restartGame);
const collisions = new CollisionSystem(
  chairSystem,
  npcSystem,
  player,
  showMessage,
  (informerDown, directHit, giantHit) => {
    if (giantHit) {
      audio.playShobidak();
    } else if (informerDown) {
      audio.playShemo();
    } else {
      if (directHit) audio.playHeadshot();
      audio.playYerushalaim();
    }
  },
  () => audio.playAya(),
);
const clock = new THREE.Clock();
const previousPlayerPosition = new THREE.Vector3();
const projectedAim = new THREE.Vector3();
const cameraFacing = new THREE.Vector3();

function animate(): void {
  const delta = Math.min(clock.getDelta(), 0.05);
  previousPlayerPosition.copy(player.group.position);
  player.update(delta, input);
  park.update(delta);
  scooterSystem.dismountIfNeeded(player);
  park.resolvePlayerPosition(player.group.position, previousPlayerPosition);
  npcSystem.resolvePlayerPosition(
    player.group.position,
    previousPlayerPosition,
    player.isRiding,
  );
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

  if (input.consumePressed('Space') && !player.isKnockedDown) {
    const nearScooter =
      !chairSystem.playerChair &&
      (player.isRiding ||
        scooterSystem.findNearestIdle(player.group.position, CONFIG.scooter.pickupRange));
    if (nearScooter) {
      const ride = scooterSystem.handlePlayerAction(player);
      if (ride === 'mounted') showMessage('עלית על הקורקינט! W לנסוע, Space לרדת.');
      if (ride === 'dismounted') showMessage('ירדת מהקורקינט.');
    } else {
      const punch = !chairSystem.playerChair ? npcSystem.punchNearest(player) : null;
      if (punch?.reacted) {
        if (punch.giantHit) {
          audio.playShobidak();
        } else if (punch.informerDown) {
          audio.playShemo();
        } else {
          audio.playPunch();
          audio.playNoten();
        }
        if (punch.giantHit) {
          showMessage("דקרת את הערבי הצ'צ'ני!");
        } else if (punch.informerDown) {
          showMessage(
            punch.allInformersDown
              ? 'ברכות, הורדת את כל המלשינים!'
              : 'הורדת מלשין באגרוף! חפש את המלשינים שנשארו.',
          );
        } else {
          showMessage('Punch! That NPC is getting back up to retaliate.');
        }
      } else {
        const action = chairSystem.handlePlayerAction(player);
        if (action === 'picked-up') showMessage('Chair ready. Face an NPC and press Space!');
        if (action === 'thrown') showMessage('Chair away!');
        if (action === 'none') showMessage('Move closer to an NPC, a scooter, or a white chair.');
      }
    }
  }

  npcSystem.update(delta, player);
  if (npcSystem.consumeProximityCue()) {
    audio.playWater();
  }
  if (player.isRiding) {
    for (const hit of npcSystem.runOverNearby(player)) {
      if (hit.giantHit) {
        audio.playShobidak();
        showMessage("דרסת את הערבי הצ'צ'ני!");
      } else if (hit.informerDown) {
        audio.playShemo();
        showMessage(
          hit.allInformersDown
            ? 'ברכות, הורדת את כל המלשינים!'
            : 'דרסת מלשין!',
        );
      } else {
        audio.playPunch();
        showMessage('דרסת אותו!');
      }
    }
  }
  if (npcSystem.consumeGiantInjection()) {
    audio.playMorgen();
    showMessage("הערבי הצ'צ'ני הזריק לך חיסון!");
    scooterSystem.dismountIfNeeded(player);
    if (chairSystem.playerChair) {
      chairSystem.playerChair.group.position.copy(player.group.position);
      chairSystem.playerChair.land();
      chairSystem.playerChair = null;
    }
  }
  chairSystem.update(delta);
  collisions.update();
  chairSystem.finalizeLandings();
  if (npcSystem.allInformersDown) showVictory();

  messageTimer -= delta;
  if (messageTimer <= 0) {
    const nearest = chairSystem.findNearestIdle(player.group.position, CONFIG.chair.pickupRange);
    const nearestScooter = scooterSystem.findNearestIdle(
      player.group.position,
      CONFIG.scooter.pickupRange,
    );
    statusElement.textContent = npcSystem.allInformersDown
      ? 'ברכות, הורדת את כל המלשינים!'
      : player.isRiding
        ? 'On scooter — Space to hop off'
        : chairSystem.playerChair
          ? 'Holding chair — Space to throw'
          : nearestScooter
            ? 'Scooter nearby — Space to ride'
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
  touchControls.dispose();
  audio.dispose();
  restartButton.removeEventListener('click', restartGame);
  renderer.dispose();
});

followCamera.update(1, player.group.position, input);
showMessage('מצא והורד את כל המלשינים', 4);
animate();
