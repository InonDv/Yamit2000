import * as THREE from 'three';

interface HumanFigureOptions {
  shirtColor: number;
  pantsColor: number;
  skinColor?: number;
  baseballCap?: boolean;
  sleeveless?: boolean;
  nikeBranding?: boolean;
  armaniCap?: boolean;
  frontText?: string;
  backText?: string;
  knife?: boolean;
  syringe?: boolean;
  cigarette?: boolean;
  microphone?: boolean;
  faceTexture?: string;
  capColor?: number;
  shirtLabelScale?: number;
  shirtLabelY?: number;
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
    const flipFlopMaterial = new THREE.MeshStandardMaterial({ color: 0x111827 });

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
    this.createLeg(
      this.leftLeg,
      -0.24,
      pantsMaterial,
      skinMaterial,
      flipFlopMaterial,
      options.nikeBranding ?? false,
    );
    if (options.knife) this.addKnife();
    if (options.syringe) this.addSyringe();
    if (options.microphone) this.addMicrophone();
    this.createLeg(
      this.rightLeg,
      0.24,
      pantsMaterial,
      skinMaterial,
      flipFlopMaterial,
      options.nikeBranding ?? false,
    );

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.18, 8), skinMaterial);
    neck.position.y = 1.94;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.36, 14, 10), skinMaterial);
    head.scale.set(0.92, 1.08, 0.95);
    head.position.y = 2.23;

    this.group.add(neck, head);
    if (options.faceTexture) {
      this.addFacePhoto(options.faceTexture);
    } else {
      const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0x172554 });
      for (const x of [-0.13, 0.13]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), eyeMaterial);
        eye.position.set(x, 2.29, -0.335);
        this.group.add(eye);
      }
      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.14, 6), skinMaterial);
      nose.position.set(0, 2.18, -0.38);
      nose.rotation.x = -Math.PI / 2;
      this.group.add(nose);
    }

    if (options.cigarette !== false && !options.microphone) {
      this.addCigarette(options.faceTexture ? 0.22 : 0);
    }

    if (options.nikeBranding) {
      const chestLogo = this.createNikeLogo(0.3, 0.12, '#111827');
      chestLogo.position.set(0, 1.48, -0.255);
      this.group.add(chestLogo);
    }

    const shirtLabelY = options.shirtLabelY ?? 1.48;
    if (options.frontText) {
      const frontLabel = this.createShirtLabel(options.frontText, options.shirtLabelScale);
      frontLabel.position.set(0, shirtLabelY, -0.28);
      frontLabel.rotation.y = Math.PI;
      this.group.add(frontLabel);
    }

    if (options.backText) {
      const backLabel = this.createShirtLabel(options.backText, options.shirtLabelScale);
      backLabel.position.set(0, shirtLabelY, 0.28);
      this.group.add(backLabel);
    }

    if (options.baseballCap) {
      this.addBaseballCap(
        options.nikeBranding ?? false,
        options.armaniCap ?? false,
        options.capColor,
      );
    }

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
    this.leftArm.rotation.z = 0;
    this.rightArm.rotation.z = 0;
  }

  setSitPose(): void {
    this.leftArm.rotation.set(-0.2, 0, 0.1);
    this.rightArm.rotation.set(-0.25, 0, -0.1);
    this.leftLeg.rotation.set(1.18, 0, 0.12);
    this.rightLeg.rotation.set(1.18, 0, -0.12);
  }

  setPartyPose(phase: number, habit: 'drink' | 'smoke'): void {
    this.setSitPose();
    const lift = (Math.sin(phase) + 1) * 0.5;
    if (habit === 'drink') {
      this.rightArm.rotation.x = 1.55 + lift * 0.45;
      this.rightArm.rotation.z = -0.12;
    } else {
      this.rightArm.rotation.x = 1.9 + lift * 0.18;
      this.rightArm.rotation.z = -0.28;
      this.leftArm.rotation.x = 0.2;
    }
  }

  attachToRightHand(object: THREE.Object3D): void {
    object.position.set(0, -1.02, -0.03);
    this.rightArm.add(object);
  }

  getRightHandWorldPosition(target = new THREE.Vector3()): THREE.Vector3 {
    return this.rightArm.localToWorld(target.set(0, -1.02, -0.08));
  }

  setRidePose(): void {
    this.leftArm.rotation.x = -0.85;
    this.rightArm.rotation.x = -0.85;
    this.leftArm.rotation.z = 0.18;
    this.rightArm.rotation.z = -0.18;
    this.leftLeg.rotation.x = 0.12;
    this.rightLeg.rotation.x = 0.62;
  }

  setPunchPose(amount: number): void {
    this.rightArm.rotation.x = amount * Math.PI * 0.52;
  }

  setInjectionPose(amount: number): void {
    this.rightArm.rotation.x = amount * Math.PI * 0.58;
    this.rightArm.rotation.z = -amount * 0.18;
  }

  setSingWalkCycle(phase: number, amount = 0.5): void {
    const swing = Math.sin(phase) * amount;
    this.leftArm.rotation.x = swing;
    this.leftArm.rotation.z = 0.08;
    this.leftLeg.rotation.x = -swing;
    this.rightLeg.rotation.x = swing;
    const bob = Math.sin(phase * 0.65) * 0.06;
    this.rightArm.rotation.set(1.92 + bob, 0.08, -0.34);
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
    shortsMaterial: THREE.MeshStandardMaterial,
    skinMaterial: THREE.MeshStandardMaterial,
    flipFlopMaterial: THREE.MeshStandardMaterial,
    nikeBranding: boolean,
  ): void {
    limb.position.set(x, 0.92, 0);
    const shortsLeg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.16, 0.38, 10),
      shortsMaterial,
    );
    shortsLeg.position.y = -0.17;
    const calf = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.1, 0.55, 10),
      skinMaterial,
    );
    calf.position.y = -0.58;

    const sole = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.07, 0.52),
      flipFlopMaterial,
    );
    sole.position.set(0, -0.88, -0.08);
    const strapGeometry = new THREE.BoxGeometry(0.055, 0.045, 0.32);
    const leftStrap = new THREE.Mesh(strapGeometry, flipFlopMaterial);
    leftStrap.position.set(-0.07, -0.82, -0.1);
    leftStrap.rotation.y = -0.45;
    const rightStrap = new THREE.Mesh(strapGeometry, flipFlopMaterial);
    rightStrap.position.set(0.07, -0.82, -0.1);
    rightStrap.rotation.y = 0.45;
    limb.add(shortsLeg, calf, sole, leftStrap, rightStrap);

    if (nikeBranding) {
      const flipFlopLogo = this.createNikeLogo(0.18, 0.07, '#ffffff');
      flipFlopLogo.position.set(0, -0.84, -0.12);
      flipFlopLogo.rotation.x = -Math.PI / 2;
      limb.add(flipFlopLogo);
    }
    this.group.add(limb);
  }

  private addFacePhoto(url: string): void {
    const loader = new THREE.TextureLoader();
    loader.load(url, (source) => {
      const image = source.image as HTMLImageElement;
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 640;
      const context = canvas.getContext('2d');
      if (context && image) {
        context.filter = 'brightness(1.85) contrast(1.25) saturate(1.15)';
        context.beginPath();
        context.ellipse(256, 320, 250, 318, 0, 0, Math.PI * 2);
        context.closePath();
        context.clip();
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
      }
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        color: 0xffffff,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const geometry = new THREE.PlaneGeometry(1.22, 1.52);
      for (let index = 0; index < 4; index += 1) {
        const mount = new THREE.Group();
        const face = new THREE.Mesh(geometry, material);
        face.position.set(0, 2.34, -0.48);
        face.rotation.y = Math.PI;
        mount.add(face);
        mount.rotation.y = (index * Math.PI) / 2;
        this.group.add(mount);
      }
    });
  }

  private addBaseballCap(
    nikeBranding: boolean,
    armaniBranding: boolean,
    capColor = 0x1d4ed8,
  ): void {
    const capMaterial = new THREE.MeshStandardMaterial({ color: capColor, roughness: 0.75 });
    const crown = new THREE.Mesh(
      new THREE.SphereGeometry(0.385, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      capMaterial,
    );
    crown.position.y = 2.42;
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.07, 0.38), capMaterial);
    brim.position.set(0, 2.43, -0.35);
    brim.rotation.x = -0.08;
    this.group.add(crown, brim);
    if (armaniBranding) {
      const frontCapLogo = this.createArmaniLogo(0.5, 0.3, '#ffffff');
      frontCapLogo.position.set(0, 2.55, -0.355);
      frontCapLogo.rotation.y = Math.PI;
      const backCapLogo = this.createArmaniLogo(0.55, 0.32, '#ffffff');
      backCapLogo.position.set(0, 2.55, 0.37);
      this.group.add(frontCapLogo, backCapLogo);
    } else if (nikeBranding) {
      const logo = this.createNikeLogo(0.45, 0.18, '#ffffff');
      logo.position.set(0, 2.55, -0.34);
      this.group.add(logo);
    }
  }

  private addCigarette(forward = 0): void {
    const filterMaterial = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      roughness: 0.85,
    });
    const paperMaterial = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.55,
    });
    const ashMaterial = new THREE.MeshStandardMaterial({
      color: 0x6b7280,
      roughness: 0.95,
    });
    const emberMaterial = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0xea580c,
      emissiveIntensity: 0.85,
      roughness: 0.4,
    });

    const cigarette = new THREE.Group();
    const filter = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 0.08, 10),
      filterMaterial,
    );
    filter.position.y = 0.04;
    const paper = new THREE.Mesh(
      new THREE.CylinderGeometry(0.026, 0.026, 0.2, 10),
      paperMaterial,
    );
    paper.position.y = 0.18;
    const ash = new THREE.Mesh(
      new THREE.CylinderGeometry(0.027, 0.022, 0.032, 8),
      ashMaterial,
    );
    ash.position.y = 0.296;
    const ember = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 6), emberMaterial);
    ember.position.y = 0.318;
    cigarette.add(filter, paper, ash, ember);

    cigarette.position.set(0.08, 2.05, -0.34 - forward);
    cigarette.rotation.x = -Math.PI / 2 - 0.12;
    cigarette.rotation.z = 0.28;
    cigarette.traverse((object) => {
      if (object instanceof THREE.Mesh) object.castShadow = true;
    });
    this.group.add(cigarette);
  }

  private addMicrophone(): void {
    const handleMaterial = new THREE.MeshStandardMaterial({
      color: 0x111827,
      roughness: 0.55,
    });
    const grilleMaterial = new THREE.MeshStandardMaterial({
      color: 0xd1d5db,
      metalness: 0.75,
      roughness: 0.28,
    });
    const ringMaterial = new THREE.MeshStandardMaterial({
      color: 0xe5e7eb,
      metalness: 0.85,
      roughness: 0.22,
    });

    const microphone = new THREE.Group();
    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.032, 0.038, 0.28, 10),
      handleMaterial,
    );
    handle.position.y = -0.12;
    const ring = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.045, 0.03, 10),
      ringMaterial,
    );
    ring.position.y = 0.03;
    const grille = new THREE.Mesh(new THREE.SphereGeometry(0.095, 12, 10), grilleMaterial);
    grille.position.y = 0.12;
    microphone.add(handle, ring, grille);
    microphone.position.set(0.04, -1.0, -0.12);
    microphone.rotation.set(1.05, 0.12, 0.2);
    microphone.traverse((object) => {
      if (object instanceof THREE.Mesh) object.castShadow = true;
    });
    this.rightArm.add(microphone);
  }

  private addKnife(): void {
    const handleMaterial = new THREE.MeshStandardMaterial({
      color: 0x111827,
      roughness: 0.7,
    });
    const bladeMaterial = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      metalness: 0.25,
      roughness: 0.18,
      emissive: 0x334155,
      emissiveIntensity: 0.22,
    });
    const handle = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.26, 0.12),
      handleMaterial,
    );
    handle.position.set(0, -1.08, -0.03);
    const guard = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.06, 0.14),
      handleMaterial,
    );
    guard.position.set(0, -1.21, -0.03);

    const bladeShape = new THREE.Shape();
    bladeShape.moveTo(-0.09, 0);
    bladeShape.lineTo(0.09, 0);
    bladeShape.lineTo(0.065, -0.3);
    bladeShape.lineTo(0, -0.46);
    bladeShape.lineTo(-0.065, -0.3);
    bladeShape.closePath();
    const blade = new THREE.Mesh(
      new THREE.ExtrudeGeometry(bladeShape, {
        depth: 0.035,
        bevelEnabled: true,
        bevelSize: 0.012,
        bevelThickness: 0.01,
        bevelSegments: 1,
      }),
      bladeMaterial,
    );
    blade.position.set(0, -1.24, -0.02);
    blade.castShadow = true;
    handle.castShadow = true;
    guard.castShadow = true;
    this.rightArm.add(handle, guard, blade);
  }

  private addSyringe(): void {
    const barrelMaterial = new THREE.MeshStandardMaterial({
      color: 0xdbeafe,
      transparent: true,
      opacity: 0.82,
      roughness: 0.2,
      metalness: 0.08,
    });
    const liquidMaterial = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.25,
    });
    const metalMaterial = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.8,
      roughness: 0.18,
    });
    const plungerMaterial = new THREE.MeshStandardMaterial({
      color: 0x1e3a8a,
      roughness: 0.55,
    });

    const syringe = new THREE.Group();
    syringe.position.set(0, -1.18, -0.04);

    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.105, 0.105, 0.62, 16),
      barrelMaterial,
    );
    const liquid = new THREE.Mesh(
      new THREE.CylinderGeometry(0.072, 0.072, 0.36, 12),
      liquidMaterial,
    );
    liquid.position.y = -0.08;
    const plunger = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.045, 0.34, 10),
      plungerMaterial,
    );
    plunger.position.y = 0.45;
    const thumbRest = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.055, 0.16),
      plungerMaterial,
    );
    thumbRest.position.y = 0.62;
    const fingerRest = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.055, 0.16),
      metalMaterial,
    );
    fingerRest.position.y = -0.33;
    const needle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016, 0.006, 0.62, 8),
      metalMaterial,
    );
    needle.position.y = -0.64;

    syringe.add(barrel, liquid, plunger, thumbRest, fingerRest, needle);
    syringe.traverse((object) => {
      if (object instanceof THREE.Mesh) object.castShadow = true;
    });
    this.rightArm.add(syringe);
  }

  private createNikeLogo(width: number, height: number, color: string): THREE.Mesh {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 96;
    const context = canvas.getContext('2d');
    if (context) {
      context.fillStyle = color;
      context.beginPath();
      context.moveTo(13, 58);
      context.bezierCurveTo(36, 78, 63, 77, 91, 61);
      context.lineTo(240, 13);
      context.bezierCurveTo(184, 52, 116, 85, 70, 86);
      context.bezierCurveTo(42, 87, 22, 77, 13, 58);
      context.fill();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    return new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  }

  private createArmaniLogo(width: number, height: number, color: string): THREE.Mesh {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const context = canvas.getContext('2d');
    if (context) {
      context.fillStyle = color;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.font = '900 108px Georgia, serif';
      context.fillText('GA', 256, 82);
      context.fillRect(104, 137, 304, 12);
      context.font = '900 58px Arial, sans-serif';
      context.fillText('ARMANI', 256, 196);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
  }

  private createShirtLabel(text: string, scale = 1): THREE.Mesh {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 320;
    const context = canvas.getContext('2d');
    if (context) {
      context.direction = 'rtl';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillStyle = '#172554';
      const words = text.trim().split(/\s+/);
      if (words.length === 2) {
        context.font = '900 150px Arial, sans-serif';
        context.fillText(words[0], canvas.width / 2, 98);
        context.fillText(words[1], canvas.width / 2, 228);
      } else {
        let fontSize = 190;
        context.font = `900 ${fontSize}px Arial, sans-serif`;
        while (context.measureText(text).width > 460 && fontSize > 120) {
          fontSize -= 4;
          context.font = `900 ${fontSize}px Arial, sans-serif`;
        }
        context.fillText(text, canvas.width / 2, canvas.height / 2);
      }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return new THREE.Mesh(
      new THREE.PlaneGeometry(0.78 * scale, 0.5 * scale),
      new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
  }
}
