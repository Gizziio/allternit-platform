import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Brain,
  Wrench,
  PaintBrush,
  Storefront,
  Kanban,
  Moon,
  Bell,
  Plus,
  Sparkle,
  Robot,
  Globe,
  Code,
} from '@phosphor-icons/react';
import GlassCard from './GlassCard';

interface ToolDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const models = [
  { id: 'gpt4', name: 'GPT-4', description: 'General purpose', icon: Brain, color: '#60a5fa' },
  { id: 'claude', name: 'Claude 3', description: 'Long context', icon: Sparkle, color: '#f472b6' },
  { id: 'codex', name: 'Codex', description: 'Code specialist', icon: Code, color: '#34d399' },
  { id: 'local', name: 'Local LLM', description: 'Privacy focused', icon: Robot, color: '#a78bfa' },
];

const quickActions = [
  { id: 'studio', name: 'Studio', description: 'Create & edit', icon: PaintBrush, color: '#60a5fa' },
  { id: 'marketplace', name: 'Marketplace', description: 'Browse tools', icon: Storefront, color: '#a78bfa' },
  { id: 'kanban', name: 'Kanban', description: 'Task board', icon: Kanban, color: '#f472b6' },
];

const settings = [
  { id: 'theme', name: 'Dark Mode', icon: Moon, enabled: true },
  { id: 'notifications', name: 'Notifications', icon: Bell, enabled: true },
];

export const ToolDrawer = ({ isOpen, onClose }: ToolDrawerProps) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[400]"
            style={{ background: 'rgba(0, 0, 0, 0.5)' }}
            onClick={onClose}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-[500] rounded-t-3xl overflow-hidden"
            style={{
              background: 'rgba(20, 20, 28, 0.95)',
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(30px) saturate(200%)',
              WebkitBackdropFilter: 'blur(30px) saturate(200%)',
              maxHeight: '80vh',
            }}
          >
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div
                    className="flex items-center justify-center w-10 h-10 rounded-xl"
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                    }}
                  >
                    <Wrench weight="duotone" size={20} className="text-white/60" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white/90">Tools</h2>
                    <p className="text-sm text-white/50">Manage models and settings</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg transition-colors duration-200 hover:bg-white/10"
                >
                  <X weight="bold" size={20} className="text-white/60" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider">
                      Models
                    </h3>
                    <button
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors duration-200 hover:bg-white/10"
                      style={{ color: '#60a5fa' }}
                    >
                      <Plus weight="bold" size={12} />
                      Add
                    </button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {models.map((model) => (
                      <GlassCard
                        key={model.id}
                        variant="light"
                        hoverable
                        className="p-3 cursor-pointer group"
                        style={{
                          background: 'rgba(255, 255, 255, 0.02)',
                          border: '1px solid rgba(255, 255, 255, 0.05)',
                        }}
                      >
                        <div
                          className="flex items-center justify-center w-10 h-10 rounded-lg mb-3 transition-transform duration-200 group-hover:scale-110"
                          style={{
                            background: `${model.color}15`,
                          }}
                        >
                          <model.icon weight="duotone" size={20} color={model.color} />
                        </div>
                        <p className="text-sm font-medium text-white/90">{model.name}</p>
                        <p className="text-xs text-white/50">{model.description}</p>
                      </GlassCard>
                    ))}
                  </div>
                </section>

                <section>
                  <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-4">
                    Quick Actions
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {quickActions.map((action) => (
                      <GlassCard
                        key={action.id}
                        variant="light"
                        hoverable
                        className="p-4 cursor-pointer flex items-center gap-3 group"
                        style={{
                          background: 'rgba(255, 255, 255, 0.02)',
                          border: '1px solid rgba(255, 255, 255, 0.05)',
                        }}
                      >
                        <div
                          className="flex items-center justify-center w-12 h-12 rounded-xl transition-transform duration-200 group-hover:scale-105"
                          style={{
                            background: `${action.color}15`,
                            border: `1px solid ${action.color}25`,
                          }}
                        >
                          <action.icon weight="duotone" size={24} color={action.color} />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white/90">{action.name}</p>
                          <p className="text-xs text-white/50">{action.description}</p>
                        </div>
                      </GlassCard>
                    ))}
                  </div>
                </section>

                <section>
                  <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-4">
                    Settings
                  </h3>
                  <div className="space-y-2">
                    {settings.map((setting) => (
                      <GlassCard
                        key={setting.id}
                        variant="light"
                        className="p-3 flex items-center justify-between cursor-pointer"
                        style={{
                          background: 'rgba(255, 255, 255, 0.02)',
                          border: '1px solid rgba(255, 255, 255, 0.05)',
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="flex items-center justify-center w-9 h-9 rounded-lg"
                            style={{
                              background: 'rgba(255, 255, 255, 0.05)',
                            }}
                          >
                            <setting.icon weight="duotone" size={18} className="text-white/60" />
                          </div>
                          <span className="text-sm font-medium text-white/80">{setting.name}</span>
                        </div>
                        <div
                          className={`w-11 h-6 rounded-full relative transition-colors duration-200 ${
                            setting.enabled ? 'bg-emerald-500/30' : 'bg-white/10'
                          }`}
                        >
                          <div
                            className={`absolute top-1 w-4 h-4 rounded-full transition-all duration-200 ${
                              setting.enabled
                                ? 'left-6 bg-emerald-400'
                                : 'left-1 bg-white/40'
                            }`}
                          />
                        </div>
                      </GlassCard>
                    ))}
                    <GlassCard
                      variant="light"
                      className="p-3 flex items-center gap-3 cursor-pointer hover:bg-white/5 transition-colors duration-200"
                      style={{
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                      }}
                    >
                      <div
                        className="flex items-center justify-center w-9 h-9 rounded-lg"
                        style={{
                          background: 'rgba(255, 255, 255, 0.05)',
                        }}
                      >
                        <Globe weight="duotone" size={18} className="text-white/60" />
                      </div>
                      <div className="flex-1">
                        <span className="text-sm font-medium text-white/80">Region</span>
                        <p className="text-xs text-white/40">US East (N. Virginia)</p>
                      </div>
                      <span className="text-xs text-white/50">Change</span>
                    </GlassCard>
                  </div>
                </section>
              </div>

              <div
                className="px-6 py-4 border-t border-white/5 flex items-center justify-between"
                style={{ background: 'rgba(0, 0, 0, 0.2)' }}
              >
                <span className="text-xs text-white/40">Allternit Shell v1.0.0</span>
                <div className="flex items-center gap-2">
                  <div
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                    style={{
                      background: 'rgba(74, 222, 128, 0.15)',
                      color: '#4ade80',
                    }}
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Connected
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ToolDrawer;
