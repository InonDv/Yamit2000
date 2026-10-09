import * as THREE from 'three';
import { COLORS, CONFIG } from '../config';
import { HumanFigure } from './HumanFigure';

const NPC_NAMES = ['נהוראי', 'אלירן', 'אבי', 'יוסי', 'נתי'] as const;

export type NpcMode = 'walking' | 'sunbathing' | 'partying';
export type ProximityCue = 'water' | 'dekel';
export type NpcExtras = {
  faceTexture?: string;
  baseballCap?: boolean;
  capColor?: number;
  proximityCue?: ProximityCue;
  shoppingCart?: boolean;
  microphone?: boolean;
  pantsColor?: number;
  partyHabit?: 'drink' | 'smoke';
  facingYaw?: number;
};
export type NpcReaction =
  | 'calm'
  | 'falling'
  | 'down'
  | 'getting-up'
  | 'finding-chair'
  | 'aiming'
  | 'chasing-player'
  | 'injecting';

export class Npc {
  readonly group = new THREE.Group();
  readonly id: string;
  readonly displayName: string;
  readonly isInformer: boolean;
  readonly proximityCue: ProximityCue | null;
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
  private readonly sellsWater: boolean;
  private readonly singing: boolean;
  private readonly partyHabit: 'drink' | 'smoke' | null;

