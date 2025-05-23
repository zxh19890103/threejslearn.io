uniform sampler2D uRhoTex;
uniform int uTexSize;

flat in int particleId;

void main() {
  float dist = distance(gl_PointCoord, vec2(0.5));
  if(dist > 0.5)
    discard;

  int x = particleId % uTexSize;
  int y = particleId / uTexSize;

  vec4 rho = texelFetch(uRhoTex, ivec2(x, y), 0);
  gl_FragColor = vec4(0.8, 0.8, 0.2, 1.0);
}