import * as THREE from "three";

export class Marker extends THREE.Group {
  constructor() {
    super();

    const markerBase = new THREE.Mesh(
      new THREE.CircleGeometry(0.3, 48),
      new THREE.MeshBasicMaterial({
        color: 0xff4d4f,
        transparent: true,
        opacity: 0.95,
        depthTest: false,
      }),
    );

    markerBase.rotation.x = -Math.PI / 2;

    const markerRing = new THREE.Mesh(
      new THREE.RingGeometry(0.34, 0.48, 48),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        side: THREE.DoubleSide,
        depthTest: false,
      }),
    );

    markerRing.rotation.x = -Math.PI / 2;

    this.renderOrder = 999; // Ensure marker renders on top
    this.scale.set(10, 10, 10); // Start small for animation

    this.add(markerBase, markerRing);
  }
}
