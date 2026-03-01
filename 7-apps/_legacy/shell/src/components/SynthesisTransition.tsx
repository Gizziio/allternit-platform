import * as React from 'react';

interface SynthesisTransitionProps {
  isSynthesizing: boolean;
  onComplete: () => void;
  children: React.ReactNode;
}

export const SynthesisTransition: React.FC<SynthesisTransitionProps> = ({
  isSynthesizing,
  onComplete,
  children,
}) => {
  const [stage, setStage] = React.useState<'idle' | 'compressing' | 'revealing' | 'complete'>('idle');

  React.useEffect(() => {
    if (isSynthesizing) {
      setStage('compressing');
      setTimeout(() => setStage('revealing'), 200);
      setTimeout(() => {
        setStage('complete');
        setTimeout(() => {
          setStage('idle');
          onComplete();
        }, 500);
      }, 300);
    }
  }, [isSynthesizing, onComplete]);

  return (
    <div className={`synthesis-transition ${stage}`}>
      {children}
    </div>
  );
};
