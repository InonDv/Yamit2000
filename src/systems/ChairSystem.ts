import * as THREE from 'three';
import { CONFIG } from '../config';
import { Chair } from '../entities/Chair';
import type { Player } from '../entities/Player';

export class ChairSystem {
  readonly chairs: Chair[] = [];
  playerChair: Chair | null = null;

  constructor(private readonly scene: THREE.Scene) {}

  seed(): void {
    const positions: Array<[number, number]> = [
      [-5, 18], [6, 17], [-11, 8], [10, 7], [-27, 4], [-24, 18],
      [25, 24], [31, 8], [9, -8], [-4, -11], [-29, -22], [18, -31],
      [3, 30], [-12, 29], [29, -10], [-7, -28],
      [-18, 20], [14, 20], [-34, 15], [35, 15], [-20, 34], [20, 34],
      [-34, -5], [34, -25], [-18, -25], [14, -24], [-3, -34], [34, 3],
      [-16, 3], [8, -20], [24, -18], [6, 35],
    ];
    for (const [x, z] of positions) this.add(new THREE.Vector3(x, CONFIG.chair.groundHeight, z));
  }

  add(position: THREE.Vector3): Chair {
    const chair = new Chair(position);
    chair.group.rotation.y = Math.random() * Math.PI * 2;
    this.chairs.push(chair);
    this.scene.add(chair.group);
    return chair;
  }

  update(delta: number): void {
    for (const chair of this.chairs) chair.update(delta);
  }

  finalizeLandings(): void {
    for (const chair of this.chairs) {
      if (chair.pendingLanding && chair.state === 'thrown') chair.land();
    }
  }

  resolvePlayerPosition(position: THREE.Vector3, previous: THREE.Vector3): void {
    const blockingDistance = CONFIG.player.radius + 0.58;
    for (const chair of this.chairs) {
      if (chair.state !== 'idle') continue;
      const dx = position.x - chair.group.position.x;
      const dz = position.z - chair.group.position.z;
      if (dx * dx + dz * dz < blockingDistance * blockingDistance) {
        position.copy(previous);
        return;
      }
    }
  }

  handlePlayerAction(player: Player): 'picked-up' | 'thrown' | 'none' {
    if (this.playerChair) {
      this.playerChair.group.position.copy(player.aimOrigin).addScaledVector(player.facing, 1.2);
      this.playerChair.throw(player.facing, CONFIG.chair.throwSpeed);
      this.playerChair = null;
      return 'thrown';
    }

    const chair = this.findNearestIdle(player.group.position, CONFIG.chair.pickupRange);
    if (!chair) return 'none';
    chair.hold(player.group, 'player');
    this.playerChair = chair;
    return 'picked-up';
  }

  findNearestIdle(position: THREE.Vector3, maxDistance: number): Chair | null {
    let nearest: Chair | null = null;
    let nearestDistance = maxDistance;
    for (const chair of this.chairs) {
      if (chair.state !== 'idle') continue;
      const distance = chair.group.position.distanceTo(position);
      if (distance < nearestDistance) {
        nearest = chair;
        nearestDistance = distance;
      }
    }
    return nearest;
  }
}
