import * as THREE from 'three';
import { CONFIG } from '../config';
import type { Chair } from '../entities/Chair';
import { Npc, type NpcMode, type ProximityCue } from '../entities/Npc';
import { PARTY_TABLES, PartyTable } from '../entities/PartyTable';
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
  private readonly pendingProximityCues: ProximityCue[] = [];
  private readonly lastProximityCueAt = new Map<string, number>();
  private readonly vendorSales = new Map<
    string,
    { customerId: string | null; saleTimer: number; approaching: boolean }
  >();
  private readonly partyTables: PartyTable[] = [];
  private readonly hookahHoses: Array<{
    npc: Npc;
    table: PartyTable;
    mesh: THREE.Mesh;
  }> = [];
  private readonly hoseMaterial = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.7,
  });
  private readonly hoseHand = new THREE.Vector3();
  private readonly hoseAnchor = new THREE.Vector3();
  private readonly hoseSag = new THREE.Vector3();

  constructor(
    private readonly scene: THREE.Scene,
    private readonly chairSystem: ChairSystem,
  ) {}

  seed(): void {
    const seats: ReturnType<PartyTable['seats']> = [];
    for (const table of PARTY_TABLES) {
      const partyTable = new PartyTable(table.x, table.z);
      this.partyTables.push(partyTable);
      this.scene.add(partyTable.group);
      seats.push(...partyTable.seats());
    }
    const roaming: Array<[NpcMode, number, number]> = [
      ['sunbathing', -25, 13],
      ['sunbathing', 24, 3],
      ['walking', 18, 3],
      ['walking', 7, -18],
      ['sunbathing', -32, 20],
      ['walking', -15, 18],
      ['walking', 8, 22],
      ['walking', 30, -28],
      ['sunbathing', 30, -8],
    ];
    const regularCount = seats.length + roaming.length;
    const informerIndexes = new Set<number>();
    while (informerIndexes.size < this.totalInformers) {
      informerIndexes.add(THREE.MathUtils.randInt(0, regularCount - 1));
    }
    seats.forEach((seat, index) => {
      const npc = new Npc(
        index,
        'partying',
        seat.position,
        informerIndexes.has(index) ? 'מלשין' : undefined,
        1,
        undefined,
        { partyHabit: seat.habit, facingYaw: seat.yaw },
      );
      this.npcs.push(npc);
      this.scene.add(npc.group);
      if (seat.habit === 'smoke') {
        const mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.hoseMaterial);
        this.scene.add(mesh);
        this.hookahHoses.push({ npc, table: seat.table, mesh });
      }
    });
    roaming.forEach(([mode, x, z], roamingIndex) => {
      const index = seats.length + roamingIndex;
      const npc = new Npc(
        index,
        mode,
        new THREE.Vector3(x, 0, z),
        informerIndexes.has(index) ? 'מלשין' : undefined,
      );
      this.npcs.push(npc);
      this.scene.add(npc.group);
      if (mode === 'walking') {
        this.ambientTimers.set(npc.id, 2 + (roamingIndex % 5) * 0.7);
      }
    });
    const giant = new Npc(
      regularCount,
      'walking',
      new THREE.Vector3(8, 0, -10),
      "ערבי צ'צ'ני",
      1.35,
      0xffffff,
    );
    this.npcs.push(giant);
    this.scene.add(giant.group);
    const portraitNpc = new Npc(
      regularCount + 1,
      'walking',
      new THREE.Vector3(-10, 0, 12),
      'מים ב5',
      1,
      0xffffff,
      {
        faceTexture: './textures/water-face.png',
        proximityCue: 'water',
        shoppingCart: true,
        pantsColor: 0x1e293b,
      },
    );
    this.npcs.push(portraitNpc);
    this.scene.add(portraitNpc.group);
    const dekel = new Npc(
      regularCount + 2,
      'walking',
      new THREE.Vector3(3, 0, 14),
      'דקל וקנין',
      1,
      0xffffff,
      {
        faceTexture: './textures/dekel-face.png',
        proximityCue: 'dekel',
        microphone: true,
        pantsColor: 0x111827,
      },
    );
    this.npcs.push(dekel);
    this.scene.add(dekel.group);
    const hotDogVendor = new Npc(
      regularCount + 3,
      'walking',
      new THREE.Vector3(10, 0, 12),
      'סטפן',
      1,
      0xffffff,
      {
        faceTexture: './textures/hotdog-face.png',
        hotDogStand: true,
        pantsColor: 0x7f1d1d,
        skinColor: 0x5c3a28,
        shirtLabelScale: 2.2,
        shirtLabelY: 1.18,
      },
    );
    this.npcs.push(hotDogVendor);
    this.scene.add(hotDogVendor.group);
  }

  update(delta: number, player: Player, audioUnlocked = false): void {
    if (audioUnlocked) this.updateProximityCue(player);
    this.updateVendors(delta);
    for (const table of this.partyTables) table.update(delta);
    this.updateHookahHoses();
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

  consumeProximityCue(): ProximityCue | null {
    return this.pendingProximityCues.shift() ?? null;
  }

  confirmProximityCue(cue: ProximityCue): void {
    const now = performance.now();
    for (const npc of this.npcs) {
      if (npc.proximityCue === cue) this.lastProximityCueAt.set(npc.id, now);
    }
  }

  private updateVendors(delta: number): void {
    for (const seller of this.npcs) {
      if (!seller.isVendor || seller.reaction !== 'calm') continue;
      let state = this.vendorSales.get(seller.id);
      if (!state) {
        state = { customerId: null, saleTimer: 0, approaching: false };
        this.vendorSales.set(seller.id, state);
      }
      state.saleTimer = Math.max(0, state.saleTimer - delta);
      const customer = this.npcs.find((npc) => npc.id === state.customerId);
      if (customer && !seller.hasArrived()) {
        state.approaching = true;
        seller.seek(customer.group.position);
        continue;
      }
      if (state.approaching && customer && seller.hasArrived()) {
        state.approaching = false;
        state.saleTimer = 1.8;
      }
      if (state.saleTimer > 0) continue;
      const candidates = this.npcs.filter(
        (npc) =>
          npc.id !== seller.id &&
          !npc.isVendor &&
          npc.characterScale <= 1 &&
          npc.reaction !== 'falling' &&
          npc.reaction !== 'down',
      );
      if (candidates.length === 0) continue;
      const next = candidates[THREE.MathUtils.randInt(0, candidates.length - 1)];
      state.customerId = next.id;
      state.approaching = true;
      seller.seek(next.group.position);
    }
  }

  private updateHookahHoses(): void {
    for (const hose of this.hookahHoses) {
      if (hose.npc.reaction !== 'calm') {
        hose.mesh.visible = false;
        continue;
      }
      hose.mesh.visible = true;
      hose.table.hoseAnchor(this.hoseAnchor);
      hose.npc.getRightHandWorldPosition(this.hoseHand);
      this.hoseSag.lerpVectors(this.hoseAnchor, this.hoseHand, 0.5);
      this.hoseSag.y = Math.min(this.hoseAnchor.y, this.hoseHand.y) - 0.42;
      hose.mesh.geometry.dispose();
      hose.mesh.geometry = new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3([
          this.hoseAnchor.clone(),
          this.hoseSag.clone(),
          this.hoseHand.clone(),
        ]),
        14,
        0.018,
        6,
        false,
      );
    }
  }

  private updateProximityCue(player: Player): void {
    const now = performance.now();
    for (const npc of this.npcs) {
      if (!npc.proximityCue) continue;
      const inRange =
        npc.group.position.distanceTo(player.group.position) <=
        CONFIG.npc.proximityCueRange;
      if (!inRange) continue;
      if (this.pendingProximityCues.includes(npc.proximityCue)) continue;
      const lastAt = this.lastProximityCueAt.get(npc.id) ?? 0;
      if (lastAt === 0 || (now - lastAt) / 1000 >= CONFIG.npc.proximityCueCooldown) {
        this.pendingProximityCues.push(npc.proximityCue);
      }
    }
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

  runOverNearby(player: Player): PlayerAttackResult[] {
    if (!player.isScooterMoving || player.isImmobilized) return [];
    const hits: PlayerAttackResult[] = [];
    const hitPoint = player.group.position
      .clone()
      .addScaledVector(player.facing, 0.85);
    for (const npc of this.npcs) {
      const hitRadius = CONFIG.scooter.hitRadius * npc.characterScale;
      if (npc.group.position.distanceTo(hitPoint) > hitRadius) continue;
      const attack = this.registerPlayerAttack(npc);
      if (attack.reacted) hits.push(attack);
    }
    return hits;
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
      npc.isVendor ||
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
        candidate.isVendor ||
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
      if (
        distance <= CONFIG.npc.giantInjectRange &&
        !player.isImmobilized &&
        !player.isScooterMoving
      ) {
        npc.reaction = 'injecting';
        npc.reactionTimer = CONFIG.player.injectionLockDuration;
        player.lockForInjection();
        this.giantInjectionEvent = true;
      } else {
        npc.chase(player.group.position, delta);
      }
      return true;
    }

    if (npc.reaction === 'injecting') {
      const duration = CONFIG.player.injectionLockDuration;
      npc.face(player.group.position);
      npc.reactionTimer = Math.max(0, npc.reactionTimer - delta);
      const progress = 1 - npc.reactionTimer / duration;
      npc.setInjectionPose(Math.sin(progress * Math.PI));
      if (npc.reactionTimer <= 0) {
        npc.setInjectionPose(0);
        npc.reaction = 'calm';
        this.deliveredInjections.delete(npc.id);
        this.ambientTimers.delete(npc.id);
        player.registerInjection();
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

  resolvePlayerPosition(
    position: THREE.Vector3,
    previous: THREE.Vector3,
    passThrough = false,
  ): void {
    if (passThrough) return;
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
