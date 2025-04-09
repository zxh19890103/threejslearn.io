import * as THREE from "three";
import { vec3 } from "cases/vec3.js";
import { triTable, edgeTable } from "./triTable.js";
import { VertexNormalsHelper } from "three/addons/helpers/VertexNormalsHelper.js";

type FieldFunc = (p: Vec3) => number;

type MarchingCubesInput = {
  isoValue: number;
  resolution: number;
  box: { min: Vec3; max: Vec3 };
  fieldFunc: FieldFunc;
};

export class MarchingCubes {
  /**
   * for one triangle, there're 12 edges,
   * in case of each edge cutted by the surface,
   * there should be 12 vertex, which has `12 * 3` numbers.
   */
  private oneTriangVertex = new Float32Array(12 * 3);

  /**
   * all the the vertex
   */
  private gridVertexArray: Float32Array;
  /** all the scalar computed! */
  private gridVertexField: Float32Array;

  /** all the cut points/colors/normals, and index */
  private cutPtVertArray: Float32Array;
  private cutPtColorArray: Float32Array;
  private cutPtNormalArray: Float32Array;
  private cutPtIndexArray: Uint32Array<ArrayBuffer>;

  /**
   * -1 means no!
   * >= 0 means the cut-vertex index.
   */
  private isEdgeCutPtComputed: Int32Array<ArrayBuffer>;

  cubes: Cube[];

  cutVertexPts: THREE.Points;
  cubesGrid: THREE.LineSegments;
  surface: THREE.Mesh;
  surfaceNormalsHelper: VertexNormalsHelper;

  vertIndexCount = 0;
  /**
   * the number of triangles generated!
   */
  ntriang = 0;
  vertCount = 0;

