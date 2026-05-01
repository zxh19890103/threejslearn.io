import * as THREE from 'three';

export declare namespace BarkType {
    let Birch: string;
    let Oak: string;
    let Pine: string;
    let Willow: string;
}

export declare namespace Billboard {
    let Single: string;
    let Double: string;
}

declare class Branch {
    /**
     * Generates a new branch
     * @param {THREE.Vector3} origin The starting point of the branch
     * @param {THREE.Euler} orientation The starting orientation of the branch
     * @param {number} length The length of the branch
     * @param {number} radius The radius of the branch at its starting point
     */
    constructor(origin?: THREE.Vector3, orientation?: THREE.Euler, length?: number, radius?: number, level?: number, sectionCount?: number, segmentCount?: number);
    origin: THREE.Vector3;
    orientation: THREE.Euler;
    length: number;
    radius: number;
    level: number;
    sectionCount: number;
    segmentCount: number;
}

export declare namespace LeafType {
    let Ash: string;
    let Aspen: string;
    let Pine_1: string;
        { Pine_1 as Pine };
    let Oak_1: string;
        { Oak_1 as Oak };
}

declare class RNG {
    constructor(seed: any);
    m_w: number;
    m_z: number;
    mask: number;
    /**
     * Returns a random number between min and max
     */
    random(max?: number, min?: number): number;
}

export declare class Tree extends THREE.Group<THREE.Object3DEventMap> {
    /**
     * @param {TreeOptions} params
     */
    constructor(options?: TreeOptions);
    /**
     * @type {RNG}
     */
    rng: RNG;
    /**
     * @type {TreeOptions}
     */
    options: TreeOptions;
    /**
     * @type {Branch[]}
     */
    branchQueue: Branch[];
    branchesMesh: THREE.Mesh<THREE.BufferGeometry<THREE.NormalBufferAttributes>, THREE.Material | THREE.Material[], THREE.Object3DEventMap>;
    leavesMesh: THREE.Mesh<THREE.BufferGeometry<THREE.NormalBufferAttributes>, THREE.Material | THREE.Material[], THREE.Object3DEventMap>;
    trellisMesh: Trellis;
    update(elapsedTime: any): void;
    /**
     * Loads a preset tree from JSON
     * @param {string} preset
     */
    loadPreset(name: any): void;
    /**
     * Loads a tree from JSON
     * @param {TreeOptions} json
     */
    loadFromJson(json: TreeOptions): void;
    /**
     * Generate a new tree
     */
    generate(): void;
    branches: {
        verts: any[];
        normals: any[];
        indices: any[];
        uvs: any[];
        windFactor: any[];
    };
    leaves: {
        verts: any[];
        normals: any[];
        indices: any[];
        uvs: any[];
    };
    /**
     * Generates a new branch
     * @param {Branch} branch
     * @returns
     */
    generateBranch(branch: Branch): void;
    /**
     * Generate branches from a parent branch
     * @param {number} count The number of child branches to generate
     * @param {number} level The level of the child branches
     * @param {{
             *  origin: THREE.Vector3,
             *  orientation: THREE.Euler,
             *  radius: number
             * }[]} sections The parent branch's sections
     * @returns
     */
    generateChildBranches(count: number, level: number, sections: {
        origin: THREE.Vector3;
        orientation: THREE.Euler;
        radius: number;
    }[]): void;
    /**
     * Logic for spawning child branches from a parent branch's section
     * @param {{
             *  origin: THREE.Vector3,
             *  orientation: THREE.Euler,
             *  radius: number
             * }[]} sections The parent branch's sections
     * @returns
     */
    generateLeaves(sections: {
        origin: THREE.Vector3;
        orientation: THREE.Euler;
        radius: number;
    }[]): void;
    /**
     * Generates a leaves
     * @param {THREE.Vector3} origin The starting point of the branch
     * @param {THREE.Euler} orientation The starting orientation of the branch
     */
    generateLeaf(origin: THREE.Vector3, orientation: THREE.Euler): void;
    /**
     * Generates the indices for branch geometry
     * @param {Branch} branch
     */
    generateBranchIndices(indexOffset: any, branch: Branch): void;
    /**
     * Generates the geometry for the branches
     */
    createBranchesGeometry(): void;
    /**
     * Generates the geometry for the leaves
     */
    createLeavesGeometry(): void;
    /**
     * Create or update the trellis geometry
     */
    createTrellis(): void;
    /**
     * Find the nearest point on the trellis grid to a given position
     * @param {THREE.Vector3} position
     * @returns {THREE.Vector3}
     */
    getNearestTrellisPoint(position: THREE.Vector3): THREE.Vector3;
    /**
     * Calculate the force vector toward the nearest trellis point
     * @param {THREE.Vector3} position Current section position
     * @param {number} radius Current section radius
     * @returns {{ direction: THREE.Vector3, strength: number } | null}
     */
    calculateTrellisForce(position: THREE.Vector3, radius: number): {
        direction: THREE.Vector3;
        strength: number;
    } | null;
    get vertexCount(): number;
    get triangleCount(): number;
}

