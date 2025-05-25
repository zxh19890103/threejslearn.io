uniform sampler2D uPositionTex;
uniform sampler2D uRhoTex;

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

vec3 getParticleCoord(int i) {
  int x = i % uTexSize;
  int y = i / uTexSize;
  vec3 coord = texelFetch(uPositionTex, ivec2(x, y), 0).xyz;
  return coord;
}

ivec3 getGridKey(int particleId) {
  int x = particleId % uTexSize;
  int y = particleId / uTexSize;
  ivec3 gk = texelFetch(uGKeyTex, ivec2(x, y), 0).xyz;
  return gk;
}

void fetchNeighbors(int particleId, out int neighbors[256], out float distances[256], out int count) {
  ivec3 gk = getGridKey(particleId);
  count = 0;

  ivec3 gridSize = textureSize(uGOffsetTex, 0);
  // vec4 coord = texelFetch(uPositionTex, )
  vec3 coord = getParticleCoord(particleId);

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
          int x = index % uTexSize;
          int y = index / uTexSize;
          int neighbor = texelFetch(uGDataTex, ivec2(x, y), 0).r;
          vec3 neighorCoord = getParticleCoord(neighbor);
          float r = distance(coord, neighorCoord);
          if(r < uH && count < uMaxNeighborsPerParticle) {
            neighbors[count] = neighbor;
            distances[count] = max(r, 0.01);
            count++;
          }
        }
      }
    }
  }
}

const float PI = 3.141592653589793;

float Poly6Kernel(float r, float h) {
  if(r >= h)
    return 0.0;
  float coef = 315.0 / (64.0 * PI * pow(h, 9.0));
  float term = pow(h * h - r * r, 3.0);
  return coef * term;
}

void main() {
  vec4 position = texture2D(uPositionTex, vUv);
  vec4 rho = texture2D(uRhoTex, vUv);

  vec3 coord = position.xyz;
  int particleIndex = int(position.w);

  float distances[256];
  int neighbors[256];
  int count;

  fetchNeighbors(particleIndex, neighbors, distances, count);

  float rhoScalar = 0.0;

  for(int i = 0; i < count; i++) {

    int neighborIndex = neighbors[i];

    if(neighborIndex == particleIndex)
      continue;

    rhoScalar += Poly6Kernel(distances[i], uH);
  }

  float pressure = uK * (rhoScalar - uRho0);

  rho.x = rhoScalar;
  rho.y = pressure;
  rho.z = pressure / pow(rhoScalar, 2.0);
  rho.w = 0.0;

  gl_FragColor = rho;
}