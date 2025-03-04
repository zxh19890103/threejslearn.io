import {
  CSS2DObject,
  CSS2DRenderer,
} from "three/addons/renderers/CSS2DRenderer.js";
import * as THREE from "three";

export let __css2drenderer__: CSS2DRenderer = null;

export const __useCSS2Renderer__ = () => {
  const PgAppDiv = document.querySelector("#PgApp") as HTMLDivElement;

  __css2drenderer__ = new CSS2DRenderer({});
  __css2drenderer__.setSize(PgAppDiv.clientWidth, PgAppDiv.clientHeight);

  __renderers__.push(__css2drenderer__);

  __css2drenderer__.domElement.style.position = "absolute";
  __css2drenderer__.domElement.style.top = "0px";
  __css2drenderer__.domElement.style.pointerEvents = "none";
  PgAppDiv.appendChild(__css2drenderer__.domElement);

  __add_nextframe_fn__((scene, camera) => {
    __css2drenderer__.render(scene, camera);
  });
};

type CreateCss2dObjectForOptions = {
  fontsize?: number;
  color?: string;
  placement?: "top" | "bottom" | "left" | "right";
  offset?: number;
};

const defaultCreateCss2dObjectForOptions: CreateCss2dObjectForOptions = {
  fontsize: 12,
  color: "#fff",
  placement: "top",
  offset: 14,
};

export const createCss2dObjectFor = (
  obj3d: THREE.Object3D,
  text: string,
  options: CreateCss2dObjectForOptions = defaultCreateCss2dObjectForOptions
) => {
  const textElement = document.createElement("div");
  textElement.className = `label`;
  textElement.style.position = "absolute";
  textElement.style[options.placement] = `${options.offset}px`;
  textElement.style.color = options.color;
  textElement.style.fontSize = `${options.fontsize}px`;
  textElement.innerText = text;

  const textObject = new CSS2DObject(textElement);
  obj3d.add(textObject);
  return textObject;
};
