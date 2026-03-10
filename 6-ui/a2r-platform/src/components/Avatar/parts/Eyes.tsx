/**
 * Eyes Component
 * 
 * Renders avatar eyes with support for:
 * - 12+ eye presets
 * - Pupil styles
 * - Blink animations
 * - Emotion expressions
 * - Eye tracking
 */

import React, { useMemo } from 'react';
import type { 
  AvatarConfig, 
  AvatarEmotion, 
  EyePreset, 
  PupilStyle 
} from '../../../lib/agents/character.types';

interface EyesProps {
  config: AvatarConfig['eyes'];
  size: number;
  emotion?: AvatarEmotion;
  isAnimating?: boolean;
  lookAt?: { x: number; y: number } | null;
}

// Eye preset path definitions
const EYE_PRESETS: Record<EyePreset, {
  name: string;
  leftPath: string;
  rightPath?: string;
  pupilOffsetY: number;
  width: number;
  height: number;
}> = {
  round: {
    name: 'Round',
    leftPath: 'M 38 42 C 38 36 42 32 50 32 C 58 32 62 36 62 42 C 62 48 58 52 50 52 C 42 52 38 48 38 42 Z',
    pupilOffsetY: 0,
    width: 24,
    height: 20,
  },
  wide: {
    name: 'Wide',
    leftPath: 'M 38 40 C 38 33 43 28 50 28 C 57 28 62 33 62 40 C 62 47 57 52 50 52 C 43 52 38 47 38 40 Z',
    pupilOffsetY: 0,
    width: 24,
    height: 24,
  },
  narrow: {
    name: 'Narrow',
    leftPath: 'M 38 42 C 38 39 43 38 50 38 C 57 38 62 39 62 42 C 62 45 57 46 50 46 C 43 46 38 45 38 42 Z',
    pupilOffsetY: 0,
    width: 24,
    height: 8,
  },
  focused: {
    name: 'Focused',
    leftPath: 'M 38 42 C 38 38 43 36 50 36 C 57 36 62 38 62 42 C 62 46 57 48 50 48 C 43 48 38 46 38 42 Z',
    pupilOffsetY: 0,
    width: 24,
    height: 12,
  },
  curious: {
    name: 'Curious',
    leftPath: 'M 38 44 C 38 38 42 34 48 34 C 54 34 58 38 58 44 C 58 50 54 54 48 54 C 42 54 38 50 38 44 Z',
    rightPath: 'M 42 40 C 42 34 46 30 52 30 C 58 30 62 34 62 40 C 62 46 58 50 52 50 C 46 50 42 46 42 40 Z',
    pupilOffsetY: -2,
    width: 20,
    height: 20,
  },
  pleased: {
    name: 'Pleased',
    leftPath: 'M 38 42 Q 50 48 62 42',
    pupilOffsetY: 2,
    width: 24,
    height: 6,
  },
  skeptical: {
    name: 'Skeptical',
    leftPath: 'M 38 38 L 62 42',
    rightPath: 'M 38 42 L 62 46',
    pupilOffsetY: -1,
    width: 24,
    height: 8,
  },
  mischief: {
    name: 'Mischief',
    leftPath: 'M 38 40 C 38 36 42 34 50 34 C 56 34 60 36 62 40 C 62 44 58 48 50 48 C 44 48 40 46 38 40 Z',
    pupilOffsetY: 1,
    width: 24,
    height: 14,
  },
  proud: {
    name: 'Proud',
    leftPath: 'M 38 40 Q 50 35 62 40 L 62 44 Q 50 52 38 44 Z',
    pupilOffsetY: -2,
    width: 24,
    height: 12,
  },
  dizzy: {
    name: 'Dizzy',
    leftPath: 'M 42 38 L 58 46 M 58 38 L 42 46',
    pupilOffsetY: 0,
    width: 16,
    height: 8,
  },
  sleepy: {
    name: 'Sleepy',
    leftPath: 'M 38 44 Q 50 46 62 44',
    pupilOffsetY: 3,
    width: 24,
    height: 4,
  },
  starry: {
    name: 'Starry',
    leftPath: 'M 50 30 L 52 38 L 60 38 L 54 43 L 56 51 L 50 46 L 44 51 L 46 43 L 40 38 L 48 38 Z',
    pupilOffsetY: 0,
    width: 20,
    height: 21,
  },
  pixel: {
    name: 'Pixel',
    leftPath: 'M 42 38 L 58 38 L 58 46 L 42 46 Z',
    pupilOffsetY: 0,
    width: 16,
    height: 8,
  },
};

