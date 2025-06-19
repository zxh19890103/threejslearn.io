---
layout: course
title: Shader：像素的雕刻刀
short: "Shader：像素的雕刻刀"
date: 2025-06-16
math: 1
twitter: 1
ximg: "https://cdn.midjourney.com/21cfdfcf-8197-4b6f-8b8f-2f1b47974be4/0_0_384_N.webp"
kofi: 1
---

Shader，在中文環境裡被稱為著色器，是運行在 GPU 上的代碼，執行它的結果一般是向屏幕輸出顏色。因此，將它叫做像素的雕刻刀是合適的。

## 是什麼

> In computer graphics, a shader is a computer program that calculates the appropriate levels of light, darkness, and color during the rendering of a 3D scene—a process known as shading. Shaders have evolved to perform a variety of specialized functions in computer graphics special effects and video post-processing, as well as general-purpose computing on graphics processing units.

這是 wiki 對它的定義。

## 詞義

Shader 作為英文單詞，它的意思是“提供陰影者”，比如，棵樹就是一個 shader，因為在太陽下，它會對地面投下陰影。Shade 是一個名詞，意思是“陰影”：

- 英文詞義：在英語中，“shade”作為名詞指“陰影”或“遮蔽光線的區域”，作為動詞指“為某物遮蓋光線”或“使某處變暗”。它源自古英語“sceadu”，意為陰影、遮蔽，與光線的阻擋或減弱有關。
- 視覺含義：在繪畫或視覺藝術中，“shade”常指通過改變明暗來表現物體的立體感或光影效果。例如，畫家會在畫布上使用不同深淺的顏色來模擬光線照射物體時的陰影效果。

## 為什麼使用 shader 這個詞

在計算機圖形學中，“shader”（著色器）這個術語最早出現在 1980 年代的渲染技術中，尤其是在 RenderMan 等渲染系統中。這個名字的選擇與“shade”和“shading”的含義有直接聯繫，原因如下：
模擬光影效果：

在計算機圖形學中，渲染的目標是模擬真實世界中光線與物體的交互，從而生成逼真的圖像。Shader 最初被設計來計算物體表面的光照效果，例如高光、陰影、漫反射等，這與藝術中的“shading”（為物體添加明暗效果）高度相關。

例如，在早期渲染管線中，shader 負責計算每個像素或頂點的光照值，這直接對應於“shade”中關於光線遮蔽和明暗變化的概念。

人類將計算機圖形學中的“著色器”命名為“shader”，是因為它最初的職責與藝術中的“shading”密切相關：模擬光線與物體的交互，生成逼真的明暗效果。 “Shade”和“shading”這些詞的核心含義——光線的遮蔽、明暗的表現以及顏色的細微變化——直接啟發了 shader 這個術語的命名。隨著技術的進步，shader 的功能雖然擴展到更廣泛的圖形處理領域，但其名稱依然承載了模擬視覺效果的歷史根源。這種命名不僅反映了技術與藝術的交匯，也體現了計算機圖形學在模擬現實視覺體驗上的追求。

---
