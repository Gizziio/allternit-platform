/**
 * @fileoverview Welcome Step Component
 * 
 * The first step of the onboarding wizard that introduces A2R
 * and sets expectations for the setup process.
 * 
 * @module components/onboarding/steps/Welcome
 */

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Shield, Clock, Box } from 'lucide-react';
import { Step } from '../components/Step';
import { Button } from '../components/Button';

/**
 * Props for the WelcomeStep component
 */
export interface WelcomeStepProps {
  /** Callback to advance to the next step */
  onNext: () => void;
}

/**
 * Feature item data structure
 */
interface Feature {
  /** Lucide icon component */
  icon: React.ReactNode;
  /** Feature title */
  title: string;
  /** Feature description */
  description: string;
}

/**
 * Welcome step of the onboarding wizard
 * 
 * Presents an introduction to A2R, explains what the VM provides,
 * shows estimated setup time, and provides a call-to-action to
 * begin the setup process.
 * 
 * @param props - Component props
 * @returns {JSX.Element} Welcome step component
 */
export function WelcomeStep({ onNext }: WelcomeStepProps): JSX.Element {
  const features: Feature[] = [
    {
      icon: <Shield className="w-6 h-6 text-blue-400" />,
      title: 'Isolated Environment',
      description: 'Run commands in a secure, sandboxed VM that protects your host system.',
    },
    {
      icon: <Box className="w-6 h-6 text-green-400" />,
      title: 'Reproducible Results',
      description: 'Consistent execution environment across different machines and users.',
    },
    {
      icon: <Clock className="w-6 h-6 text-purple-400" />,
      title: 'Quick Setup',
      description: 'Get up and running in 5-10 minutes with automated setup.',
    },
  ];

  return (
    <Step
      title="Welcome to A2R"
      description="Your isolated, reproducible command execution environment"
      showNavigation={false}
    >
      <div className="space-y-8">
        {/* Hero Section */}
        <motion.div
          className="text-center space-y-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg shadow-blue-500/20">
            <Box className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">
            Agent-Action-Response Environment
          </h1>
          <p className="text-lg text-gray-400 max-w-md mx-auto">
            A secure sandbox for running AI agent commands with complete isolation 
            from your host system.
          </p>
        </motion.div>

        {/* Features Grid */}
        <motion.div
          className="grid gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              className="flex items-start gap-4 p-4 rounded-xl bg-gray-800/50 border border-gray-700/50 hover:border-gray-600 transition-colors"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.3 + index * 0.1 }}
            >
              <div className="flex-shrink-0 p-2 rounded-lg bg-gray-700/50">
                {feature.icon}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-white mb-1">{feature.title}</h3>
                <p className="text-sm text-gray-400">{feature.description}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Setup Time Estimate */}
        <motion.div
          className="flex items-center justify-center gap-2 text-sm text-gray-400"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          <Clock className="w-4 h-4" />
          <span>Estimated setup time: <strong className="text-gray-300">5-10 minutes</strong></span>
        </motion.div>

        {/* CTA Button */}
        <motion.div
          className="flex justify-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.7 }}
        >
          <Button
            size="lg"
            onClick={onNext}
            className="group"
            aria-label="Begin A2R setup process"
          >
            Get Started
            <ArrowRight className="ml-2 w-5 h-5 transition-transform group-hover:translate-x-1" />
          </Button>
        </motion.div>

        {/* Footer Info */}
        <motion.p
          className="text-center text-xs text-gray-500"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.8 }}
        >
          By continuing, you agree to download VM images for local execution.
        </motion.p>
      </div>
    </Step>
  );
}