  constructor(
    id: number,
    readonly mode: NpcMode,
    position: THREE.Vector3,
    assignedName?: string,
    readonly characterScale = 1,
    clothingColor?: number,
    extras: NpcExtras = {},
  ) {
    this.id = `npc-${id}`;
    this.proximityCue = extras.proximityCue ?? null;
    this.sellsWater = extras.shoppingCart ?? false;
    this.singing = extras.microphone ?? false;
    this.partyHabit = extras.partyHabit ?? null;
    this.displayName =
      assignedName ??
      (extras.faceTexture
        ? ''
        : NPC_NAMES[Math.floor(Math.random() * NPC_NAMES.length)]);
    this.isInformer = this.displayName === 'מלשין';
    this.figure = new HumanFigure({
      shirtColor:
        clothingColor ??
        (mode === 'walking'
          ? COLORS.npcWalker
          : mode === 'partying'
            ? 0xdb2777
            : COLORS.npcSunbather),
      pantsColor:
        extras.pantsColor ?? clothingColor ?? (id % 2 === 0 ? 0x0f766e : 0x334155),
      microphone: extras.microphone,
      skinColor: extras.faceTexture
        ? 0xe0b089
        : [0xf0b98b, 0x8d5524, 0xc68642, 0xffdbac][id % 4],
      frontText: this.displayName || undefined,
      backText: this.displayName || undefined,
      syringe: this.displayName === "ערבי צ'צ'ני",
      baseballCap: extras.baseballCap,
      capColor: extras.capColor,
      faceTexture: extras.faceTexture,
      shirtLabelScale: extras.faceTexture ? 1.55 : 1,
    });
    this.bodyMaterial = this.figure.shirtMaterial;
    this.group.add(this.figure.group);
    this.group.scale.setScalar(characterScale);
    if (this.singing) this.figure.setSingWalkCycle(this.walkPhase, 0);
    if (this.sellsWater) this.addShoppingCart();

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

    if (mode === 'partying') {
      this.figure.group.position.set(0, -0.36, 0.12);
      this.figure.setSitPose();
      if (this.partyHabit === 'smoke') this.figure.attachToRightHand(this.createMouthpiece());
      if (this.partyHabit === 'drink') this.figure.attachToRightHand(this.createHeldGlass());
      if (extras.facingYaw !== undefined) this.group.rotation.y = extras.facingYaw;
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

    if (this.mode === 'partying' && this.reaction === 'calm' && this.partyHabit) {
      this.walkPhase += delta * 2.4;
      this.figure.setPartyPose(this.walkPhase, this.partyHabit);
      return;
    }

    if (this.mode !== 'walking' || this.reaction !== 'calm') {
      if (this.mode === 'walking') this.figure.resetPose();
      return;
    }
    const direction = this.target.clone().sub(this.group.position);
    direction.y = 0;
    if (direction.lengthSq() < (this.sellsWater ? 3.2 : 1)) {
      if (this.sellsWater) {
        this.figure.resetPose();
        return;
      }
      this.chooseTarget();
      return;
    }
    direction.normalize();
    this.group.position.addScaledVector(direction, CONFIG.npc.walkSpeed * delta);
    this.group.rotation.y = Math.atan2(-direction.x, -direction.z);
    this.walkPhase += delta * 7;
    if (this.singing) this.figure.setSingWalkCycle(this.walkPhase, 0.5);
    else this.figure.setWalkCycle(this.walkPhase, 0.5);
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

  chase(target: THREE.Vector3, delta: number): void {
    const direction = target.clone().sub(this.group.position);
    direction.y = 0;
    if (direction.lengthSq() === 0) return;
    direction.normalize();
    this.group.rotation.y = Math.atan2(-direction.x, -direction.z);
    this.group.position.addScaledVector(direction, CONFIG.npc.giantRunSpeed * delta);
    this.walkPhase += delta * 14;
    this.figure.setWalkCycle(this.walkPhase, 0.9);
  }

  face(target: THREE.Vector3): void {
    const direction = target.clone().sub(this.group.position);
    direction.y = 0;
    if (direction.lengthSq() === 0) return;
    this.group.rotation.y = Math.atan2(-direction.x, -direction.z);
  }

  setInjectionPose(amount: number): void {
    this.figure.setInjectionPose(amount);
  }

  seek(position: THREE.Vector3): void {
    this.target.copy(position);
    this.target.y = 0;
  }

  hasArrived(): boolean {
    return this.group.position.distanceToSquared(this.target) < 3.2;
  }

  getRightHandWorldPosition(target = new THREE.Vector3()): THREE.Vector3 {
    return this.figure.getRightHandWorldPosition(target);
  }

  private createMouthpiece(): THREE.Group {
    const piece = new THREE.Group();
    const hose = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.65 });
    const tip = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016, 0.02, 0.14, 8),
      new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.6, roughness: 0.3 }),
    );
    tip.rotation.x = Math.PI / 2;
    tip.position.z = -0.08;
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.1, 8), hose);
    grip.rotation.x = Math.PI / 2;
    grip.position.z = 0.02;
    piece.add(tip, grip);
    return piece;
  }

  private createHeldGlass(): THREE.Mesh {
    return new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.035, 0.11, 10),
      new THREE.MeshStandardMaterial({
        color: 0xbfdbfe,
        transparent: true,
        opacity: 0.45,
        roughness: 0.1,
      }),
    );
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

  private addShoppingCart(): void {
    const cart = new THREE.Group();
    const metal = new THREE.MeshStandardMaterial({
      color: 0xc5ccd4,
      metalness: 0.72,
      roughness: 0.32,
    });
    const darkMetal = new THREE.MeshStandardMaterial({
      color: 0x4b5563,
      metalness: 0.55,
      roughness: 0.4,
    });
    const plastic = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.7 });
    const basket = new THREE.Mesh(
      new THREE.BoxGeometry(0.95, 0.58, 1.18),
      new THREE.MeshStandardMaterial({
        color: 0xdbe3ea,
        metalness: 0.45,
        roughness: 0.4,
        transparent: true,
        opacity: 0.28,
      }),
    );
    basket.position.set(0, 0.62, 0);
    const bottom = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.05, 1.18), metal);
    bottom.position.set(0, 0.34, 0);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.78, 0.06), metal);
    back.position.set(0, 0.95, -0.58);
    const handleBar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 0.98, 10),
      darkMetal,
    );
    handleBar.rotation.z = Math.PI / 2;
    handleBar.position.set(0, 1.18, -0.82);
    for (const x of [-0.42, 0.42]) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.03, 0.72, 8),
        darkMetal,
      );
      post.position.set(x, 0.82, -0.7);
      post.rotation.x = 0.28;
      cart.add(post);
    }
    const wheelGeometry = new THREE.CylinderGeometry(0.12, 0.12, 0.08, 12);
    for (const x of [-0.4, 0.4]) {
      for (const z of [-0.46, 0.46]) {
        const wheel = new THREE.Mesh(wheelGeometry, plastic);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(x, 0.12, z);
        cart.add(wheel);
      }
    }
    const bottleBody = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.58,
      roughness: 0.18,
    });
    const capMaterial = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.45 });
    const waterMaterial = new THREE.MeshStandardMaterial({
      color: 0x7dd3fc,
      transparent: true,
      opacity: 0.7,
    });
    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col < 4; col += 1) {
        const bottle = new THREE.Group();
        const body = new THREE.Mesh(
          new THREE.CylinderGeometry(0.055, 0.06, 0.32, 10),
          bottleBody,
        );
        const water = new THREE.Mesh(
          new THREE.CylinderGeometry(0.04, 0.042, 0.22, 8),
          waterMaterial,
        );
        water.position.y = -0.02;
        const cap = new THREE.Mesh(
          new THREE.CylinderGeometry(0.028, 0.03, 0.055, 8),
          capMaterial,
        );
        cap.position.y = 0.19;
        bottle.add(body, water, cap);
        bottle.position.set((col - 1.5) * 0.18, 0.72, (row - 1) * 0.26);
        cart.add(bottle);
      }
    }
    cart.add(basket, bottom, back, handleBar);
    cart.position.set(0, 0, 1.28);
    for (let index = 0; index < 4; index += 1) {
      const mount = new THREE.Group();
      const copy = index === 0 ? cart : cart.clone();
      mount.add(copy);
      mount.rotation.y = (index * Math.PI) / 2;
      mount.traverse((object) => {
        if (object instanceof THREE.Mesh) object.castShadow = true;
      });
      this.group.add(mount);
    }
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