  constructor(readonly input: MarchingCubesInput) {
    const geometry = new THREE.BufferGeometry();

    const surface = new THREE.Mesh(
      geometry,
      // new THREE.MeshBasicMaterial({
      //   vertexColors: true,
      //   color: 0xffffff,
      //   // color: 0x0077be,
      //   side: THREE.FrontSide,
      // })
      new THREE.MeshPhongMaterial({
        // vertexColors: true,
        // color: 0xffffff,
        color: 0x0077be,
        transparent: true,
        opacity: 0.9,
        side: THREE.FrontSide,
        specular: 0xffffff,
        shininess: 1,
      })
      // new THREE.MeshPhysicalMaterial({
      //   color: 0x0077be, // Water blue
      //   // vertexColors: true,
      //   // color: 0xffffff,
      //   transparent: false,
      //   opacity: 0.7,
      //   depthWrite: true,
      //   side: THREE.FrontSide,
      //   roughness: 0.1, // Makes it glossy
      //   metalness: 0.2, // Reflective property
      //   clearcoat: 1.0, // Extra shininess
      //   transmission: 0.9, // Simulates refraction
      // })
    );

    this.surface = surface;
    surface.frustumCulled = false;

    this.buildGrid();

    const triangVertex = this.oneTriangVertex;
    const cutPtVertArray = this.cutPtVertArray;
    const cutPtColorArray = this.cutPtColorArray;
    const cutPtNormalArray = this.cutPtNormalArray;

    const indexArray = this.cutPtIndexArray;
    const isEdgeCutPtComputed = this.isEdgeCutPtComputed;

    const cubeCornerYes: number[] = [1, 2, 4, 8, 16, 32, 64, 128];

    let ntriang = 0;
    /**
     * for vertexArray's cursor ++
     */
    let iCursor = 0;
    /**
     * for indexArray's cursor ++,
     * also can be for memory of `isEdgeCutPtComputed`
     */
    let iCursor4Index = 0;
    /**
     * the vertexArray's index
     */
    let vertIndex = 0;

    this.march = function () {
      ntriang = 0;
      iCursor = 0;
      iCursor4Index = 0;
      vertIndex = 0;

      cutPtNormalArray.fill(0);
      isEdgeCutPtComputed.fill(-1);

      // compute it everytime march all for the fluid is flowing.
      computeGridVertexFields();

      const { cubes, gridVertexField } = this;
      const { isoValue } = this.input;

      let index = 0b00000000;
      let cornerindex = 0;

      for (const cube of cubes) {
        index &= 0;
        cornerindex = 0;

        for (const corner of cube.vertexInArray) {
          if (gridVertexField[corner] < isoValue)
            index |= cubeCornerYes[cornerindex];
          cornerindex += 1;
        }

        const n = createTrianglesForCube(cube, index);
        ntriang += n;
      }

      // console.log("icursor=", iCursor);

      const Normal: Vec3 = [0, 0, 0];

      for (let i = 0; i < iCursor; i += 3) {
        Normal[0] = cutPtNormalArray[i];
        Normal[1] = cutPtNormalArray[i + 1];
        Normal[2] = cutPtNormalArray[i + 2];

        vec3.normalize(Normal);

        cutPtNormalArray[i] = Normal[0];
        cutPtNormalArray[i + 1] = Normal[1];
        cutPtNormalArray[i + 2] = Normal[2];
      }

      this.ntriang = ntriang;
      this.vertIndexCount = iCursor4Index;
      this.vertCount = iCursor;
    };

    const computeGridVertexFields = () => {
      const field = this.gridVertexField;
      const fieldFunc = this.input.fieldFunc;
      const gridVertex = this.gridVertexArray;
      const n = field.length;
      const P: Vec3 = [0, 0, 0];
      let iX = 0;

      for (let i = 0; i < n; i += 1) {
        iX = 3 * i;
        P[0] = gridVertex[iX];
        P[1] = gridVertex[iX + 1];
        P[2] = gridVertex[iX + 2];
        field[i] = fieldFunc(P);
      }
    };

    const createTrianglesForCube = (cube: Cube, cubeindex: number) => {
      /* Cube is entirely in/out of the surface */
      if (edgeTable[cubeindex] === 0) {
        return 0;
      }

      /* Find the vertices where the surface intersects the cube */
      if (edgeTable[cubeindex] & 1)
        isEdgeCutPtComputed[cube.edgeIndices[0]] === -1 &&
          VertexInterpOnCubeEdge(cube, 0);
      if (edgeTable[cubeindex] & 2)
        isEdgeCutPtComputed[cube.edgeIndices[1]] === -1 &&
          VertexInterpOnCubeEdge(cube, 1);
      if (edgeTable[cubeindex] & 4)
        isEdgeCutPtComputed[cube.edgeIndices[2]] === -1 &&
          VertexInterpOnCubeEdge(cube, 2);
      if (edgeTable[cubeindex] & 8)
        isEdgeCutPtComputed[cube.edgeIndices[3]] === -1 &&
          VertexInterpOnCubeEdge(cube, 3);
      if (edgeTable[cubeindex] & 16)
        isEdgeCutPtComputed[cube.edgeIndices[4]] === -1 &&
          VertexInterpOnCubeEdge(cube, 4);
      if (edgeTable[cubeindex] & 32)
        isEdgeCutPtComputed[cube.edgeIndices[5]] === -1 &&
          VertexInterpOnCubeEdge(cube, 5);
      if (edgeTable[cubeindex] & 64)
        isEdgeCutPtComputed[cube.edgeIndices[6]] === -1 &&
          VertexInterpOnCubeEdge(cube, 6);
      if (edgeTable[cubeindex] & 128)
        isEdgeCutPtComputed[cube.edgeIndices[7]] === -1 &&
          VertexInterpOnCubeEdge(cube, 7);
      if (edgeTable[cubeindex] & 256)
        isEdgeCutPtComputed[cube.edgeIndices[8]] === -1 &&
          VertexInterpOnCubeEdge(cube, 8);
      if (edgeTable[cubeindex] & 512)
        isEdgeCutPtComputed[cube.edgeIndices[9]] === -1 &&
          VertexInterpOnCubeEdge(cube, 9);
      if (edgeTable[cubeindex] & 1024)
        isEdgeCutPtComputed[cube.edgeIndices[10]] === -1 &&
          VertexInterpOnCubeEdge(cube, 10);
      if (edgeTable[cubeindex] & 2048)
        isEdgeCutPtComputed[cube.edgeIndices[11]] === -1 &&
          VertexInterpOnCubeEdge(cube, 11);

      cubeindex <<= 4;

      let n = 0;
      let e1 = 0;
      let k = 0;

      while (triTable[cubeindex + k] != -1) {
        e1 = cubeindex + k;

        addTriangle(cube, triTable[e1 + 2], triTable[e1 + 1], triTable[e1]);

        k += 3;
        n += 1;
      }

      return n;
    };

    /**
     * every time it inserts 3 vertex.
     */
    let addTriangle: (cube: Cube, e1: number, e2: number, e3: number) => void;

    {
      let triVX = 0;
      let triVY = 0;
      let triVZ = 0;

      let i0 = 0;
      let i1 = 0;
      let i2 = 0;

      let cutPtIndex = 0;
      let edgeIndex = -1;

      addTriangle = (cube: Cube, e1: number, e2: number, e3: number) => {
        // #1
        edgeIndex = cube.edgeIndices[e1];
        cutPtIndex = isEdgeCutPtComputed[edgeIndex];
        if (cutPtIndex === -1) {
          const o1 = e1 * 3;
          const i = iCursor;
          i0 = i;

          triVX = triangVertex[o1];
          triVY = triangVertex[o1 + 1];
          triVZ = triangVertex[o1 + 2];

          cutPtVertArray[i] = triVX;
          cutPtVertArray[i + 1] = triVY;
          cutPtVertArray[i + 2] = triVZ;

          const r = Math.random();
          const g = Math.random();
          const b = Math.random();

          cutPtColorArray[i] = r;
          cutPtColorArray[i + 1] = g;
          cutPtColorArray[i + 2] = b;

          isEdgeCutPtComputed[edgeIndex] = vertIndex;
          indexArray[iCursor4Index] = vertIndex;

          vertIndex += 1;
          iCursor += 3;
          iCursor4Index += 1;
        } else {
          indexArray[iCursor4Index] = cutPtIndex;
          iCursor4Index += 1;
          i0 = cutPtIndex;
        }

        // #2
        edgeIndex = cube.edgeIndices[e2];
        cutPtIndex = isEdgeCutPtComputed[edgeIndex];

        if (cutPtIndex === -1) {
          const o2 = e2 * 3;
          const i = iCursor;
          i1 = i;

          triVX = triangVertex[o2];
          triVY = triangVertex[o2 + 1];
          triVZ = triangVertex[o2 + 2];

          cutPtVertArray[i] = triVX;
          cutPtVertArray[i + 1] = triVY;
          cutPtVertArray[i + 2] = triVZ;

          const r = Math.random();
          const g = Math.random();
          const b = Math.random();

          cutPtColorArray[i] = r;
          cutPtColorArray[i + 1] = g;
          cutPtColorArray[i + 2] = b;

          isEdgeCutPtComputed[edgeIndex] = vertIndex;
          indexArray[iCursor4Index] = vertIndex;

          vertIndex += 1;
          iCursor += 3;
          iCursor4Index += 1;
        } else {
          indexArray[iCursor4Index] = cutPtIndex;
          iCursor4Index += 1;
          i1 = cutPtIndex;
        }

        // #3
        edgeIndex = cube.edgeIndices[e3];
        cutPtIndex = isEdgeCutPtComputed[edgeIndex];
        if (cutPtIndex === -1) {
          const o3 = e3 * 3;
          const i = iCursor;
          i2 = i;

          triVX = triangVertex[o3];
          triVY = triangVertex[o3 + 1];
          triVZ = triangVertex[o3 + 2];

          cutPtVertArray[i] = triVX;
          cutPtVertArray[i + 1] = triVY;
          cutPtVertArray[i + 2] = triVZ;

          const r = Math.random();
          const g = Math.random();
          const b = Math.random();

          cutPtColorArray[i] = r;
          cutPtColorArray[i + 1] = g;
          cutPtColorArray[i + 2] = b;

          isEdgeCutPtComputed[edgeIndex] = vertIndex;
          indexArray[iCursor4Index] = vertIndex;

          vertIndex += 1;
          iCursor += 3;
          iCursor4Index += 1;
        } else {
          indexArray[iCursor4Index] = cutPtIndex;
          iCursor4Index += 1;
          i2 = cutPtIndex;
        }

        // compute normals
        computeTriFaceNormal(i0, i1, i2);
      };
    }

    let computeTriFaceNormal: (p0: number, p1: number, p2: number) => void;

    {
      const P10: Vec3 = [0, 0, 0];
      const P20: Vec3 = [0, 0, 0];
      const Normal: Vec3 = [0, 0, 0];

      const cross = (v1: Vec3, v2: Vec3) => {
        Normal[0] = v1[1] * v2[2] - v1[2] * v2[1]; // x-component
        Normal[1] = v1[2] * v2[0] - v1[0] * v2[2]; // y-component
        Normal[2] = v1[0] * v2[1] - v1[1] * v2[0]; // z-component

        vec3.normalize(Normal);
      };

      computeTriFaceNormal = (p0: number, p1: number, p2: number) => {
        const op0 = p0 * 3;
        const op1 = p1 * 3;
        const op2 = p2 * 3;

        P10[0] = cutPtVertArray[op1] - cutPtVertArray[op0];
        P10[1] = cutPtVertArray[op1 + 1] - cutPtVertArray[op0 + 1];
        P10[2] = cutPtVertArray[op1 + 2] - cutPtVertArray[op0 + 2];

        P20[0] = cutPtVertArray[op2] - cutPtVertArray[op0];
        P20[1] = cutPtVertArray[op2 + 1] - cutPtVertArray[op0 + 1];
        P20[2] = cutPtVertArray[op2 + 2] - cutPtVertArray[op0 + 2];

        cross(P20, P10);

        cutPtNormalArray[op0] += Normal[0];
        cutPtNormalArray[op0 + 1] += Normal[1];
        cutPtNormalArray[op0 + 2] += Normal[2];

        cutPtNormalArray[op1] += Normal[0];
        cutPtNormalArray[op1 + 1] += Normal[1];
        cutPtNormalArray[op1 + 2] += Normal[2];

        cutPtNormalArray[op2] += Normal[0];
        cutPtNormalArray[op2 + 1] += Normal[1];
        cutPtNormalArray[op2 + 2] += Normal[2];
      };
    }

    let VertexInterpOnCubeEdge: (cube: Cube, edge: number) => void;

    {
      const EPSILON = 1e-3;
      const isolevel = this.input.isoValue;
      const gridVertexField = this.gridVertexField;
      const gridVertexArray = this.gridVertexArray;

      let p0: number;
      let p1: number;
      let scalar0: number;
      let scalar1: number;
      let p0_x = 0;
      let p0_y = 0;
      let p0_z = 0;
      let p1_x = 0;
      let p1_y = 0;
      let p1_z = 0;

      VertexInterpOnCubeEdge = (cube: Cube, edge: number) => {
        const oX = edge * 3;
        const oY = oX + 1;
        const oZ = oX + 2;

        p0 = cube.edgeVertex[edge * 2];
        p1 = cube.edgeVertex[edge * 2 + 1];

        scalar0 = gridVertexField[p0];
        scalar1 = gridVertexField[p1];

        p0 *= 3;
        p1 *= 3;

        p0_x = gridVertexArray[p0];
        p0_y = gridVertexArray[p0 + 1];
        p0_z = gridVertexArray[p0 + 2];

        p1_x = gridVertexArray[p1];
        p1_y = gridVertexArray[p1 + 1];
        p1_z = gridVertexArray[p1 + 2];

        if (Math.abs(isolevel - scalar0) < EPSILON) {
          triangVertex[oX] = p0_x;
          triangVertex[oY] = p0_y;
          triangVertex[oZ] = p0_z;
        } else if (Math.abs(isolevel - scalar1) < EPSILON) {
          triangVertex[oX] = p1_x;
          triangVertex[oY] = p1_y;
          triangVertex[oZ] = p1_z;
        } else if (Math.abs(scalar0 - scalar1) < EPSILON) {
          triangVertex[oX] = p0_x;
          triangVertex[oY] = p0_y;
          triangVertex[oZ] = p0_z;
        } else {
          const mu = (isolevel - scalar0) / (scalar1 - scalar0);

          triangVertex[oX] = p0_x + mu * (p1_x - p0_x);
          triangVertex[oY] = p0_y + mu * (p1_y - p0_y);
          triangVertex[oZ] = p0_z + mu * (p1_z - p0_z);
        }
      };
    }
  }

