import * as THREE from 'three';
import { COLORS, CONFIG } from '../config';
import { HumanFigure } from '../entities/HumanFigure';

type Obstacle = { minX: number; maxX: number; minZ: number; maxZ: number };
type SlideRider = {
  root: THREE.Group;
  path: THREE.CatmullRomCurve3;
  progress: number;
  speed: number;
};

export class Park {
  readonly group = new THREE.Group();
  private readonly obstacles: Obstacle[] = [];
  private readonly slideRiders: SlideRider[] = [];

  constructor() {
    this.createGround();
    this.createPool(-16, -10, 16, 11);
    this.createPool(17, 12, 12, 15);
    this.createPaths();
    this.createFence();
    this.createSlide();
    this.createSigns();
    this.createPalms();
  }

  update(delta: number): void {
    const forward = new THREE.Vector3(0, 0, -1);
    for (const rider of this.slideRiders) {
      rider.progress = (rider.progress + delta * rider.speed) % 1;
      const easedProgress = rider.progress * rider.progress * (3 - 2 * rider.progress);
      rider.root.position.copy(rider.path.getPointAt(easedProgress));
      rider.root.position.y += 0.32;
      const tangent = rider.path.getTangentAt(easedProgress).normalize();
      rider.root.quaternion.setFromUnitVectors(forward, tangent);
    }
  }

  resolvePlayerPosition(position: THREE.Vector3, previous: THREE.Vector3): void {
    const radius = CONFIG.player.radius;
    for (const obstacle of this.obstacles) {
      if (
        position.x + radius > obstacle.minX &&
        position.x - radius < obstacle.maxX &&
        position.z + radius > obstacle.minZ &&
        position.z - radius < obstacle.maxZ
      ) {
        position.copy(previous);
        return;
      }
    }
  }

