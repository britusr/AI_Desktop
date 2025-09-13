import { Object3D, AnimationClip, SkinnedMesh, Material, AnimationMixer } from 'three';

// GLTF types
export interface GLTF {
  animations: AnimationClip[];
  scene: Object3D;
  scenes: Object3D[];
  cameras: Object3D[];
  asset: {
    copyright?: string;
    generator?: string;
    version?: string;
    minVersion?: string;
    extensions?: any;
    extras?: any;
  };
  parser: any;
  userData: any;
}

declare module 'three/examples/jsm/loaders/GLTFLoader' {
  export class GLTFLoader {
    constructor();
    load(
      url: string,
      onLoad: (gltf: GLTF) => void,
      onProgress?: (event: ProgressEvent) => void,
      onError?: (event: ErrorEvent) => void
    ): void;
    loadAsync(url: string): Promise<GLTF>;
    parse(
      data: ArrayBuffer | string,
      path: string,
      onLoad: (gltf: GLTF) => void,
      onError?: (event: ErrorEvent) => void
    ): void;
    parseAsync(data: ArrayBuffer | string, path: string): Promise<GLTF>;
    setDRACOLoader(dracoLoader: any): GLTFLoader;
    setKTX2Loader(ktx2Loader: any): GLTFLoader;
    setMeshoptDecoder(meshoptDecoder: any): GLTFLoader;
  }
}

// Extended types for Ready Player Me avatars
export interface ReadyPlayerMeGLTF extends GLTF {
  animations: AnimationClip[];
  scene: Object3D & {
    traverse: (callback: (object: Object3D) => void) => void;
  };
}

export interface AvatarMesh extends SkinnedMesh {
  morphTargetInfluences?: number[];
  morphTargetDictionary?: { [key: string]: number };
  material: Material | Material[];
}

export interface AvatarBone extends Object3D {
  name: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number; w: number };
  scale: { x: number; y: number; z: number };
}

// Extend AnimationMixer to include dispose method
declare module 'three' {
  interface AnimationMixer {
    dispose(): void;
  }
}