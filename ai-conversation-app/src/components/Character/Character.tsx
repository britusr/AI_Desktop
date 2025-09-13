// @ts-nocheck
import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Canvas, useFrame, extend } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows, useGLTF } from '@react-three/drei';
import * as THREE from 'three';

// Extend Three.js objects for JSX usage
extend(THREE);
import { useCharacterAnimation, useLipSync } from '../../hooks';
import { VisemeData } from '../../types/audio';
import { ReadyPlayerMeGLTF, AvatarMesh, GLTF } from '../../types/three';

interface CharacterProps {
  avatarUrl?: string;
  visemeData?: VisemeData;
  isListening: boolean;
  isSpeaking: boolean;
  emotion?: string;
  scale?: number;
  position?: [number, number, number];
}

interface AvatarModelProps {
  url: string;
  visemeData?: VisemeData;
  isListening: boolean;
  isSpeaking: boolean;
  emotion?: string;
  scale?: number;
  position?: [number, number, number];
}

const AvatarModel: React.FC<AvatarModelProps> = ({
  url,
  visemeData,
  isListening,
  isSpeaking,
  emotion = 'neutral',
  scale = 1,
  position = [0, 0, 0]
}) => {
  const meshRef = useRef<THREE.Group>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const actionsRef = useRef<{ [key: string]: THREE.AnimationAction }>({});
  const [avatarMeshes, setAvatarMeshes] = useState<AvatarMesh[]>([]);
  
  // Load GLTF model
  const gltf = useGLTF(url) as GLTF;
  
  // Initialize avatar and animations
  useEffect(() => {
    if (!gltf || !meshRef.current) return;

    const mixer = new THREE.AnimationMixer(gltf.scene);
    mixerRef.current = mixer;

    // Find all skinned meshes (face and body)
    const meshes: AvatarMesh[] = [];
    gltf.scene.traverse((child) => {
      if (child instanceof THREE.SkinnedMesh) {
        meshes.push(child as AvatarMesh);
      }
    });
    setAvatarMeshes(meshes);

    // Setup default animations if available
     if (gltf.animations && gltf.animations.length > 0) {
       gltf.animations.forEach((clip: THREE.AnimationClip) => {
         const action = mixer.clipAction(clip);
         actionsRef.current[clip.name] = action;
         
         // Auto-play idle animations
         if (clip.name.toLowerCase().includes('idle')) {
           action.play();
         }
       });
     }

    return () => {
      if (mixer && typeof mixer.dispose === 'function') {
        mixer.dispose();
      }
    };
  }, [gltf]);
  
  // Animation and lip sync
  const { currentAnimation, animationSpeed } = useCharacterAnimation({
    isListening,
    isSpeaking,
    emotion
  });
  
  const { lipSyncMorphTargets } = useLipSync({
    visemeData,
    isSpeaking
  });
  
  // Apply lip sync morph targets
  useEffect(() => {
    if (!avatarMeshes.length || !lipSyncMorphTargets) return;

    avatarMeshes.forEach((mesh) => {
       if (mesh.morphTargetInfluences && mesh.morphTargetDictionary) {
         Object.entries(lipSyncMorphTargets).forEach(([targetName, value]) => {
           const index = mesh.morphTargetDictionary![targetName];
           if (index !== undefined && mesh.morphTargetInfluences) {
             mesh.morphTargetInfluences[index] = value as number;
           }
         });
       }
     });
  }, [avatarMeshes, lipSyncMorphTargets]);
  
  // Apply emotion-based expressions
  useEffect(() => {
    if (!avatarMeshes.length) return;

    avatarMeshes.forEach((mesh) => {
      if (mesh.morphTargetInfluences && mesh.morphTargetDictionary) {
        // Reset emotion morph targets
         const emotionTargets = ['mouthSmileLeft', 'mouthSmileRight', 'mouthFrownLeft', 'mouthFrownRight', 'jawOpen', 'eyeWideLeft', 'eyeWideRight'];
         emotionTargets.forEach(target => {
           const index = mesh.morphTargetDictionary![target];
           if (index !== undefined && mesh.morphTargetInfluences) {
             mesh.morphTargetInfluences[index] = 0;
           }
         });

        // Apply current emotion
        switch (emotion) {
          case 'happy':
             ['mouthSmileLeft', 'mouthSmileRight'].forEach(target => {
               const index = mesh.morphTargetDictionary![target];
               if (index !== undefined && mesh.morphTargetInfluences) {
                 mesh.morphTargetInfluences[index] = 0.7;
               }
             });
             break;
           case 'sad':
             ['mouthFrownLeft', 'mouthFrownRight'].forEach(target => {
               const index = mesh.morphTargetDictionary![target];
               if (index !== undefined && mesh.morphTargetInfluences) {
                 mesh.morphTargetInfluences[index] = 0.5;
               }
             });
             break;
           case 'surprised':
             const jawIndex = mesh.morphTargetDictionary!['jawOpen'];
             const leftEyeIndex = mesh.morphTargetDictionary!['eyeWideLeft'];
             const rightEyeIndex = mesh.morphTargetDictionary!['eyeWideRight'];
             if (jawIndex !== undefined && mesh.morphTargetInfluences) {
               mesh.morphTargetInfluences[jawIndex] = 0.3;
             }
             if (leftEyeIndex !== undefined && mesh.morphTargetInfluences) {
               mesh.morphTargetInfluences[leftEyeIndex] = 0.8;
             }
             if (rightEyeIndex !== undefined && mesh.morphTargetInfluences) {
               mesh.morphTargetInfluences[rightEyeIndex] = 0.8;
             }
             break;
        }
      }
    });
  }, [avatarMeshes, emotion]);
  
  // Animation frame update
  useFrame((state, delta) => {
    if (mixerRef.current) {
      mixerRef.current.update(delta * animationSpeed);
    }

    // Add subtle breathing animation
    if (meshRef.current && currentAnimation === 'idle') {
      const time = state.clock.elapsedTime;
      meshRef.current.position.y = Math.sin(time * 2) * 0.01;
      meshRef.current.rotation.y = Math.sin(time * 0.5) * 0.02;
    }

    // Add blinking animation
    if (avatarMeshes.length > 0) {
      const time = state.clock.elapsedTime;
      const blinkFrequency = 3; // Blink every 3 seconds
      const blinkDuration = 0.15;
      const blinkPhase = (time % blinkFrequency) / blinkFrequency;
      
      if (blinkPhase < blinkDuration / blinkFrequency) {
        const blinkAmount = Math.sin((blinkPhase / (blinkDuration / blinkFrequency)) * Math.PI);
        
        avatarMeshes.forEach((mesh) => {
           if (mesh.morphTargetInfluences && mesh.morphTargetDictionary) {
             const leftEyeIndex = mesh.morphTargetDictionary['eyeBlinkLeft'];
             const rightEyeIndex = mesh.morphTargetDictionary['eyeBlinkRight'];
             
             if (leftEyeIndex !== undefined && mesh.morphTargetInfluences) {
               mesh.morphTargetInfluences[leftEyeIndex] = blinkAmount;
             }
             if (rightEyeIndex !== undefined && mesh.morphTargetInfluences) {
               mesh.morphTargetInfluences[rightEyeIndex] = blinkAmount;
             }
           }
         });
      }
    }
  });

  return (
    <group ref={meshRef} position={position} scale={scale} {...({} as any)}>
      <primitive object={gltf.scene} {...({} as any)} />
    </group>
  );
};

