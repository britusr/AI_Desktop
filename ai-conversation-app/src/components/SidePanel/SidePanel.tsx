import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { VisemeData, ProcessingMode } from "../../types/audio";
import "./SidePanel.css";

interface SidePanelProps {
  isListening: boolean;
  isSpeaking: boolean;
  currentEmotion: string;
  processingMode: ProcessingMode;
  transcript: string;
  response: string;
  onToggleListening: () => void;
  onToggleSpeaking: () => void;
  onChangeEmotion: (emotion: string) => void;
}

function SidePanel({
  isListening,
  isSpeaking,
  currentEmotion,
  processingMode,
  transcript,
  response,
  onToggleListening,
  onToggleSpeaking,
  onChangeEmotion
}: SidePanelProps) {
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