  private buildGrid() {
    const { box, resolution } = this.input;

    const N = vec3.ceil(
      vec3.divideScalar(vec3.dR(box.min, box.max), resolution)
    );

    console.log(`nX: ${N[0]}; nY: ${N[1]}; nZ: ${N[2]}`);

    const [nX, nY, nZ] = N;

    const vertexCount = (nX + 1) * (nY + 1) * (nZ + 1);
    const gridVertexArray = new Float32Array(vertexCount * 3);
    const gridVertexField = new Float32Array(vertexCount);

    /**
     * 🥲 should be: `nz * (nx + 1) * (ny + 1) + nx * (nz + 1) * (ny + 1) + nz * (nx + 1) * (ny + 1)`
     * **/
    const edgesCount =
      nZ * (nX + 1) * (nY + 1) +
      nX * (nZ + 1) * (nY + 1) +
      nZ * (nX + 1) * (nY + 1);

    const indexArray = new Uint32Array(edgesCount);
    this.isEdgeCutPtComputed = new Int32Array(edgesCount).fill(-1);

    const cutPtCount = edgesCount * 3;

    console.log("Edges: ", edgesCount);
    console.log("Cut Pts: ", cutPtCount);

    this.cutPtVertArray = new Float32Array(cutPtCount);
    this.cutPtColorArray = new Float32Array(cutPtCount);
    this.cutPtNormalArray = new Float32Array(cutPtCount);

    this.gridVertexArray = gridVertexArray;
    this.gridVertexField = gridVertexField;
    this.cutPtIndexArray = indexArray;

    let i = 0;
    let iX = 0;
    let vx = 0;
    let vy = 0;
    let vz = 0;

    const tx = box.min[0];
    const ty = box.min[1];
    const tz = box.min[2];

    const cubes: Cube[] = [];

    for (let x = 0; x <= nX; x += 1) {
      vx = x * resolution;
      for (let y = 0; y <= nY; y += 1) {
        vy = y * resolution;
        for (let z = 0; z <= nZ; z += 1) {
          vz = z * resolution;

          iX = i * 3;
          gridVertexArray[iX] = tx + vx;
          gridVertexArray[iX + 1] = ty + vy;
          gridVertexArray[iX + 2] = tz + vz;

          i += 1;
        }
      }
    }

    /**
     * vertex count on X,Y,Z
     */
    const N2: Vec3 = [nX + 1, nY + 1, nZ + 1];
    for (let x = 0; x < nX; x += 1) {
      for (let y = 0; y < nY; y += 1) {
        for (let z = 0; z < nZ; z += 1) {
          cubes.push(new Cube(this, x, y, z, N2));
        }
      }
    }

    {
      this.cubes = cubes;
      const vertexPair2EdgeIndexMap = new Map<string, number>();
      let edgeIndexCursor = 0;

      for (const cube of cubes) {
        let j = 0;

        for (let i = 0; i < 24; i += 2) {
          const p0 = cube.edgeVertex[i];
          const p1 = cube.edgeVertex[i + 1];

          const key = `${p0}.${p1}`; // no order!
          if (vertexPair2EdgeIndexMap.has(key)) {
            const edgeIndex = vertexPair2EdgeIndexMap.get(key);
            cube.edgeIndices[j] = edgeIndex;
          } else {
            const edgeIndex = edgeIndexCursor++;
            vertexPair2EdgeIndexMap.set(key, edgeIndex);
            vertexPair2EdgeIndexMap.set(`${p1}.${p0}`, edgeIndex);
            cube.edgeIndices[j] = edgeIndex;
          }

          j += 1;
        }
      }

      vertexPair2EdgeIndexMap.clear();
    }

    const gridLines = new THREE.LineSegments(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({
        color: 0xfe0198,
      })
    );

    gridLines.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(gridVertexArray, 3)
    );