const Floor: React.FC = () => {
  return (
    <mesh receiveShadow position={[0, -2, 0]} rotation={[-Math.PI / 2, 0, 0]} {...({} as any)}>
      <planeGeometry args={[20, 20]} {...({} as any)} />
      <meshStandardMaterial 
        color="#f0f0f0" 
        roughness={0.8} 
        metalness={0.1}
        {...({} as any)}
      />
    </mesh>
  );
};

const Character: React.FC<CharacterProps> = ({
  avatarUrl = '',
  visemeData,
  isListening,
  isSpeaking,
  emotion = 'neutral',
  scale = 1,
  position = [0, -1, 0]
}) => {
  const defaultAvatarUrl = useMemo(() => {
    return avatarUrl || 'https://models.readyplayer.me/64bfa15f0e72c63d7c3934a6.glb';
  }, [avatarUrl]);

  return (
    <Canvas
      shadows
      camera={{ position: [0, 1.5, 3], fov: 50 }}
      style={{ width: '100%', height: '100vh' }}
    >
      <ambientLight intensity={0.4} {...({} as any)} />
      <directionalLight
        position={[5, 5, 5]}
        intensity={1}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={50}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
        {...({} as any)}
      />
      <pointLight position={[-5, 5, 5]} intensity={0.5} {...({} as any)} />
      
      <Environment preset="studio" />
      
      <Floor />
      
      <AvatarModel
        url={defaultAvatarUrl}
        visemeData={visemeData}
        isListening={isListening}
        isSpeaking={isSpeaking}
        emotion={emotion}
        scale={scale}
        position={position}
      />
      
      <ContactShadows
        position={[0, -1.99, 0]}
        opacity={0.4}
        scale={10}
        blur={1.5}
        far={4.5}
      />
      
      <OrbitControls
        enablePan={false}
        enableZoom={true}
        enableRotate={true}
        minDistance={2}
        maxDistance={8}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2}
        target={[0, 0, 0]}
      />
    </Canvas>
  );
};

export default Character;