import { useState, useEffect } from 'react';

interface UseCharacterAnimationProps {
  isListening: boolean;
  isSpeaking: boolean;
  emotion: string;
}

interface CharacterAnimationState {
  currentAnimation: string;
  animationSpeed: number;
  bodyPose: string;
}

export const useCharacterAnimation = ({
  isListening,
  isSpeaking,
  emotion
}: UseCharacterAnimationProps): CharacterAnimationState => {
  const [currentAnimation, setCurrentAnimation] = useState<string>('idle');
  const [animationSpeed, setAnimationSpeed] = useState<number>(1.0);
  const [bodyPose, setBodyPose] = useState<string>('neutral');

  useEffect(() => {
    if (isSpeaking) {
      setCurrentAnimation('talking');
      setAnimationSpeed(1.2);
      setBodyPose('engaged');
    } else if (isListening) {
      setCurrentAnimation('listening');
      setAnimationSpeed(0.8);
      setBodyPose('attentive');
    } else {
      setCurrentAnimation('idle');
      setAnimationSpeed(1.0);
      setBodyPose('neutral');
    }
  }, [isListening, isSpeaking]);

  useEffect(() => {
    switch (emotion) {
      case 'happy':
        setBodyPose('cheerful');
        setAnimationSpeed(1.3);
        break;
      case 'sad':
        setBodyPose('dejected');
        setAnimationSpeed(0.7);
        break;
      case 'excited':
        setBodyPose('energetic');
        setAnimationSpeed(1.5);
        break;
      case 'calm':
        setBodyPose('relaxed');
        setAnimationSpeed(0.9);
        break;
      default:
        // Keep current pose for neutral or unknown emotions
        break;
    }
  }, [emotion]);

  return {
    currentAnimation,
    animationSpeed,
    bodyPose
  };
};