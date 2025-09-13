import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { VisemeData, ProcessingMode } from "../../types/audio";
import "./SidePanel.css";

interface ViewportSettings {
  cameraPosition: [number, number, number];
  cameraFov: number;
  orbitTarget: [number, number, number];
  minDistance: number;
  maxDistance: number;
}

interface EnvironmentSettings {
  preset: string;
  intensity: number;
  background: boolean;
}

interface SidePanelProps {
  isListening: boolean;
  isSpeaking: boolean;
  currentEmotion: string;
  processingMode: ProcessingMode;
  transcript: string;
  response: string;
  viewportSettings: ViewportSettings;
  environmentSettings: EnvironmentSettings;
  onToggleListening: () => void;
  onToggleSpeaking: () => void;
  onChangeEmotion: (emotion: string) => void;
  onViewportChange: (settings: ViewportSettings) => void;
  onEnvironmentChange: (settings: EnvironmentSettings) => void;
  onSaveSettings?: () => void;
}

function SidePanel({
  isListening,
  isSpeaking,
  currentEmotion,
  processingMode,
  transcript,
  response,
  viewportSettings,
  environmentSettings,
  onToggleListening,
  onToggleSpeaking,
  onChangeEmotion,
  onViewportChange,
  onEnvironmentChange,
  onSaveSettings
}: SidePanelProps) {
  const [localSettings, setLocalSettings] = useState<ViewportSettings>(viewportSettings);
  const [localEnvironmentSettings, setLocalEnvironmentSettings] = useState<EnvironmentSettings>(environmentSettings);

  const environmentPresets = [
    'studio', 'sunset', 'dawn', 'night', 'forest', 'apartment', 'city', 'park', 'lobby', 'warehouse'
  ];

  const handleViewportChange = (key: keyof ViewportSettings, value: any) => {
    const newSettings = { ...localSettings, [key]: value };
    setLocalSettings(newSettings);
    onViewportChange(newSettings);
  };

  const handleEnvironmentChange = (key: keyof EnvironmentSettings, value: any) => {
    const newSettings = { ...localEnvironmentSettings, [key]: value };
    setLocalEnvironmentSettings(newSettings);
    onEnvironmentChange(newSettings);
  };

  const resetToDefaults = () => {
    const defaultSettings: ViewportSettings = {
      cameraPosition: [0, 1, 7],
      cameraFov: 50,
      orbitTarget: [0, -1, 0],
      minDistance: 4,
      maxDistance: 8
    };
    setLocalSettings(defaultSettings);
    onViewportChange(defaultSettings);
  };
  return (
    <div className="sidepanel">
      <div className="status-panel">
        <h2>AI Assistant Panel</h2>
        <div className="status-indicators">
          <div className={`status-indicator ${processingMode}`}>
            Status: {processingMode.charAt(0).toUpperCase() + processingMode.slice(1)}
          </div>
        </div>
      </div>

      <div className="control-buttons">
        <button 
          className={`control-btn ${isListening ? 'active' : ''}`}
          onClick={onToggleListening}
        >
          {isListening ? '🎤 Stop Listening' : '🎤 Start Listening'}
        </button>
        
        <button 
          className={`control-btn ${isSpeaking ? 'active' : ''}`}
          onClick={onToggleSpeaking}
        >
          {isSpeaking ? '🔊 Stop Speaking' : '🔊 Start Speaking'}
        </button>
      </div>

      <div className="emotion-controls">
        <h3>Character Emotions</h3>
        <div className="emotion-buttons">
          {['neutral', 'happy', 'sad', 'surprised', 'excited'].map(emotion => (
            <button
              key={emotion}
              className={`emotion-btn ${currentEmotion === emotion ? 'active' : ''}`}
              onClick={() => onChangeEmotion(emotion)}
            >
              {emotion.charAt(0).toUpperCase() + emotion.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="viewport-controls">
        <h3>Viewport Controls</h3>
        <div className="control-group">
          <label>Camera Position</label>
          <div className="position-controls">
            <input
              type="range"
              min="-5"
              max="5"
              step="0.1"
              value={localSettings.cameraPosition[0]}
              onChange={(e) => handleViewportChange('cameraPosition', [parseFloat(e.target.value), localSettings.cameraPosition[1], localSettings.cameraPosition[2]])}
            />
            <span>X: {localSettings.cameraPosition[0].toFixed(1)}</span>
          </div>
          <div className="position-controls">
            <input
              type="range"
              min="-2"
              max="5"
              step="0.1"
              value={localSettings.cameraPosition[1]}
              onChange={(e) => handleViewportChange('cameraPosition', [localSettings.cameraPosition[0], parseFloat(e.target.value), localSettings.cameraPosition[2]])}
            />
            <span>Y: {localSettings.cameraPosition[1].toFixed(1)}</span>
          </div>
          <div className="position-controls">
            <input
              type="range"
              min="3"
              max="15"
              step="0.1"
              value={localSettings.cameraPosition[2]}
              onChange={(e) => handleViewportChange('cameraPosition', [localSettings.cameraPosition[0], localSettings.cameraPosition[1], parseFloat(e.target.value)])}
            />
            <span>Z: {localSettings.cameraPosition[2].toFixed(1)}</span>
          </div>
        </div>
        
        <div className="control-group">
          <label>Field of View</label>
          <div className="fov-control">
            <input
              type="range"
              min="20"
              max="80"
              step="1"
              value={localSettings.cameraFov}
              onChange={(e) => handleViewportChange('cameraFov', parseInt(e.target.value))}
            />
            <span>{localSettings.cameraFov}°</span>
          </div>
        </div>
        
        <div className="control-group">
          <label>Zoom Range</label>
          <div className="zoom-controls">
            <input
              type="range"
              min="1"
              max="10"
              step="0.1"
              value={localSettings.minDistance}
              onChange={(e) => handleViewportChange('minDistance', parseFloat(e.target.value))}
            />
            <span>Min: {localSettings.minDistance.toFixed(1)}</span>
          </div>
          <div className="zoom-controls">
            <input
              type="range"
              min="5"
              max="20"
              step="0.1"
              value={localSettings.maxDistance}
              onChange={(e) => handleViewportChange('maxDistance', parseFloat(e.target.value))}
            />
            <span>Max: {localSettings.maxDistance.toFixed(1)}</span>
          </div>
        </div>
        
        <button className="reset-btn" onClick={resetToDefaults}>
          Reset to Defaults
        </button>
        {onSaveSettings && (
          <button className="save-btn" onClick={onSaveSettings}>
            Save Settings
          </button>
        )}
      </div>

      <div className="environment-controls">
        <h3>Environment Settings</h3>
        <div className="control-group">
          <label>Environment Preset</label>
          <select 
            value={localEnvironmentSettings.preset}
            onChange={(e) => handleEnvironmentChange('preset', e.target.value)}
            className="environment-select"
          >
            {environmentPresets.map(preset => (
              <option key={preset} value={preset}>
                {preset.charAt(0).toUpperCase() + preset.slice(1)}
              </option>
            ))}
          </select>
        </div>
        
        <div className="control-group">
          <label>Environment Intensity</label>
          <div className="intensity-controls">
            <input
              type="range"
              min="0.1"
              max="3"
              step="0.1"
              value={localEnvironmentSettings.intensity}
              onChange={(e) => handleEnvironmentChange('intensity', parseFloat(e.target.value))}
            />
            <span>Intensity: {localEnvironmentSettings.intensity.toFixed(1)}</span>
          </div>
        </div>
        
        <div className="control-group">
          <label>
            <input
              type="checkbox"
              checked={localEnvironmentSettings.background}
              onChange={(e) => handleEnvironmentChange('background', e.target.checked)}
            />
            Show Environment Background
          </label>
        </div>
        
        <div className="environment-actions">
          <button 
            className="save-btn environment-save"
            onClick={() => {
              if (onSaveSettings) {
                onSaveSettings();
                // Show visual feedback
                const btn = document.querySelector('.environment-save') as HTMLButtonElement;
                if (btn) {
                  const originalText = btn.textContent;
                  btn.textContent = '✓ Saved!';
                  btn.style.background = 'rgba(76, 175, 80, 0.8)';
                  setTimeout(() => {
                    btn.textContent = originalText;
                    btn.style.background = '';
                  }, 2000);
                }
              }
            }}
          >
            💾 Save Environment
          </button>
          
          <button 
            className="debug-btn"
            onClick={() => {
              // Open developer tools for debugging
              if (typeof window !== 'undefined' && window.__TAURI_INTERNALS__) {
                invoke('open_devtools').catch(console.error);
              } else {
                // In development mode, just open browser dev tools
                console.log('=== ENVIRONMENT DEBUG INFO ===');
                console.log('Current Environment Settings:', localEnvironmentSettings);
                console.log('Props Environment Settings:', environmentSettings);
                console.log('LocalStorage Environment:', localStorage.getItem('environmentSettings'));
                console.log('Tauri Available:', !!window.__TAURI_INTERNALS__);
                console.log('==============================');
                alert('Check browser console for debug information');
              }
            }}
            title="Open Developer Tools for Debugging"
          >
            🔧 Debug Tools
          </button>
        </div>
      </div>

      <div className="conversation-panel">
        <div className="transcript-section">
          <h3>Transcript</h3>
          <div className="transcript-content">
            {transcript || "Start speaking to see transcription..."}
          </div>
        </div>
        
        <div className="response-section">
          <h3>AI Response</h3>
          <div className="response-content">
            {response || "AI responses will appear here..."}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SidePanel;
export type { ViewportSettings, EnvironmentSettings };