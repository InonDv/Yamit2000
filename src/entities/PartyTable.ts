import * as THREE from 'three';

export const PARTY_TABLES = [
  { x: 1, z: -6 },
  { x: 15, z: -22 },
  { x: -22, z: 7 },
] as const;

const SEAT_RADIUS = 1.5;
const SEATS_PER_TABLE = 3;

export type PartySeat = {
  position: THREE.Vector3;
  yaw: number;
  habit: 'drink' | 'smoke';
};

export class PartyTable {
  readonly group = new THREE.Group();
  private readonly puffs: THREE.Mesh[] = [];
  private smokePhase = Math.random() * Math.PI * 2;

  constructor(x: number, z: number) {
    this.group.position.set(x, 0, z);
    const wood = new THREE.MeshStandardMaterial({ color: 0x9a6b3f, roughness: 0.8 });
    const darkWood = new THREE.MeshStandardMaterial({ color: 0x5b3a1f, roughness: 0.85 });
    const top = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.08, 20), wood);
    top.position.y = 0.78;
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.28, 0.74, 10), darkWood);
    pedestal.position.y = 0.37;
    this.group.add(top, pedestal);

    for (let index = 0; index < SEATS_PER_TABLE; index += 1) {
      const angle = (index / SEATS_PER_TABLE) * Math.PI * 2;
      const chair = this.createChair();
      chair.position.set(Math.sin(angle) * SEAT_RADIUS, 0, Math.cos(angle) * SEAT_RADIUS);
      chair.rotation.y = angle;
      this.group.add(chair);
    }

    this.addDrinks();
    this.addHookah();
    this.group.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
  }

  update(delta: number): void {
    this.smokePhase += delta * 1.4;
    this.puffs.forEach((puff, index) => {
      const t = (this.smokePhase * 0.35 + index * 0.28) % 1;
      puff.position.y = 1.62 + t * 0.85;
      puff.scale.setScalar(0.12 + t * 0.28);
      const material = puff.material as THREE.MeshStandardMaterial;
      material.opacity = 0.35 * (1 - t);
    });
  }

  static seats(): PartySeat[] {
    const seats: PartySeat[] = [];
    PARTY_TABLES.forEach((table, tableIndex) => {
      for (let index = 0; index < SEATS_PER_TABLE; index += 1) {
        const angle = (index / SEATS_PER_TABLE) * Math.PI * 2;
        seats.push({
          position: new THREE.Vector3(
            table.x + Math.sin(angle) * SEAT_RADIUS,
            0,
            table.z + Math.cos(angle) * SEAT_RADIUS,
          ),
          yaw: angle,
          habit: (tableIndex + index) % 2 === 0 ? 'drink' : 'smoke',
        });
      }
    });
    return seats;
  }

  private createChair(): THREE.Group {
    const chair = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.08, 0.55), material);
    seat.position.y = 0.48;
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.58, 0.08), material);
    back.position.set(0, 0.8, 0.24);
    const legGeometry = new THREE.BoxGeometry(0.07, 0.48, 0.07);
    for (const x of [-0.2, 0.2]) {
      for (const z of [-0.2, 0.2]) {
        const leg = new THREE.Mesh(legGeometry, material);
        leg.position.set(x, 0.24, z);
        chair.add(leg);
      }
    }
    chair.add(seat, back);
    return chair;
  }

  private addDrinks(): void {
    const vodka = this.createVodka();
    vodka.position.set(-0.38, 0.97, 0.18);
    const vodkaTwo = this.createVodka();
    vodkaTwo.position.set(0.42, 0.97, -0.28);
    vodkaTwo.rotation.y = 0.6;
    this.group.add(vodka, vodkaTwo);
    for (const [x, z] of [
      [-0.18, -0.32],
      [0.22, 0.34],
      [0.48, 0.12],
      [-0.5, -0.08],
    ]) {
      const can = this.createXlCan();
      can.position.set(x, 0.95, z);
      this.group.add(can);
    }
    for (const [x, z] of [
      [0.08, -0.48],
      [-0.28, 0.42],
      [0.52, 0.38],
      [-0.55, 0.22],
    ]) {
      const glass = this.createGlass();
      glass.position.set(x, 0.9, z);
      this.group.add(glass);
    }
  }

  private createVodka(): THREE.Group {
    const bottle = new THREE.Group();
    const glass = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      transparent: true,
      opacity: 0.45,
      roughness: 0.12,
      metalness: 0.1,
    });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.38, 12), glass);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 0.14, 8), glass);
    neck.position.y = 0.25;
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.032, 0.032, 0.05, 8),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.4, roughness: 0.3 }),
    );
    cap.position.y = 0.34;
    const label = this.createLabel('VODKA', '#111827', '#f8fafc', 0.14, 0.1);
    label.position.set(0, 0.02, 0.081);
    bottle.add(body, neck, cap, label);
    return bottle;
  }

  private createXlCan(): THREE.Group {
    const can = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.055, 0.22, 12),
      new THREE.MeshStandardMaterial({ color: 0x1d4ed8, metalness: 0.35, roughness: 0.35 }),
    );
    const top = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.055, 0.03, 12),
      new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.7, roughness: 0.25 }),
    );
    top.position.y = 0.12;
    const label = this.createLabel('XL', '#facc15', '#1e3a8a', 0.11, 0.08);
    label.position.set(0, 0.01, 0.057);
    can.add(body, top, label);
    return can;
  }

  private createGlass(): THREE.Mesh {
    return new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.038, 0.12, 10),
      new THREE.MeshStandardMaterial({
        color: 0xbfdbfe,
        transparent: true,
        opacity: 0.35,
        roughness: 0.08,
      }),
    );
  }

  private addHookah(): void {
    const hookah = new THREE.Group();
    const glass = new THREE.MeshStandardMaterial({
      color: 0x7f1d1d,
      transparent: true,
      opacity: 0.55,
      roughness: 0.2,
    });
    const metal = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      metalness: 0.75,
      roughness: 0.28,
    });
    const vase = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), glass);
    vase.position.y = 0.95;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.55, 8), metal);
    stem.position.y = 1.28;
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.08, 10), metal);
    bowl.position.y = 1.58;
    const coal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 0.03, 8),
      new THREE.MeshStandardMaterial({
        color: 0xfb923c,
        emissive: 0xea580c,
        emissiveIntensity: 0.8,
      }),
    );
    coal.position.y = 1.63;
    const hose = new THREE.Mesh(
      new THREE.TorusGeometry(0.22, 0.018, 6, 16, Math.PI),
      new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.7 }),
    );
    hose.rotation.x = Math.PI / 2;
    hose.position.set(0.18, 1.12, 0.12);
    hookah.add(vase, stem, bowl, coal, hose);
    this.group.add(hookah);

    const smokeMaterial = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
    });
    for (let index = 0; index < 4; index += 1) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), smokeMaterial.clone());
      puff.position.set(0.02, 1.62, 0);
      this.puffs.push(puff);
      this.group.add(puff);
    }
  }

  private createLabel(
    text: string,
    fill: string,
    background: string,
    width: number,
    height: number,
  ): THREE.Mesh {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const context = canvas.getContext('2d');
    if (context) {
      context.fillStyle = background;
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = fill;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.font = '900 72px Arial, sans-serif';
      context.fillText(text, 128, 64);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({ map: texture, transparent: true }),
    );
  }
}
