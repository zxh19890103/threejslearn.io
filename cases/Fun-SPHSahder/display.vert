uniform sampler2D uPositionTex;
uniform sampler2D uVelocityTex;

flat out int particleId;

void main() {
  gl_PointSize = 30.0;
  vec4 particleCoord = texture2D(uPositionTex, uv);
  vec3 pos = particleCoord.xyz;
  particleId = int(particleCoord.w);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}