uniform sampler2D uPositionTex;
uniform sampler2D uVelocityTex;
uniform sampler2D uRhoTex;

uniform isampler3D uGOffsetTex;
uniform isampler2D uGKeyTex;
uniform isampler2D uGDataTex;

uniform int uMaxNeighborsPerParticle;
uniform int uParticlesCount;

uniform int uTexSize;
uniform float uTime;
uniform float uDelta;
uniform float uGravity;

uniform float uH;
uniform float uK;
uniform float uMu;
uniform float uRho0;

uniform vec3 uBMin;
uniform vec3 uBMax;
uniform ivec3 uGridSize;

in vec2 vUv;

float rand(vec2 co) {
  return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
}

float randMinusOneToOne(vec2 co) {
  return rand(co) * 2.0 - 1.0;
}

float randSplitRange(vec2 co) {
  float r = fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
  if(r < 0.5) {
        // map [0.0, 0.5) to (-1.0, -0.5)
    return -1.0 + r * 1.0;  // r * 1.0 ∈ [0.0, 0.5)
  } else {
        // map [0.5, 1.0) to (0.5, 1.0)
    return r; // already in desired range
  }
}

// pass!
ivec3 getGridKey(int particleId) {
  int x = particleId % uTexSize;
  int y = particleId / uTexSize;
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
          // count++;
          continue;
        }

        ivec4 offsetData = texelFetch(uGOffsetTex, neighborCell, 0);
        int offset = offsetData.x;
        int cnt = offsetData.y;

        for(int i = 0; i < cnt; i++) {
          int index = offset + i;
          int x = index % uTexSize;
          int y = index / uTexSize;
          int neighbor = texelFetch(uGDataTex, ivec2(x, y), 0).x;

          if(count < uMaxNeighborsPerParticle) {
            neighbors[count++] = neighbor;
          }
        }
      }
    }
  }
}

// --- Kernel Functions ---
const float PI = 3.141592653589793;

float Poly6Kernel(float r, float h) {
  if(r >= h)
    return 0.0;
  float coef = 315.0 / (64.0 * PI * pow(h, 9.0));
  float term = pow(h * h - r * r, 3.0);
  return coef * term;
}

float SpikyKernelGradient(float r, float h) {
  if(r >= h || r == 0.0)
    return 0.0;
  float coef = -45.0 / (PI * pow(h, 6.0));
  float term = pow(h - r, 2.0);
  return coef * term;
}

float W_viscosity(float r, float h) {
  if(r >= h)
    return 0.0;
  float coef = 45.0 / (PI * pow(h, 6.0));
  return coef * (1.0 - r / h);
}

// --- Pressure Force ---

vec3 calcPressureForce(
  vec3 xi,
  vec3 xj,
  float pi,
  float pj,
  float rhoi,
  float rhoj
) {
  vec3 r = xj - xi;
  if(length(r) == 0.0)
    return vec3(0.0);
  float s = max(length(r), 0.001);
  float w = SpikyKernelGradient(s, uH);
  vec3 dir = normalize(r);
  float scalar = w * (pi + pj);
  return dir * scalar;
}

// --- Viscosity Force ---

vec3 calcViscosityForce(
  vec3 xi,
  vec3 xj,
  vec3 vi,
  vec3 vj,
  float rhoi,
  float rhoj
) {
  float r = distance(xi, xj);

  if(length(r) == 0.0) {
    return vec3(0.0);
  }

  float w = W_viscosity(r, uH);

  vec3 vDiff = vj - vi;

  if(length(vDiff) == 0.0) {
    return vec3(0.0);
  }

  vec3 dir = normalize(vDiff);

  float scalar = uMu * w * (1.0 / rhoi) * (1.0 / rhoj);

  return dir * scalar;
}

const float boundaryDistance = 0.05; // Distance within which repulsive force is applied
const float boundaryForceStrength = 100.0; // Strength of the repulsive force

