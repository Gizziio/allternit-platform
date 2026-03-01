/**
 * Browser Timeline Component
 * 
 * Visualizes browser automation actions with before/after comparison,
 * DOM diff highlighting, and replay controls.
 */

import React, { useState, useCallback, useEffect } from 'react';
import styles from './BrowserTimeline.module.css';

// Types matching the Rust receipts
export interface BrowserActionReceipt {
  id: string;
  tool: string;
  params: Record<string, unknown>;
  result: BrowserResult;
  beforeScreenshot?: string; // base64
  afterScreenshot?: string; // base64
  domSnapshotBefore?: DomSnapshot;
  domSnapshotAfter?: DomSnapshot;
  networkLog: NetworkEvent[];
  events: BrowserEvent[];
  durationMs: number;
  timestamp: string;
}

export interface BrowserResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface DomSnapshot {
  html: string;
  title: string;
  url: string;
  viewport: { width: number; height: number };
}

export interface NetworkEvent {
  url: string;
  method: string;
  status: number;
  timestamp: number;
}

export interface BrowserEvent {
  type: 'navigation' | 'click' | 'type' | 'scroll' | 'screenshot' | 'error';
  timestamp: number;
  data: unknown;
}

export interface BrowserTimelineProps {
  sessionId: string;
  actions: BrowserActionReceipt[];
  onStepSelect?: (step: number) => void;
  autoPlay?: boolean;
}

// ============================================================================
// Main Component
// ============================================================================

