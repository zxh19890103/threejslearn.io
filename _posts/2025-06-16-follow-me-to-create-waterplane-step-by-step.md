---
layout: course
title: "Follow me! Create Water Step by Step With ThreeJs"
short: "Follow me! Create Water Step by Step With ThreeJs"
banner:
  img: "https://cdn.midjourney.com/23cd5bed-5b3d-4d28-a157-62fb5b629bcd/0_1.jpeg"
  caption: Lake & Sunset
nochapters: 1
kofi: 1
math: 1
twitter: 1
---

我們使用淺水方程模擬平靜的水面效果！

“淺水”，也就是水面只有輕微的波浪，沒有湍流、沒有海嘯，很平靜的水面。這種水面我們可以不考慮 z 軸方向上的動量。

## 兩個公式

### 質量守恆

```math
\frac{\partial h}{\partial t } + \frac{\partial h u}{\partial x } + \frac{\partial h v}{\partial y }  = 0
```

質量守恆從物理意義上確保液體（海水）不會隨時間減少。此處的海水多了，彼處的海水便少一些。

### 動量守恆

首先是 X 方向上：

```math
\frac{\partial (h u)}{\partial t} + \frac{\partial (h u^2 + \frac{1}{2} g h^2)}{\partial x} + \frac{\partial (h u v)}{\partial y} = f_x
```

然後是 Y 方向上：

```math
\frac{\partial (h v)}{\partial t} + \frac{\partial (h u v)}{\partial x} + \frac{\partial (h v^2 + \frac{1}{2} g h^2)}{\partial y} = f_y
```

動量守恆確保海水的運動符合基本的物理運動法則，使得海水運動更接近現實情況。

## 兩個紋理

### 海水的高度

顧名思義，這個紋理用於存儲海水的高度。

海水是時刻變動的，此起彼伏，也就是每一個位置上的高度是變化的，因此我們需要一個文件（紋理）來存儲這些高度值。

這裡我們使用紋理 R 通道即可，節約存儲空間。

```ts
const tex = new THREE.WebGLRenderTarget();
```

### 海水移動速度

速度也是隨時間變化的物理量，因此需要存儲和更新。

和高度一樣，使用一個文件（紋理）存儲它們。

由於只考慮平面移動，我們使用 RG 通道即可，節約存儲空間。

### 讀取和更新

事實上，這裡我們要使用的是 `WebGLRenderTarget`，並使用 GPU 的計算這些紋理。也需要考慮 Shader 裡讀和寫的分離要求。也就是要使用 Ping-Pong 計算，不斷交換讀寫渲染目標，實現讀取和更新。

### 什麼是 Ping-Pong 渲染？

Ping-Pong 渲染是一種在 WebGL 中使用 Render Target（渲染目標，類似“離屏畫布”）的技術，通過在兩個紋理（Texture）之間來回切換，實現迭代計算或效果更新。它就像打乒乓球，數據在兩個 Render Target 之間“乒乒乓乓”地傳遞，每一輪都更新一次計算結果。

- 核心思想：你有兩個 Render Target（稱為 RT1 和 RT2）。每一幀，你用 RT1 的數據作為輸入，渲染到 RT2；下一幀，反過來用 RT2 的數據渲染到 RT1。這樣不斷切換，實現連續的數據處理。
- 為什麼用？：很多圖形效果（像水波傳播、模糊、粒子模擬）需要基於前一幀的結果進行計算，Ping-Pong 讓你能高效地保存和更新這些中間狀態。

## 大概的步驟

創建兩對大小為 $128\times128$ 的紋理，使用 WebGLRenderTarget：

- 一個用於存儲和更新高度
- 一個用於存儲和更新平面速度

那麼這裡對應 $128\times128$ 個格子，每個格子可以計算一個位置：

```c++
float gap = 102.01;
vec2 xy = ivec2(x, y) * gap;
```

將高度紋理納入考慮，我們將得到一個起伏不平的平面幾何體，使用 mesh 繪製出來，然後在每一幀更新它，結果就是海面了。

後續，我們可以在對側水面的上面添加一個暗紅的太陽和其兩側的晚霞，我們將得到一個“海上日落美景圖”，就像這樣：