    /** @todo improve */
    gridLines.geometry.setIndex(cubes.flatMap((cube) => [...cube.edgeVertex]));

    this.cutVertexPts = new THREE.Points(
      new THREE.BufferGeometry(),
      new THREE.PointsMaterial({
        size: 5,
        sizeAttenuation: false,
        color: 0x000000,
      })
    );

    this.cubesGrid = gridLines;
  }

  renderAsSurface = () => {
    const vic = this.vertIndexCount;
    // console.log("vertIndexCount:", vic);
    const geometry = this.surface.geometry;

    const attrib0 = new THREE.BufferAttribute(this.cutPtVertArray, 3);
    const attrib1 = new THREE.BufferAttribute(this.cutPtColorArray, 3);
    const attrib2 = new THREE.BufferAttribute(this.cutPtNormalArray, 3);
    const attrib3 = new THREE.BufferAttribute(
      this.cutPtIndexArray.slice(0, vic),
      1
    );

    geometry.setAttribute("position", attrib0);
    geometry.setAttribute("color", attrib1);
    geometry.setAttribute("normal", attrib2);
    geometry.setIndex(attrib3);
  };

  renderAsPoints = () => {
    // console.log("vert count", this.vertCount);

    this.cutVertexPts.geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        this.gridVertexArray.slice(0, this.vertCount),
        3
      )
    );
  };
}

