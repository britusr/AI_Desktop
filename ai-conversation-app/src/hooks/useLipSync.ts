import { useState, useEffect, useCallback } from 'react';
import { VisemeData } from '../types/audio';

interface UseLipSyncProps {
  visemeData?: VisemeData;
  isSpeaking: boolean;
  smoothing?: number;
  intensity?: number;
}

interface LipSyncState {
  lipSyncMorphTargets: { [key: string]: number };
  currentViseme: string;
  isActive: boolean;
}

// ARKit-compatible viseme to morph target mapping
const VISEME_TO_MORPH_TARGET: { [key: string]: { [key: string]: number } } = {
  'sil': {}, // Silence - no morph targets
  'aa': { 'jawOpen': 0.7, 'mouthFunnel': 0.2 }, // 'a' in "father"
  'ae': { 'jawOpen': 0.5, 'mouthStretch': 0.3 }, // 'a' in "cat"
  'ah': { 'jawOpen': 0.4, 'mouthShrugLower': 0.2 }, // 'u' in "but"
  'ao': { 'mouthFunnel': 0.8, 'jawOpen': 0.3 }, // 'o' in "dog"
  'aw': { 'mouthFunnel': 0.9, 'jawOpen': 0.4 }, // 'ow' in "how"
  'ay': { 'jawOpen': 0.6, 'mouthSmileLeft': 0.3, 'mouthSmileRight': 0.3 }, // 'i' in "bite"
  'b': { 'mouthClose': 1.0, 'mouthPressLeft': 0.5, 'mouthPressRight': 0.5 }, // 'b' in "big"
  'ch': { 'mouthShrugUpper': 0.7, 'jawOpen': 0.2 }, // 'ch' in "chip"
  'd': { 'tongueOut': 0.6, 'jawOpen': 0.3 }, // 'd' in "dog"
  'dh': { 'tongueOut': 0.8, 'jawOpen': 0.2 }, // 'th' in "this"
  'eh': { 'jawOpen': 0.5, 'mouthStretch': 0.2 }, // 'e' in "bed"
  'er': { 'mouthFunnel': 0.6, 'jawOpen': 0.3 }, // 'ur' in "bird"
  'ey': { 'jawOpen': 0.4, 'mouthSmileLeft': 0.4, 'mouthSmileRight': 0.4 }, // 'a' in "cake"
  'f': { 'mouthLowerDownLeft': 0.8, 'mouthLowerDownRight': 0.8, 'mouthUpperUpLeft': 0.3, 'mouthUpperUpRight': 0.3 }, // 'f' in "fish"
  'g': { 'jawOpen': 0.4, 'mouthShrugLower': 0.3 }, // 'g' in "go"
  'hh': { 'jawOpen': 0.3, 'mouthDimpleLeft': 0.2, 'mouthDimpleRight': 0.2 }, // 'h' in "house"
  'ih': { 'mouthSmileLeft': 0.4, 'mouthSmileRight': 0.4, 'jawOpen': 0.2 }, // 'i' in "bit"
  'iy': { 'mouthSmileLeft': 0.7, 'mouthSmileRight': 0.7, 'jawOpen': 0.1 }, // 'ee' in "see"
  'jh': { 'mouthShrugUpper': 0.8, 'jawOpen': 0.3 }, // 'j' in "jump"
  'k': { 'jawOpen': 0.3, 'mouthShrugLower': 0.4 }, // 'k' in "cat"
  'l': { 'tongueOut': 0.7, 'jawOpen': 0.2 }, // 'l' in "love"
  'm': { 'mouthClose': 1.0, 'mouthPressLeft': 0.7, 'mouthPressRight': 0.7 }, // 'm' in "man"
  'n': { 'tongueOut': 0.5, 'mouthClose': 0.3 }, // 'n' in "no"
  'ng': { 'jawOpen': 0.2, 'mouthShrugLower': 0.5 }, // 'ng' in "sing"
  'ow': { 'mouthFunnel': 0.9, 'jawOpen': 0.4 }, // 'o' in "go"
  'oy': { 'mouthFunnel': 0.7, 'mouthSmileLeft': 0.3, 'mouthSmileRight': 0.3 }, // 'oy' in "boy"
  'p': { 'mouthClose': 1.0, 'mouthPressLeft': 0.8, 'mouthPressRight': 0.8 }, // 'p' in "put"
  'r': { 'mouthFunnel': 0.6, 'jawOpen': 0.2 }, // 'r' in "red"
  's': { 'mouthShrugUpper': 0.6, 'mouthShrugLower': 0.3 }, // 's' in "see"
  'sh': { 'mouthShrugUpper': 0.8, 'mouthFunnel': 0.4 }, // 'sh' in "ship"
  't': { 'tongueOut': 0.6, 'jawOpen': 0.2 }, // 't' in "top"
  'th': { 'tongueOut': 0.9, 'jawOpen': 0.1 }, // 'th' in "think"
  'uh': { 'mouthFunnel': 0.5, 'jawOpen': 0.3 }, // 'u' in "book"
  'uw': { 'mouthFunnel': 1.0, 'jawOpen': 0.2 }, // 'oo' in "food"
  'v': { 'mouthLowerDownLeft': 0.9, 'mouthLowerDownRight': 0.9, 'mouthUpperUpLeft': 0.4, 'mouthUpperUpRight': 0.4 }, // 'v' in "voice"
  'w': { 'mouthFunnel': 0.9, 'mouthPucker': 0.7 }, // 'w' in "water"
  'y': { 'mouthSmileLeft': 0.5, 'mouthSmileRight': 0.5, 'jawOpen': 0.2 }, // 'y' in "yes"
  'z': { 'mouthShrugUpper': 0.5, 'mouthShrugLower': 0.4 }, // 'z' in "zoo"
  'zh': { 'mouthShrugUpper': 0.7, 'mouthFunnel': 0.3 } // 's' in "measure"
};

