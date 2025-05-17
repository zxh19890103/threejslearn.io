uniform sampler2D uPosition;
uniform sampler2D uVelocity;

uniform isampler2D uGOffsetTex;  // texel: (key, offset, count)
uniform isampler2D uGKeyTex;     // texel: (gx, gy, gz) per particle
uniform isampler2D uGDataTex;    // linear buffer of particle indices
uniform ivec3 uGridSize;
uniform int uMaxNeighborsPerParticle;
uniform int uParticlesCount;

uniform int uTexSize;
uniform float uTime;
uniform float uDelta;

varying vec2 vUv;

int cantor(int a, int b, int c) {
  int ab = ((a + b) * (a + b + 1)) / 2 + b;
  return ((ab + c) * (ab + c + 1)) / 2 + c;
}

ivec3 getGridKey(int particleId) {
  int texW = textureSize(uGKeyTex, 0).x;
  int x = particleId % texW;
  int y = particleId / texW;
  ivec3 gk = texelFetch(uGKeyTex, ivec2(x, y), 0).xyz;
  return gk;
}

void fetchNeighbors(int particleId, out int neighbors[256], out int count) {
  ivec3 gk = getGridKey(particleId);
  count = 0;

  for(int dx = -1; dx <= 1; dx++) {
    for(int dy = -1; dy <= 1; dy++) {
      for(int dz = -1; dz <= 1; dz++) {
        ivec3 neighborCell = gk + ivec3(dx, dy, dz);
        if(any(lessThan(neighborCell, ivec3(0))) || any(greaterThanEqual(neighborCell, uGridSize))) {
          continue;
        }

        int key = cantor(neighborCell.x, neighborCell.y, neighborCell.z);
        int offsetIdx = key;  // 1D texture, offset is stored at texel (key, 0)

        ivec3 offsetData = texelFetch(uGOffsetTex, ivec2(offsetIdx, 0), 0); // .g = offset, .b = count
        int offset = offsetData.g;
        int cnt = offsetData.b;

        for(int i = 0; i < cnt; i++) {
          int index = offset + i;
          int dataTexW = textureSize(uGDataTex, 0).x;
          int x = index % dataTexW;
          int y = index / dataTexW;
          int neighbor = texelFetch(uGDataTex, ivec2(x, y), 0).r;

          if(count < uMaxNeighborsPerParticle) {
            neighbors[count++] = neighbor;
          }
        }
      }
    }
  }
}

float rand(vec2 co) {
  return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
}

float randMinusOneToOne(vec2 co) {
  return rand(co) * 2.0 - 1.0;
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

void main() {
  vec4 coords = texture2D(uPosition, vUv);
  vec4 velocity = texture2D(uVelocity, vUv);

      // int particleIndex = uv2index(vUv

  velocity.x = randMinusOneToOne(vUv + 0.0);
  velocity.y = randMinusOneToOne(vUv + 0.1);
  velocity.z = randMinusOneToOne(vUv + 0.2);

  gl_FragColor = velocity;
}