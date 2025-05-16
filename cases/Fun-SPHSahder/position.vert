
precision highp float;

uniform sampler2D u_positionTex;  // Positions of all particles
uniform sampler2D u_velocityTex;  // Velocities of all particles
uniform float u_timeStep;          // Delta time
uniform float u_particleRadius;    // Kernel radius
uniform vec2 u_textureSize;        // Dimensions of particle texture (e.g. 32x32)

varying vec2 v_uv;

// Helper to get particle data by UV
vec4 getParticleData(vec2 uv) {
    return texture2D(u_positionTex, uv);
}

void main() {
    vec4 selfPos = texture2D(u_positionTex, v_uv);
    vec4 selfVel = texture2D(u_velocityTex, v_uv);

    vec3 acceleration = vec3(0.0);
    float density = 0.0;

    // Loop over neighbors in a small radius (naive example)
    // We'll sample a small square neighborhood of pixels
    int radius = 2; // sample +-2 pixels around current pixel

    for (int x = -radius; x <= radius; x++) {
        for (int y = -radius; y <= radius; y++) {
            vec2 offset = vec2(float(x), float(y)) / u_textureSize;
            vec2 neighborUV = v_uv + offset;

            // Clamp UV inside texture bounds
            neighborUV = clamp(neighborUV, vec2(0.0), vec2(1.0));

            vec4 neighborPos = texture2D(u_positionTex, neighborUV);
            vec4 neighborVel = texture2D(u_velocityTex, neighborUV);

            // Distance between particles
            vec3 diff = neighborPos.xyz - selfPos.xyz;
            float r = length(diff);

            if (r < u_particleRadius && r > 0.0) {
                // Calculate density contribution (kernel function)
                float q = 1.0 - r / u_particleRadius;
                density += q * q * q; // e.g. simple kernel

                // Pressure and viscosity forces would go here...
                // For now, just a dummy acceleration to show the structure
                acceleration += normalize(diff) * q * 0.1; // fake force
            }
        }
    }

    // Update velocity
    vec3 newVelocity = selfVel.xyz + acceleration * u_timeStep;

    gl_FragColor = vec4(newVelocity, 1.0);
}
