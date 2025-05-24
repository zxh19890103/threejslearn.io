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
       
  float r = rho.x / 500.0;
  float b = 1.0 - r;

  gl_FragColor = vec4(r, 0.3 * b, 0.7 * b, 1.0);
}