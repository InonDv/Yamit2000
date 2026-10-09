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
      [-5, 18], [-11, 8], [-27, 4], [25, 24], [9, -8], [-29, -22],
      [3, 30], [29, -10], [-18, 20], [-34, 15], [-20, 34], [-34, -5],
      [-18, -25], [-3, -34], [-16, 3], [27, -5],
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
