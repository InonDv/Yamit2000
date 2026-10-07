import { CONFIG } from '../config';
import type { Npc } from '../entities/Npc';
import type { Player } from '../entities/Player';
import type { ChairSystem } from './ChairSystem';
import type { NpcSystem } from './NpcSystem';

export class CollisionSystem {
  constructor(
    private readonly chairs: ChairSystem,
    private readonly npcs: NpcSystem,
    private readonly player: Player,
    private readonly onMessage: (message: string) => void,
    private readonly onPlayerChairHit: () => void,
    private readonly onNpcChairHitPlayer: () => void,
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
        let threatenedNpc: Npc | null = null;
        let nearestDistanceSquared = Number.POSITIVE_INFINITY;
        const reactionDistance =
          CONFIG.chair.collisionRadius + CONFIG.npc.chairReactionRadius;

        for (const npc of this.npcs.npcs) {
          const npcCenter = npc.group.position.clone();
          npcCenter.y += 1.1;
          const distanceSquared = this.segmentDistanceSquared(
            chair.previousPosition,
            chair.group.position,
            npcCenter,
          );
          if (
            distanceSquared <= reactionDistance * reactionDistance &&
            distanceSquared < nearestDistanceSquared
          ) {
            threatenedNpc = npc;
            nearestDistanceSquared = distanceSquared;
          }
        }

        if (threatenedNpc) {
          const physicalHitDistance =
            CONFIG.chair.collisionRadius + CONFIG.npc.radius;
          const directHit =
            nearestDistanceSquared <= physicalHitDistance * physicalHitDistance;
          const attack = this.npcs.registerPlayerChairAttack(threatenedNpc, directHit);
          if (directHit) {
            chair.land();
            this.onPlayerChairHit();
          }
          if (attack.informerDown) {
            this.onMessage(
              attack.allInformersDown
                ? 'ברכות, שלחת את כל המלשינים לקבורה בפרדס'
                : 'הורדת מלשין! חפש את המלשינים שנשארו.',
            );
          } else if (attack.reacted) {
            this.onMessage(
              directHit
                ? 'Direct hit! The NPC is down — and will retaliate!'
                : 'Close throw! The NPC falls and will retaliate!',
            );
          } else if (directHit) {
            this.onMessage('Chair hit!');
          }
        }
      } else if (chair.owner?.startsWith('npc-')) {
        let hitNpc = false;
        const npcHitDistance = CONFIG.chair.collisionRadius + CONFIG.npc.radius;
        for (const npc of this.npcs.npcs) {
          if (npc.id === chair.owner) continue;
          const npcCenter = npc.group.position.clone();
          npcCenter.y += 1.1;
          if (
            this.segmentDistanceSquared(
              chair.previousPosition,
              chair.group.position,
              npcCenter,
            ) > npcHitDistance * npcHitDistance
          ) {
            continue;
          }
          this.npcs.registerNpcAttack(npc, chair.owner);
          chair.land();
          hitNpc = true;
          break;
        }
        if (hitNpc) continue;

        const hitDistance = CONFIG.chair.collisionRadius + CONFIG.player.radius;
        const playerCenter = this.player.aimOrigin;
        if (
          this.segmentDistanceSquared(
            chair.previousPosition,
            chair.group.position,
            playerCenter,
          ) <= hitDistance * hitDistance
        ) {
          this.player.registerHit();
          chair.land();
          this.onNpcChairHitPlayer();
          this.onMessage('Ouch! An NPC hit you with a chair.');
        }
      }
    }
  }

  private segmentDistanceSquared(
    start: { x: number; y: number; z: number },
    end: { x: number; y: number; z: number },
    point: { x: number; y: number; z: number },
  ): number {
    const segmentX = end.x - start.x;
    const segmentY = end.y - start.y;
    const segmentZ = end.z - start.z;
    const lengthSquared =
      segmentX * segmentX + segmentY * segmentY + segmentZ * segmentZ;
    if (lengthSquared === 0) {
      const dx = point.x - start.x;
      const dy = point.y - start.y;
      const dz = point.z - start.z;
      return dx * dx + dy * dy + dz * dz;
    }
    const projection = Math.max(
      0,
      Math.min(
        1,
        ((point.x - start.x) * segmentX +
          (point.y - start.y) * segmentY +
          (point.z - start.z) * segmentZ) /
          lengthSquared,
      ),
    );
    const closestX = start.x + segmentX * projection;
    const closestY = start.y + segmentY * projection;
    const closestZ = start.z + segmentZ * projection;
    const dx = point.x - closestX;
    const dy = point.y - closestY;
    const dz = point.z - closestZ;
    return dx * dx + dy * dy + dz * dz;
  }
}
