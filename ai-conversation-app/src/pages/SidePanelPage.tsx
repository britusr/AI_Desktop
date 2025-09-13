import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import SidePanel from "../components/SidePanel/SidePanel";
import { VisemeData, ProcessingMode } from "../types/audio";

// Extend Window interface for Tauri
declare global {
  interface Window {
    __TAURI_INTERNALS__?: any;
  }
}

function SidePanelPage() {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentEmotion, setCurrentEmotion] = useState<string>('neutral');
  const [processingMode, setProcessingMode] = useState<ProcessingMode>(ProcessingMode.Idle);
  const [transcript, setTranscript] = useState<string>("");
  const [response, setResponse] = useState<string>("");

  // Real audio processing functions
  const toggleListening = async () => {
    try {
      if (isListening) {
        // Stop listening
        if (typeof window !== 'undefined' && window.__TAURI_INTERNALS__) {
          await invoke('stop_listening');
        }
        setIsListening(false);
        setProcessingMode(ProcessingMode.Idle);
      } else {
        // Start listening
        setIsSpeaking(false);
        setIsListening(true);
        setProcessingMode(ProcessingMode.Listening);
        
        if (typeof window !== 'undefined' && window.__TAURI_INTERNALS__) {
          const result = await invoke('start_listening');
          if (result) {
            setTranscript(result as string);
          }
        } else {
          // Demo mode for development
          setTimeout(() => {
            setTranscript("This is a demo transcript in development mode");
          }, 2000);
        }
      }
    } catch (error) {
      console.error('Error toggling listening:', error);
      setIsListening(false);
      setProcessingMode(ProcessingMode.Idle);
    }
  };

  const toggleSpeaking = async () => {
    try {
      if (isSpeaking) {
        // Stop speaking
        if (typeof window !== 'undefined' && window.__TAURI_INTERNALS__) {
          await invoke('stop_speaking');
        }
        setIsSpeaking(false);
        setProcessingMode(ProcessingMode.Idle);
      } else {
        // Start speaking
        setIsListening(false);
        setIsSpeaking(true);
        setProcessingMode(ProcessingMode.Speaking);
        
        if (typeof window !== 'undefined' && window.__TAURI_INTERNALS__) {
          await invoke('start_speaking', { text: "Hello, this is a test response from the AI assistant." });
        } else {
          // Demo mode for development
          setTimeout(() => {
            setResponse("This is a demo AI response in development mode");
          }, 1000);
        }
      }
    } catch (error) {
      console.error('Error toggling speaking:', error);
      setIsSpeaking(false);
      setProcessingMode(ProcessingMode.Idle);
    }
  };

  const changeEmotion = (emotion: string) => {
    setCurrentEmotion(emotion);
    // Send emotion change to main window
    if (typeof window !== 'undefined' && window.__TAURI_INTERNALS__) {
      invoke('change_character_emotion', { emotion });
    }
  };

  // Initialize audio system
  useEffect(() => {
    const initializeAudio = async () => {
      try {
        // Check if we're running in Tauri environment
        if (typeof window !== 'undefined' && window.__TAURI_INTERNALS__) {
          await invoke('initialize_audio_system');
          console.log('Audio system initialized');
        } else {
          console.log('Running in development mode - Tauri functions not available');
        }
      } catch (error) {
        console.error('Failed to initialize audio system:', error);
      }
    };

    initializeAudio();
  }, []);

  return (
    <SidePanel
      isListening={isListening}
      isSpeaking={isSpeaking}
      currentEmotion={currentEmotion}
      processingMode={processingMode}
      transcript={transcript}
      response={response}
      onToggleListening={toggleListening}
      onToggleSpeaking={toggleSpeaking}
      onChangeEmotion={changeEmotion}
    />
  );
}

export default SidePanelPage;