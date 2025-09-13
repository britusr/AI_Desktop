import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import SidePanel, { ViewportSettings, EnvironmentSettings } from "../components/SidePanel/SidePanel";
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
    // Send emotion change to main window via event
    if (typeof window !== 'undefined' && window.__TAURI_INTERNALS__) {
      emit('emotion-changed', emotion);
    }
  };

  const handleViewportChange = (settings: ViewportSettings) => {
    setViewportSettings(settings);
    localStorage.setItem('viewportSettings', JSON.stringify(settings));
    // Send viewport changes to main window via event
    if (typeof window !== 'undefined' && window.__TAURI_INTERNALS__) {
      emit('viewport-settings-change', settings);
    }
  };

  const handleEnvironmentChange = (settings: EnvironmentSettings) => {
    setEnvironmentSettings(settings);
    localStorage.setItem('environmentSettings', JSON.stringify(settings));
    // Send environment changes to main window via event
    if (typeof window !== 'undefined' && window.__TAURI_INTERNALS__) {
      emit('environment-settings-change', settings);
    }
  };

  const handleSaveSettings = () => {
    // Save to localStorage
    localStorage.setItem('viewportSettings', JSON.stringify(viewportSettings));
    localStorage.setItem('environmentSettings', JSON.stringify(environmentSettings));
    
    // Emit current settings to main window to ensure synchronization
    if (typeof window !== 'undefined' && window.__TAURI_INTERNALS__) {
      emit('viewport-settings-change', viewportSettings);
      emit('environment-settings-change', environmentSettings);
    }
    
    console.log('Settings saved and synchronized successfully!');
  };

  // Initialize audio system and load saved settings
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
      viewportSettings={viewportSettings}
      environmentSettings={environmentSettings}
      onToggleListening={toggleListening}
      onToggleSpeaking={toggleSpeaking}
      onChangeEmotion={changeEmotion}
      onViewportChange={handleViewportChange}
      onEnvironmentChange={handleEnvironmentChange}
      onSaveSettings={handleSaveSettings}
    />
  );
}

export default SidePanelPage;