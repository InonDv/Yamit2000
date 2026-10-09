import * as THREE from 'three';

export class Scooter {
  readonly group = new THREE.Group();
  ridden = false;

  constructor(position: THREE.Vector3, yaw: number) {
    const frame = new THREE.MeshStandardMaterial({
      color: 0x111827,
      metalness: 0.35,
      roughness: 0.4,
    });
    const accent = new THREE.MeshStandardMaterial({
      color: 0x84cc16,
      roughness: 0.45,
    });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.07, 1.05), accent);
    deck.position.set(0, 0.16, 0.08);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.95, 8), frame);
    stem.position.set(0, 0.62, -0.42);
    stem.rotation.x = 0.12;
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.62, 8), frame);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, 1.08, -0.48);
    const gripGeometry = new THREE.CylinderGeometry(0.032, 0.032, 0.12, 8);
    const leftGrip = new THREE.Mesh(gripGeometry, accent);
    leftGrip.rotation.z = Math.PI / 2;
    leftGrip.position.set(-0.32, 1.08, -0.48);
    const rightGrip = leftGrip.clone();
    rightGrip.position.x = 0.32;
    const wheelGeometry = new THREE.TorusGeometry(0.12, 0.045, 8, 16);
    const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.7 });
    const frontWheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
    frontWheel.rotation.y = Math.PI / 2;
    frontWheel.position.set(0, 0.12, -0.5);
    const rearWheel = frontWheel.clone();
    rearWheel.position.z = 0.52;
    const headlight = new THREE.Mesh(
      new THREE.SphereGeometry(0.04, 8, 6),
      new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xfacc15,
        emissiveIntensity: 0.6,
      }),
    );
    headlight.position.set(0, 0.28, -0.56);
    this.group.add(deck, stem, bar, leftGrip, rightGrip, frontWheel, rearWheel, headlight);
    this.group.scale.setScalar(1.85);
    this.group.traverse((object) => {
      if (object instanceof THREE.Mesh) object.castShadow = true;
    });
    this.group.position.copy(position);
    this.group.rotation.y = yaw;
  }
}
