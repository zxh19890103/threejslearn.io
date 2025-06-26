import * as THREE from "three";

export class Sky extends THREE.Mesh<
  THREE.SphereGeometry,
  THREE.ShaderMaterial
> {
  constructor() {
    const geo = new THREE.SphereGeometry(
      12,
      24,
      24,
      0,
      2 * Math.PI,
      0,
      Math.PI
    );

    super(
      geo,
      new THREE.ShaderMaterial({
        precision: "mediump",
        vertexShader: /* glsl */ `
        varying vec3 vWorldPosition;

        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
        `,
        fragmentShader: /* glsl */ `
        uniform vec3 topColor;
        uniform vec3 horizonColor;
        uniform float exponent;
        uniform vec3 sunDir;
        uniform vec3 sunColor;
        // uniform vec3 glowColor;
        uniform float time; // 可傳入動畫時間

        varying vec3 vWorldPosition;

        // GLSL noise function
        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
            mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
            u.y
          );
        }

        void main() {
          vec3 dir = normalize(vWorldPosition);

          float h = abs(dir.y);
          float factor = pow(h, exponent);
          vec3 skyColor = mix(horizonColor, topColor, factor);

          // 加強太陽光暈
          float sunDot = dot(dir, sunDir);
          float glow = pow(max(sunDot, 0.0), 500.0);

          skyColor += sunColor * glow;
          gl_FragColor = vec4(skyColor, 1.0);
        }
        `,
        side: THREE.BackSide, // flip to render inside of sphere
        uniforms: {
          topColor: { value: new THREE.Color(0x03091a) }, // deep blue
          horizonColor: { value: new THREE.Color(0xff8333) }, // orange-red
          exponent: { value: 0.4 },
          time: { value: 0 },
          sunDir: { value: new THREE.Vector3(0.0, -6, -10.0).normalize() },
          sunColor: { value: new THREE.Color(0xffffff) }
        },
      })
    );
  }
}
