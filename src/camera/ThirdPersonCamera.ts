import * as THREE from 'three';
import { CONFIG } from '../config';
import type { InputController } from '../input/InputController';

export class ThirdPersonCamera {
  yaw = 0;
  private pitch = 0.35;
  private readonly desiredPosition = new THREE.Vector3();
  private readonly target = new THREE.Vector3();

  constructor(readonly camera: THREE.PerspectiveCamera) {}

  update(delta: number, targetPosition: THREE.Vector3, input: InputController): void {
    this.yaw -= input.consumePointerDeltaX() * CONFIG.camera.sensitivity;

    const horizontalDistance = CONFIG.camera.distance * Math.cos(this.pitch);
    const height = CONFIG.camera.height + CONFIG.camera.distance * Math.sin(this.pitch);
    this.desiredPosition.set(
      targetPosition.x + Math.sin(this.yaw) * horizontalDistance,
      targetPosition.y + height,
      targetPosition.z + Math.cos(this.yaw) * horizontalDistance,
    );

    const alpha = 1 - Math.exp(-CONFIG.camera.smoothing * delta);
    this.camera.position.lerp(this.desiredPosition, alpha);
    this.target.copy(targetPosition).add(new THREE.Vector3(0, 1.4, 0));
    this.camera.lookAt(this.target);
  }

  setPitch(value: number): void {
    this.pitch = THREE.MathUtils.clamp(value, CONFIG.camera.minPitch, CONFIG.camera.maxPitch);
  }
}
