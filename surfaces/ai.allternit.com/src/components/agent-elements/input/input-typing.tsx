import { useState, useEffect, useRef } from "react";

export function useInputTyping(
  text: string,
  duration: number,
  isActive: boolean,
  onComplete: () => void,
) {
  const [visibleChars, setVisibleChars] = useState(0);
  const [showImage, setShowImage] = useState(false);
  
  // Inline state adjustment for isActive change
  const [prevIsActive, setPrevIsActive] = useState(isActive);
  if (isActive !== prevIsActive) {
    setPrevIsActive(isActive);
    if (!isActive) {
      setVisibleChars(0);
      setShowImage(false);
    }
  }

  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (!isActive) {
      return;
    }

    const imageDelay = duration * 0.1;
    const typingStart = duration * 0.15;
    const typingDuration = duration * 0.7;
    const charInterval = typingDuration / text.length;
    const sendDelay = duration * 0.15;
    const timers: ReturnType<typeof setTimeout>[] = [];

    timers.push(setTimeout(() => setShowImage(true), imageDelay));
    for (let i = 0; i < text.length; i++) {
      timers.push(
        setTimeout(
          () => setVisibleChars(i + 1),
          typingStart + charInterval * i,
        ),
      );
    }
    timers.push(
      setTimeout(
        () => onCompleteRef.current(),
        typingStart + typingDuration + sendDelay,
      ),
    );

    return () => {
      timers.forEach(t => clearTimeout(t));
    };
  }, [isActive, text, duration]);

  return { displayedText: text.slice(0, visibleChars), showImage };
}
