import * as THREE from 'three';
import { CONFIG } from '../config';
import type { Chair } from '../entities/Chair';
import { Npc, type NpcMode } from '../entities/Npc';
import type { Player } from '../entities/Player';
import type { ChairSystem } from './ChairSystem';

export class NpcSystem {
  readonly npcs: Npc[] = [];
  private readonly retaliationChairs = new Map<string, Chair>();

  constructor(
    private readonly scene: THREE.Scene,
    private readonly chairSystem: ChairSystem,
  ) {}

  seed(): void {
    const placements: Array<[NpcMode, number, number]> = [
      ['sunbathing', -25, 13],
      ['sunbathing', 24, 3],
      ['sunbathing', 13, 27],
      ['sunbathing', -8, -24],
      ['walking', -2, 9],
      ['walking', 18, 3],
      ['walking', 7, -18],
      ['walking', -23, -8],
      ['walking', 28, 28],
    ];
    placements.forEach(([mode, x, z], index) => {
      const npc = new Npc(index, mode, new THREE.Vector3(x, 0, z));
      this.npcs.push(npc);
      this.scene.add(npc.group);
    });
  }

  update(delta: number, player: Player): void {
    for (const npc of this.npcs) {
      npc.update(delta);
      if (npc.reaction === 'calm') continue;

      if (npc.reaction === 'finding-chair') {
        npc.reactionTimer -= delta;
        if (npc.reactionTimer > 0) continue;
        const chair = this.claimChair(npc);
        chair.hold(npc.group, npc.id);
        this.retaliationChairs.set(npc.id, chair);
        npc.reaction = 'aiming';
        npc.reactionTimer = 0.55;
      } else if (npc.reaction === 'aiming') {
        npc.reactionTimer -= delta;
        npc.group.lookAt(player.group.position.x, npc.group.position.y, player.group.position.z);
        if (npc.reactionTimer <= 0) this.throwAtPlayer(npc, player);
      }
    }
  }

  private claimChair(npc: Npc): Chair {
    return (
      this.chairSystem.findNearestIdle(npc.group.position, CONFIG.npc.chairSearchRange) ??
      this.chairSystem.add(npc.group.position.clone().add(new THREE.Vector3(1.5, 0.18, 0)))
    );
  }

  private throwAtPlayer(npc: Npc, player: Player): void {
    const chair = this.retaliationChairs.get(npc.id);
    if (!chair) {
      npc.reaction = 'calm';
      return;
    }
    chair.group.position.copy(npc.group.position).add(new THREE.Vector3(0, 1.3, 0));
    const target = player.aimOrigin;
    const direction = target.sub(chair.group.position).normalize();
    chair.throw(direction, CONFIG.chair.npcThrowSpeed);
    this.retaliationChairs.delete(npc.id);
    npc.reaction = 'calm';
    npc.reactionTimer = 0;
  }
}
