import * as THREE from 'three';
import { CONFIG } from '../config';
import type { InputController } from '../input/InputController';
import { HumanFigure } from './HumanFigure';

export class Player {
  readonly group = new THREE.Group();
  readonly facing = new THREE.Vector3(0, 0, -1);
  hitFlash = 0;

  private readonly figure = new HumanFigure({
    shirtColor: 0xf8fafc,
    pantsColor: 0x2563eb,
    baseballCap: true,
    sleeveless: true,
    nikeBranding: true,
    backText: 'יקיר הגבר',
  });
  private readonly bodyMaterial = this.figure.shirtMaterial;
  private walkPhase = 0;
  private punchTimer = 0;

  constructor() {
    this.group.add(this.figure.group);
    this.group.position.set(CONFIG.player.start.x, 0, CONFIG.player.start.z);
  }

  update(delta: number, input: InputController): void {
    const move =
      Number(input.isHeld('KeyW')) - Number(input.isHeld('KeyS'));

    if (move !== 0) {
      this.group.position.addScaledVector(
        this.facing,
        move * CONFIG.player.moveSpeed * delta,
      );
      this.walkPhase += delta * 10;
      this.figure.setWalkCycle(this.walkPhase, 0.65 * move);
    } else {
      this.figure.resetPose();
    }

    if (this.punchTimer > 0) {
      this.punchTimer = Math.max(0, this.punchTimer - delta);
      const progress = 1 - this.punchTimer / CONFIG.player.punchDuration;
      this.figure.setPunchPose(Math.sin(progress * Math.PI));
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

  faceDirection(direction: THREE.Vector3): void {
    direction.y = 0;
    if (direction.lengthSq() === 0) return;
    this.facing.copy(direction).normalize();
    this.group.rotation.y = Math.atan2(-this.facing.x, -this.facing.z);
  }

  registerHit(): void {
    this.hitFlash = 0.7;
  }

  punch(): void {
    this.punchTimer = CONFIG.player.punchDuration;
  }

  get aimOrigin(): THREE.Vector3 {
    return this.group.position.clone().add(new THREE.Vector3(0, 1.5, 0));
  }
}
