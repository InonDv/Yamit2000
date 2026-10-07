import * as THREE from 'three';
import { COLORS, CONFIG } from '../config';
import { HumanFigure } from './HumanFigure';

const NPC_NAMES = ['נהוראי', 'אלירן', 'אבי', 'יוסי', 'נתי'] as const;

export type NpcMode = 'walking' | 'sunbathing';
export type NpcReaction =
  | 'calm'
  | 'falling'
  | 'down'
  | 'getting-up'
  | 'finding-chair'
  | 'aiming';

export class Npc {
  readonly group = new THREE.Group();
  readonly id: string;
  readonly displayName: string;
  readonly isInformer: boolean;
  reaction: NpcReaction = 'calm';
  reactionTimer = 0;
  hitCooldown = 0;
  private readonly target = new THREE.Vector3();
  private readonly figure: HumanFigure;
  private readonly bodyMaterial: THREE.MeshStandardMaterial;
  private readonly fallStartPosition = new THREE.Vector3();
  private fallStartRotationX = 0;
  private fallStartRotationZ = 0;
  private permanentKnockdown = false;
  private walkPhase = Math.random() * Math.PI * 2;

  constructor(
    id: number,
    readonly mode: NpcMode,
    position: THREE.Vector3,
    assignedName?: string,
    readonly characterScale = 1,
    clothingColor?: number,
  ) {
    this.id = `npc-${id}`;
    this.displayName =
      assignedName ?? NPC_NAMES[Math.floor(Math.random() * NPC_NAMES.length)];
    this.isInformer = this.displayName === 'מלשין';
    this.figure = new HumanFigure({
      shirtColor:
        clothingColor ?? (mode === 'walking' ? COLORS.npcWalker : COLORS.npcSunbather),
      pantsColor: clothingColor ?? (id % 2 === 0 ? 0x0f766e : 0x334155),
      skinColor: [0xf0b98b, 0x8d5524, 0xc68642, 0xffdbac][id % 4],
      frontText: this.displayName,
      backText: this.displayName,
    });
    this.bodyMaterial = this.figure.shirtMaterial;
    this.group.add(this.figure.group);
    this.group.scale.setScalar(characterScale);

    if (mode === 'sunbathing') {
      this.figure.group.position.set(0, 0.68, 1.05);
      this.figure.group.rotation.x = -Math.PI / 2;
      const lounger = new THREE.Mesh(
        new THREE.BoxGeometry(1.7, 0.18, 3.2),
        new THREE.MeshStandardMaterial({ color: 0xffffff }),
      );
      lounger.position.y = 0.35;
      lounger.castShadow = true;
      this.group.add(lounger);
    }

    this.group.position.copy(position);
    this.chooseTarget();
  }

  update(delta: number): void {
    this.hitCooldown = Math.max(0, this.hitCooldown - delta);
    if (this.hitCooldown > 0) {
      this.bodyMaterial.emissive.setHex(0xffffff);
      this.bodyMaterial.emissiveIntensity = this.hitCooldown;
    } else {
      this.bodyMaterial.emissiveIntensity = 0;
    }

    if (this.updateKnockdown(delta)) return;

    if (this.mode !== 'walking' || this.reaction !== 'calm') {
      if (this.mode === 'walking') this.figure.resetPose();
      return;
    }
    const direction = this.target.clone().sub(this.group.position);
    direction.y = 0;
    if (direction.lengthSq() < 1) {
      this.chooseTarget();
      return;
    }
    direction.normalize();
    this.group.position.addScaledVector(direction, CONFIG.npc.walkSpeed * delta);
    this.group.rotation.y = Math.atan2(-direction.x, -direction.z);
    this.walkPhase += delta * 7;
    this.figure.setWalkCycle(this.walkPhase, 0.5);
  }