// Pupil style definitions
const PUPIL_STYLES: Record<PupilStyle, {
  render: (cx: number, cy: number, r: number, color: string) => React.ReactNode;
}> = {
  dot: {
    render: (cx, cy, r, color) => (
      <circle cx={cx} cy={cy} r={r} fill={color} />
    ),
  },
  ring: {
    render: (cx, cy, r, color) => (
      <>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={r * 0.4} />
        <circle cx={cx} cy={cy} r={r * 0.3} fill={color} />
      </>
    ),
  },
  slit: {
    render: (cx, cy, r, color) => (
      <ellipse cx={cx} cy={cy} rx={r * 0.4} ry={r * 1.2} fill={color} />
    ),
  },
  star: {
    render: (cx, cy, r, color) => {
      const points = [];
      for (let i = 0; i < 5; i++) {
        const angle = (i * 144 - 90) * Math.PI / 180;
        const outerX = cx + Math.cos(angle) * r;
        const outerY = cy + Math.sin(angle) * r;
        const innerAngle = ((i * 144 + 72) - 90) * Math.PI / 180;
        const innerX = cx + Math.cos(innerAngle) * (r * 0.4);
        const innerY = cy + Math.sin(innerAngle) * (r * 0.4);
        points.push(`${outerX},${outerY} ${innerX},${innerY}`);
      }
      return <polygon points={points.join(' ')} fill={color} />;
    },
  },
  heart: {
    render: (cx, cy, r, color) => (
      <path
        d={`M ${cx} ${cy + r * 0.3} 
            C ${cx} ${cy - r * 0.5}, ${cx - r} ${cy - r * 0.8}, ${cx - r} ${cy} 
            C ${cx - r} ${cy + r * 0.8}, ${cx} ${cy + r}, ${cx} ${cy + r} 
            C ${cx} ${cy + r}, ${cx + r} ${cy + r * 0.8}, ${cx + r} ${cy} 
            C ${cx + r} ${cy - r * 0.8}, ${cx} ${cy - r * 0.5}, ${cx} ${cy + r * 0.3} Z`}
        fill={color}
        transform={`scale(0.8) translate(${cx * 0.25}, ${cy * 0.25})`}
      />
    ),
  },
  plus: {
    render: (cx, cy, r, color) => (
      <>
        <rect x={cx - r * 0.25} y={cy - r} width={r * 0.5} height={r * 2} fill={color} rx={1} />
        <rect x={cx - r} y={cy - r * 0.25} width={r * 2} height={r * 0.5} fill={color} rx={1} />
      </>
    ),
  },
};

// Emotion adjustments for eyes
function getEmotionEyeAdjustment(emotion: AvatarEmotion | undefined): {
  scaleY: number;
  translateY: number;
} {
  if (!emotion) return { scaleY: 1, translateY: 0 };
  
  switch (emotion) {
    case 'focused':
    case 'narrow':
      return { scaleY: 0.7, translateY: 2 };
    case 'pleased':
      return { scaleY: 0.5, translateY: 4 };
    case 'proud':
      return { scaleY: 0.8, translateY: -1 };
    case 'sleepy':
      return { scaleY: 0.3, translateY: 5 };
    default:
      return { scaleY: 1, translateY: 0 };
  }
}

