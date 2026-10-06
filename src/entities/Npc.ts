import * as THREE from 'three';
import { COLORS, CONFIG } from '../config';

export type NpcMode = 'walking' | 'sunbathing';
export type NpcReaction = 'calm' | 'finding-chair' | 'aiming';

export class Npc {
  readonly group = new THREE.Group();
  readonly id: string;
  reaction: NpcReaction = 'calm';
  reactionTimer = 0;
  hitCooldown = 0;
  private readonly target = new THREE.Vector3();
  private readonly bodyMaterial: THREE.MeshStandardMaterial;

  constructor(
    id: number,
    readonly mode: NpcMode,
    position: THREE.Vector3,
  ) {
    this.id = `npc-${id}`;
    this.bodyMaterial = new THREE.MeshStandardMaterial({
      color: mode === 'walking' ? COLORS.npcWalker : COLORS.npcSunbather,
    });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.65, 1, 4, 8), this.bodyMaterial);
    body.castShadow = true;
    body.position.y = mode === 'walking' ? 1.25 : 0.95;
    if (mode === 'sunbathing') body.rotation.x = Math.PI / 2.8;

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.48, 12, 8),
      new THREE.MeshStandardMaterial({ color: 0xf0b98b }),
    );
    head.castShadow = true;
    head.position.set(0, mode === 'walking' ? 2.25 : 1.05, mode === 'walking' ? 0 : -0.9);
    this.group.add(body, head);

    if (mode === 'sunbathing') {
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

    if (this.mode !== 'walking' || this.reaction !== 'calm') return;
    const direction = this.target.clone().sub(this.group.position);
    direction.y = 0;
    if (direction.lengthSq() < 1) {
      this.chooseTarget();
      return;
    }
    direction.normalize();
    this.group.position.addScaledVector(direction, CONFIG.npc.walkSpeed * delta);
    this.group.rotation.y = Math.atan2(-direction.x, -direction.z);
  }

  registerHit(): boolean {
    if (this.hitCooldown > 0 || this.reaction !== 'calm') return false;
    this.hitCooldown = 0.6;
    this.reaction = 'finding-chair';
    this.reactionTimer = CONFIG.npc.retaliationDelay;
    return true;
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
