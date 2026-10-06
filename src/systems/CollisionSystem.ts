import { CONFIG } from '../config';
import type { Player } from '../entities/Player';
import type { ChairSystem } from './ChairSystem';
import type { NpcSystem } from './NpcSystem';

export class CollisionSystem {
  constructor(
    private readonly chairs: ChairSystem,
    private readonly npcs: NpcSystem,
    private readonly player: Player,
    private readonly onMessage: (message: string) => void,
  ) {}

  update(): void {
    for (const chair of this.chairs.chairs) {
      if (
        chair.state !== 'thrown' ||
        chair.flightTime < CONFIG.chair.ownerImmunity
      ) {
        continue;
      }

      if (chair.owner === 'player') {
        for (const npc of this.npcs.npcs) {
          const hitDistance = CONFIG.chair.collisionRadius + CONFIG.npc.radius;
          const npcCenter = npc.group.position.clone();
          npcCenter.y += 1.1;
          if (chair.group.position.distanceToSquared(npcCenter) > hitDistance * hitDistance) {
            continue;
          }
          const reacted = npc.registerHit();
          chair.land();
          this.onMessage(
            reacted ? 'Direct hit! That NPC is retaliating!' : 'Chair hit!',
          );
          break;
        }
      } else if (chair.owner?.startsWith('npc-')) {
        const hitDistance = CONFIG.chair.collisionRadius + CONFIG.player.radius;
        const playerCenter = this.player.aimOrigin;
        if (chair.group.position.distanceToSquared(playerCenter) <= hitDistance * hitDistance) {
          this.player.registerHit();
          chair.land();
          this.onMessage('Ouch! An NPC hit you with a chair.');
        }
      }
    }
  }
}
