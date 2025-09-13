import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import Character from "./components/Character/Character";
import { VisemeData, ProcessingMode } from "./types/audio";
import "./App.css";

// Extend Window interface for Tauri
declare global {
  interface Window {
    __TAURI_INTERNALS__?: any;
  }
}

function App() {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentEmotion, setCurrentEmotion] = useState<string>('neutral');
  const [visemeData, setVisemeData] = useState<VisemeData | undefined>(undefined);
  const [processingMode, setProcessingMode] = useState<ProcessingMode>(ProcessingMode.Idle);
  const [transcript, setTranscript] = useState<string>("");
  // @ts-ignore
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
        setVisemeData(undefined);
      } else {
        // Start speaking
        setIsListening(false);
        setIsSpeaking(true);
        setProcessingMode(ProcessingMode.Speaking);
        
        const textToSpeak = response || "Hello! I'm your AI assistant. How can I help you today?";
        
        if (typeof window !== 'undefined' && window.__TAURI_INTERNALS__) {
          await invoke('start_speaking', { text: textToSpeak });
        }
        
        // Simulate viseme data when speaking
        simulateVisemeData();
      }
    } catch (error) {
      console.error('Error toggling speaking:', error);
      setIsSpeaking(false);
      setProcessingMode(ProcessingMode.Idle);
      setVisemeData(undefined);
    }
  };

  const simulateVisemeData = () => {
    const visemes = ['aa', 'eh', 'ih', 'oh', 'uw', 'b', 'm', 'f', 'th', 's'];
    let index = 0;
    
    const interval = setInterval(() => {
      if (index < visemes.length && isSpeaking) {
        setVisemeData({
          phoneme: visemes[index],
          timestamp: Date.now(),
          duration: 200,
          intensity: 0.8 + Math.random() * 0.2
        });
        index++;
      } else {
        clearInterval(interval);
        setVisemeData(undefined);
      }
    }, 200);
  };

  const changeEmotion = (emotion: string) => {
    setCurrentEmotion(emotion);
  };

  // Initialize audio system and listen for emotion changes
  useEffect(() => {
    const initializeAudio = async () => {
      try {
        // Check if we're running in Tauri environment
        if (typeof window !== 'undefined' && window.__TAURI_INTERNALS__) {
          await invoke('initialize_audio_system');
          console.log('Audio system initialized');
          
          // Listen for emotion changes from sidepanel
          const { listen } = await import('@tauri-apps/api/event');
          await listen('emotion-change', (event) => {
            setCurrentEmotion(event.payload as string);
          });
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
    <div className="app fullscreen">
      <div className="character-section fullscreen-character">
        <Character
          isListening={isListening}
          isSpeaking={isSpeaking}
          emotion={currentEmotion}
          visemeData={visemeData}
          scale={2.0}
          position={[0, -0.5, 0]}
        />
      </div>
    </div>
  );
}

export default App;