// Helper function: Compute repulsive force magnitude based on distance
float computeRepulsiveForce(float dist, float maxDist) {
  if(dist >= maxDist)
    return 0.0; // No force beyond max distance
  float ratio = dist / maxDist;
    // Quadratic decay for smooth force
  return boundaryForceStrength * (1.0 - ratio) * (1.0 - ratio);
}

void computeBoundaryRepulsiveForce(vec3 pos, vec3 force) {
    // Compute distances to each of the six faces
  float distLeft = pos.x - uBMin.x;   // Distance to left face (x = minX)
  float distRight = uBMax.x - pos.x;  // Distance to right face (x = maxX)
  float distBottom = pos.y - uBMin.y; // Distance to bottom face (y = minY)
  float distTop = uBMax.y - pos.y;    // Distance to top face (y = maxY)
  float distBack = pos.z - uBMin.z;   // Distance to back face (z = minZ)
  float distFront = uBMax.z - pos.z;  // Distance to front face (z = maxZ)

    // Apply repulsive force if particle is close to a face
  if(distLeft < boundaryDistance) {
    force += vec3(computeRepulsiveForce(distLeft, boundaryDistance), 0.0, 0.0); // Push right
  }
  if(distRight < boundaryDistance) {
    force += vec3(-computeRepulsiveForce(distRight, boundaryDistance), 0.0, 0.0); // Push left
  }
  if(distBottom < boundaryDistance) {
    force += vec3(0.0, computeRepulsiveForce(distBottom, boundaryDistance), 0.0); // Push up
  }
  if(distTop < boundaryDistance) {
    force += vec3(0.0, -computeRepulsiveForce(distTop, boundaryDistance), 0.0); // Push down
  }
  if(distBack < boundaryDistance) {
    force += vec3(0.0, 0.0, computeRepulsiveForce(distBack, boundaryDistance)); // Push forward
  }
  if(distFront < boundaryDistance) {
    force += vec3(0.0, 0.0, -computeRepulsiveForce(distFront, boundaryDistance)); // Push backward
  }
}

void main() {
  vec4 coord = texture2D(uPositionTex, vUv);
  vec3 velocity = texture2D(uVelocityTex, vUv).xyz;
  vec4 rho = texture2D(uRhoTex, vUv);

  vec3 particleCoord = coord.xyz;
  int particleIndex = int(coord.w);

  vec3 pressureForce = vec3(0.0);
  vec3 viscosityForce = vec3(0.0);

  for(int i = 0; i < uParticlesCount; i++) {
    if(particleIndex == i)
      continue;

    int x = i % uTexSize;
    int y = i / uTexSize;
    ivec2 xy = ivec2(x, y);

    vec3 neighborCoord = texelFetch(uPositionTex, xy, 0).xyz;
    vec3 neighborVelocity = texelFetch(uVelocityTex, xy, 0).xyz;
    vec4 neighborRho = texelFetch(uRhoTex, xy, 0);

    float r = distance(neighborCoord, particleCoord);
    if(r >= uH)
      continue;

    r = max(r, 0.01);

    pressureForce += calcPressureForce(particleCoord, neighborCoord, rho.z, neighborRho.z, rho.x, neighborRho.x);
    viscosityForce += calcViscosityForce(particleCoord, neighborCoord, velocity, neighborVelocity, rho.x, neighborRho.x);
  }

  vec3 acc = (pressureForce + viscosityForce) / rho.x;

  acc.y -= uGravity; // Apply gravity

  computeBoundaryRepulsiveForce(particleCoord, acc);

  velocity += acc * uDelta;

  if(uBMin.x + 0.01 > coord.x || uBMax.x - 0.01 < coord.x) {
    velocity.x *= -0.6;
  } else {
  }
  if(uBMin.y + 0.01 > coord.y || uBMax.y - 0.01 < coord.y) {
    velocity.y *= -0.6;
  } else {
  }
  if(uBMin.z + 0.01 > coord.z || uBMax.z - 0.01 < coord.z) {
    velocity.z *= -0.6;
  } else {
  }

  gl_FragColor = vec4(velocity, 1.0);
}