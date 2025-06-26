uniform sampler2D uHeightTex;
uniform sampler2D uVelocityTex;

uniform float uTime;
uniform float texSize;
uniform float hbase;
uniform float dt;

in vec2 vUv;

void main() {
  float unit = 1.0 / texSize;

  // 讀取當前網格點
  float h = texture(uHeightTex, vUv).r;
  vec2 u = texture(uVelocityTex, vUv).rg;

  // 讀取鄰居網格點
  vec2 dx = vec2(unit, 0.0);
  vec2 dy = vec2(0.0, unit);

  float h_left = texture(uHeightTex, vUv - dx).r;
  float h_right = texture(uHeightTex, vUv + dx).r;
  float h_up = texture(uHeightTex, vUv + dy).r;
  float h_down = texture(uHeightTex, vUv - dy).r;
  vec2 u_left = texture(uVelocityTex, vUv - dx).rg;
  vec2 u_right = texture(uVelocityTex, vUv + dx).rg;
  vec2 u_up = texture(uVelocityTex, vUv + dy).rg;
  vec2 u_down = texture(uVelocityTex, vUv - dy).rg;

  // 中心差分：計算通量散度
  float dh_dx = (h_right * u_right.x - h_left * u_left.x) / (2.0 * unit); // ∂(hu)/∂x
  float dh_dy = (h_up * u_up.y - h_down * u_down.y) / (2.0 * unit); // ∂(hv)/∂y

  // 更新高度
  // float h_new = clamp(h - dt * (dh_dx + dh_dy), 0.001, 0.5);
  float h_new = max(h - dt * (dh_dx + dh_dy), hbase);

  // 邊界條件：吸收邊界
  if(vUv.x < unit || vUv.x > 1.0 - unit || vUv.y < unit || vUv.y > 1.0 - unit) {
    h_new *= 0.9; // 減弱高度
  }

  gl_FragColor = vec4(h_new, 0.0, 0.0, 1.0);
}