uniform sampler2D uPositionTex;

uniform isampler3D uGOffsetTex;  // texel: (key, offset, count)
uniform isampler2D uGKeyTex;     // texel: (gx, gy, gz) per particle
uniform isampler2D uGDataTex;    // linear buffer of particle indices

uniform int uMaxNeighborsPerParticle;
uniform int uParticlesCount;

uniform int uTexSize;
uniform float uTime;
uniform float uDelta;

uniform float uH;
uniform float uK;
uniform float uMu;
uniform float uRho0;

varying vec2 vUv;

ivec3 getGridKey(int particleId) {
  int x = particleId % uTexSize;
  int y = particleId / uTexSize;
  ivec3 gk = texelFetch(uGKeyTex, ivec2(x, y), 0).xyz;
  return gk;
}

void fetchNeighbors(int particleId, out int neighbors[256], out int count) {
  ivec3 gk = getGridKey(particleId);
  count = 0;

  ivec3 gridSize = textureSize(uGOffsetTex, 0);

  for(int dx = -1; dx <= 1; dx++) {
    for(int dy = -1; dy <= 1; dy++) {
      for(int dz = -1; dz <= 1; dz++) {
        ivec3 neighborCell = gk + ivec3(dx, dy, dz);
        // 跳过越界格子
        if(any(lessThan(neighborCell, ivec3(0))) ||
          any(greaterThanEqual(neighborCell, gridSize))) {
          continue;
        }

        ivec4 offsetData = texelFetch(uGOffsetTex, neighborCell, 0);
        int offset = offsetData.r;
        int cnt = offsetData.g;

        for(int i = 0; i < cnt; i++) {
          int index = offset + i;
          int x = index % uParticlesCount;
          int y = index / uParticlesCount;
          int neighbor = texelFetch(uGDataTex, ivec2(x, y), 0).r;
          if(count < uMaxNeighborsPerParticle) {
            neighbors[count++] = neighbor;
          }
        }
      }
    }
  }
}

int uv2index(vec2 uv) {
  ivec2 pixelCoord = ivec2(floor(uv * vec2(uTexSize)));
  int index = pixelCoord.y * uTexSize + pixelCoord.x;
  return index;
}

vec2 index2uv(int index) {
  int x = index % uTexSize;
  int y = index / uTexSize;
  vec2 uv = (vec2(x, y) + 0.5) / vec2(uTexSize);
  return uv;
}

float poly6Kernel(float r, float h) {
  if(r >= h)
    return 0.0;
  float h2 = h * h;
  float r2 = r * r;
  float factor = 315.0 / (64.0 * 3.14159265 * pow(h, 9.0));
  return factor * pow(h2 - r2, 3.0);
}

void main() {
  vec3 coord = texture2D(uPositionTex, vUv).xyz;
  vec4 rho = texture2D(uRhoTex, vUv);

  int particleIndex = uv2index(vUv);

  int neighbors[256];
  int count;

  fetchNeighbors(particleIndex, neighbors, count);

  float rhoScalar = 0.0;

  for(int i = 0; i < count; i++) {
    int neighborid = neighbors[i];
    vec2 neighborUv = index2uv(neighborid);
    vec3 neighborCoord = texture2D(uPositionTex, neighborUv).xyz;
    float r = distance(neighborCoord, coord);

    if(r < uH) {
      rhoScalar += poly6Kernel(r, uH);
    }
  }

  float pressure = uK * (rhoScalar - uRho0);
  pressure = max(pressure, 0.0);

  rho.x = rhoScalar;
  rho.y = pressure;
  rho.z = 0.0;
  rho.w = 0.0;

  gl_FragColor = rho;
}