use crate::config::get_config;
use crate::audio::{AudioFrame, AudioManager};
use anyhow::{Context, Result};
use std::sync::{Arc, Mutex};
use std::sync::mpsc::Receiver;
use tokio::sync::broadcast;
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

#[derive(Debug, Clone)]
pub struct TranscriptionResult {
    pub text: String,
    pub confidence: f32,
    pub language: String,
    pub timestamp: u64,
    pub is_final: bool,
}

pub struct SpeechToText {
    whisper_ctx: Option<WhisperContext>,
    audio_buffer: Vec<f32>,
    buffer_size: usize,
    sample_rate: u32,
    transcription_sender: broadcast::Sender<TranscriptionResult>,
    is_processing: Arc<Mutex<bool>>,
    vad_threshold: f32,
    min_speech_duration: f32,
    silence_counter: usize,
}

impl SpeechToText {
    pub fn new() -> Result<Self> {
        let config = get_config();
        let (transcription_sender, _) = broadcast::channel(100);
        
        Ok(SpeechToText {
            whisper_ctx: None,
            audio_buffer: Vec::new(),
            buffer_size: (config.stt.min_speech_duration * config.audio.input.sample_rate as f32) as usize,
            sample_rate: config.audio.input.sample_rate,
            transcription_sender,
            is_processing: Arc::new(Mutex::new(false)),
            vad_threshold: config.stt.silence_threshold,
            min_speech_duration: config.stt.min_speech_duration,
            silence_counter: 0,
        })
    }
    
    pub fn initialize(&mut self) -> Result<()> {
        let config = get_config();
        
        // Initialize Whisper context
        let model_path = format!("models/{}.bin", config.stt.model);
        
        let ctx_params = WhisperContextParameters::default();
        
        // For now, we'll use a placeholder path
        // In a real implementation, you'd download or bundle the model
        let whisper_ctx = WhisperContext::new_with_params(
            &model_path,
            ctx_params,
        ).context("Failed to initialize Whisper context")?;
        
        self.whisper_ctx = Some(whisper_ctx);
        
        log::info!("Speech-to-Text initialized with model: {}", config.stt.model);
        Ok(())
    }
    
    pub async fn start_processing(&mut self, audio_receiver: Arc<Mutex<Receiver<AudioFrame>>>) -> Result<()> {
        let config = get_config();
        *self.is_processing.lock().unwrap() = true;
        
        let transcription_sender = self.transcription_sender.clone();
        let is_processing = self.is_processing.clone();
        let vad_threshold = self.vad_threshold;
        let min_speech_duration = self.min_speech_duration;
        let sample_rate = self.sample_rate;
        
        tokio::spawn(async move {
            let mut audio_buffer = Vec::new();
            let mut silence_counter = 0;
            let silence_threshold = (0.5 * sample_rate as f32) as usize; // 0.5 seconds of silence
            
            while *is_processing.lock().unwrap() {
                // Receive audio frames
                if let Ok(receiver) = audio_receiver.try_lock() {
                    while let Ok(frame) = receiver.try_recv() {
                        // Voice Activity Detection (VAD)
                        let energy = Self::calculate_energy(&frame.data);
                        
                        if energy > vad_threshold {
                            // Speech detected
                            audio_buffer.extend_from_slice(&frame.data);
                            silence_counter = 0;
                        } else {
                            // Silence detected
                            silence_counter += frame.data.len();
                            
                            // If we have accumulated speech and now have silence, process it
                            if !audio_buffer.is_empty() && silence_counter > silence_threshold {
                                if audio_buffer.len() > (min_speech_duration * sample_rate as f32) as usize {
                                    // Process the accumulated audio
                                    if let Ok(transcription) = Self::transcribe_audio(&audio_buffer, sample_rate).await {
                                        let result = TranscriptionResult {
                                            text: transcription,
                                            confidence: 0.9, // Placeholder
                                            language: config.stt.language.clone(),
                                            timestamp: std::time::SystemTime::now()
                                                .duration_since(std::time::UNIX_EPOCH)
                                                .unwrap()
                                                .as_millis() as u64,
                                            is_final: true,
                                        };
                                        
                                        if let Err(e) = transcription_sender.send(result) {
                                            log::error!("Failed to send transcription: {}", e);
                                        }
                                    }
                                }
                                
                                audio_buffer.clear();
                                silence_counter = 0;
                            }
                        }
                    }
                }
                
                tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;
            }
        });
        
        log::info!("Speech-to-Text processing started");
        Ok(())
    }
    
    fn calculate_energy(audio_data: &[f32]) -> f32 {
        let sum_squares: f32 = audio_data.iter().map(|&x| x * x).sum();
        (sum_squares / audio_data.len() as f32).sqrt()
    }
    
    async fn transcribe_audio(audio_data: &[f32], sample_rate: u32) -> Result<String> {
        // Placeholder implementation
        // In a real implementation, you would:
        // 1. Resample audio to 16kHz if needed
        // 2. Use Whisper to transcribe
        // 3. Return the transcription
        
        // For now, return a placeholder
        if audio_data.len() > 1000 {
            Ok("[Transcribed speech placeholder]".to_string())
        } else {
            Ok(String::new())
        }
    }
    
    pub fn get_transcription_receiver(&self) -> broadcast::Receiver<TranscriptionResult> {
        self.transcription_sender.subscribe()
    }
    
    pub fn stop_processing(&mut self) {
        *self.is_processing.lock().unwrap() = false;
        log::info!("Speech-to-Text processing stopped");
    }
    
    pub fn is_processing(&self) -> bool {
        *self.is_processing.lock().unwrap()
    }
}

impl Drop for SpeechToText {
    fn drop(&mut self) {
        self.stop_processing();
    }
}