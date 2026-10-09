import * as THREE from 'three';
import { CONFIG } from '../config';
import { Scooter } from '../entities/Scooter';
import type { Player } from '../entities/Player';

export class ScooterSystem {
  readonly scooters: Scooter[] = [];
  ridden: Scooter | null = null;

  constructor(private readonly scene: THREE.Scene) {}

  seed(): void {
    const limit = CONFIG.world.halfSize - 6;
    for (let index = 0; index < CONFIG.scooter.count; index += 1) {
      const scooter = new Scooter(
        new THREE.Vector3(
          THREE.MathUtils.randFloat(-limit, limit),
          0,
          THREE.MathUtils.randFloat(-limit, limit),
        ),
        Math.random() * Math.PI * 2,
      );
      this.scooters.push(scooter);
      this.scene.add(scooter.group);
    }
  }

  handlePlayerAction(player: Player): 'mounted' | 'dismounted' | 'none' {
    if (this.ridden) {
      this.dismount(player);
      return 'dismounted';
    }
    const scooter = this.findNearestIdle(player.group.position, CONFIG.scooter.pickupRange);
    if (!scooter) return 'none';
    this.mount(player, scooter);
    return 'mounted';
  }

  dismountIfNeeded(player: Player): void {
    if (this.ridden && player.isKnockedDown) this.dismount(player);
  }

  findNearestIdle(position: THREE.Vector3, maxDistance: number): Scooter | null {
    let nearest: Scooter | null = null;
    let nearestDistance = maxDistance;
    for (const scooter of this.scooters) {
      if (scooter.ridden) continue;
      const distance = scooter.group.position.distanceTo(position);
      if (distance < nearestDistance) {
        nearest = scooter;
        nearestDistance = distance;
      }
    }
    return nearest;
  }

  private mount(player: Player, scooter: Scooter): void {
    scooter.ridden = true;
    this.ridden = scooter;
    player.group.add(scooter.group);
    scooter.group.position.set(0, 0, 0.2);
    scooter.group.rotation.set(0, 0, 0);
    player.setRiding(true);
  }

  private dismount(player: Player): void {
    const scooter = this.ridden;
    if (!scooter) return;
    this.scene.attach(scooter.group);
    scooter.group.position.y = 0;
    scooter.group.rotation.x = 0;
    scooter.group.rotation.z = 0;
    scooter.ridden = false;
    this.ridden = null;
    player.setRiding(false);
  }
}