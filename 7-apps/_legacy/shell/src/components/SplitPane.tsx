import * as React from 'react';

interface SplitPaneProps {
  leftPane: React.ReactNode;
  centerPane: React.ReactNode;
  rightPane?: React.ReactNode;
  mobileBreakpoint?: number;
}

export const SplitPane: React.FC<SplitPaneProps> = ({
  leftPane,
  centerPane,
  rightPane,
  mobileBreakpoint = 768,
}) => {
  const [isMobile, setIsMobile] = React.useState(
    typeof window !== 'undefined' && window.innerWidth < mobileBreakpoint
  );
  const [showLeftPane, setShowLeftPane] = React.useState(false);
  const [showRightPane, setShowRightPane] = React.useState(false);

  React.useEffect(() => {
    const handleResize = () => {
      if (typeof window !== 'undefined') {
        setIsMobile(window.innerWidth < mobileBreakpoint);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [mobileBreakpoint]);

  React.useEffect(() => {
    if (!isMobile) {
      setShowLeftPane(false);
      setShowRightPane(false);
    }
  }, [isMobile]);

  if (isMobile) {
    return (
      <div className="split-pane-mobile">
        <div className="split-pane-mobile-center">
          <div className="split-pane-mobile-controls">
            <button
              className="split-pane-mobile-btn"
              onClick={() => {
                setShowLeftPane(true);
                setShowRightPane(false);
              }}
              type="button"
            >
              Evidence
            </button>
            {rightPane && (
              <button
                className="split-pane-mobile-btn"
                onClick={() => {
                  setShowRightPane(true);
                  setShowLeftPane(false);
                }}
                type="button"
              >
                Actions
              </button>
            )}
          </div>
          {centerPane}
        </div>
        {showLeftPane && (
          <div
            className="split-pane-mobile-backdrop"
            onClick={() => {
              setShowLeftPane(false);
              setShowRightPane(false);
            }}
          />
        )}
        <div className={`split-pane-mobile-left ${showLeftPane ? 'open' : ''}`}>
          <div className="split-pane-mobile-header">
            <span>Evidence</span>
            <button
              className="split-pane-mobile-close"
              onClick={() => setShowLeftPane(false)}
              type="button"
            >
              ✕
            </button>
          </div>
          <div className="split-pane-mobile-body">
            {leftPane}
          </div>
        </div>
        {rightPane && (
          <div className={`split-pane-mobile-right ${showRightPane ? 'open' : ''}`}>
            <div className="split-pane-mobile-header">
              <span>Actions</span>
              <button
                className="split-pane-mobile-close"
                onClick={() => setShowRightPane(false)}
                type="button"
              >
                ✕
              </button>
            </div>
            <div className="split-pane-mobile-body">
              {rightPane}
            </div>
          </div>
        )}
        {showRightPane && (
          <div
            className="split-pane-mobile-backdrop"
            onClick={() => {
              setShowLeftPane(false);
              setShowRightPane(false);
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="split-pane-desktop">
      <div className="split-pane-left">
        {leftPane}
      </div>
      <div className="split-pane-center">
        {centerPane}
      </div>
      {rightPane && (
        <div className="split-pane-right">
          {rightPane}
        </div>
      )}
    </div>
  );
};
