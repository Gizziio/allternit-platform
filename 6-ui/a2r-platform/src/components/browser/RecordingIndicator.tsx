/**
 * Browser Recording Status Indicator
 * 
 * Shows a glowing border animation when the agent is recording
 * the browser session. This provides visual feedback that the
 * agent is actively controlling the browser.
 */

import React, { useEffect, useState } from 'react';
import './RecordingIndicator.css';

export interface RecordingIndicatorProps {
  isRecording: boolean;
  recordingId?: string;
  duration?: number; // seconds
  framesCaptured?: number;
}

export const RecordingIndicator: React.FC<RecordingIndicatorProps> = ({
  isRecording,
  recordingId,
  duration,
  framesCaptured,
}) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isRecording) {
      setElapsed(0);
      return;
    }

    const timer = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [isRecording]);

  if (!isRecording) {
    return null;
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="recording-indicator">
      <div className="recording-glow-border" />
      <div className="recording-content">
        <div className="recording-badge">
          <span className="recording-dot" />
          <span className="recording-text">REC</span>
        </div>
        <div className="recording-info">
          <span className="recording-timer">{formatTime(elapsed)}</span>
          {framesCaptured !== undefined && (
            <span className="recording-frames">{framesCaptured} frames</span>
          )}
          {recordingId && (
            <span className="recording-id" title={recordingId}>
              {recordingId.slice(0, 8)}...
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default RecordingIndicator;
