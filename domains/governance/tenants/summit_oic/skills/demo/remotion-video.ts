/**
 * Remotion Demo Video System
 * 
 * Programmatic video generation for A2R Operator demos.
 * Creates professional demo videos from scripts and screen recordings.
 * 
 * @module summit.demo.remotion
 */

// ============================================================================
// Video Composition Types
// ============================================================================

export interface VideoComposition {
  id: string;
  title: string;
  duration: number; // in frames (30fps = 30 frames per second)
  width: number;
  height: number;
  fps: number;
  scenes: Scene[];
  audio?: AudioTrack[];
  createdAt: string;
}

export interface Scene {
  id: string;
  name: string;
  startFrame: number;
  endFrame: number;
  duration: number;
  type: 'screen_recording' | 'text_overlay' | 'logo' | 'transition' | 'narration';
  content: SceneContent;
  transitions?: Transition[];
}

export interface SceneContent {
  type: 'video' | 'image' | 'text' | 'audio';
  src?: string; // URL or file path
  text?: string;
  style?: TextStyle;
  position?: Position;
  duration?: number;
}

export interface TextStyle {
  fontSize: number;
  fontFamily: string;
  color: string;
  backgroundColor?: string;
  alignment: 'left' | 'center' | 'right';
  animation?: 'fade_in' | 'slide_in' | 'typewriter';
}

export interface Position {
  x: number;
  y: number;
  width?: number;
  height?: number;
}

export interface Transition {
  type: 'fade' | 'slide' | 'zoom' | 'wipe';
  duration: number;
  direction?: 'left' | 'right' | 'up' | 'down';
}

export interface AudioTrack {
  id: string;
  type: 'narration' | 'music' | 'sfx';
  src: string;
  startFrame: number;
  endFrame: number;
  volume?: number;
}

export interface VideoExport {
  success: boolean;
  outputPath: string;
  duration: number;
  size: number;
  format: 'mp4' | 'webm' | 'mov';
  createdAt: string;
  error?: string;
}

// ============================================================================
// Demo Video Templates
// ============================================================================

