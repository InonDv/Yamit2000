import * as THREE from 'three';
import { COLORS, CONFIG } from '../config';
import { HumanFigure } from './HumanFigure';

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
  reaction: NpcReaction = 'calm';
  reactionTimer = 0;
  hitCooldown = 0;
  private readonly target = new THREE.Vector3();
  private readonly figure: HumanFigure;
  private readonly bodyMaterial: THREE.MeshStandardMaterial;
  private readonly fallStartPosition = new THREE.Vector3();
  private fallStartRotationX = 0;
  private fallStartRotationZ = 0;
  private walkPhase = Math.random() * Math.PI * 2;

  constructor(
    id: number,
    readonly mode: NpcMode,
    position: THREE.Vector3,
  ) {
    this.id = `npc-${id}`;
    this.figure = new HumanFigure({
      shirtColor: mode === 'walking' ? COLORS.npcWalker : COLORS.npcSunbather,
      pantsColor: id % 2 === 0 ? 0x0f766e : 0x334155,
      skinColor: [0xf0b98b, 0x8d5524, 0xc68642, 0xffdbac][id % 4],
    });
    this.bodyMaterial = this.figure.shirtMaterial;
    this.group.add(this.figure.group);

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

  registerHit(): boolean {
    if (this.hitCooldown > 0 || this.reaction !== 'calm') return false;
    this.hitCooldown = 0.6;
    this.figure.resetPose();
    this.fallStartPosition.copy(this.figure.group.position);
    this.fallStartRotationX = this.figure.group.rotation.x;
    this.fallStartRotationZ = this.figure.group.rotation.z;
    this.reaction = 'falling';
    this.reactionTimer = CONFIG.npc.fallDuration;
    return true;
  }

  private updateKnockdown(delta: number): boolean {
    if (this.reaction === 'falling') {
      this.reactionTimer = Math.max(0, this.reactionTimer - delta);
      const progress = 1 - this.reactionTimer / CONFIG.npc.fallDuration;
      const eased = 1 - (1 - progress) ** 3;
      this.figure.group.rotation.x = THREE.MathUtils.lerp(
        this.fallStartRotationX,
        -Math.PI / 2,
        eased,
      );
      this.figure.group.rotation.z = THREE.MathUtils.lerp(
        this.fallStartRotationZ,
        -0.22,
        eased,
      );
      this.figure.group.position.x = THREE.MathUtils.lerp(
        this.fallStartPosition.x,
        this.fallStartPosition.x + 0.38,
        eased,
      );
      this.figure.group.position.y = THREE.MathUtils.lerp(
        this.fallStartPosition.y,
        0.28,
        eased,
      );
      this.figure.group.position.z = THREE.MathUtils.lerp(
        this.fallStartPosition.z,
        0.85,
        eased,
      );
      if (this.reactionTimer <= 0) {
        this.reaction = 'down';
        this.reactionTimer = CONFIG.npc.downDuration;
      }
      return true;
    }

    if (this.reaction === 'down') {
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
      this.figure.group.rotation.x = THREE.MathUtils.lerp(-Math.PI / 2, 0, eased);
      this.figure.group.rotation.z = THREE.MathUtils.lerp(-0.22, 0, eased);
      this.figure.group.position.x = THREE.MathUtils.lerp(
        this.fallStartPosition.x + 0.38,
        0,
        eased,
      );
      this.figure.group.position.y = THREE.MathUtils.lerp(0.28, 0, eased);
      this.figure.group.position.z = THREE.MathUtils.lerp(0.85, 0, eased);
      if (this.reactionTimer <= 0) {
        this.figure.group.position.set(0, 0, 0);
        this.figure.group.rotation.set(0, 0, 0);
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
