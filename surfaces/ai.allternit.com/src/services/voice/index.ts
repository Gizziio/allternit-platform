/**
 * Voice Services - Unified Export
 * 
 * Provides hybrid voice capabilities:
 * - TTS (Text-to-Speech) with Chatterbox backend + browser fallback
 * - STT (Speech-to-Text) with Web Speech API + backend fallback
 * - Voice cloning (backend only)
 * - Audio energy analysis for Persona animation
 */

export { type TTSRequest, type TTSResponse, type VoiceModel, type VoicePreset, VoiceService, type VoiceState, voiceService } from './VoiceService';
export { type STTCallback, type STTEvent, type STTEventType, type STTOptions, type STTResult, type SpeechRecognition, type SpeechRecognitionAlternative, type SpeechRecognitionErrorEvent, type SpeechRecognitionEvent, type SpeechRecognitionResult, type SpeechRecognitionResultList, SpeechToTextService, speechToText } from './SpeechToText';