export const Eyes: React.FC<EyesProps> = ({
  config,
  size,
  emotion,
  isAnimating,
  lookAt,
}) => {
  const preset = (config?.preset && EYE_PRESETS[config.preset]) || EYE_PRESETS['round'];
  const pupilStyle = (config?.pupilStyle && PUPIL_STYLES[config.pupilStyle]) || PUPIL_STYLES['dot'];
  const emotionAdj = getEmotionEyeAdjustment(emotion);
  
  // Calculate scales
  const baseScale = (config?.size || 1) * (size / 100);
  const eyeSpacing = 14 * baseScale;
  
  // Calculate pupil offset based on lookAt
  const lookOffset = useMemo(() => {
    if (!lookAt) return { x: 0, y: preset.pupilOffsetY };
    return {
      x: lookAt.x * 3, // Max 3px offset
      y: lookAt.y * 2 + preset.pupilOffsetY,
    };
  }, [lookAt, preset.pupilOffsetY]);
  
  // Blink animation class
  const blinkClass = isAnimating ? `avatar-eyes--blink-${config?.blinkRate || 'normal'}` : '';
  
  // Render single eye
  const renderEye = (
    cx: number,
    isLeft: boolean,
    path?: string
  ): React.ReactNode => {
    const eyePath = path || preset.leftPath;
    const pupilR = 3 * baseScale;
    const pupilX = cx + lookOffset.x;
    const pupilY = 42 + lookOffset.y;
    
    // Apply emotion transform
    const transform = `scale(1, ${emotionAdj.scaleY}) translate(0, ${emotionAdj.translateY})`;
    
    return (
      <g 
        key={isLeft ? 'left' : 'right'}
        className={`avatar-eye avatar-eye--${isLeft ? 'left' : 'right'}`}
        transform={transform}
      >
        {/* Eye white/shape */}
        <path
          d={eyePath}
          fill={config?.color || '#ECECEC'}
          opacity={0.9}
        />
        
        {/* Pupil */}
        {pupilStyle.render(pupilX, pupilY, pupilR, config?.color || '#ECECEC')}
        
        {/* Highlight/reflection */}
        <circle
          cx={pupilX + pupilR * 0.3}
          cy={pupilY - pupilR * 0.3}
          r={pupilR * 0.4}
          fill="white"
          opacity="0.6"
        />
      </g>
    );
  };
  
  return (
    <g 
      className={`avatar-eyes ${blinkClass}`}
      data-preset={config?.preset || 'round'}
      data-pupil={config?.pupilStyle || 'dot'}
      data-emotion={emotion}
      style={{
        transformOrigin: 'center',
      }}
    >
      {/* Left eye */}
      {renderEye(50 - eyeSpacing, true, preset.rightPath && preset.leftPath)}
      
      {/* Right eye */}
      {renderEye(50 + eyeSpacing, false, preset.rightPath || preset.leftPath)}
    </g>
  );
};

// Export eye preset metadata
export const EYE_PRESET_METADATA = Object.entries(EYE_PRESETS).map(([id, def]) => ({
  id: id as EyePreset,
  name: def.name,
  description: getEyeDescription(id as EyePreset),
}));

function getEyeDescription(preset: EyePreset): string {
  const descriptions: Record<EyePreset, string> = {
    round: 'Friendly and approachable',
    wide: 'Alert and attentive',
    narrow: 'Focused and intense',
    focused: 'Intensely concentrated',
    curious: 'Questioning and inquisitive',
    pleased: 'Happy and content',
    skeptical: 'Questioning and doubtful',
    mischief: 'Playful and scheming',
    proud: 'Confident and assured',
    dizzy: 'Confused and overwhelmed',
    sleepy: 'Relaxed and calm',
    starry: 'Excited and amazed',
    pixel: 'Digital and retro',
  };
  return descriptions[preset];
}

// Export pupil style metadata
export const PUPIL_STYLE_METADATA: Record<PupilStyle, { name: string; description: string }> = {
  dot: { name: 'Dot', description: 'Classic simple pupil' },
  ring: { name: 'Ring', description: 'Hollow ring design' },
  slit: { name: 'Slit', description: 'Vertical slit' },
  star: { name: 'Star', description: 'Star-shaped pupil' },
  heart: { name: 'Heart', description: 'Heart-shaped pupil' },
  plus: { name: 'Plus', description: 'Plus sign pupil' },
};

Eyes.displayName = 'Eyes';