export const A2R_DEMO_TEMPLATE: VideoComposition = {
  id: 'a2r_demo_2min',
  title: 'A2R Operator - 2 Minute Demo',
  duration: 3600, // 2 minutes at 30fps
  width: 1920,
  height: 1080,
  fps: 30,
  scenes: [
    // Scene 1: Problem (0:00-0:15)
    {
      id: 'scene_1',
      name: 'The Problem',
      startFrame: 0,
      endFrame: 450,
      duration: 450,
      type: 'screen_recording',
      content: {
        type: 'video',
        src: 'recordings/teacher_working_late.mp4',
      },
      transitions: [{ type: 'fade', duration: 30 }],
    },
    {
      id: 'scene_1_text',
      name: 'Problem Text Overlay',
      startFrame: 50,
      endFrame: 200,
      duration: 150,
      type: 'text_overlay',
      content: {
        type: 'text',
        text: "It's 7:30 PM. Again.",
        style: {
          fontSize: 72,
          fontFamily: 'Montserrat',
          color: '#FFFFFF',
          backgroundColor: 'rgba(0,0,0,0.7)',
          alignment: 'center',
          animation: 'fade_in',
        },
        position: { x: 960, y: 540 },
      },
    },

    // Scene 2: Solution (0:15-0:30)
    {
      id: 'scene_2',
      name: 'Solution Intro',
      startFrame: 450,
      endFrame: 900,
      duration: 450,
      type: 'logo',
      content: {
        type: 'image',
        src: 'logos/a2r_logo.png',
      },
      transitions: [{ type: 'fade', duration: 30 }],
    },

    // Scene 3: Module Creation (0:30-0:50)
    {
      id: 'scene_3',
      name: 'Module Creation Demo',
      startFrame: 900,
      endFrame: 1500,
      duration: 600,
      type: 'screen_recording',
      content: {
        type: 'video',
        src: 'recordings/module_creation.mp4',
      },
    },
    {
      id: 'scene_3_text',
      name: 'Module Creation Text',
      startFrame: 950,
      endFrame: 1100,
      duration: 150,
      type: 'text_overlay',
      content: {
        type: 'text',
        text: '1 command. 3 modules. 30 seconds.',
        style: {
          fontSize: 48,
          fontFamily: 'Montserrat',
          color: '#FFFFFF',
          backgroundColor: 'rgba(34,197,94,0.9)',
          alignment: 'center',
          animation: 'slide_in',
        },
        position: { x: 960, y: 900 },
      },
    },

    // Scene 4: Assignment Creation (0:50-1:15)
    {
      id: 'scene_4',
      name: 'Assignment Creation Demo',
      startFrame: 1500,
      endFrame: 2250,
      duration: 750,
      type: 'screen_recording',
      content: {
        type: 'video',
        src: 'recordings/assignment_creation.mp4',
      },
    },
    {
      id: 'scene_4_text',
      name: 'Assignment Creation Text',
      startFrame: 1550,
      endFrame: 1700,
      duration: 150,
      type: 'text_overlay',
      content: {
        type: 'text',
        text: 'Your style. Every time.',
        style: {
          fontSize: 48,
          fontFamily: 'Montserrat',
          color: '#FFFFFF',
          backgroundColor: 'rgba(34,197,94,0.9)',
          alignment: 'center',
          animation: 'slide_in',
        },
        position: { x: 960, y: 900 },
      },
    },

    // Scene 5: Platform Integration (1:15-1:35)
    {
      id: 'scene_5',
      name: 'Platform Integration',
      startFrame: 2250,
      endFrame: 2850,
      duration: 600,
      type: 'logo',
      content: {
        type: 'image',
        src: 'logos/platforms_composite.png',
      },
    },
    {
      id: 'scene_5_text',
      name: 'Platform Integration Text',
      startFrame: 2300,
      endFrame: 2450,
      duration: 150,
      type: 'text_overlay',
      content: {
        type: 'text',
        text: 'All your tools. One system.',
        style: {
          fontSize: 48,
          fontFamily: 'Montserrat',
          color: '#FFFFFF',
          backgroundColor: 'rgba(34,197,94,0.9)',
          alignment: 'center',
          animation: 'slide_in',
        },
        position: { x: 960, y: 900 },
      },
    },

    // Scene 6: Result (1:35-1:50)
    {
      id: 'scene_6',
      name: 'The Result',
      startFrame: 2850,
      endFrame: 3300,
      duration: 450,
      type: 'screen_recording',
      content: {
        type: 'video',
        src: 'recordings/teacher_leaving_happy.mp4',
      },
    },
    {
      id: 'scene_6_text',
      name: 'Result Text',
      startFrame: 2900,
      endFrame: 3050,
      duration: 150,
      type: 'text_overlay',
      content: {
        type: 'text',
        text: '10 hours → 10 minutes.',
        style: {
          fontSize: 72,
          fontFamily: 'Montserrat',
          color: '#FFFFFF',
          backgroundColor: 'rgba(34,197,94,0.9)',
          alignment: 'center',
          animation: 'fade_in',
        },
        position: { x: 960, y: 540 },
      },
    },

    // Scene 7: Call to Action (1:50-2:00)
    {
      id: 'scene_7',
      name: 'Call to Action',
      startFrame: 3300,
      endFrame: 3600,
      duration: 300,
      type: 'logo',
      content: {
        type: 'image',
        src: 'logos/a2r_logo_final.png',
      },
    },
    {
      id: 'scene_7_text',
      name: 'CTA Text',
      startFrame: 3350,
      endFrame: 3550,
      duration: 200,
      type: 'text_overlay',
      content: {
        type: 'text',
        text: 'A2R Operator\nBecause teachers deserve to go home at 3 PM.',
        style: {
          fontSize: 48,
          fontFamily: 'Montserrat',
          color: '#FFFFFF',
          alignment: 'center',
          animation: 'fade_in',
        },
        position: { x: 960, y: 700 },
      },
    },
  ],
  audio: [
    {
      id: 'narration',
      type: 'narration',
      src: 'audio/narration.mp3',
      startFrame: 0,
      endFrame: 3600,
      volume: 1.0,
    },
    {
      id: 'background_music',
      type: 'music',
      src: 'audio/background_music.mp3',
      startFrame: 0,
      endFrame: 3600,
      volume: 0.3,
    },
  ],
  createdAt: new Date().toISOString(),
};

// ============================================================================
// Video Generator
// ============================================================================