declare class TreeOptions {
    seed: number;
    type: string;
    bark: {
        type: string;
        tint: number;
        flatShading: boolean;
        textured: boolean;
        textureScale: {
            x: number;
            y: number;
        };
    };
    branch: {
        levels: number;
        angle: {
            1: number;
            2: number;
            3: number;
        };
        children: {
            0: number;
            1: number;
            2: number;
        };
        force: {
            direction: {
                x: number;
                y: number;
                z: number;
            };
            strength: number;
        };
        gnarliness: {
            0: number;
            1: number;
            2: number;
            3: number;
        };
        length: {
            0: number;
            1: number;
            2: number;
            3: number;
        };
        radius: {
            0: number;
            1: number;
            2: number;
            3: number;
        };
        sections: {
            0: number;
            1: number;
            2: number;
            3: number;
        };
        segments: {
            0: number;
            1: number;
            2: number;
            3: number;
        };
        start: {
            1: number;
            2: number;
            3: number;
        };
        taper: {
            0: number;
            1: number;
            2: number;
            3: number;
        };
        twist: {
            0: number;
            1: number;
            2: number;
            3: number;
        };
    };
    leaves: {
        type: string;
        billboard: string;
        angle: number;
        count: number;
        start: number;
        size: number;
        sizeVariance: number;
        tint: number;
        alphaTest: number;
    };
    trellis: {
        enabled: boolean;
        position: {
            x: number;
            y: number;
            z: number;
        };
        width: number;
        height: number;
        spacing: number;
        force: {
            strength: number;
            maxDistance: number;
            falloff: number;
        };
        cylinderRadius: number;
        visible: boolean;
        color: number;
    };
    /**
     * Copies the values from source into this object
     * @param {TreeOptions} source
     */
    copy(source: TreeOptions, target?: this): void;
}

