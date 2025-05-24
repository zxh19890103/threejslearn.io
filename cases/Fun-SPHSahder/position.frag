uniform sampler2D uPositionTex;
uniform sampler2D uVelocityTex;
uniform sampler2D uRhoTex;

uniform float uTime;
uniform float uDelta;
uniform vec3 uBMin;
uniform vec3 uBMax;

varying vec2 vUv;

void main() {
  vec4 coord = texture2D(uPositionTex, vUv);
  vec4 velocity = texture2D(uVelocityTex, vUv);

  coord.xyz += velocity.xyz * uDelta;
  coord.xyz = clamp(coord.xyz, uBMin, uBMax);

  gl_FragColor = coord;
}