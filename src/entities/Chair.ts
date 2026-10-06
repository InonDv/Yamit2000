import * as THREE from 'three';
import { COLORS, CONFIG } from '../config';

export type ChairState = 'idle' | 'held' | 'thrown';
export type ChairOwner = 'player' | string | null;

export class Chair {
  readonly group = new THREE.Group();
  readonly velocity = new THREE.Vector3();
  state: ChairState = 'idle';
  owner: ChairOwner = null;
  holder: THREE.Object3D | null = null;
  flightTime = 0;

  constructor(position: THREE.Vector3) {
    const material = new THREE.MeshStandardMaterial({
      color: COLORS.chair,
      roughness: 0.48,
    });
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.16, 1.08), material);
    seat.position.y = 0.9;
    seat.rotation.x = -0.03;

    const backZ = 0.49;
    const backRailGeometry = new THREE.CapsuleGeometry(0.085, 0.88, 4, 8);
    for (const x of [-0.52, 0.52]) {
      const rail = new THREE.Mesh(backRailGeometry, material);
      rail.position.set(x, 1.47, backZ);
      rail.rotation.z = x * -0.08;
      this.group.add(rail);
    }
    const top = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.09, 8, 20, Math.PI), material);
    top.position.set(0, 1.83, backZ);
    this.group.add(top);

    for (const x of [-0.29, 0, 0.29]) {
      const slat = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.63, 4, 8), material);
      slat.position.set(x, 1.46, backZ + 0.005);
      slat.rotation.z = x * -0.18;
      this.group.add(slat);
    }

    const apron = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.18, 0.12), material);
    apron.position.set(0, 0.81, -0.49);
    this.group.add(apron);

    const legGeometry = new THREE.BoxGeometry(0.14, 0.9, 0.16);
    for (const x of [-0.45, 0.45]) {
      for (const z of [-0.4, 0.4]) {
        const leg = new THREE.Mesh(legGeometry, material);
        leg.position.set(x * 1.06, 0.43, z);
        leg.rotation.z = x > 0 ? -0.08 : 0.08;
        leg.rotation.x = z > 0 ? 0.06 : -0.06;
        this.group.add(leg);
      }
    }
    this.group.add(seat);
    this.group.traverse((object) => {
      if (object instanceof THREE.Mesh) object.castShadow = true;
    });
    this.group.position.copy(position);
  }

  hold(holder: THREE.Object3D, owner: Exclude<ChairOwner, null>): void {
    this.state = 'held';
    this.owner = owner;
    this.holder = holder;
    this.velocity.set(0, 0, 0);
    this.flightTime = 0;
    this.group.rotation.set(0, 0, 0);
  }

  throw(direction: THREE.Vector3, speed: number): void {
    this.state = 'thrown';
    this.holder = null;
    this.flightTime = 0;
    this.velocity.copy(direction).normalize().multiplyScalar(speed);
    this.velocity.y += 3.4;
  }

  land(): void {
    this.state = 'idle';
    this.owner = null;
    this.holder = null;
    this.velocity.set(0, 0, 0);
    this.group.position.y = CONFIG.chair.groundHeight;
    this.group.rotation.set(0, this.group.rotation.y, Math.PI / 2);
  }

  update(delta: number): void {
    if (this.state === 'held' && this.holder) {
      const holderPosition = new THREE.Vector3();
      const holderQuaternion = new THREE.Quaternion();
      this.holder.getWorldPosition(holderPosition);
      this.holder.getWorldQuaternion(holderQuaternion);
      const offset = new THREE.Vector3(0, 1.25, -1.25).applyQuaternion(holderQuaternion);
      this.group.position.copy(holderPosition).add(offset);
      this.group.quaternion.copy(holderQuaternion);
      this.group.rotateX(-0.2);
      return;
    }

    if (this.state !== 'thrown') return;
    this.flightTime += delta;
    this.velocity.y -= CONFIG.chair.gravity * delta;
    this.group.position.addScaledVector(this.velocity, delta);
    this.group.rotateX(delta * 7);
    this.group.rotateZ(delta * 4);

    if (this.group.position.y <= CONFIG.chair.groundHeight && this.velocity.y < 0) {
      this.land();
    }
  }
}
