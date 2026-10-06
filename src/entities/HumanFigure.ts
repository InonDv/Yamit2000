import * as THREE from 'three';

interface HumanFigureOptions {
  shirtColor: number;
  pantsColor: number;
  skinColor?: number;
  baseballCap?: boolean;
  sleeveless?: boolean;
}

export class HumanFigure {
  readonly group = new THREE.Group();
  readonly shirtMaterial: THREE.MeshStandardMaterial;

  private readonly leftArm = new THREE.Group();
  private readonly rightArm = new THREE.Group();
  private readonly leftLeg = new THREE.Group();
  private readonly rightLeg = new THREE.Group();

  constructor(options: HumanFigureOptions) {
    const skinMaterial = new THREE.MeshStandardMaterial({
      color: options.skinColor ?? 0xf0b98b,
      roughness: 0.8,
    });
    this.shirtMaterial = new THREE.MeshStandardMaterial({
      color: options.shirtColor,
      roughness: 0.75,
    });
    const pantsMaterial = new THREE.MeshStandardMaterial({
      color: options.pantsColor,
      roughness: 0.85,
    });
    const shoeMaterial = new THREE.MeshStandardMaterial({ color: 0x1f2937 });

    const torso = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.42, 0.95, 14),
      this.shirtMaterial,
    );
    torso.scale.z = 0.72;
    torso.position.y = 1.38;
    const hips = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.34, 0.3, 12),
      pantsMaterial,
    );
    hips.scale.z = 0.72;
    hips.position.y = 0.87;
    this.group.add(torso, hips);

    this.createArm(this.leftArm, -0.49, skinMaterial, options.sleeveless ?? false);
    this.createArm(this.rightArm, 0.49, skinMaterial, options.sleeveless ?? false);
    this.createLeg(this.leftLeg, -0.24, pantsMaterial, shoeMaterial);
    this.createLeg(this.rightLeg, 0.24, pantsMaterial, shoeMaterial);

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.18, 8), skinMaterial);
    neck.position.y = 1.94;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.36, 14, 10), skinMaterial);
    head.scale.set(0.92, 1.08, 0.95);
    head.position.y = 2.23;

    const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0x172554 });
    for (const x of [-0.13, 0.13]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), eyeMaterial);
      eye.position.set(x, 2.29, -0.335);
      this.group.add(eye);
    }

    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.14, 6), skinMaterial);
    nose.position.set(0, 2.18, -0.38);
    nose.rotation.x = -Math.PI / 2;
    this.group.add(neck, head, nose);

    if (options.baseballCap) this.addBaseballCap();

    this.group.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
  }

  setWalkCycle(phase: number, amount = 0.65): void {
    const swing = Math.sin(phase) * amount;
    this.leftArm.rotation.x = swing;
    this.rightArm.rotation.x = -swing;
    this.leftLeg.rotation.x = -swing;
    this.rightLeg.rotation.x = swing;
  }

  resetPose(): void {
    this.setWalkCycle(0, 0);
  }

  private createArm(
    limb: THREE.Group,
    x: number,
    skinMaterial: THREE.MeshStandardMaterial,
    sleeveless: boolean,
  ): void {
    limb.position.set(x, 1.72, 0);
    const shoulder = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 10, 8),
      sleeveless ? skinMaterial : this.shirtMaterial,
    );
    shoulder.position.y = -0.05;
    const upperArm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.105, 0.42, 10),
      skinMaterial,
    );
    upperArm.position.y = -0.28;
    const forearm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.105, 0.085, 0.48, 10),
      skinMaterial,
    );
    forearm.position.y = -0.71;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.115, 10, 7), skinMaterial);
    hand.scale.y = 1.18;
    hand.position.y = -1;
    limb.add(shoulder, upperArm, forearm, hand);
    this.group.add(limb);
  }

  private createLeg(
    limb: THREE.Group,
    x: number,
    pantsMaterial: THREE.MeshStandardMaterial,
    shoeMaterial: THREE.MeshStandardMaterial,
  ): void {
    limb.position.set(x, 0.92, 0);
    const leg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.14, 0.78, 8),
      pantsMaterial,
    );
    leg.position.y = -0.36;
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.2, 0.48), shoeMaterial);
    shoe.position.set(0, -0.81, -0.09);
    limb.add(leg, shoe);
    this.group.add(limb);
  }

  private addBaseballCap(): void {
    const capMaterial = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.75 });
    const crown = new THREE.Mesh(
      new THREE.SphereGeometry(0.385, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      capMaterial,
    );
    crown.position.y = 2.42;
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.07, 0.38), capMaterial);
    brim.position.set(0, 2.43, -0.35);
    brim.rotation.x = -0.08;
    this.group.add(crown, brim);
  }
}