  private createGround(): void {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(CONFIG.world.halfSize * 2, CONFIG.world.halfSize * 2),
      new THREE.MeshStandardMaterial({ color: COLORS.grass, roughness: 0.95 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.group.add(ground);
  }

  private createPool(x: number, z: number, width: number, depth: number): void {
    const rim = new THREE.Mesh(
      new THREE.BoxGeometry(width + 1.2, 0.3, depth + 1.2),
      new THREE.MeshStandardMaterial({ color: COLORS.poolEdge }),
    );
    rim.position.set(x, 0.12, z);
    rim.receiveShadow = true;

    const water = new THREE.Mesh(
      new THREE.BoxGeometry(width, 0.16, depth),
      new THREE.MeshPhysicalMaterial({
        color: COLORS.water,
        roughness: 0.15,
        metalness: 0.05,
        transparent: true,
        opacity: 0.85,
      }),
    );
    water.position.set(x, 0.32, z);
    this.group.add(rim, water);
    this.obstacles.push({
      minX: x - (width + 1.2) / 2,
      maxX: x + (width + 1.2) / 2,
      minZ: z - (depth + 1.2) / 2,
      maxZ: z + (depth + 1.2) / 2,
    });
  }

  private createPaths(): void {
    const material = new THREE.MeshStandardMaterial({ color: COLORS.path, roughness: 1 });
    const horizontal = new THREE.Mesh(new THREE.BoxGeometry(78, 0.08, 5), material);
    horizontal.position.set(0, 0.05, 5);
    horizontal.receiveShadow = true;
    const vertical = new THREE.Mesh(new THREE.BoxGeometry(5, 0.08, 78), material);
    vertical.position.set(0, 0.06, 0);
    vertical.receiveShadow = true;
    this.group.add(horizontal, vertical);
  }

  private createFence(): void {
    const material = new THREE.MeshStandardMaterial({ color: 0xf8fafc });
    const size = CONFIG.world.halfSize * 2;
    const parts = [
      [0, 1, -CONFIG.world.halfSize, size, 2, 0.3],
      [0, 1, CONFIG.world.halfSize, size, 2, 0.3],
      [-CONFIG.world.halfSize, 1, 0, 0.3, 2, size],
      [CONFIG.world.halfSize, 1, 0, 0.3, 2, size],
    ] as const;
    for (const [x, y, z, w, h, d] of parts) {
      const fence = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
      fence.position.set(x, y, z);
      fence.castShadow = true;
      this.group.add(fence);
    }
  }

  private createSlide(): void {
    const towerPosition = new THREE.Vector3(-29, 0, -22);
    const supportMaterial = new THREE.MeshStandardMaterial({ color: 0x0e7490 });
    const platformMaterial = new THREE.MeshStandardMaterial({ color: 0xfacc15 });
    for (const [x, z] of [
      [-1.4, -1.4],
      [1.4, -1.4],
      [-1.4, 1.4],
      [1.4, 1.4],
    ]) {
      const support = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.23, 7, 10),
        supportMaterial,
      );
      support.position.set(towerPosition.x + x, 3.5, towerPosition.z + z);
      support.castShadow = true;
      this.group.add(support);
    }
    const platform = new THREE.Mesh(
      new THREE.CylinderGeometry(2.3, 2.3, 0.35, 16),
      platformMaterial,
    );
    platform.position.set(towerPosition.x, 7, towerPosition.z);
    platform.castShadow = true;
    this.group.add(platform);

    const firstPath = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-28.2, 7.1, -21),
      new THREE.Vector3(-26, 6.4, -18.5),
      new THREE.Vector3(-24, 4.4, -17.5),
      new THREE.Vector3(-23, 2.1, -15.5),
      new THREE.Vector3(-21.5, 0.65, -14.5),
    ]);
    const secondPath = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-29.8, 7.1, -20.8),
      new THREE.Vector3(-32.5, 5.8, -18),
      new THREE.Vector3(-30.5, 4, -14),
      new THREE.Vector3(-25.5, 2.1, -13),
      new THREE.Vector3(-22, 0.65, -12.5),
    ]);
    this.createSlideTrack(firstPath, 0xf97316);
    this.createSlideTrack(secondPath, 0x38bdf8);
    this.createSlideRider(firstPath, 0.04, 0xf43f5e, 0);
    this.createSlideRider(firstPath, 0.56, 0x22c55e, 1);
    this.createSlideRider(secondPath, 0.28, 0xa855f7, 2);

    const stairMaterial = new THREE.MeshStandardMaterial({ color: 0xe2e8f0 });
    const ladderRailGeometry = new THREE.CylinderGeometry(0.08, 0.08, 7, 8);
    for (const x of [-0.55, 0.55]) {
      const rail = new THREE.Mesh(ladderRailGeometry, stairMaterial);
      rail.position.set(towerPosition.x + x, 3.5, towerPosition.z + 1.9);
      this.group.add(rail);
    }
    for (let step = 0; step < 10; step += 1) {
      const rung = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 1.1, 8),
        stairMaterial,
      );
      rung.rotation.z = Math.PI / 2;
      rung.position.set(towerPosition.x, 0.45 + step * 0.67, towerPosition.z + 1.9);
      this.group.add(rung);
    }
    this.obstacles.push({ minX: -32, maxX: -26, minZ: -25, maxZ: -19 });
  }

  private createSlideTrack(path: THREE.CatmullRomCurve3, color: number): void {
    const slideMaterial = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.35,
      metalness: 0.05,
    });
    const waterMaterial = new THREE.MeshStandardMaterial({
      color: 0x7dd3fc,
      transparent: true,
      opacity: 0.8,
    });
    const up = new THREE.Vector3(0, 1, 0);
    const localZ = new THREE.Vector3(0, 0, 1);
    const localY = new THREE.Vector3(0, 1, 0);
    const segments = 36;
    for (let index = 0; index < segments; index += 1) {
      const start = path.getPoint(index / segments);
      const finish = path.getPoint((index + 1) / segments);
      const direction = finish.clone().sub(start);
      const length = direction.length();
      const normalized = direction.clone().normalize();
      const midpoint = start.clone().add(finish).multiplyScalar(0.5);
      const orientation = new THREE.Quaternion().setFromUnitVectors(localZ, normalized);

      const bed = new THREE.Mesh(
        new THREE.BoxGeometry(1.7, 0.16, length + 0.08),
        slideMaterial,
      );
      bed.position.copy(midpoint);
      bed.quaternion.copy(orientation);
      bed.castShadow = true;
      this.group.add(bed);

      const water = new THREE.Mesh(
        new THREE.BoxGeometry(1.34, 0.03, length + 0.09),
        waterMaterial,
      );
      water.position.copy(midpoint).addScaledVector(up, 0.11);
      water.quaternion.copy(orientation);
      this.group.add(water);

      const lateral = new THREE.Vector3().crossVectors(up, normalized).normalize();
      for (const side of [-1, 1]) {
        const rail = new THREE.Mesh(
          new THREE.CylinderGeometry(0.09, 0.09, length + 0.08, 8),
          slideMaterial,
        );
        rail.position
          .copy(midpoint)
          .addScaledVector(lateral, side * 0.78)
          .addScaledVector(up, 0.32);
        rail.quaternion.setFromUnitVectors(localY, normalized);
        rail.castShadow = true;
        this.group.add(rail);
      }
    }
  }

  private createSlideRider(
    path: THREE.CatmullRomCurve3,
    progress: number,
    shirtColor: number,
    skinIndex: number,
  ): void {
    const root = new THREE.Group();
    const child = new HumanFigure({
      shirtColor,
      pantsColor: 0x0f766e,
      skinColor: [0xffdbac, 0xc68642, 0x8d5524][skinIndex % 3],
      sleeveless: true,
    });
    child.group.scale.setScalar(0.52);
    child.group.rotation.x = Math.PI / 2;
    child.group.position.y = 0.12;
    root.add(child.group);
    this.group.add(root);
    this.slideRiders.push({
      root,
      path,
      progress,
      speed: 0.1 + skinIndex * 0.012,
    });
  }

  private createSigns(): void {
    const positions: Array<[number, number, number]> = [
      [0, 3, -36],
      [-35, 3, 5],
      [34, 3, 27],
    ];
    for (const [x, y, z] of positions) {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 160;
      const context = canvas.getContext('2d');
      if (!context) continue;
      context.fillStyle = '#075985';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.strokeStyle = '#facc15';
      context.lineWidth = 14;
      context.strokeRect(7, 7, canvas.width - 14, canvas.height - 14);
      context.fillStyle = '#ffffff';
      context.font = 'bold 64px sans-serif';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText('YAMIT 2000', canvas.width / 2, canvas.height / 2);

      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(8, 2.5),
        new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), side: THREE.DoubleSide }),
      );
      sign.position.set(x, y, z);
      if (Math.abs(x) > 30) sign.rotation.y = Math.PI / 2;
      this.group.add(sign);
    }
  }

  private createPalms(): void {
    const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x854d0e });
    const leafMaterial = new THREE.MeshStandardMaterial({ color: 0x15803d });
    const positions = [
      [-31, -26],
      [30, -2],
      [-28, 24],
      [13, -29],
      [29, 30],
    ];
    for (const [x, z] of positions) {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, 5, 8), trunkMaterial);
      trunk.position.set(x, 2.5, z);
      trunk.castShadow = true;
      const crown = new THREE.Mesh(new THREE.SphereGeometry(2, 8, 5), leafMaterial);
      crown.scale.y = 0.45;
      crown.position.set(x, 5.1, z);
      crown.castShadow = true;
      this.group.add(trunk, crown);
    }
  }
}
