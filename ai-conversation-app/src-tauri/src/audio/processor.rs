use crate::config::get_config;
use crate::audio::{AudioFrame, AudioManager, SpeechToText, TextToSpeech, VisemeData};
use crate::audio::tts::SynthesisRequest;
use anyhow::{Context, Result};
use std::sync::{Arc, Mutex};
use tokio::sync::broadcast;

#[derive(Debug, Clone)]
pub enum AudioEvent {
    SpeechDetected(String),
    SpeechEnded,
    AudioGenerated(Vec<f32>),
    VisemeGenerated(VisemeData),
    Error(String),
}

pub struct AudioProcessor {
    audio_manager: Arc<Mutex<AudioManager>>,
    stt: Arc<Mutex<SpeechToText>>,
    tts: Arc<Mutex<TextToSpeech>>,
    event_sender: broadcast::Sender<AudioEvent>,
    is_running: Arc<Mutex<bool>>,
    processing_mode: ProcessingMode,
}

#[derive(Debug, Clone, PartialEq)]
pub enum ProcessingMode {
    Listening,
    Speaking,
    Idle,
}

impl AudioProcessor {
    pub async fn new() -> Result<Self> {
        let audio_manager = Arc::new(Mutex::new(AudioManager::new()?));
        let stt = Arc::new(Mutex::new(SpeechToText::new()?));
        let tts = Arc::new(Mutex::new(TextToSpeech::new()?));
        let (event_sender, _) = broadcast::channel(1000);
        
        let mut processor = AudioProcessor {
            audio_manager,
            stt,
            tts,
            event_sender,
            is_running: Arc::new(Mutex::new(false)),
            processing_mode: ProcessingMode::Idle,
        };
        
        processor.initialize().await?;
        Ok(processor)
    }
    
    pub async fn start_processing(&mut self) -> Result<()> {
        self.start().await
    }
    
    pub async fn stop_processing(&mut self) -> Result<()> {
        self.stop().await
    }
    
    pub async fn initialize(&mut self) -> Result<()> {
        // Initialize audio manager
        {
            let mut audio_manager = self.audio_manager.lock().unwrap();
            audio_manager.initialize()?;
        }
        
        // Initialize STT
        {
            let mut stt = self.stt.lock().unwrap();
            stt.initialize()?;
        }
        
        // Initialize TTS
        {
            let mut tts = self.tts.lock().unwrap();
            tts.initialize()?;
        }
        
        log::info!("Audio processor initialized successfully");
        Ok(())
    }
    
    pub async fn start(&mut self) -> Result<()> {
        *self.is_running.lock().unwrap() = true;
        self.processing_mode = ProcessingMode::Listening;
        
        // Start audio recording
        {
            let mut audio_manager = self.audio_manager.lock().unwrap();
            audio_manager.start_recording()?;
        }
        
        // Start STT processing
        let audio_receiver = {
            let audio_manager = self.audio_manager.lock().unwrap();
            audio_manager.get_audio_receiver()
        };
        
        {
            let mut stt = self.stt.lock().unwrap();
            stt.start_processing(audio_receiver).await?;
        }
        
        // Start event processing loop
        self.start_event_processing().await?;
        
        log::info!("Audio processor started");
        Ok(())
    }
    