![sunset over sea](https://media.istockphoto.com/id/1083660474/photo/morning-dawn-on-the-river.jpg?s=612x612&w=0&k=20&c=buNjWsB1RzBFZWcrxcydmRrqnfyC9bO8BewNEUN60Ls=)

## 粗代碼

### 創建 Fun 項目並添加 `water.ts` 文件

```
yarn cc Fun-Water
```

### 確定紋理大小

```ts
export const texSize = 128;
```

### 定義函數 `createRT` 和 `createRTPair`

它用於創建 Ping-Pong 渲染目標，封裝的目的是固定一個參數配置：

```ts
export const createRT = (
  format: THREE.PixelFormat,
  type: THREE.TextureDataType
) => {
  return new THREE.WebGLRenderTarget(texSize, texSize, {
    format,
    type,
    wrapS: THREE.RepeatWrapping,
    wrapT: THREE.RepeatWrapping,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    depthBuffer: false,
    stencilBuffer: false,
  });
};
```

以及 `createPingPongRTPair` 函數：

```ts
export const createPingPongRTPair = (
  format: THREE.PixelFormat,
  type: THREE.TextureDataType
) => {
  return {
    rt0: createRT(format, type),
    rt1: createRT(format, type),
    swap() {
      const rt1 = this.rt1;
      this.rt1 = this.rt0;
      this.rt0 = rt1;
    },
  };
};
```

其中，`swap` 函數是對兩個目標進行互換，以實現 ping-pong 效果。

### 創建專門為計算高度和速度用的元素

它們分別是：

- 一個場景
- 一個正交相機，用於觀察場景，獲得合適的渲染結果
- 一個正方形 mesh，用於出發 shader 執行
- 兩對 RT

```ts
const computingScene = new THREE.Scene();
const computingCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

const quadGeo = new THREE.PlaneGeometry(2, 2);
const quadMatrial = new THREE.MeshPhongMaterial();
const quadMesh = new THREE.Mesh<THREE.PlaneGeometry, any>(quadGeo);
computingScene.add(quadMesh);

const heightMap = createPingPongRTPair(THREE.RedFormat, THREE.FloatType);
const velocityMap = createPingPongRTPair(THREE.RGFormat, THREE.FloatType);
```

我們將這個過程包裝為一個函數吧：

```ts
const createQuadComputingScene = () => {
  // ...
  return (mat: THREE.ShaderMaterial, uniforms: Record<string, any>) => {
    for (const name in uniforms) {
      mat.uniforms[name].value = uniforms[name];
    }
    renderer.render(computingScene, computingCamera);
  };
};
```

它返回一個 render loop Partial，其中，外界需要提供材質以及一組 uniforms 值。

在 render loop 裡：

```ts
const renderQuad = createQuadComputingScene();
const updateVelocityMapMaterial;
const updateHeightMapMaterial;

loop = () => {
  renderer.setRenderTarget(velocityMap.rt1);
  renderQuad(updateVelocityMapMaterial, {
    heightTex: heightMap.rt0,
  });
  velocityMap.swap();

  renderer.setRenderTarget(heightMap.rt1);
  renderQuad(updateHeightMapMaterial, {
    heightTex: heightMap.rt0,
    velocityTex: velocityMap.rt0,
  });
  heightMap.swap();

  renderer.setRenderTarget(null);

  // here you got the HeightMap updated! Draw the water mesh.

  renderer.render(scene, camera);
};
```

我們需要寫材質，因為我們只能在材質裡，實現 GPU 計算邏輯。這裡使用的是 `THREE.ShaderMaterial`：

### 如何顯示 heightMap？

我們有了高度紋理，這樣就可以使用它來渲染水面。

首先我們可以計算 x 和 y 的座標吧，對於每一個格子，我們都有一個對應的座標，設定格子的大小為 `cellSize`，在 shader 裡，我們可以計算位置 xy，然後從 heightMap 裡讀取 h，也就是 z 值。

```c++
float h = texelFetch(heightTex, ivec2(pos.x, pos.y), 0).r;
gl_Position = vec4(ix * cellSize, iy * cellSize, h, 1.0);
```

其中， pos 為由 CPU 傳入的頂點座標，它們是格子的索引。

### 初步結果

{% include coderun.html id="Fun-Water" %}

---
