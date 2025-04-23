
// vertexShader.glsl
varying vec3 vPosition; // Pass position to fragment shader
varying vec3 vNormal;   // Pass normal to fragment shader

uniform float dt;
uniform void main() {
  vPosition = position;  // Store vertex position
  vNormal = normal;      // Store normal

  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}

float Ploy6Kernel(float r, float h) {
  return 0;
}