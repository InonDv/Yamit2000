import * as THREE from 'three';
import { COLORS, CONFIG } from '../config';

type Obstacle = { minX: number; maxX: number; minZ: number; maxZ: number };

export class Park {
  readonly group = new THREE.Group();
  private readonly obstacles: Obstacle[] = [];

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
    const tower = new THREE.Mesh(
      new THREE.CylinderGeometry(2.4, 2.4, 8, 16),
      new THREE.MeshStandardMaterial({ color: 0x0ea5e9 }),
    );
    tower.position.set(25, 4, -20);
    tower.castShadow = true;
    const slide = new THREE.Mesh(
      new THREE.TorusGeometry(5, 0.8, 8, 24, Math.PI * 1.4),
      new THREE.MeshStandardMaterial({ color: 0xf97316 }),
    );
    slide.position.set(21, 5, -20);
    slide.rotation.set(Math.PI / 2, 0.4, 0);
    slide.castShadow = true;
    this.group.add(tower, slide);
    this.obstacles.push({ minX: 22, maxX: 28, minZ: -23, maxZ: -17 });
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
