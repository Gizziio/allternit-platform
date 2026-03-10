import { useState, useEffect } from 'react';

export function useScrollSpy(selectors: string[], offset: number = 100): string | null {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const elements = selectors.map((selector) => 
      document.querySelector(selector)
    ).filter(Boolean) as Element[];

    if (elements.length === 0) return;

    const handleScroll = () => {
      const scrollPosition = window.scrollY + offset;

      for (let i = elements.length - 1; i >= 0; i--) {
        const element = elements[i];
        if (element) {
          const { offsetTop } = element as HTMLElement;
          if (offsetTop <= scrollPosition) {
            setActiveId(element.id);
            return;
          }
        }
      }

      setActiveId(null);
    };

    handleScroll(); // Initial check
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => window.removeEventListener('scroll', handleScroll);
  }, [selectors, offset]);

  return activeId;
}