class Cube {
  readonly vertex0: number;
  readonly vertex1: number;
  readonly vertex2: number;
  readonly vertex3: number;
  readonly vertex4: number;
  readonly vertex5: number;
  readonly vertex6: number;
  readonly vertex7: number;

  readonly vertexInArray = new Uint32Array(8);
  /**
   * [(p0,p1),(p1,p2),...]
   */
  readonly edgeVertex = new Uint32Array(24);
  /**
   * considered re-used
   * [0,1,3, 3,4,5,...]
   */
  readonly edgeIndices = new Uint32Array(12);

  constructor(
    readonly manager: MarchingCubes,
    readonly x: number,
    readonly y: number,
    readonly z: number,
    readonly N: Vec3
  ) {
    const [, nY, nZ] = N;

    this.vertex0 = x * nY * nZ + y * nZ + z;
    this.vertex1 = this.vertex0 + nY * nZ;
    this.vertex2 = this.vertex1 + 1;
    this.vertex3 = this.vertex0 + 1;

    this.vertex4 = this.vertex0 + nZ;
    this.vertex5 = this.vertex1 + nZ;
    this.vertex6 = this.vertex2 + nZ;
    this.vertex7 = this.vertex3 + nZ;

    this.vertexInArray[0] = this.vertex0;
    this.vertexInArray[1] = this.vertex1;
    this.vertexInArray[2] = this.vertex2;
    this.vertexInArray[3] = this.vertex3;
    this.vertexInArray[4] = this.vertex4;
    this.vertexInArray[5] = this.vertex5;
    this.vertexInArray[6] = this.vertex6;
    this.vertexInArray[7] = this.vertex7;

    for (let i = 0; i < 24; i++) {
      this.edgeVertex[i] = this.vertexInArray[cubesIndexToLineSegments[i]];
    }
  }

  private iDraw = 0;
  /**
   * for test, it's not a problem.
   * @private
   */
  drawEdgeByEdge() {
    if (this.iDraw === 12) return [null, null];
    const P0 = this.edgeVertex[this.iDraw * 2];
    const P1 = this.edgeVertex[this.iDraw * 2 + 1];
    this.iDraw += 1;
    return [P0, P1];
  }
}

export interface MarchingCubes {
  march(): void;
}

// https://paulbourke.net/geometry/polygonise/

const cubeEdges = [
  [0, 1], // 0
  [1, 2], // 1
  [2, 3], // 2
  [3, 0], // 3
  [4, 5], // 4
  [5, 6], // 5
  [6, 7], // 6
  [7, 4], // 7
  [4, 0], // 8
  [5, 1], // 9
  [6, 2], // 10
  [7, 3], // 11
];

const cubesIndexToLineSegments = cubeEdges.flat();
