import * as THREE from 'three';
import { COLORS, CONFIG } from '../config';
import type { InputController } from '../input/InputController';
import { HumanFigure } from './HumanFigure';

export class Player {
  readonly group = new THREE.Group();
  readonly facing = new THREE.Vector3(0, 0, -1);
  hitFlash = 0;

  private readonly figure = new HumanFigure({
    shirtColor: COLORS.player,
    pantsColor: 0x2563eb,
    baseballCap: true,
  });
  private readonly bodyMaterial = this.figure.shirtMaterial;
  private readonly movement = new THREE.Vector3();
  private walkPhase = 0;

  constructor() {
    this.group.add(this.figure.group);
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
      this.walkPhase += delta * 10;
      this.figure.setWalkCycle(this.walkPhase);
    } else {
      this.figure.resetPose();
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
