export interface VisemeData {
  phoneme: string;
  timestamp: number;
  duration: number;
  intensity: number;
}

export interface AudioFrame {
  data: Float32Array;
  sample_rate: number;
  channels: number;
  timestamp: number;
}

export interface TranscriptionResult {
  text: string;
  confidence: number;
  language: string;
  timestamp: number;
  is_final: boolean;
}

export interface SynthesisRequest {
  text: string;
  voice?: string;
  speed?: number;
  pitch?: number;
  volume?: number;
  generate_visemes: boolean;
}

export interface SynthesisResult {
  audio_data: Float32Array;
  sample_rate: number;
  duration: number;
  visemes: VisemeData[];
}

export enum AudioEvent {
  SpeechDetected = 'speech_detected',
  SpeechEnded = 'speech_ended',
  AudioGenerated = 'audio_generated',
  VisemeGenerated = 'viseme_generated',
  Error = 'error'
}

export enum ProcessingMode {
  Listening = 'listening',
  Speaking = 'speaking',
  Idle = 'idle'
}