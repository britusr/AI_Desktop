use crate::config::{get_config, AudioConfig};
use anyhow::{Context, Result};
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{Device, Host, Stream, StreamConfig};
use rodio::{Decoder, OutputStream, Sink};
use std::sync::{Arc, Mutex};
use std::sync::mpsc::{self, Receiver, Sender};
use tokio::sync::broadcast;

pub mod stt;
pub mod tts;
pub mod processor;

pub use stt::SpeechToText;
pub use tts::TextToSpeech;
pub use processor::AudioProcessor;

#[derive(Debug, Clone)]
pub struct AudioFrame {
    pub data: Vec<f32>,
    pub sample_rate: u32,
    pub channels: u16,
    pub timestamp: u64,
}

#[derive(Debug, Clone)]
pub struct VisemeData {
    pub phoneme: String,
    pub timestamp: f64,
    pub duration: f64,
    pub intensity: f32,
}

pub struct AudioManager {
    host: Host,
    input_device: Option<Device>,
    output_device: Option<Device>,
    input_stream: Option<Stream>,
    output_stream: Option<OutputStream>,
    audio_sender: Sender<AudioFrame>,
    audio_receiver: Arc<Mutex<Receiver<AudioFrame>>>,
    viseme_broadcaster: broadcast::Sender<VisemeData>,
    is_recording: Arc<Mutex<bool>>,
    is_playing: Arc<Mutex<bool>>,
}

impl AudioManager {
    pub fn new() -> Result<Self> {
        let host = cpal::default_host();
        let (audio_sender, audio_receiver) = mpsc::channel();
        let (viseme_broadcaster, _) = broadcast::channel(1000);
        
        Ok(AudioManager {
            host,
            input_device: None,
            output_device: None,
            input_stream: None,
            output_stream: None,
            audio_sender,
            audio_receiver: Arc::new(Mutex::new(audio_receiver)),
            viseme_broadcaster,
            is_recording: Arc::new(Mutex::new(false)),
            is_playing: Arc::new(Mutex::new(false)),
        })
    }
    
    pub fn initialize(&mut self) -> Result<()> {
        let config = get_config();
        
        // Initialize input device
        self.input_device = if config.audio.input.device == "default" {
            Some(self.host.default_input_device()
                .context("No default input device available")?)
        } else {
            self.find_device_by_name(&config.audio.input.device, true)?
        };
        
        // Initialize output device
        self.output_device = if config.audio.output.device == "default" {
            Some(self.host.default_output_device()
                .context("No default output device available")?)
        } else {
            self.find_device_by_name(&config.audio.output.device, false)?
        };
        
        log::info!("Audio devices initialized successfully");
        Ok(())
    }
    
    fn find_device_by_name(&self, name: &str, is_input: bool) -> Result<Option<Device>> {
        let devices = if is_input {
            self.host.input_devices()?
        } else {
            self.host.output_devices()?
        };
        
        for device in devices {
            if let Ok(device_name) = device.name() {
                if device_name.contains(name) {
                    return Ok(Some(device));
                }
            }
        }
        
        Ok(None)
    }
    
    pub fn start_recording(&mut self) -> Result<()> {
        let config = get_config();
        let device = self.input_device.as_ref()
            .context("Input device not initialized")?;
        
        let stream_config = StreamConfig {
            channels: config.audio.input.channels,
            sample_rate: cpal::SampleRate(config.audio.input.sample_rate),
            buffer_size: cpal::BufferSize::Fixed(config.audio.input.buffer_size),
        };
        
        let sender = self.audio_sender.clone();
        let is_recording = self.is_recording.clone();
        
        let stream = device.build_input_stream(
            &stream_config,
            move |data: &[f32], _: &cpal::InputCallbackInfo| {
                if *is_recording.lock().unwrap() {
                    let frame = AudioFrame {
                        data: data.to_vec(),
                        sample_rate: stream_config.sample_rate.0,
                        channels: stream_config.channels,
                        timestamp: std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .unwrap()
                            .as_millis() as u64,
                    };
                    
                    if let Err(e) = sender.send(frame) {
                        log::error!("Failed to send audio frame: {}", e);
                    }
                }
            },
            |err| {
                log::error!("Audio input stream error: {}", err);
            },
            None,
        )?;
        
        stream.play()?;
        self.input_stream = Some(stream);
        *self.is_recording.lock().unwrap() = true;
        
        log::info!("Audio recording started");
        Ok(())
    }
    
    pub fn stop_recording(&mut self) -> Result<()> {
        *self.is_recording.lock().unwrap() = false;
        
        if let Some(stream) = self.input_stream.take() {
            stream.pause()?;
        }
        
        log::info!("Audio recording stopped");
        Ok(())
    }
    
    pub fn play_audio(&mut self, audio_data: Vec<f32>, sample_rate: u32) -> Result<()> {
        let config = get_config();
        
        // Create a simple WAV-like format for rodio
        let spec = rodio::source::SineWave::new(440.0)
            .take_duration(std::time::Duration::from_secs(1))
            .amplify(0.0); // Silent base
        
        // For now, we'll use a simple approach
        // In a real implementation, you'd convert the f32 data to a proper audio source
        log::info!("Playing audio with {} samples at {} Hz", audio_data.len(), sample_rate);
        
        *self.is_playing.lock().unwrap() = true;
        
        // TODO: Implement proper audio playback with the provided data
        // This is a placeholder implementation
        
        Ok(())
    }
    
    pub fn get_audio_receiver(&self) -> Arc<Mutex<Receiver<AudioFrame>>> {
        self.audio_receiver.clone()
    }
    
    pub fn get_viseme_receiver(&self) -> broadcast::Receiver<VisemeData> {
        self.viseme_broadcaster.subscribe()
    }
    
    pub fn send_viseme(&self, viseme: VisemeData) -> Result<()> {
        self.viseme_broadcaster.send(viseme)
            .map_err(|e| anyhow::anyhow!("Failed to send viseme: {}", e))?;
        Ok(())
    }
    
    pub fn is_recording(&self) -> bool {
        *self.is_recording.lock().unwrap()
    }
    
    pub fn is_playing(&self) -> bool {
        *self.is_playing.lock().unwrap()
    }
}

impl Drop for AudioManager {
    fn drop(&mut self) {
        let _ = self.stop_recording();
        *self.is_playing.lock().unwrap() = false;
    }
}