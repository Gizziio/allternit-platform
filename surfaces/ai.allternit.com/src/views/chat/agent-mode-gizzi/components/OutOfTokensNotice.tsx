import React from 'react';
import { m, AnimatePresence } from 'framer-motion';

interface OutOfTokensNoticeProps {
  isVisible: boolean;
}

export const OutOfTokensNotice = React.memo(({ isVisible }: OutOfTokensNoticeProps) => {
  return (
    <AnimatePresence>
      {isVisible && (
        <m.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: [0, 1, 1, 1, 0], y: [10, 0, 0, 0, -5] }}
          exit={{ opacity: 0 }}
          transition={{ duration: 2.0, times: [0, 0.15, 0.5, 0.8, 1] }}
          className="fixed top-[30%] left-1/2 -translate-x-1/2 pointer-events-none z-[160]"
        >
          <div className="px-4 py-2 bg-slate-800/95 rounded-lg border border-solid border-white/10 shadow-xl text-center font-mono text-[12px] text-slate-200 tracking-tight whitespace-nowrap">
            You've hit your limit · replenishes Q4 2085 (approx. 24,847 days remaining)
          </div>
        </m.div>
      )}
    </AnimatePresence>
  );
});

OutOfTokensNotice.displayName = 'OutOfTokensNotice';