export const useLipSync = ({
  visemeData,
  isSpeaking,
  smoothing = 0.3,
  intensity = 1.0
}: UseLipSyncProps): LipSyncState => {
  const [lipSyncMorphTargets, setLipSyncMorphTargets] = useState<{ [key: string]: number }>({});
  const [currentViseme, setCurrentViseme] = useState<string>('sil');
  const [isActive, setIsActive] = useState<boolean>(false);
  const [, setPreviousTargets] = useState<{ [key: string]: number }>({});

  // Smooth interpolation function
  const interpolateValue = useCallback((current: number, target: number, factor: number): number => {
    return current + (target - current) * factor;
  }, []);

  // Apply viseme data to morph targets
  useEffect(() => {
    if (!isSpeaking || !visemeData) {
      // Reset to neutral when not speaking
      setCurrentViseme('sil');
      setIsActive(false);
      
      // Smoothly transition to neutral
      setLipSyncMorphTargets(prev => {
        const newTargets: { [key: string]: number } = {};
        Object.keys(prev).forEach(key => {
          newTargets[key] = interpolateValue(prev[key] || 0, 0, 1 - smoothing);
        });
        return newTargets;
      });
      return;
    }

    setIsActive(true);
    setCurrentViseme(visemeData.phoneme);

    // Get target morph values for the current viseme
    const targetMorphs = VISEME_TO_MORPH_TARGET[visemeData.phoneme] || {};
    
    // Apply intensity scaling
    const scaledTargets: { [key: string]: number } = {};
    Object.entries(targetMorphs).forEach(([key, value]) => {
      scaledTargets[key] = value * intensity * visemeData.intensity;
    });

    // Smooth transition to new targets
    setLipSyncMorphTargets(prev => {
      const newTargets: { [key: string]: number } = { ...prev };
      
      // Get all possible morph target keys
      const allKeys = new Set([
        ...Object.keys(prev),
        ...Object.keys(scaledTargets)
      ]);

      allKeys.forEach(key => {
        const currentValue = prev[key] || 0;
        const targetValue = scaledTargets[key] || 0;
        newTargets[key] = interpolateValue(currentValue, targetValue, 1 - smoothing);
      });

      return newTargets;
    });

    setPreviousTargets(scaledTargets);
  }, [visemeData, isSpeaking, smoothing, intensity, interpolateValue]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      setLipSyncMorphTargets({});
      setCurrentViseme('sil');
      setIsActive(false);
    };
  }, []);

  return {
    lipSyncMorphTargets,
    currentViseme,
    isActive
  };
};