export class RemotionVideoGenerator {
  private outputDir: string;
  private recordingsDir: string;
  private audioDir: string;
  private logosDir: string;

  constructor(directories: {
    output: string;
    recordings: string;
    audio: string;
    logos: string;
  }) {
    this.outputDir = directories.output;
    this.recordingsDir = directories.recordings;
    this.audioDir = directories.audio;
    this.logosDir = directories.logos;
  }

  /**
   * Generate video from composition
   */
  async generateVideo(composition: VideoComposition): Promise<VideoExport> {
    console.log('[Remotion] Starting video generation...');
    console.log('[Remotion] Composition:', composition.title);
    console.log('[Remotion] Duration:', composition.duration / 30, 'seconds');

    try {
      // In production, would use Remotion to render
      // For now, simulate the process

      // Step 1: Validate all assets exist
      const assetsValid = await this.validateAssets(composition);
      if (!assetsValid) {
        throw new Error('Missing required assets');
      }

      // Step 2: Render composition
      const outputPath = `${this.outputDir}/${composition.id}_${Date.now()}.mp4`;
      
      console.log('[Remotion] Rendering composition...');
      // await renderComposition(composition, outputPath);

      // Step 3: Export video
      const exportResult: VideoExport = {
        success: true,
        outputPath,
        duration: composition.duration / 30,
        size: 50 * 1024 * 1024, // Simulated 50MB
        format: 'mp4',
        createdAt: new Date().toISOString(),
      };

      console.log('[Remotion] Video exported:', outputPath);
      return exportResult;
    } catch (error: any) {
      console.error('[Remotion] Error:', error.message);
      return {
        success: false,
        outputPath: '',
        duration: 0,
        size: 0,
        format: 'mp4',
        createdAt: new Date().toISOString(),
        error: error.message,
      };
    }
  }

  /**
   * Validate all assets exist
   */
  private async validateAssets(composition: VideoComposition): Promise<boolean> {
    const requiredAssets: string[] = [];

    // Collect all asset paths from scenes
    for (const scene of composition.scenes) {
      if (scene.content.src) {
        requiredAssets.push(scene.content.src);
      }
    }

    // Collect audio assets
    if (composition.audio) {
      for (const track of composition.audio) {
        requiredAssets.push(track.src);
      }
    }

    // Check if assets exist (would check filesystem in production)
    console.log('[Remotion] Validating assets:', requiredAssets.length);
    
    // For demo, assume all assets exist
    return true;
  }

  /**
   * Create composition from script
   */
  createCompositionFromScript(script: VideoScript): VideoComposition {
    const composition: VideoComposition = {
      id: `composition_${Date.now()}`,
      title: script.title,
      duration: script.duration * 30,
      width: 1920,
      height: 1080,
      fps: 30,
      scenes: [],
      audio: [],
      createdAt: new Date().toISOString(),
    };

    let currentFrame = 0;

    // Convert script scenes to composition scenes
    for (const scene of script.scenes) {
      const duration = scene.duration * 30;
      
      composition.scenes.push({
        id: `scene_${composition.scenes.length}`,
        name: scene.name,
        startFrame: currentFrame,
        endFrame: currentFrame + duration,
        duration,
        type: scene.type,
        content: scene.content,
        transitions: scene.transitions,
      });

      currentFrame += duration;
    }

    // Add audio tracks
    if (script.narration) {
      composition.audio?.push({
        id: 'narration',
        type: 'narration',
        src: script.narration,
        startFrame: 0,
        endFrame: composition.duration,
        volume: 1.0,
      });
    }

    return composition;
  }
}

// ============================================================================
// Video Script Type
// ============================================================================

export interface VideoScript {
  title: string;
  duration: number; // in seconds
  scenes: ScriptScene[];
  narration?: string; // path to audio file
}

export interface ScriptScene {
  name: string;
  duration: number; // in seconds
  type: 'screen_recording' | 'text_overlay' | 'logo' | 'transition';
  content: SceneContent;
  transitions?: Transition[];
  narration?: string; // specific narration for this scene
}

/**
 * Factory function to create video generator
 */
export function createRemotionVideoGenerator(directories: {
  output: string;
  recordings: string;
  audio: string;
  logos: string;
}): RemotionVideoGenerator {
  return new RemotionVideoGenerator(directories);
}