    async fn start_event_processing(&self) -> Result<()> {
        let event_sender = self.event_sender.clone();
        let is_running = self.is_running.clone();
        let audio_manager = self.audio_manager.clone();
        let tts = self.tts.clone();
        
        // STT event processing
        let stt_receiver = {
            let stt = self.stt.lock().unwrap();
            stt.get_transcription_receiver()
        };
        
        let stt_event_sender = event_sender.clone();
        let stt_is_running = is_running.clone();
        tokio::spawn(async move {
            let mut receiver = stt_receiver;
            while *stt_is_running.lock().unwrap() {
                match receiver.recv().await {
                    Ok(transcription) => {
                        if !transcription.text.trim().is_empty() {
                            let event = AudioEvent::SpeechDetected(transcription.text);
                            if let Err(e) = stt_event_sender.send(event) {
                                log::error!("Failed to send STT event: {}", e);
                            }
                        }
                    }
                    Err(e) => {
                        log::error!("STT receiver error: {}", e);
                        break;
                    }
                }
            }
        });
        
        // TTS event processing
        let tts_receiver = {
            let tts = self.tts.lock().unwrap();
            tts.get_synthesis_receiver()
        };
        
        let tts_event_sender = event_sender.clone();
        let tts_is_running = is_running.clone();
        let tts_audio_manager = audio_manager.clone();
        tokio::spawn(async move {
            let mut receiver = tts_receiver;
            while *tts_is_running.lock().unwrap() {
                match receiver.recv().await {
                    Ok(synthesis_result) => {
                        // Play the generated audio
                        {
                            let mut audio_manager = tts_audio_manager.lock().unwrap();
                            if let Err(e) = audio_manager.play_audio(
                                synthesis_result.audio_data.clone(),
                                synthesis_result.sample_rate,
                            ) {
                                log::error!("Failed to play audio: {}", e);
                            }
                        }
                        
                        // Send audio generated event
                        let audio_event = AudioEvent::AudioGenerated(synthesis_result.audio_data);
                        if let Err(e) = tts_event_sender.send(audio_event) {
                            log::error!("Failed to send TTS audio event: {}", e);
                        }
                        
                        // Send viseme events
                        for viseme in synthesis_result.visemes {
                            let viseme_event = AudioEvent::VisemeGenerated(viseme.clone());
                            if let Err(e) = tts_event_sender.send(viseme_event) {
                                log::error!("Failed to send viseme event: {}", e);
                            }
                            
                            // Also send to audio manager for character animation
                            {
                                let audio_manager = tts_audio_manager.lock().unwrap();
                                if let Err(e) = audio_manager.send_viseme(viseme) {
                                    log::error!("Failed to send viseme to audio manager: {}", e);
                                }
                            }
                        }
                    }
                    Err(e) => {
                        log::error!("TTS receiver error: {}", e);
                        break;
                    }
                }
            }
        });
        
        Ok(())
    }
    
    pub async fn synthesize_speech(&mut self, text: String) -> Result<()> {
        self.synthesize_speech_internal(&text).await
    }
    
    async fn synthesize_speech_internal(&mut self, text: &str) -> Result<()> {
        self.processing_mode = ProcessingMode::Speaking;
        
        let config = get_config();
        let request = SynthesisRequest {
            text: text.to_string(),
            voice: Some(config.tts.voice.clone()),
            speed: Some(config.tts.speed),
            pitch: Some(config.tts.pitch),
            volume: Some(config.tts.volume),
            generate_visemes: config.tts.generate_visemes,
        };
        
        {
            let mut tts = self.tts.lock().unwrap();
            tts.synthesize(request).await?;
        }
        
        // Wait for synthesis to complete
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        
        self.processing_mode = ProcessingMode::Listening;
        
        log::info!("Speech synthesis requested for: '{}'", text);
        Ok(())
    }
    
    pub fn set_processing_mode(&mut self, mode: ProcessingMode) {
        self.processing_mode = mode;
        
        match mode {
            ProcessingMode::Listening => {
                // Enable STT, disable TTS output
                log::debug!("Switched to listening mode");
            }
            ProcessingMode::Speaking => {
                // Disable STT, enable TTS output
                log::debug!("Switched to speaking mode");
            }
            ProcessingMode::Idle => {
                // Disable both
                log::debug!("Switched to idle mode");
            }
        }
    }
    
    pub fn get_processing_mode(&self) -> ProcessingMode {
        self.processing_mode.clone()
    }
    
    pub fn get_event_receiver(&self) -> broadcast::Receiver<AudioEvent> {
        self.event_sender.subscribe()
    }
    
    pub fn get_viseme_receiver(&self) -> broadcast::Receiver<VisemeData> {
        let audio_manager = self.audio_manager.lock().unwrap();
        audio_manager.get_viseme_receiver()
    }
    
    pub fn is_running(&self) -> bool {
        *self.is_running.lock().unwrap()
    }
    
    pub fn is_recording(&self) -> bool {
        let audio_manager = self.audio_manager.lock().unwrap();
        audio_manager.is_recording()
    }
    
    pub fn is_playing(&self) -> bool {
        let audio_manager = self.audio_manager.lock().unwrap();
        audio_manager.is_playing()
    }
    
    pub async fn stop(&mut self) -> Result<()> {
        *self.is_running.lock().unwrap() = false;
        self.processing_mode = ProcessingMode::Idle;
        
        // Stop audio recording
        {
            let mut audio_manager = self.audio_manager.lock().unwrap();
            audio_manager.stop_recording()?;
        }
        
        // Stop STT processing
        {
            let mut stt = self.stt.lock().unwrap();
            stt.stop_processing();
        }
        
        // Stop TTS synthesis
        {
            let mut tts = self.tts.lock().unwrap();
            tts.stop_synthesis();
        }
        
        log::info!("Audio processor stopped");
        Ok(())
    }
}

impl Drop for AudioProcessor {
    fn drop(&mut self) {
        let _ = futures::executor::block_on(self.stop());
    }
}