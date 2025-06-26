uniform sampler2D uHeightTex;
uniform sampler2D uVelocityTex;
uniform float dt;
uniform float uTime;
uniform float g;
uniform float damping;
uniform float texSize;
uniform float hbase;

uniform vec2 impactPos;
uniform float impactStrength;
uniform float windStrength;

in vec2 vUv;

// 簡單隨機函數
float random(vec2 st) {
  return fract(sin(dot(st, vec2(12.9898, 78.233))) * 43758.5453123);
}

void main() {
  float unit = 1.0 / texSize;
  vec2 dx = vec2(unit, 0.0);
  vec2 dy = vec2(0.0, unit);

  float h = texture(uHeightTex, vUv).r;
  vec2 u = texture(uVelocityTex, vUv).rg;

  float h_left = texture(uHeightTex, vUv - dx).r;
  float h_right = texture(uHeightTex, vUv + dx).r;
  float h_up = texture(uHeightTex, vUv + dy).r;
  float h_down = texture(uHeightTex, vUv - dy).r;
  vec2 u_left = texture(uVelocityTex, vUv - dx).rg;
  vec2 u_right = texture(uVelocityTex, vUv + dx).rg;
  vec2 u_up = texture(uVelocityTex, vUv + dy).rg;
  vec2 u_down = texture(uVelocityTex, vUv - dy).rg;

  float pressure_x = 0.5 * g * (h_right * h_right - h_left * h_left) / (2.0 * unit);
  float conv_x = (h_right * u_right.x * u_right.x - h_left * u_left.x * u_left.x) / (2.0 * unit);
  float cross_xy = (h_up * u_up.x * u_up.y - h_down * u_down.x * u_down.y) / (2.0 * unit);
  float pressure_y = 0.5 * g * (h_up * h_up - h_down * h_down) / (2.0 * unit);
  float conv_y = (h_up * u_up.y * u_up.y - h_down * u_down.y * u_down.y) / (2.0 * unit);
  float cross_yx = (h_right * u_right.x * u_right.y - h_left * u_left.x * u_left.y) / (2.0 * unit);

  // float dist = length(vUv - impactPos);
  // vec2 f = dist < 0.1 ? impactStrength * exp(-dist * dist / 0.01) * normalize(vUv - impactPos + vec2(0.0001)) : vec2(0.0);

  vec2 u_new = u - dt * (
    //
  vec2(conv_x + pressure_x / max(h, hbase), conv_y + pressure_y / max(h, hbase)) +
    //
    vec2(cross_xy, cross_yx));

  vec2 f = windStrength * vec2(sin(uTime * 2.0), cos(uTime * 2.0)); // 周期性風力

  u_new += dt * f;
  u_new *= damping;

  if(vUv.x < unit || vUv.x > 1.0 - unit) {
    u_new.x *= -0.6;
  }

  if(vUv.y < unit || vUv.y > 1.0 - unit) {
    u_new.y *= -0.6;
  }

  u_new.x = clamp(u_new.x, -1.0, 1.0);
  u_new.y = clamp(u_new.y, -1.0, 1.0);

  gl_FragColor = vec4(u_new, 0.0, 1.0);
}