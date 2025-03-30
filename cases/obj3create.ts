import * as THREE from "three";
import { vec3 } from "./vec3.js";

export const createPtsCloud = (
  pts: number[],
  color: number,
  colors?: number[]
) => {
  let vertexColors = colors !== undefined;

  const geometry = new THREE.BufferGeometry();
  const material = new THREE.PointsMaterial({
    color: vertexColors ? 0xffffff : color,
    vertexColors: vertexColors,
    sizeAttenuation: false,
    size: 6,
  });

  const cloud = new THREE.Points(geometry, material);

  const render = (pts: number[], colors?: number[]) => {
    const _vertexColors = colors !== undefined;

    if (vertexColors !== _vertexColors) {
      vertexColors = _vertexColors;
      material.vertexColors = _vertexColors;
      material.needsUpdate = true;
      material.color.setHex(vertexColors ? 0xffffff : color);
      console.log("vertexColors", vertexColors);
    }

    geometry.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));

    if (vertexColors) {
      geometry.setAttribute(
        "color",
        new THREE.Float32BufferAttribute(colors, 3)
      );
    }
  };

  render(pts, colors);

  return {
    thing: cloud,
    update: (pts: number[], colors?: number[]) => {
      render(pts, colors);
    },
  };
};

export const createChartline = (pts: number[], color: number) => {
  const geometry = new THREE.BufferGeometry();
  const material = new THREE.LineBasicMaterial({
    color,
  });

  const line = new THREE.Line(geometry, material);

  geometry.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));

  return {
    thing: line,
    update: (pts: number[]) => {
      geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(pts, 3)
      );
    },
  };
};

type Vector3UIDescripitor = { o: Vec3; dir: Vec3; color: number };
export const createVector3 = (
  vectors: Vector3UIDescripitor[],
  size: number = 0.1
) => {
  const geometry = new THREE.BufferGeometry();
  const material = new THREE.LineBasicMaterial({
    color: 0xffffff,
    vertexColors: true,
  });

  const color = new THREE.Color();
  const line = new THREE.LineSegments(geometry, material);

  const render = (vectors: Vector3UIDescripitor[]) => {
    const pts = vectors.flatMap((v) => {
      const dir = size > 0 ? vec3.setLength(vec3.clone(v.dir), size) : v.dir;
      return [...v.o, ...vec3.sum(v.o, dir)];
    });

    const colors = vectors.flatMap((v) => {
      color.setHex(v.color);
      return [...color, ...color];
    });

    geometry.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  };

  render(vectors);

  return {
    thing: line,
    update: (...vectors: Vector3UIDescripitor[]) => {
      render(vectors);
    },
  };
};
