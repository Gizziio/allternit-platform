# T4-A2: Accessibility (a11y)

## Agent Role
Accessibility Specialist

## Task
Ensure full accessibility compliance across all UI components.

## Deliverables

### 1. A11y Audit Checklist

Create comprehensive checklist:

```markdown
# Accessibility Checklist

## Keyboard Navigation
- [ ] All interactive elements focusable
- [ ] Tab order logical
- [ ] Focus visible
- [ ] Escape closes modals/menus
- [ ] Arrow keys for lists/grids
- [ ] Space/Enter activate buttons
- [ ] Skip links present

## Screen Readers
- [ ] Semantic HTML elements
- [ ] ARIA labels on icons
- [ ] ARIA describedby for complex fields
- [ ] Live regions for updates
- [ ] Alt text on images
- [ ] Role attributes appropriate

## Color & Contrast
- [ ] 4.5:1 contrast for normal text
- [ ] 3:1 contrast for large text
- [ ] 3:1 contrast for UI components
- [ ] Color not sole indicator
- [ ] Focus indicators visible

## Motion & Animation
- [ ] Reduced motion support
- [ ] No auto-playing media
- [ ] No flashing content
```

### 2. Keyboard Navigation System

Create: `6-ui/a2r-platform/src/a11y/keyboard.tsx`

```typescript
// Focus trap for modals/drawers
interface FocusTrapProps {
  children: React.ReactNode;
  active: boolean;
  onEscape?: () => void;
}

export function FocusTrap({ children, active, onEscape }: FocusTrapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!active) return;
    
    const container = containerRef.current;
    if (!container) return;
    
    // Find all focusable elements
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;
    
    // Focus first element
    firstElement?.focus();
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onEscape?.();
        return;
      }
      
      if (e.key !== 'Tab') return;
      
      // Trap focus
      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    };
    
    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [active, onEscape]);
  
  return <div ref={containerRef}>{children}</div>;
}

// Skip link for keyboard users
export function SkipLink({ to }: { to: string }) {
  return (
    <a
      href={to}
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-white focus:rounded"
    >
      Skip to main content
    </a>
  );
}

// Visually hidden text for screen readers
export function VisuallyHidden({ children }: { children: React.ReactNode }) {
  return <span className="sr-only">{children}</span>;
}
```

### 3. ARIA Components

Create accessible versions of components:

```typescript
// Accessible button
interface AccessibleButtonProps extends ButtonProps {
  ariaLabel?: string;
  ariaPressed?: boolean;
  ariaExpanded?: boolean;
  ariaControls?: string;
  ariaDescribedBy?: string;
}

export function AccessibleButton({
  ariaLabel,
  ariaPressed,
  ariaExpanded,
  ariaControls,
  ariaDescribedBy,
  ...props
}: AccessibleButtonProps) {
  return (
    <Button
      {...props}
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
      aria-expanded={ariaExpanded}
      aria-controls={ariaControls}
      aria-describedby={ariaDescribedBy}
    />
  );
}

// Accessible modal
interface AccessibleModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function AccessibleModal({
  isOpen,
  onClose,
  title,
  description,
  children,
}: AccessibleModalProps) {
  const titleId = useId();
  const descId = useId();
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <FocusTrap active={isOpen} onEscape={onClose}>
        <DialogContent
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={description ? descId : undefined}
        >
          <DialogHeader>
            <DialogTitle id={titleId}>{title}</DialogTitle>
            {description && (
              <DialogDescription id={descId}>{description}</DialogDescription>
            )}
          </DialogHeader>
          {children}
        </DialogContent>
      </FocusTrap>
    </Dialog>
  );
}
```

### 4. Live Regions

Create: `6-ui/a2r-platform/src/a11y/live-region.tsx`

```typescript
// Announce changes to screen readers
export function useAnnouncer() {
  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    const region = document.getElementById(`live-region-${priority}`);
    if (region) {
      region.textContent = message;
    }
  }, []);
  
  return { announce };
}

// Live region provider
export function LiveRegionProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      {/* Polite announcements (non-interrupting) */}
      <div
        id="live-region-polite"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      />
      {/* Assertive announcements (interrupting) */}
      <div
        id="live-region-assertive"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      />
    </>
  );
}
```

### 5. Color Contrast Verification

Create contrast checking:

```typescript
// Utility to check contrast ratio
export function getContrastRatio(color1: string, color2: string): number {
  // Calculate luminance and contrast ratio
  const lum1 = getLuminance(color1);
  const lum2 = getLuminance(color2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

function getLuminance(color: string): number {
  const rgb = parseColor(color);
  const [r, g, b] = rgb.map(c => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Check WCAG compliance
export function checkContrast(
  foreground: string,
  background: string,
  size: 'normal' | 'large' = 'normal'
): { pass: boolean; ratio: number; level: 'AAA' | 'AA' | 'fail' } {
  const ratio = getContrastRatio(foreground, background);
  const threshold = size === 'large' ? 3 : 4.5;
  
  if (ratio >= 7) return { pass: true, ratio, level: 'AAA' };
  if (ratio >= threshold) return { pass: true, ratio, level: 'AA' };
  return { pass: false, ratio, level: 'fail' };
}
```

### 6. Reduced Motion Support

```typescript
// Hook for reduced motion preference
export function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(false);
  
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);
    
    const handleChange = (e: MediaQueryListEvent) => {
      setReducedMotion(e.matches);
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);
  
  return reducedMotion;
}

// Animated component with reduced motion support
export function AccessibleMotion({ children, animate, reducedMotionAnimate, ...props }) {
  const prefersReducedMotion = useReducedMotion();
  
  const animation = prefersReducedMotion ? reducedMotionAnimate : animate;
  
  return (
    <motion.div animate={animation} {...props}>
      {children}
    </motion.div>
  );
}
```

### 7. Accessibility Testing

Add automated tests:

```typescript
// Example accessibility test
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

describe('GlassCard accessibility', () => {
  it('should have no accessibility violations', async () => {
    const { container } = render(<GlassCard>Content</GlassCard>);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
  
  it('should be keyboard navigable', async () => {
    render(
      <GlassCard hover>
        <button>Click me</button>
      </GlassCard>
    );
    
    const button = screen.getByRole('button');
    await userEvent.tab();
    expect(button).toHaveFocus();
  });
});
```

### 8. Accessibility Documentation

Create: `6-ui/a2r-platform/ACCESSIBILITY.md`

Document:
- Keyboard shortcuts
- Screen reader support
- ARIA usage
- Known limitations
- Testing procedures

## Requirements

- WCAG 2.1 Level AA compliance
- Keyboard navigation
- Screen reader support
- Reduced motion support
- Proper focus management
- Color contrast 4.5:1

## Success Criteria
- [ ] Keyboard navigation working
- [ ] Focus trap for modals
- [ ] Skip links
- [ ] ARIA attributes
- [ ] Live regions
- [ ] Reduced motion support
- [ ] Contrast checking
- [ ] Automated a11y tests
- [ ] No SYSTEM_LAW violations
