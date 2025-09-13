import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import Character from "./components/Character/Character";
import { VisemeData, ProcessingMode } from "./types/audio";
import { ViewportSettings, EnvironmentSettings } from "./components/SidePanel/SidePanel";
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
  const [viewportSettings, setViewportSettings] = useState<ViewportSettings>({
    cameraPosition: [0, 1, 7],
    cameraFov: 50,
    orbitTarget: [0, -1, 0],
    minDistance: 4,
    maxDistance: 8
  });

  const [environmentSettings, setEnvironmentSettings] = useState<EnvironmentSettings>({
    preset: 'studio',
    intensity: 1,
    background: true
  });

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

  const handleEmotionChange = (emotion: string) => {
    setCurrentEmotion(emotion);
  };

  const handleViewportChange = (newSettings: ViewportSettings) => {
    setViewportSettings(newSettings);
    localStorage.setItem('viewportSettings', JSON.stringify(newSettings));
  };

  const handleEnvironmentChange = (settings: EnvironmentSettings) => {
    setEnvironmentSettings(settings);
    // Save to localStorage for persistence
    localStorage.setItem('environmentSettings', JSON.stringify(settings));
  };

  // Initialize audio system and listen for changes from sidepanel
  useEffect(() => {
    const initializeAudio = async () => {
      try {
        // Load saved viewport settings
        const savedSettings = localStorage.getItem('viewportSettings');
        if (savedSettings) {
          const parsedSettings = JSON.parse(savedSettings);
          setViewportSettings(parsedSettings);
        }

        // Load saved environment settings
        const savedEnvironmentSettings = localStorage.getItem('environmentSettings');
        if (savedEnvironmentSettings) {
          const parsedEnvironmentSettings = JSON.parse(savedEnvironmentSettings);
          setEnvironmentSettings(parsedEnvironmentSettings);
        }

        // Check if we're running in Tauri environment
        if (typeof window !== 'undefined' && window.__TAURI_INTERNALS__) {
          await invoke('initialize_audio_system');
          console.log('Audio system initialized');
          
          // Listen for emotion changes from sidepanel
          const unlistenEmotion = await listen('emotion-changed', (event) => {
            const emotion = event.payload as string;
            console.log('Received emotion change:', emotion);
            setCurrentEmotion(emotion);
          });
          
          // Listen for viewport settings changes
          const unlistenViewport = await listen('viewport-settings-change', (event) => {
            const settings = event.payload as ViewportSettings;
            setViewportSettings(settings);
            localStorage.setItem('viewportSettings', JSON.stringify(settings));
          });
          
          // Listen for environment settings changes
          const unlistenEnvironment = await listen('environment-settings-change', (event) => {
            const settings = event.payload as EnvironmentSettings;
            setEnvironmentSettings(settings);
            localStorage.setItem('environmentSettings', JSON.stringify(settings));
          });
          
          return () => {
            unlistenEmotion();
            unlistenViewport();
            unlistenEnvironment();
          };
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
          avatarUrl="https://models.readyplayer.me/64bfa15f0e72c63d7c3934a6.glb"
          isListening={isListening}
          isSpeaking={isSpeaking}
          emotion={currentEmotion}
          visemeData={visemeData}
          scale={1}
          position={[0, -1, 0]}
          viewportSettings={viewportSettings}
          environmentSettings={environmentSettings}
          onViewportChange={handleViewportChange}
          onEnvironmentChange={handleEnvironmentChange}
        />
      </div>
    </div>
  );
}

export default App;
