import React from 'react';
import { motion } from 'framer-motion';
import { X, Warning, Check } from '@phosphor-icons/react';
import type { ValidationError } from '../types/SwarmOrchestrator.types';
import { TEXT, createGlassStyle } from '@/design/allternit.tokens';

interface ValidationPanelProps {
  errors: ValidationError[];
  onClose: () => void;
  modeColors: any;
}

export function ValidationPanel({ errors, onClose, modeColors }: ValidationPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 10 }}
      className="absolute right-4 top-20 w-80 rounded-2xl overflow-hidden z-[200] shadow-2xl border border-solid"
      style={{
        ...createGlassStyle('thick'),
        borderColor: modeColors.border,
      }}
    >
      <div className="flex items-center justify-between p-4 border-b border-solid" style={{ borderColor: modeColors.border }}>
        <h3 className="font-bold text-sm tracking-tight" style={{ color: TEXT.primary }}>Validation Results</h3>
        <button type="button" onClick={onClose} className="p-1 rounded-md hover:bg-white/10 transition-colors" style={{ color: TEXT.tertiary }}>
          <X size={18} />
        </button>
      </div>

      <div className="p-4 max-h-[400px] overflow-y-auto space-y-3">
        {errors.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 gap-2 text-green-400">
            <Check size={32} weight="bold" />
            <span className="text-sm font-bold uppercase tracking-widest">Swarm is Ready</span>
          </div>
        ) : (
          errors.map((error) => (
            <div
              key={`${error.field}-${error.message}`}
              className="flex items-start gap-3 p-3 rounded-xl border border-solid transition-all"
              style={{
                background: error.severity === 'error' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                borderColor: error.severity === 'error' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
              }}
            >
              <Warning
                size={20}
                weight="fill"
                className={error.severity === 'error' ? 'text-red-400' : 'text-amber-400'}
              />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-black uppercase tracking-tighter mb-0.5" style={{ color: TEXT.primary }}>
                  {error.field.split('.').pop()}
                </div>
                <div className="text-[12px] leading-relaxed" style={{ color: TEXT.secondary }}>
                  {error.message}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </motion.div>
  );
}
