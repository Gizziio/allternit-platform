import { useState, useCallback, useEffect } from 'react';
import { DEFAULT_CONFIG } from '../types';
import type { Annotation, AnnotationOutput, AgentationConfig } from '../types';

/**
 * Hook for managing Agentation state and annotations
 */
export function useAgentation(config: Partial<typeof DEFAULT_CONFIG> = {}) {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  
  const [isEnabled, setIsEnabled] = useState(false);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [selectedElement, setSelectedElement] = useState<Element | null>(null);
  const [notes, setNotes] = useState('');

  // Load annotations from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    try {
      const stored = localStorage.getItem(mergedConfig.storageKey);
      if (stored) {
        setAnnotations(JSON.parse(stored));
      }
    } catch (error) {
      console.warn('Failed to load Agentation annotations:', error);
    }
  }, [mergedConfig.storageKey]);

  // Save annotations to localStorage when changed
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem(mergedConfig.storageKey, JSON.stringify(annotations));
    } catch (error) {
      console.warn('Failed to save Agentation annotations:', error);
    }
  }, [annotations, mergedConfig.storageKey]);

  // Toggle Agentation enabled state
  const toggleEnabled = useCallback(() => {
    setIsEnabled(prev => !prev);
  }, []);

  // Select an element for annotation
  const selectElement = useCallback((element: Element) => {
    setSelectedElement(element);
  }, []);

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedElement(null);
    setNotes('');
  }, []);

  // Save annotation
  const saveAnnotation = useCallback(() => {
    if (!selectedElement || !notes.trim()) return;

    const elementInfo = getElementInfo(selectedElement);
    const screenshot = captureElementScreenshot(selectedElement);

    const annotation: Annotation = {
      id: `ann_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      element: elementInfo,
      notes: notes.trim(),
      screenshot,
      createdAt: Date.now(),
    };

    setAnnotations(prev => [...prev, annotation]);
    clearSelection();
    
    return annotation;
  }, [selectedElement, notes, clearSelection]);

  // Delete annotation
  const deleteAnnotation = useCallback((id: string) => {
    setAnnotations(prev => prev.filter(a => a.id !== id));
  }, []);

  // Get output for clipboard
  const getOutput = useCallback((annotation: Annotation): AnnotationOutput => {
    return {
      notes: annotation.notes,
      selectors: annotation.element.selectors,
      context: getElementContext(annotation.element),
      screenshot: annotation.screenshot,
    };
  }, []);

  // Clear all annotations
  const clearAll = useCallback(() => {
    if (confirm('Are you sure you want to delete all annotations?')) {
      setAnnotations([]);
    }
  }, []);

  return {
    // State
    isEnabled,
    annotations,
    selectedElement,
    notes,
    setNotes,
    
    // Actions
    toggleEnabled,
    selectElement,
    clearSelection,
    saveAnnotation,
    deleteAnnotation,
    getOutput,
    clearAll,
    
    // Config
    config: mergedConfig,
  };
}

/**
 * Hook for selecting elements with mouse
 */
export function useElementSelector(
  isEnabled: boolean,
  onSelect: (element: Element) => void
) {
  const [isSelecting, setIsSelecting] = useState(false);

  useEffect(() => {
    if (!isEnabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsSelecting(false);
      }
    };

    const handleClick = (e: MouseEvent) => {
      if (!isSelecting) return;
      
      e.preventDefault();
      e.stopPropagation();
      
      if (e.target instanceof Element) {
        onSelect(e.target);
      }
      
      setIsSelecting(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('click', handleClick, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('click', handleClick, true);
    };
  }, [isEnabled, isSelecting, onSelect]);

  const startSelecting = useCallback(() => {
    setIsSelecting(true);
  }, []);

  const stopSelecting = useCallback(() => {
    setIsSelecting(false);
  }, []);

  return {
    isSelecting,
    startSelecting,
    stopSelecting,
  };
}

/**
 * Get element info for annotation
 */
function getElementInfo(element: Element) {
  const selectors = generateSelectors(element);
  
  return {
    tagName: element.tagName.toLowerCase(),
    id: element.id || undefined,
    className: element.className || undefined,
    selectors,
    xpath: getXPath(element),
    text: element.textContent?.trim().substring(0, 100) || undefined,
    boundingBox: {
      x: element.getBoundingClientRect().left,
      y: element.getBoundingClientRect().top,
      width: element.getBoundingClientRect().width,
      height: element.getBoundingClientRect().height,
    },
  };
}

/**
 * Generate CSS selectors for an element
 */
export function generateSelectors(element: Element): string[] {
  const selectors: string[] = [];
  
  // ID selector (most specific)
  if (element.id) {
    selectors.push(`#${element.id}`);
  }
  
  // Class selector
  if (element.className && typeof element.className === 'string') {
    const classes = element.className.split(' ').filter(Boolean);
    if (classes.length > 0) {
      selectors.push(`.${classes.join('.')}`);
    }
  }
  
  // Tag + attribute selectors
  selectors.push(element.tagName.toLowerCase());
  
  // Data attributes
  Array.from(element.attributes).forEach(attr => {
    if (attr.name.startsWith('data-')) {
      selectors.push(`[${attr.name}="${attr.value}"]`);
    }
  });
  
  return selectors;
}

/**
 * Get XPath for an element
 */
export function getXPath(element: Element): string {
  if (element.id) {
    return `//*[@id="${element.id}"]`;
  }
  
  const parts: string[] = [];
  let current: Element | null = element;
  
  while (current && current.nodeType === Node.ELEMENT_NODE) {
    let selector = current.tagName.toLowerCase();
    
    if (current.id) {
      selector = `*[@id="${current.id}"]`;
      parts.unshift(selector);
      break;
    }
    
    let sibling = current.previousElementSibling;
    let index = 1;
    
    while (sibling) {
      if (sibling.tagName === current.tagName) {
        index++;
      }
      sibling = sibling.previousElementSibling;
    }
    
    if (index > 1) {
      selector += `[${index}]`;
    }
    
    parts.unshift(selector);
    current = current.parentElement;
  }
  
  return '/' + parts.join('/');
}

/**
 * Get context description for an element
 */
function getElementContext(elementInfo: any): string {
  const parts: string[] = [];
  
  parts.push(`Element: <${elementInfo.tagName}>`);
  
  if (elementInfo.id) {
    parts.push(`ID: ${elementInfo.id}`);
  }
  
  if (elementInfo.className) {
    parts.push(`Classes: ${elementInfo.className}`);
  }
  
  if (elementInfo.text) {
    parts.push(`Text: "${elementInfo.text}"`);
  }
  
  return parts.join('\n');
}

/**
 * Capture element screenshot (returns data URL)
 */
function captureElementScreenshot(element: Element): string | undefined {
  // Note: This is a simplified version
  // In production, you'd use html2canvas or similar
  // For now, we skip screenshot capture to avoid dependencies
  return undefined;
}