export const BrowserTimeline: React.FC<BrowserTimelineProps> = ({
  sessionId,
  actions,
  onStepSelect,
  autoPlay = false,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [showDiff, setShowDiff] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'screenshot' | 'dom' | 'network'>('screenshot');

  const currentAction = actions[currentStep];

  // Auto-play functionality
  useEffect(() => {
    if (!isPlaying || currentStep >= actions.length - 1) {
      setIsPlaying(false);
      return;
    }

    const timer = setTimeout(() => {
      setCurrentStep((prev) => prev + 1);
    }, 2000);

    return () => clearTimeout(timer);
  }, [isPlaying, currentStep, actions.length]);

  const handleStepSelect = useCallback((index: number) => {
    setCurrentStep(index);
    onStepSelect?.(index);
  }, [onStepSelect]);

  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  const stepTo = useCallback((direction: 'prev' | 'next') => {
    setCurrentStep((prev) => {
      if (direction === 'prev') return Math.max(0, prev - 1);
      return Math.min(actions.length - 1, prev + 1);
    });
  }, [actions.length]);

  if (actions.length === 0) {
    return (
      <div className={styles.empty}>
        <p>No browser actions recorded</p>
      </div>
    );
  }

  return (
    <div className={styles.timeline} data-testid="browser-timeline">
      {/* Header */}
      <div className={styles.header}>
        <h3>Browser Session: {sessionId.slice(0, 8)}...</h3>
        <div className={styles.stats}>
          <span>Step {currentStep + 1} of {actions.length}</span>
          <span className={styles.duration}>
            Total: {(actions.reduce((sum, a) => sum + a.durationMs, 0) / 1000).toFixed(1)}s
          </span>
        </div>
      </div>

      {/* Playback Controls */}
      <div className={styles.controls}>
        <button
          className={styles.controlBtn}
          onClick={() => setCurrentStep(0)}
          disabled={currentStep === 0}
        >
          ⏮ First
        </button>
        <button
          className={styles.controlBtn}
          onClick={() => stepTo('prev')}
          disabled={currentStep === 0}
        >
          ⏮ Prev
        </button>
        <button
          className={`${styles.controlBtn} ${styles.playBtn}`}
          onClick={togglePlay}
        >
          {isPlaying ? '⏸ Pause' : '▶ Play'}
        </button>
        <button
          className={styles.controlBtn}
          onClick={() => stepTo('next')}
          disabled={currentStep === actions.length - 1}
        >
          Next ⏭
        </button>
        <button
          className={styles.controlBtn}
          onClick={() => setCurrentStep(actions.length - 1)}
          disabled={currentStep === actions.length - 1}
        >
          Last ⏭
        </button>
      </div>

      {/* Main Content */}
      <div className={styles.content}>
        {/* Step List */}
        <div className={styles.stepList}>
          {actions.map((action, index) => (
            <TimelineStep
              key={action.id}
              index={index}
              action={action}
              isActive={index === currentStep}
              isCompleted={index < currentStep}
              onClick={() => handleStepSelect(index)}
            />
          ))}
        </div>

        {/* Detail View */}
        <div className={styles.detailView}>
          {currentAction && (
            <>
              <div className={styles.tabs}>
                <button
                  className={selectedTab === 'screenshot' ? styles.activeTab : ''}
                  onClick={() => setSelectedTab('screenshot')}
                >
                  📸 Screenshot
                </button>
                <button
                  className={selectedTab === 'dom' ? styles.activeTab : ''}
                  onClick={() => setSelectedTab('dom')}
                >
                  🌐 DOM
                </button>
                <button
                  className={selectedTab === 'network' ? styles.activeTab : ''}
                  onClick={() => setSelectedTab('network')}
                >
                  🌐 Network ({currentAction.networkLog.length})
                </button>
              </div>

              <div className={styles.tabContent}>
                {selectedTab === 'screenshot' && (
                  <ScreenshotView
                    action={currentAction}
                    showDiff={showDiff}
                    onToggleDiff={() => setShowDiff(!showDiff)}
                  />
                )}
                {selectedTab === 'dom' && (
                  <DomView
                    before={currentAction.domSnapshotBefore}
                    after={currentAction.domSnapshotAfter}
                  />
                )}
                {selectedTab === 'network' && (
                  <NetworkView events={currentAction.networkLog} />
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Sub-components
// ============================================================================

interface TimelineStepProps {
  index: number;
  action: BrowserActionReceipt;
  isActive: boolean;
  isCompleted: boolean;
  onClick: () => void;
}

const TimelineStep: React.FC<TimelineStepProps> = ({
  index,
  action,
  isActive,
  isCompleted,
  onClick,
}) => {
  const toolIcon = getToolIcon(action.tool);
  const statusIcon = action.result.success ? '✓' : '✗';
  const statusClass = action.result.success ? styles.success : styles.error;

  return (
    <div
      className={`${styles.step} ${isActive ? styles.active : ''} ${
        isCompleted ? styles.completed : ''
      }`}
      onClick={onClick}
    >
      <div className={`${styles.stepNumber} ${statusClass}`}>
        {isCompleted ? statusIcon : index + 1}
      </div>
      <div className={styles.stepContent}>
        <div className={styles.stepTitle}>
          {toolIcon} {action.tool}
        </div>
        <div className={styles.stepMeta}>
          <span>{action.durationMs}ms</span>
          <span>{new Date(action.timestamp).toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  );
};

interface ScreenshotViewProps {
  action: BrowserActionReceipt;
  showDiff: boolean;
  onToggleDiff: () => void;
}

const ScreenshotView: React.FC<ScreenshotViewProps> = ({
  action,
  showDiff,
  onToggleDiff,
}) => {
  const [sliderPosition, setSliderPosition] = useState(50);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSliderPosition(parseInt(e.target.value));
  };

  if (!action.beforeScreenshot && !action.afterScreenshot) {
    return <div className={styles.noScreenshot}>No screenshots available</div>;
  }

  return (
    <div className={styles.screenshotView}>
      <div className={styles.screenshotControls}>
        <label className={styles.diffToggle}>
          <input
            type="checkbox"
            checked={showDiff}
            onChange={onToggleDiff}
          />
          Show comparison slider
        </label>
      </div>

      {showDiff && action.beforeScreenshot && action.afterScreenshot ? (
        <div className={styles.comparisonSlider} ref={containerRef}>
          <div className={styles.imageContainer}>
            {/* After image (background) */}
            <img
              src={`data:image/png;base64,${action.afterScreenshot}`}
              alt="After"
              className={styles.comparisonImage}
            />
            {/* Before image (clipped) */}
            <div
              className={styles.beforeClip}
              style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
            >
              <img
                src={`data:image/png;base64,${action.beforeScreenshot}`}
                alt="Before"
                className={styles.comparisonImage}
              />
            </div>
            {/* Slider handle */}
            <input
              type="range"
              min="0"
              max="100"
              value={sliderPosition}
              onChange={handleSliderChange}
              className={styles.slider}
            />
            <div
              className={styles.sliderHandle}
              style={{ left: `${sliderPosition}%` }}
            >
              ↔
            </div>
          </div>
          <div className={styles.labels}>
            <span>Before</span>
            <span>After</span>
          </div>
        </div>
      ) : (
        <div className={styles.screenshots}>
          {action.beforeScreenshot && (
            <div className={styles.screenshot}>
              <label>Before</label>
              <img
                src={`data:image/png;base64,${action.beforeScreenshot}`}
                alt="Before"
              />
            </div>
          )}
          {action.afterScreenshot && (
            <div className={styles.screenshot}>
              <label>After</label>
              <img
                src={`data:image/png;base64,${action.afterScreenshot}`}
                alt="After"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

interface DomViewProps {
  before?: DomSnapshot;
  after?: DomSnapshot;
}

const DomView: React.FC<DomViewProps> = ({ before, after }) => {
  if (!before && !after) {
    return <div className={styles.noDom}>No DOM snapshots available</div>;
  }

  return (
    <div className={styles.domView}>
      <div className={styles.domColumns}>
        {before && (
          <div className={styles.domColumn}>
            <h4>Before</h4>
            <div className={styles.domInfo}>
              <p><strong>Title:</strong> {before.title}</p>
              <p><strong>URL:</strong> {before.url}</p>
              <p><strong>Viewport:</strong> {before.viewport.width}x{before.viewport.height}</p>
            </div>
            <pre className={styles.domContent}>
              {before.html.slice(0, 2000)}...
            </pre>
          </div>
        )}
        {after && (
          <div className={styles.domColumn}>
            <h4>After</h4>
            <div className={styles.domInfo}>
              <p><strong>Title:</strong> {after.title}</p>
              <p><strong>URL:</strong> {after.url}</p>
              <p><strong>Viewport:</strong> {after.viewport.width}x{after.viewport.height}</p>
            </div>
            <pre className={styles.domContent}>
              {after.html.slice(0, 2000)}...
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

interface NetworkViewProps {
  events: NetworkEvent[];
}

const NetworkView: React.FC<NetworkViewProps> = ({ events }) => {
  if (events.length === 0) {
    return <div className={styles.noNetwork}>No network activity</div>;
  }

  return (
    <div className={styles.networkView}>
      <table className={styles.networkTable}>
        <thead>
          <tr>
            <th>Method</th>
            <th>URL</th>
            <th>Status</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event, index) => (
            <tr key={index}>
              <td className={styles.method}>{event.method}</td>
              <td className={styles.url} title={event.url}>
                {new URL(event.url).pathname}
              </td>
              <td className={`${styles.status} ${getStatusClass(event.status)}`}>
                {event.status}
              </td>
              <td className={styles.time}>
                {new Date(event.timestamp).toLocaleTimeString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ============================================================================
// Helpers
// ============================================================================

function getToolIcon(tool: string): string {
  const icons: Record<string, string> = {
    'BROWSER.GET_CONTEXT': '🔍',
    'BROWSER.ACT': '👆',
    'BROWSER.NAV': '🔗',
    'BROWSER.EXTRACT': '📄',
    'BROWSER.SCREENSHOT': '📸',
    'BROWSER.WAIT': '⏱️',
  };
  return icons[tool] || '🔧';
}

function getStatusClass(status: number): string {
  if (status >= 200 && status < 300) return styles.statusSuccess;
  if (status >= 300 && status < 400) return styles.statusRedirect;
  if (status >= 400 && status < 500) return styles.statusClientError;
  return styles.statusServerError;
}

export default BrowserTimeline;
