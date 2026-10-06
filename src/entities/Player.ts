import * as THREE from 'three';
import { COLORS, CONFIG } from '../config';
import type { InputController } from '../input/InputController';

export class Player {
  readonly group = new THREE.Group();
  readonly facing = new THREE.Vector3(0, 0, -1);
  hitFlash = 0;

  private readonly bodyMaterial = new THREE.MeshStandardMaterial({ color: COLORS.player });
  private readonly movement = new THREE.Vector3();

  constructor() {
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(CONFIG.player.radius, 1.1, 5, 10),
      this.bodyMaterial,
    );
    body.position.y = 1.45;
    body.castShadow = true;

    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(0.75, 0.25, 0.18),
      new THREE.MeshStandardMaterial({ color: 0x172554 }),
    );
    visor.position.set(0, 1.8, -0.62);
    visor.castShadow = true;

    this.group.add(body, visor);
    this.group.position.set(CONFIG.player.start.x, 0, CONFIG.player.start.z);
  }

  update(delta: number, input: InputController, cameraYaw: number): void {
    const x = Number(input.isHeld('ArrowRight')) - Number(input.isHeld('ArrowLeft'));
    const z = Number(input.isHeld('ArrowDown')) - Number(input.isHeld('ArrowUp'));
    this.movement.set(x, 0, z);

    if (this.movement.lengthSq() > 0) {
      this.movement.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraYaw);
      this.group.position.addScaledVector(this.movement, CONFIG.player.moveSpeed * delta);
      this.facing.lerp(this.movement, Math.min(1, delta * 14)).normalize();
      this.group.rotation.y = Math.atan2(-this.facing.x, -this.facing.z);
    }

    const limit = CONFIG.world.halfSize - 1;
    this.group.position.x = THREE.MathUtils.clamp(this.group.position.x, -limit, limit);
    this.group.position.z = THREE.MathUtils.clamp(this.group.position.z, -limit, limit);

    if (this.hitFlash > 0) {
      this.hitFlash -= delta;
      this.bodyMaterial.emissive.setHex(0xff0000);
      this.bodyMaterial.emissiveIntensity = Math.min(1, this.hitFlash * 2);
    } else {
      this.bodyMaterial.emissiveIntensity = 0;
    }
  }

  registerHit(): void {
    this.hitFlash = 0.7;
  }

  get aimOrigin(): THREE.Vector3 {
    return this.group.position.clone().add(new THREE.Vector3(0, 1.5, 0));
  }
}
