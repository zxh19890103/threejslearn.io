import * as THREE from "three";

export class Marker extends THREE.Group {
  constructor() {
    super();

    const markerBase = new THREE.Mesh(
      new THREE.CircleGeometry(100, 48),
      new THREE.MeshBasicMaterial({
        color: 0xff4d4f,
        transparent: true,
        opacity: 0.95,
        depthTest: true,
      }),
    );

    const markerRing = new THREE.Mesh(
      new THREE.RingGeometry(34, 48, 48),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        side: THREE.DoubleSide,
        depthTest: true,
      }),
    );

    this.rotation.y = -Math.PI / 2;

    this.renderOrder = 2000; // Ensure marker renders on top
    this.scale.set(100, 10, 10); // Start small for animation

    this.add(markerBase, markerRing);
  }
}
