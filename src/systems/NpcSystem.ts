import * as THREE from 'three';
import { CONFIG } from '../config';
import type { Chair } from '../entities/Chair';
import { Npc, type NpcMode } from '../entities/Npc';
import type { Player } from '../entities/Player';
import type { ChairSystem } from './ChairSystem';

type PlayerAttackResult = {
  reacted: boolean;
  informerDown: boolean;
  giantHit: boolean;
  allInformersDown: boolean;
};

export class NpcSystem {
  readonly npcs: Npc[] = [];
  private readonly totalInformers = 3;
  private readonly downInformers = new Set<string>();
  private readonly retaliationChairs = new Map<string, Chair>();
  private readonly reactionTargets = new Map<string, 'player' | string>();
  private readonly ambientTimers = new Map<string, number>();
  private readonly deliveredInjections = new Set<string>();
  private giantInjectionEvent = false;
  private proximityCueReady = false;
  private lastProximityCueAt = 0;
  private wasNearProximityNpc = false;
  private waterCustomerId: string | null = null;
  private waterSaleTimer = 0;
  private waterApproaching = false;

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
      ['sunbathing', -32, 20],
      ['sunbathing', 32, 20],
      ['sunbathing', -15, 33],
      ['sunbathing', 30, -8],
      ['walking', -15, 18],
      ['walking', 8, 22],
      ['walking', -32, 0],
      ['walking', 30, -28],
      ['walking', 2, -30],
    ];
    const informerIndexes = new Set<number>();
    while (informerIndexes.size < this.totalInformers) {
      informerIndexes.add(THREE.MathUtils.randInt(0, placements.length - 1));
    }
    placements.forEach(([mode, x, z], index) => {
      const npc = new Npc(
        index,
        mode,
        new THREE.Vector3(x, 0, z),
        informerIndexes.has(index) ? 'מלשין' : undefined,
      );
      this.npcs.push(npc);
      this.scene.add(npc.group);
      if (mode === 'walking') {
        this.ambientTimers.set(npc.id, 2 + (index % 5) * 0.7);
      }
    });
    const giant = new Npc(
      placements.length,
      'walking',
      new THREE.Vector3(8, 0, -10),
      "ערבי צ'צ'ני",
      1.35,
      0xffffff,
    );
    this.npcs.push(giant);
    this.scene.add(giant.group);
    const portraitNpc = new Npc(
      placements.length + 1,
      'walking',
      new THREE.Vector3(-10, 0, 12),
      'מים ב5',
      1,
      0x147a5a,
      {
        faceTexture: './textures/water-face.png',
        baseballCap: true,
        capColor: 0x1f2937,
        proximityCue: true,
        shoppingCart: true,
      },
    );
    this.npcs.push(portraitNpc);
    this.scene.add(portraitNpc.group);
  }

  update(delta: number, player: Player): void {
    this.updateProximityCue(player);
    this.updateWaterSeller(delta);
    for (const npc of this.npcs) {
      npc.update(delta);
      if (npc.characterScale > 1 && this.updateGiantRetaliation(npc, player, delta)) {
        continue;
      }
      if (npc.reaction === 'calm') {
        this.updateAmbientThrow(npc, delta);
        continue;
      }

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
        const targetPosition = this.getTargetPosition(npc, player);
        const directionToTarget = targetPosition.clone().sub(npc.group.position);
        npc.group.rotation.y = Math.atan2(-directionToTarget.x, -directionToTarget.z);
        if (npc.reactionTimer <= 0) this.throwAtTarget(npc, targetPosition);
      }
    }
  }

  registerPlayerAttack(npc: Npc): PlayerAttackResult {
    const giantHit = npc.characterScale > 1;
    if (giantHit) {
      const reacted = this.registerAttack(npc, 'player');
      return {
        reacted,
        informerDown: false,
        giantHit: true,
        allInformersDown: this.allInformersDown,
      };
    }
    const informerDown = npc.isInformer && !this.downInformers.has(npc.id);
    const reacted = this.registerAttack(npc, 'player', informerDown);
    if (reacted && informerDown) this.downInformers.add(npc.id);
    return {
      reacted,
      informerDown: reacted && informerDown,
      giantHit: false,
      allInformersDown: this.allInformersDown,
    };
  }

  registerPlayerChairAttack(npc: Npc): PlayerAttackResult {
    return this.registerPlayerAttack(npc);
  }

  registerNpcAttack(npc: Npc, attackerId: string): boolean {
    if (npc.isInformer || npc.characterScale > 1) return false;
    if (this.npcs.find((candidate) => candidate.id === attackerId)?.isInformer) {
      return false;
    }
    return this.registerAttack(npc, attackerId);
  }

  get allInformersDown(): boolean {
    return this.downInformers.size === this.totalInformers;
  }

  consumeGiantInjection(): boolean {
    if (!this.giantInjectionEvent) return false;
    this.giantInjectionEvent = false;
    return true;
  }

  consumeProximityCue(): boolean {
    if (!this.proximityCueReady) return false;
    this.proximityCueReady = false;
    return true;
  }

  private updateWaterSeller(delta: number): void {
    const seller = this.npcs.find((npc) => npc.proximityCue);
    if (!seller || seller.reaction !== 'calm') return;
    this.waterSaleTimer = Math.max(0, this.waterSaleTimer - delta);
    const customer = this.npcs.find((npc) => npc.id === this.waterCustomerId);
    if (customer && !seller.hasArrived()) {
      this.waterApproaching = true;
      seller.seek(customer.group.position);
      return;
    }
    if (this.waterApproaching && customer && seller.hasArrived()) {
      this.waterApproaching = false;
      this.waterSaleTimer = 1.8;
    }
    if (this.waterSaleTimer > 0) return;
    const candidates = this.npcs.filter(
      (npc) =>
        npc.id !== seller.id &&
        npc.characterScale <= 1 &&
        npc.reaction !== 'falling' &&
        npc.reaction !== 'down',
    );
    if (candidates.length === 0) return;
    const next = candidates[THREE.MathUtils.randInt(0, candidates.length - 1)];
    this.waterCustomerId = next.id;
    this.waterApproaching = true;
    seller.seek(next.group.position);
  }

  private updateProximityCue(player: Player): void {
    const portraitNpc = this.npcs.find((npc) => npc.proximityCue);
    if (!portraitNpc) return;
    const inRange =
      portraitNpc.group.position.distanceTo(player.group.position) <=
      CONFIG.npc.proximityCueRange;
    if (inRange && !this.wasNearProximityNpc) {
      const elapsed = (performance.now() - this.lastProximityCueAt) / 1000;
      if (this.lastProximityCueAt === 0 || elapsed >= CONFIG.npc.proximityCueCooldown) {
        this.lastProximityCueAt = performance.now();
        this.proximityCueReady = true;
      }
    }
    this.wasNearProximityNpc = inRange;
  }

  punchNearest(player: Player): PlayerAttackResult {
    let nearest: Npc | null = null;
    let nearestDistance: number = CONFIG.player.punchRange;
    for (const npc of this.npcs) {
      const distance =
        npc.group.position.distanceTo(player.group.position) -
        CONFIG.npc.radius * (npc.characterScale - 1);
      if (distance < nearestDistance) {
        nearest = npc;
        nearestDistance = distance;
      }
    }
    if (!nearest) {
      return {
        reacted: false,
        informerDown: false,
        giantHit: false,
        allInformersDown: this.allInformersDown,
      };
    }
    const attack = this.registerPlayerAttack(nearest);
    if (!attack.reacted) return attack;
    player.punch();
    return attack;
  }

  private registerAttack(
    npc: Npc,
    target: 'player' | string,
    permanentKnockdown = false,
  ): boolean {
    const reacted = npc.registerHit(permanentKnockdown);
    if (!reacted) return false;
    const heldChair = this.retaliationChairs.get(npc.id);
    if (heldChair) {
      heldChair.group.position.copy(npc.group.position);
      heldChair.land();
      this.retaliationChairs.delete(npc.id);
    }
    if (permanentKnockdown) {
      this.reactionTargets.delete(npc.id);
      this.ambientTimers.delete(npc.id);
    } else {
      this.reactionTargets.set(npc.id, target);
    }
    return true;
  }

  private updateAmbientThrow(npc: Npc, delta: number): void {
    if (
      npc.mode !== 'walking' ||
      npc.isInformer ||
      npc.characterScale > 1 ||
      npc.proximityCue
    ) {
      return;
    }
    const timer = (this.ambientTimers.get(npc.id) ?? this.randomAmbientDelay()) - delta;
    if (timer > 0) {
      this.ambientTimers.set(npc.id, timer);
      return;
    }

    let target: Npc | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const candidate of this.npcs) {
      if (
        candidate.id === npc.id ||
        candidate.isInformer ||
        candidate.characterScale > 1 ||
        candidate.proximityCue ||
        candidate.reaction !== 'calm'
      ) {
        continue;
      }
      const distance = candidate.group.position.distanceToSquared(npc.group.position);
      if (distance < nearestDistance) {
        target = candidate;
        nearestDistance = distance;
      }
    }
    if (!target) {
      this.ambientTimers.set(npc.id, 1);
      return;
    }

    const chair = this.claimChair(npc);
    chair.hold(npc.group, npc.id);
    this.retaliationChairs.set(npc.id, chair);
    this.reactionTargets.set(npc.id, target.id);
    npc.reaction = 'aiming';
    npc.reactionTimer = 0.65;
  }

  private updateGiantRetaliation(npc: Npc, player: Player, delta: number): boolean {
    if (npc.reaction === 'finding-chair') {
      npc.reaction = 'chasing-player';
      npc.reactionTimer = 0;
      this.reactionTargets.delete(npc.id);
      this.deliveredInjections.delete(npc.id);
    }

    if (npc.reaction === 'chasing-player') {
      npc.face(player.group.position);
      const distance = npc.group.position.distanceTo(player.group.position);
      if (distance <= 2.25) {
        npc.reaction = 'injecting';
        npc.reactionTimer = 1;
      } else {
        npc.chase(player.group.position, delta);
      }
      return true;
    }

    if (npc.reaction === 'injecting') {
      npc.face(player.group.position);
      npc.reactionTimer = Math.max(0, npc.reactionTimer - delta);
      const progress = 1 - npc.reactionTimer;
      npc.setInjectionPose(Math.sin(progress * Math.PI));
      if (progress >= 0.45 && !this.deliveredInjections.has(npc.id)) {
        this.deliveredInjections.add(npc.id);
        player.registerInjection();
        this.giantInjectionEvent = true;
      }
      if (npc.reactionTimer <= 0) {
        npc.setInjectionPose(0);
        npc.reaction = 'calm';
        this.ambientTimers.delete(npc.id);
      }
      return true;
    }

    return false;
  }

  private getTargetPosition(npc: Npc, player: Player): THREE.Vector3 {
    const target = this.reactionTargets.get(npc.id) ?? 'player';
    if (target === 'player') return player.aimOrigin;
    const targetNpc = this.npcs.find((candidate) => candidate.id === target);
    return targetNpc
      ? targetNpc.group.position.clone().add(new THREE.Vector3(0, 1.1, 0))
      : player.aimOrigin;
  }

  private randomAmbientDelay(): number {
    return THREE.MathUtils.randFloat(
      CONFIG.npc.ambientThrowMinDelay,
      CONFIG.npc.ambientThrowMaxDelay,
    );
  }

  resolvePlayerPosition(position: THREE.Vector3, previous: THREE.Vector3): void {
    for (const npc of this.npcs) {
      if (
        npc.reaction === 'falling' ||
        npc.reaction === 'down' ||
        npc.reaction === 'getting-up'
      ) {
        continue;
      }
      const blockingDistance =
        CONFIG.player.radius + CONFIG.npc.radius * npc.characterScale;
      const dx = position.x - npc.group.position.x;
      const dz = position.z - npc.group.position.z;
      if (dx * dx + dz * dz < blockingDistance * blockingDistance) {
        position.copy(previous);
        return;
      }
    }
  }

  private claimChair(npc: Npc): Chair {
    return (
      this.chairSystem.findNearestIdle(npc.group.position, CONFIG.npc.chairSearchRange) ??
      this.chairSystem.add(npc.group.position.clone().add(new THREE.Vector3(1.5, 0.18, 0)))
    );
  }

  private throwAtTarget(npc: Npc, targetPosition: THREE.Vector3): void {
    const chair = this.retaliationChairs.get(npc.id);
    if (!chair) {
      npc.reaction = 'calm';
      this.reactionTargets.delete(npc.id);
      this.ambientTimers.set(npc.id, this.randomAmbientDelay());
      return;
    }
    chair.group.position.copy(npc.group.position).add(new THREE.Vector3(0, 1.3, 0));
    const direction = targetPosition.clone().sub(chair.group.position);
    const horizontalDistance = Math.hypot(direction.x, direction.z);
    direction.y = 0;
    chair.throw(
      direction,
      CONFIG.chair.npcThrowSpeed,
      THREE.MathUtils.clamp(horizontalDistance * 0.45, 4, 9),
    );
    this.retaliationChairs.delete(npc.id);
    this.reactionTargets.delete(npc.id);
    this.ambientTimers.set(npc.id, this.randomAmbientDelay());
    npc.reaction = 'calm';
    npc.reactionTimer = 0;
  }
}