export declare const TreePreset: {
    'Ash Small': {
        seed: number;
        type: string;
        bark: {
            type: string;
            tint: number;
            flatShading: boolean;
            textured: boolean;
            textureScale: {
                x: number;
                y: number;
            };
        };
        branch: {
            levels: number;
            angle: {
                "1": number;
                "2": number;
                "3": number;
            };
            children: {
                "0": number;
                "1": number;
                "2": number;
            };
            force: {
                direction: {
                    x: number;
                    y: number;
                    z: number;
                };
                strength: number;
            };
            gnarliness: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            length: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            radius: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            sections: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            segments: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            start: {
                "1": number;
                "2": number;
                "3": number;
            };
            taper: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            twist: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
        };
        leaves: {
            type: string;
            billboard: string;
            angle: number;
            count: number;
            start: number;
            size: number;
            sizeVariance: number;
            tint: number;
            alphaTest: number;
        };
        trellis: {
            enabled: boolean;
        };
    };
    'Ash Medium': {
        seed: number;
        type: string;
        bark: {
            type: string;
            tint: number;
            flatShading: boolean;
            textured: boolean;
            textureScale: {
                x: number;
                y: number;
            };
        };
        branch: {
            levels: number;
            angle: {
                "1": number;
                "2": number;
                "3": number;
            };
            children: {
                "0": number;
                "1": number;
                "2": number;
            };
            force: {
                direction: {
                    x: number;
                    y: number;
                    z: number;
                };
                strength: number;
            };
            gnarliness: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            length: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            radius: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            sections: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            segments: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            start: {
                "1": number;
                "2": number;
                "3": number;
            };
            taper: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            twist: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
        };
        leaves: {
            type: string;
            billboard: string;
            angle: number;
            count: number;
            start: number;
            size: number;
            sizeVariance: number;
            tint: number;
            alphaTest: number;
        };
        trellis: {
            enabled: boolean;
        };
    };
    'Ash Large': {
        seed: number;
        type: string;
        bark: {
            type: string;
            tint: number;
            flatShading: boolean;
            textured: boolean;
            textureScale: {
                x: number;
                y: number;
            };
        };
        branch: {
            levels: number;
            angle: {
                "1": number;
                "2": number;
                "3": number;
            };
            children: {
                "0": number;
                "1": number;
                "2": number;
            };
            force: {
                direction: {
                    x: number;
                    y: number;
                    z: number;
                };
                strength: number;
            };
            gnarliness: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            length: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            radius: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            sections: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            segments: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            start: {
                "1": number;
                "2": number;
                "3": number;
            };
            taper: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            twist: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
        };
        leaves: {
            type: string;
            billboard: string;
            angle: number;
            count: number;
            start: number;
            size: number;
            sizeVariance: number;
            tint: number;
            alphaTest: number;
        };
        trellis: {
            enabled: boolean;
        };
    };
    'Aspen Small': {
        seed: number;
        type: string;
        bark: {
            type: string;
            tint: number;
            flatShading: boolean;
            textured: boolean;
            textureScale: {
                x: number;
                y: number;
            };
        };
        branch: {
            levels: number;
            angle: {
                "1": number;
                "2": number;
                "3": number;
            };
            children: {
                "0": number;
                "1": number;
                "2": number;
            };
            force: {
                direction: {
                    x: number;
                    y: number;
                    z: number;
                };
                strength: number;
            };
            gnarliness: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            length: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            radius: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            sections: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            segments: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            start: {
                "1": number;
                "2": number;
                "3": number;
            };
            taper: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            twist: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
        };
        leaves: {
            type: string;
            billboard: string;
            angle: number;
            count: number;
            start: number;
            size: number;
            sizeVariance: number;
            tint: number;
            alphaTest: number;
        };
        trellis: {
            enabled: boolean;
        };
    };
    'Aspen Medium': {
        seed: number;
        type: string;
        bark: {
            type: string;
            tint: number;
            flatShading: boolean;
            textured: boolean;
            textureScale: {
                x: number;
                y: number;
            };
        };
        branch: {
            levels: number;
            angle: {
                "1": number;
                "2": number;
                "3": number;
            };
            children: {
                "0": number;
                "1": number;
                "2": number;
            };
            force: {
                direction: {
                    x: number;
                    y: number;
                    z: number;
                };
                strength: number;
            };
            gnarliness: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            length: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            radius: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            sections: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            segments: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            start: {
                "1": number;
                "2": number;
                "3": number;
            };
            taper: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            twist: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
        };
        leaves: {
            type: string;
            billboard: string;
            angle: number;
            count: number;
            start: number;
            size: number;
            sizeVariance: number;
            tint: number;
            alphaTest: number;
        };
        trellis: {
            enabled: boolean;
        };
    };
    'Aspen Large': {
        seed: number;
        type: string;
        bark: {
            type: string;
            tint: number;
            flatShading: boolean;
            textured: boolean;
            textureScale: {
                x: number;
                y: number;
            };
        };
        branch: {
            levels: number;
            angle: {
                "1": number;
                "2": number;
                "3": number;
            };
            children: {
                "0": number;
                "1": number;
                "2": number;
            };
            force: {
                direction: {
                    x: number;
                    y: number;
                    z: number;
                };
                strength: number;
            };
            gnarliness: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            length: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            radius: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            sections: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            segments: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            start: {
                "1": number;
                "2": number;
                "3": number;
            };
            taper: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            twist: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
        };
        leaves: {
            type: string;
            billboard: string;
            angle: number;
            count: number;
            start: number;
            size: number;
            sizeVariance: number;
            tint: number;
            alphaTest: number;
        };
        trellis: {
            enabled: boolean;
        };
    };
    'Bush 1': {
        seed: number;
        type: string;
        bark: {
            type: string;
            tint: number;
            flatShading: boolean;
            textured: boolean;
            textureScale: {
                x: number;
                y: number;
            };
        };
        branch: {
            levels: number;
            angle: {
                "1": number;
                "2": number;
                "3": number;
            };
            children: {
                "0": number;
                "1": number;
                "2": number;
            };
            force: {
                direction: {
                    x: number;
                    y: number;
                    z: number;
                };
                strength: number;
            };
            gnarliness: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            length: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            radius: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            sections: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            segments: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            start: {
                "1": number;
                "2": number;
                "3": number;
            };
            taper: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            twist: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
        };
        leaves: {
            type: string;
            billboard: string;
            angle: number;
            count: number;
            start: number;
            size: number;
            sizeVariance: number;
            tint: number;
            alphaTest: number;
        };
        trellis: {
            enabled: boolean;
        };
    };
    'Bush 2': {
        seed: number;
        type: string;
        bark: {
            type: string;
            tint: number;
            flatShading: boolean;
            textured: boolean;
            textureScale: {
                x: number;
                y: number;
            };
        };
        branch: {
            levels: number;
            angle: {
                "1": number;
                "2": number;
                "3": number;
            };
            children: {
                "0": number;
                "1": number;
                "2": number;
            };
            force: {
                direction: {
                    x: number;
                    y: number;
                    z: number;
                };
                strength: number;
            };
            gnarliness: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            length: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            radius: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            sections: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            segments: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            start: {
                "1": number;
                "2": number;
                "3": number;
            };
            taper: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            twist: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
        };
        leaves: {
            type: string;
            billboard: string;
            angle: number;
            count: number;
            start: number;
            size: number;
            sizeVariance: number;
            tint: number;
            alphaTest: number;
        };
        trellis: {
            enabled: boolean;
        };
    };
    'Bush 3': {
        seed: number;
        type: string;
        bark: {
            type: string;
            tint: number;
            flatShading: boolean;
            textured: boolean;
            textureScale: {
                x: number;
                y: number;
            };
        };
        branch: {
            levels: number;
            angle: {
                "1": number;
                "2": number;
                "3": number;
            };
            children: {
                "0": number;
                "1": number;
                "2": number;
            };
            force: {
                direction: {
                    x: number;
                    y: number;
                    z: number;
                };
                strength: number;
            };
            gnarliness: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            length: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            radius: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            sections: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            segments: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            start: {
                "1": number;
                "2": number;
                "3": number;
            };
            taper: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            twist: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
        };
        leaves: {
            type: string;
            billboard: string;
            angle: number;
            count: number;
            start: number;
            size: number;
            sizeVariance: number;
            tint: number;
            alphaTest: number;
        };
        trellis: {
            enabled: boolean;
        };
    };
    'Oak Small': {
        seed: number;
        type: string;
        bark: {
            type: string;
            tint: number;
            flatShading: boolean;
            textured: boolean;
            textureScale: {
                x: number;
                y: number;
            };
        };
        branch: {
            levels: number;
            angle: {
                "1": number;
                "2": number;
                "3": number;
            };
            children: {
                "0": number;
                "1": number;
                "2": number;
            };
            force: {
                direction: {
                    x: number;
                    y: number;
                    z: number;
                };
                strength: number;
            };
            gnarliness: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            length: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            radius: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            sections: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            segments: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            start: {
                "1": number;
                "2": number;
                "3": number;
            };
            taper: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            twist: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
        };
        leaves: {
            type: string;
            billboard: string;
            angle: number;
            count: number;
            start: number;
            size: number;
            sizeVariance: number;
            tint: number;
            alphaTest: number;
        };
        trellis: {
            enabled: boolean;
        };
    };
    'Oak Medium': {
        seed: number;
        type: string;
        bark: {
            type: string;
            tint: number;
            flatShading: boolean;
            textured: boolean;
            textureScale: {
                x: number;
                y: number;
            };
        };
        branch: {
            levels: number;
            angle: {
                "1": number;
                "2": number;
                "3": number;
            };
            children: {
                "0": number;
                "1": number;
                "2": number;
            };
            force: {
                direction: {
                    x: number;
                    y: number;
                    z: number;
                };
                strength: number;
            };
            gnarliness: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            length: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            radius: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            sections: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            segments: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            start: {
                "1": number;
                "2": number;
                "3": number;
            };
            taper: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            twist: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
        };
        leaves: {
            type: string;
            billboard: string;
            angle: number;
            count: number;
            start: number;
            size: number;
            sizeVariance: number;
            tint: number;
            alphaTest: number;
        };
        trellis: {
            enabled: boolean;
        };
    };
    'Oak Large': {
        seed: number;
        type: string;
        bark: {
            type: string;
            tint: number;
            flatShading: boolean;
            textured: boolean;
            textureScale: {
                x: number;
                y: number;
            };
        };
        branch: {
            levels: number;
            angle: {
                "1": number;
                "2": number;
                "3": number;
            };
            children: {
                "0": number;
                "1": number;
                "2": number;
            };
            force: {
                direction: {
                    x: number;
                    y: number;
                    z: number;
                };
                strength: number;
            };
            gnarliness: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            length: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            radius: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            sections: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            segments: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            start: {
                "1": number;
                "2": number;
                "3": number;
            };
            taper: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            twist: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
        };
        leaves: {
            type: string;
            billboard: string;
            angle: number;
            count: number;
            start: number;
            size: number;
            sizeVariance: number;
            tint: number;
            alphaTest: number;
        };
        trellis: {
            enabled: boolean;
        };
    };
    'Pine Small': {
        seed: number;
        type: string;
        bark: {
            type: string;
            tint: number;
            flatShading: boolean;
            textured: boolean;
            textureScale: {
                x: number;
                y: number;
            };
        };
        branch: {
            levels: number;
            angle: {
                "1": number;
                "2": number;
                "3": number;
            };
            children: {
                "0": number;
                "1": number;
                "2": number;
            };
            force: {
                direction: {
                    x: number;
                    y: number;
                    z: number;
                };
                strength: number;
            };
            gnarliness: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            length: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            radius: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            sections: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            segments: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            start: {
                "1": number;
                "2": number;
                "3": number;
            };
            taper: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            twist: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
        };
        leaves: {
            type: string;
            billboard: string;
            angle: number;
            count: number;
            start: number;
            size: number;
            sizeVariance: number;
            tint: number;
            alphaTest: number;
        };
        trellis: {
            enabled: boolean;
        };
    };
    'Pine Medium': {
        seed: number;
        type: string;
        bark: {
            type: string;
            tint: number;
            flatShading: boolean;
            textured: boolean;
            textureScale: {
                x: number;
                y: number;
            };
        };
        branch: {
            levels: number;
            angle: {
                "1": number;
                "2": number;
                "3": number;
            };
            children: {
                "0": number;
                "1": number;
                "2": number;
            };
            force: {
                direction: {
                    x: number;
                    y: number;
                    z: number;
                };
                strength: number;
            };
            gnarliness: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            length: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            radius: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            sections: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            segments: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            start: {
                "1": number;
                "2": number;
                "3": number;
            };
            taper: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            twist: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
        };
        leaves: {
            type: string;
            billboard: string;
            angle: number;
            count: number;
            start: number;
            size: number;
            sizeVariance: number;
            tint: number;
            alphaTest: number;
        };
        trellis: {
            enabled: boolean;
        };
    };
    'Pine Large': {
        seed: number;
        type: string;
        bark: {
            type: string;
            tint: number;
            flatShading: boolean;
            textured: boolean;
            textureScale: {
                x: number;
                y: number;
            };
        };
        branch: {
            levels: number;
            angle: {
                "1": number;
                "2": number;
                "3": number;
            };
            children: {
                "0": number;
                "1": number;
                "2": number;
            };
            force: {
                direction: {
                    x: number;
                    y: number;
                    z: number;
                };
                strength: number;
            };
            gnarliness: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            length: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            radius: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            sections: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            segments: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            start: {
                "1": number;
                "2": number;
                "3": number;
            };
            taper: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            twist: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
        };
        leaves: {
            type: string;
            billboard: string;
            angle: number;
            count: number;
            start: number;
            size: number;
            sizeVariance: number;
            tint: number;
            alphaTest: number;
        };
        trellis: {
            enabled: boolean;
        };
    };
    Trellis: {
        seed: number;
        type: string;
        bark: {
            type: string;
            tint: number;
            flatShading: boolean;
            textured: boolean;
            textureScale: {
                x: number;
                y: number;
            };
        };
        branch: {
            levels: number;
            angle: {
                "1": number;
                "2": number;
                "3": number;
            };
            children: {
                "0": number;
                "1": number;
                "2": number;
            };
            force: {
                direction: {
                    x: number;
                    y: number;
                    z: number;
                };
                strength: number;
            };
            gnarliness: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            length: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            radius: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            sections: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            segments: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            start: {
                "1": number;
                "2": number;
                "3": number;
            };
            taper: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            twist: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
        };
        leaves: {
            type: string;
            billboard: string;
            angle: number;
            count: number;
            start: number;
            size: number;
            sizeVariance: number;
            tint: number;
            alphaTest: number;
        };
        trellis: {
            enabled: boolean;
            position: {
                x: number;
                y: number;
                z: number;
            };
            width: number;
            height: number;
            spacing: number;
            force: {
                strength: number;
                maxDistance: number;
                falloff: number;
            };
            cylinderRadius: number;
            visible: boolean;
            color: number;
        };
    };
};

export declare namespace TreeType {
    let Deciduous: string;
    let Evergreen: string;
}

/**
 * Trellis structure for guiding tree branch growth
 * Creates a grid of cylinders that branches can be attracted to
 */
export declare class Trellis extends THREE.Group<THREE.Object3DEventMap> {
    /**
     * @param {Object} options Trellis configuration
     */
    constructor(options: any);
    options: any;
    material: THREE.MeshStandardMaterial;
    hCylinderGeo: THREE.CylinderGeometry;
    vCylinderGeo: THREE.CylinderGeometry;
    /**
     * Generate the trellis geometry
     */
    generate(): void;
    /**
     * Find the nearest point on the trellis grid to a given position
     * @param {THREE.Vector3} position
     * @returns {THREE.Vector3}
     */
    getNearestPoint(position: THREE.Vector3): THREE.Vector3;
    /**
     * Clean up geometry and materials
     */
    dispose(): void;
}

export { }

export namespace BarkType {
    let Birch: string;
    let Oak: string;
    let Pine: string;
    let Willow: string;
}


export namespace Billboard {
    let Single: string;
    let Double: string;
}


export namespace TreeType {
    let Deciduous: string;
    let Evergreen: string;
}

