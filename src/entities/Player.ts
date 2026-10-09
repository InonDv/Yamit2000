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
    armaniCap: true,
    backText: 'בחור טוב',
    knife: true,
  });
  private readonly bodyMaterial = this.figure.shirtMaterial;
  private walkPhase = 0;
  private punchTimer = 0;
  private injectionKnockdownTimer = 0;
  private riding = false;

  constructor() {
    this.group.add(this.figure.group);
    this.group.position.set(CONFIG.player.start.x, 0, CONFIG.player.start.z);
  }

  update(delta: number, input: InputController): void {
    if (this.injectionKnockdownTimer > 0) {
      this.updateInjectionKnockdown(delta);
    } else {
      const move =
        Number(input.isHeld('KeyW')) - Number(input.isHeld('KeyS'));
      const speed = this.riding ? CONFIG.scooter.rideSpeed : CONFIG.player.moveSpeed;

      if (move !== 0) {
        this.group.position.addScaledVector(this.facing, move * speed * delta);
        this.walkPhase += delta * 10;
        if (this.riding) this.figure.setRidePose();
        else this.figure.setWalkCycle(this.walkPhase, 0.65 * move);
      } else if (this.riding) {
        this.figure.setRidePose();
      } else {
        this.figure.resetPose();
      }

      if (this.punchTimer > 0) {
        this.punchTimer = Math.max(0, this.punchTimer - delta);
        const progress = 1 - this.punchTimer / CONFIG.player.punchDuration;
        this.figure.setPunchPose(Math.sin(progress * Math.PI));
      }
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
    if (this.isKnockedDown) return;
    direction.y = 0;
    if (direction.lengthSq() === 0) return;
    this.facing.copy(direction).normalize();
    this.group.rotation.y = Math.atan2(-this.facing.x, -this.facing.z);
  }

  registerHit(): void {
    this.hitFlash = 0.7;
  }

  registerInjection(): void {
    this.registerHit();
    this.injectionKnockdownTimer = CONFIG.player.injectionKnockdownDuration;
    this.punchTimer = 0;
    this.figure.resetPose();
  }

  punch(): void {
    this.punchTimer = CONFIG.player.punchDuration;
  }

  setRiding(riding: boolean): void {
    this.riding = riding;
    if (this.isKnockedDown) return;
    this.figure.group.position.y = riding ? 0.42 : 0;
    if (!riding) this.figure.resetPose();
    else this.figure.setRidePose();
  }

  get isRiding(): boolean {
    return this.riding;
  }

  get isKnockedDown(): boolean {
    return this.injectionKnockdownTimer > 0;
  }

  get aimOrigin(): THREE.Vector3 {
    return this.group.position.clone().add(new THREE.Vector3(0, 1.5, 0));
  }

  private updateInjectionKnockdown(delta: number): void {
    const duration = CONFIG.player.injectionKnockdownDuration;
    const fallTime = 0.4;
    const getUpTime = 0.55;
    const rolls = CONFIG.player.injectionRollCount;
    this.injectionKnockdownTimer = Math.max(0, this.injectionKnockdownTimer - delta);
    const elapsed = duration - this.injectionKnockdownTimer;
    const remaining = this.injectionKnockdownTimer;
    const fallenX = -Math.PI / 2;
    const fallenY = 0.32;
    const fallenZ = 0.9;

    let downAmount = 1;
    let roll = 0;
    if (elapsed < fallTime) {
      const progress = elapsed / fallTime;
      downAmount = 1 - (1 - progress) ** 3;
    } else if (remaining < getUpTime) {
      const progress = 1 - remaining / getUpTime;
      downAmount = 1 - progress * progress * (3 - 2 * progress);
    } else {
      const rollWindow = Math.max(0.01, duration - fallTime - getUpTime);
      roll = ((elapsed - fallTime) / rollWindow) * rolls * Math.PI * 2;
    }

    this.figure.group.rotation.x = fallenX * downAmount;
    this.figure.group.rotation.y = 0;
    this.figure.group.rotation.z = roll;
    this.figure.group.position.set(0, fallenY * downAmount, fallenZ * downAmount);

    if (this.injectionKnockdownTimer <= 0) {
      this.figure.group.position.set(0, 0, 0);
      this.figure.group.rotation.set(0, 0, 0);
      this.figure.resetPose();
    }
  }
}
