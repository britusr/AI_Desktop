use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use anyhow::{Context, Result};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub app: AppSettings,
    pub audio: AudioConfig,
    pub stt: SttConfig,
    pub tts: TtsConfig,
    pub llm: LlmConfig,
    pub vision: VisionConfig,
    pub character: CharacterConfig,
    pub performance: PerformanceConfig,
    pub memory: MemoryConfig,
    pub logging: LoggingConfig,
    pub development: DevelopmentConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub name: String,
    pub version: String,
    pub window: WindowConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowConfig {
    pub width: u32,
    pub height: u32,
    pub resizable: bool,
    pub fullscreen: bool,
    pub always_on_top: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioConfig {
    pub input: AudioInputConfig,
    pub output: AudioOutputConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioInputConfig {
    pub device: String,
    pub sample_rate: u32,
    pub channels: u16,
    pub buffer_size: u32,
    pub noise_suppression: bool,
    pub echo_cancellation: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioOutputConfig {
    pub device: String,
    pub sample_rate: u32,
    pub channels: u16,
    pub volume: f32,
    pub low_latency: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SttConfig {
    pub provider: String,
    pub model: String,
    pub language: String,
    pub real_time: bool,
    pub vad_enabled: bool,
    pub silence_threshold: f32,
    pub min_speech_duration: f32,
    pub max_speech_duration: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TtsConfig {
    pub provider: String,
    pub voice: String,
    pub speed: f32,
    pub pitch: f32,
    pub volume: f32,
    pub streaming: bool,
    pub low_latency: bool,
    pub generate_visemes: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LlmConfig {
    pub provider: String,
    pub model: String,
    pub max_tokens: u32,
    pub temperature: f32,
    pub top_p: f32,
    pub stream: bool,
    pub context_window: u32,
    pub system_prompt: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VisionConfig {
    pub enabled: bool,
    pub model: String,
    pub input_resolution: [u32; 2],
    pub fps: u32,
    pub object_detection: bool,
    pub face_detection: bool,
    pub emotion_recognition: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CharacterConfig {
    pub enabled: bool,
    pub provider: String,
    pub avatar_url: String,
    pub animations: AnimationConfig,
    pub lip_sync: LipSyncConfig,
    pub facial_expressions: FacialExpressionConfig,
    pub rendering: RenderingConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnimationConfig {
    pub idle: String,
    pub talking: String,
    pub listening: String,
    pub thinking: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LipSyncConfig {
    pub enabled: bool,
    pub viseme_mapping: String,
    pub smoothing: f32,
    pub intensity: f32,
    pub real_time: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FacialExpressionConfig {
    pub enabled: bool,
    pub emotion_mapping: bool,
    pub blink_rate: f32,
    pub eye_tracking: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RenderingConfig {
    pub quality: String,
    pub shadows: bool,
    pub lighting: String,
    pub anti_aliasing: bool,
    pub fps_target: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceConfig {
    pub hardware_acceleration: bool,
    pub gpu_rendering: bool,
    pub multi_threading: bool,
    pub memory_optimization: bool,
    pub low_latency_mode: bool,
    pub target_fps: u32,
    pub audio_buffer_size: u32,
    pub video_buffer_size: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryConfig {
    pub enabled: bool,
    pub max_history: u32,
    pub context_retention: u32,
    pub save_conversations: bool,
    pub conversation_timeout: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoggingConfig {
    pub level: String,
    pub file_logging: bool,
    pub console_logging: bool,
    pub log_file: String,
    pub max_file_size: String,
    pub max_files: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DevelopmentConfig {
    pub debug_mode: bool,
    pub hot_reload: bool,
    pub performance_monitoring: bool,
    pub error_reporting: bool,
    pub telemetry: bool,
}

impl AppConfig {
    pub fn load_from_file<P: AsRef<Path>>(path: P) -> Result<Self> {
        let content = fs::read_to_string(path)
            .context("Failed to read configuration file")?;
        
        let config: AppConfig = serde_yaml::from_str(&content)
            .context("Failed to parse YAML configuration")?;
        
        Ok(config)
    }
    
    pub fn load_default() -> Result<Self> {
        // Try multiple possible paths for the config file
        let possible_paths = [
            "config/config.yaml",
            "../config/config.yaml",
            "src-tauri/config.yaml",
            "./config.yaml"
        ];
        
        for path in &possible_paths {
            if std::path::Path::new(path).exists() {
                return Self::load_from_file(path);
            }
        }
        
        Err(anyhow::anyhow!("Configuration file not found in any of the expected locations: {:?}", possible_paths))
    }
    

}

// Global configuration instance
use once_cell::sync::OnceCell;
static CONFIG: OnceCell<AppConfig> = OnceCell::new();

pub fn init_config() -> Result<()> {
    let config = AppConfig::load_default()?;
    CONFIG.set(config).map_err(|_| anyhow::anyhow!("Configuration already initialized"))?;
    Ok(())
}