  registerHit(permanentKnockdown = false): boolean {
    if (
      permanentKnockdown &&
      !this.permanentKnockdown &&
      (this.reaction === 'falling' || this.reaction === 'down')
    ) {
      this.permanentKnockdown = true;
      this.hitCooldown = 0.6;
      return true;
    }
    if (
      this.hitCooldown > 0 ||
      this.reaction === 'falling' ||
      this.reaction === 'down' ||
      this.reaction === 'getting-up'
    ) {
      return false;
    }
    this.hitCooldown = 0.6;
    this.permanentKnockdown = permanentKnockdown;
    this.figure.resetPose();
    this.fallStartPosition.copy(this.figure.group.position);
    this.fallStartRotationX = this.figure.group.rotation.x;
    this.fallStartRotationZ = this.figure.group.rotation.z;
    this.reaction = 'falling';
    this.reactionTimer = CONFIG.npc.fallDuration;
    return true;
  }

  private updateKnockdown(delta: number): boolean {
    const sunbather = this.mode === 'sunbathing';
    const fallenRotationX = -Math.PI / 2;
    const fallenRotationZ = sunbather ? -Math.PI / 2 : -0.22;
    const fallenX = this.fallStartPosition.x + (sunbather ? 1.05 : 0.38);
    const fallenY = sunbather ? 0.08 : 0.28;
    const fallenZ = this.fallStartPosition.z + (sunbather ? 0.25 : 0.85);

    if (this.reaction === 'falling') {
      this.reactionTimer = Math.max(0, this.reactionTimer - delta);
      const progress = 1 - this.reactionTimer / CONFIG.npc.fallDuration;
      const eased = 1 - (1 - progress) ** 3;
      this.figure.group.rotation.x = THREE.MathUtils.lerp(
        this.fallStartRotationX,
        fallenRotationX,
        eased,
      );
      this.figure.group.rotation.z = THREE.MathUtils.lerp(
        this.fallStartRotationZ,
        fallenRotationZ,
        eased,
      );
      this.figure.group.position.x = THREE.MathUtils.lerp(
        this.fallStartPosition.x,
        fallenX,
        eased,
      );
      this.figure.group.position.y = THREE.MathUtils.lerp(
        this.fallStartPosition.y,
        fallenY,
        eased,
      );
      this.figure.group.position.z = THREE.MathUtils.lerp(
        this.fallStartPosition.z,
        fallenZ,
        eased,
      );
      if (this.reactionTimer <= 0) {
        this.reaction = 'down';
        this.reactionTimer = CONFIG.npc.downDuration;
      }
      return true;
    }

    if (this.reaction === 'down') {
      if (this.permanentKnockdown) return true;
      this.reactionTimer = Math.max(0, this.reactionTimer - delta);
      if (this.reactionTimer <= 0) {
        this.reaction = 'getting-up';
        this.reactionTimer = CONFIG.npc.getUpDuration;
      }
      return true;
    }

    if (this.reaction === 'getting-up') {
      this.reactionTimer = Math.max(0, this.reactionTimer - delta);
      const progress = 1 - this.reactionTimer / CONFIG.npc.getUpDuration;
      const eased = progress * progress * (3 - 2 * progress);
      this.figure.group.rotation.x = THREE.MathUtils.lerp(
        fallenRotationX,
        this.fallStartRotationX,
        eased,
      );
      this.figure.group.rotation.z = THREE.MathUtils.lerp(
        fallenRotationZ,
        this.fallStartRotationZ,
        eased,
      );
      this.figure.group.position.x = THREE.MathUtils.lerp(
        fallenX,
        this.fallStartPosition.x,
        eased,
      );
      this.figure.group.position.y = THREE.MathUtils.lerp(
        fallenY,
        this.fallStartPosition.y,
        eased,
      );
      this.figure.group.position.z = THREE.MathUtils.lerp(
        fallenZ,
        this.fallStartPosition.z,
        eased,
      );
      if (this.reactionTimer <= 0) {
        this.figure.group.position.copy(this.fallStartPosition);
        this.figure.group.rotation.x = this.fallStartRotationX;
        this.figure.group.rotation.z = this.fallStartRotationZ;
        this.reaction = 'finding-chair';
        this.reactionTimer = CONFIG.npc.retaliationDelay;
      }
      return true;
    }

    return false;
  }

  private chooseTarget(): void {
    const limit = CONFIG.world.halfSize - 5;
    this.target.set(
      THREE.MathUtils.randFloat(-limit, limit),
      0,
      THREE.MathUtils.randFloat(-limit, limit),
    );
  }
}
