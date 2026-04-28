"use client";

import React from "react";
import { motion } from "framer-motion";
import { 
  Robot, 
  Circle, 
  Square, 
  Lightning, 
  Sparkle, 
  Leaf, 
  Brain, 
  Shield, 
  Coins, 
  Heart, 
  Book, 
  Scales, 
  Flask, 
  GameController, 
  MusicNote, 
  Trophy, 
  AirplaneTilt, 
  House, 
  ShoppingBag,
  ForkKnife as Utensils 
} from "@phosphor-icons/react";

import { STUDIO_THEME } from "../AgentView.constants";

export function MascotPreview({ config, name }: { config: any; name: string }) {
  const getAvatarIcon = () => {
    const template = config.mascotTemplate || config.mascot?.template || 'gizzi';
    const colors = config.colors || config.style || {};
    const primaryColor = colors.primary || colors.primaryColor || STUDIO_THEME.accent;
    const accentColor = colors.glow || colors.accentColor || '#93C5FD';

    const iconStyle = { color: primaryColor, filter: `drop-shadow(0 0 4px ${accentColor}40)` };
    const size = 48;

    switch (template) {
      case 'bot': return <Robot size={size} style={iconStyle} />;
      case 'orb': return <Circle size={size} style={{ ...iconStyle, color: accentColor }} />;
      case 'geometric': return <Square size={size} style={iconStyle} />;
      case 'cyber': return <Lightning size={size} style={iconStyle} />;
      case 'magic': return <Sparkle size={size} style={iconStyle} />;
      case 'nature': return <Leaf size={size} style={iconStyle} />;
      case 'data': return <Brain size={size} style={iconStyle} />;
      case 'security': return <Shield size={size} style={iconStyle} />;
      case 'finance': return <Coins size={size} style={iconStyle} />;
      case 'healthcare': return <Heart size={size} style={iconStyle} />;
      case 'education': return <Book size={size} style={iconStyle} />;
      case 'legal': return <Scales size={size} style={iconStyle} />;
      case 'science': return <Flask size={size} style={iconStyle} />;
      case 'gaming': return <GameController size={size} style={iconStyle} />;
      case 'music': return <MusicNote size={size} style={iconStyle} />;
      case 'sports': return <Trophy size={size} style={iconStyle} />;
      case 'travel': return <AirplaneTilt size={size} style={iconStyle} />;
      case 'food': return <Utensils size={size} style={iconStyle} />;
      case 'fashion': return <Sparkle size={size} style={iconStyle} />;
      case 'realEstate': return <House size={size} style={iconStyle} />;
      case 'retail': return <ShoppingBag size={size} style={iconStyle} />;
      default: return <Robot size={size} style={iconStyle} />;
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <motion.div 
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        style={{
          width: '100px',
          height: '100px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--surface-hover)',
          border: `1px solid ${STUDIO_THEME.borderSubtle}`,
          boxShadow: '0 8px 32px var(--surface-hover)',
          position: 'relative'
        }}
      >
        <div style={{ position: 'absolute', inset: '-2px', borderRadius: '50%', background: `radial-gradient(circle, ${STUDIO_THEME.accent}10 0%, transparent 70%)` }} />
        {getAvatarIcon()}
      </motion.div>
      <div style={{ 
        fontSize: '10px', 
        fontWeight: 700, 
        color: STUDIO_THEME.textMuted, 
        textTransform: 'uppercase', 
        letterSpacing: '0.2em',
        textAlign: 'center'
      }}>{name}</div>
    </div>
  );
}
