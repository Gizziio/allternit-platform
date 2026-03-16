/**
 * Voice Services - Unified Export
 * 
 * Provides hybrid voice capabilities:
 * - TTS (Text-to-Speech) with Chatterbox backend + browser fallback
 * - STT (Speech-to-Text) with Web Speech API + backend fallback
 * - Voice cloning (backend only)
 * - Audio energy analysis for Persona animation
 */

export * from './VoiceService';
export * from './SpeechToText';
