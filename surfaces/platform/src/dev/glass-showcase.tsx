/**
 * Glass Morphism Showcase
 * 
 * Visual test page demonstrating all glass components and their variants
 * Test in both light and dark modes
 * 
 * @module glass-showcase
 */

import React, { useState } from 'react';
import {
  GlassCard,
  GlassCardFloating,
  GlassCardPrimary,
  GlassCardSuccess,
  GlassCardWarning,
  GlassCardDanger,
  GlassCardInteractive,
  GlassSurface,
  GlassSurfaceThin,
  GlassSurfaceBase,
  GlassSurfaceElevated,
  GlassSurfaceThick,
  GlassPanel,
  GlassSidebar,
  GlassDrawer,
  GlassDialog,
  GlassTooltip,
  GlassPopover,
  GlassDropdown,
  GlassInput,
  GlassSearchInput,
  GlassButton,
  GlassButtonPrimary,
  GlassButtonSuccess,
  GlassButtonDanger,
  GlassButtonGhost,
  GlassIconButton,
  useGlass,
  supportsBackdropFilter,
} from '../design/glass';

// ============================================================================
// Showcase Styles
// ============================================================================

const containerStyles: React.CSSProperties = {
  padding: '40px',
  minHeight: '100vh',
  background: 'var(--bg-primary)',
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-sans)',
};

const sectionStyles: React.CSSProperties = {
  marginBottom: '60px',
};

const sectionTitleStyles: React.CSSProperties = {
  fontSize: '24px',
  fontWeight: 600,
  marginBottom: '24px',
  color: 'var(--text-primary)',
};

const gridStyles: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
  gap: '24px',
};

const flexRowStyles: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '16px',
  alignItems: 'center',
};

const demoBoxStyles: React.CSSProperties = {
  padding: '24px',
  minHeight: '120px',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
};

// ============================================================================
// Theme Toggle Component
// ============================================================================

function ThemeToggle({ 
  darkMode, 
  onToggle 
}: { 
  darkMode: boolean; 
  onToggle: () => void;
}) {
  return (
    <div style={{ 
      position: 'fixed', 
      top: 20, 
      right: 20, 
      zIndex: 1000,
    }}>
      <GlassButton onClick={onToggle} variant="primary">
        {darkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}
      </GlassButton>
    </div>
  );
}

// ============================================================================
// Support Badge Component
// ============================================================================

function SupportBadge() {
  const supported = supportsBackdropFilter();
  
  return (
    <div style={{ 
      position: 'fixed', 
      top: 20, 
      left: 20, 
      zIndex: 1000,
    }}>
      <GlassCard 
        variant={supported ? 'success' : 'warning'} 
        padding="sm" 
        rounded="md"
      >
        <span style={{ fontSize: '14px', fontWeight: 500 }}>
          {supported ? '✅ Backdrop Filter: Supported' : '⚠️ Backdrop Filter: Fallback'}
        </span>
      </GlassCard>
    </div>
  );
}

// ============================================================================
// Main Showcase Component
// ============================================================================

export function GlassShowcase() {
  const [darkMode, setDarkMode] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleTheme = () => setDarkMode(!darkMode);

  // Apply theme to document
  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  return (
    <div style={containerStyles} data-theme={darkMode ? 'dark' : 'light'}>
      <SupportBadge />
      <ThemeToggle darkMode={darkMode} onToggle={toggleTheme} />

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '60px', paddingTop: '40px' }}>
        <h1 style={{ fontSize: '48px', fontWeight: 700, marginBottom: '16px' }}>
          Glass Morphism System
        </h1>
        <p style={{ fontSize: '18px', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto' }}>
          A comprehensive glass morphism component library with backdrop blur, 
          GPU-accelerated transforms, and full accessibility support.
        </p>
      </div>

      {/* GlassCard Section */}
      <section style={sectionStyles}>
        <h2 style={sectionTitleStyles}>GlassCard Variants</h2>
        <div style={gridStyles}>
          <GlassCard>
            <div style={demoBoxStyles}>
              <h3 style={{ margin: '0 0 8px 0' }}>Default Card</h3>
              <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                Standard glass card with subtle elevation
              </p>
            </div>
          </GlassCard>

          <GlassCardFloating>
            <div style={demoBoxStyles}>
              <h3 style={{ margin: '0 0 8px 0' }}>Floating Card</h3>
              <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                Elevated with prominent shadow
              </p>
            </div>
          </GlassCardFloating>

          <GlassCardPrimary>
            <div style={demoBoxStyles}>
              <h3 style={{ margin: '0 0 8px 0' }}>Primary Card</h3>
              <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                Accent color variant
              </p>
            </div>
          </GlassCardPrimary>

          <GlassCardSuccess>
            <div style={demoBoxStyles}>
              <h3 style={{ margin: '0 0 8px 0' }}>Success Card</h3>
              <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                Success state styling
              </p>
            </div>
          </GlassCardSuccess>

          <GlassCardWarning>
            <div style={demoBoxStyles}>
              <h3 style={{ margin: '0 0 8px 0' }}>Warning Card</h3>
              <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                Warning state styling
              </p>
            </div>
          </GlassCardWarning>

          <GlassCardDanger>
            <div style={demoBoxStyles}>
              <h3 style={{ margin: '0 0 8px 0' }}>Danger Card</h3>
              <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                Error state styling
              </p>
            </div>
          </GlassCardDanger>
        </div>
      </section>

      {/* Interactive Cards Section */}
      <section style={sectionStyles}>
        <h2 style={sectionTitleStyles}>Interactive Cards</h2>
        <div style={flexRowStyles}>
          <GlassCardInteractive 
            hover="lift" 
            onClick={() => alert('Lift hover effect!')}
            style={{ cursor: 'pointer', width: '200px' }}
          >
            <div style={demoBoxStyles}>
              <h4 style={{ margin: 0 }}>Hover: Lift</h4>
            </div>
          </GlassCardInteractive>

          <GlassCardInteractive 
            hover="glow" 
            onClick={() => alert('Glow hover effect!')}
            style={{ cursor: 'pointer', width: '200px' }}
          >
            <div style={demoBoxStyles}>
              <h4 style={{ margin: 0 }}>Hover: Glow</h4>
            </div>
          </GlassCardInteractive>

          <GlassCardInteractive 
            hover="scale" 
            onClick={() => alert('Scale hover effect!')}
            style={{ cursor: 'pointer', width: '200px' }}
          >
            <div style={demoBoxStyles}>
              <h4 style={{ margin: 0 }}>Hover: Scale</h4>
            </div>
          </GlassCardInteractive>

          <GlassCard disabled style={{ width: '200px' }}>
            <div style={demoBoxStyles}>
              <h4 style={{ margin: 0 }}>Disabled State</h4>
            </div>
          </GlassCard>
        </div>
      </section>

      {/* GlassSurface Section */}
      <section style={sectionStyles}>
        <h2 style={sectionTitleStyles}>GlassSurface Intensities</h2>
        <div style={flexRowStyles}>
          <GlassSurfaceThin style={{ padding: '40px' }}>
            Thin
          </GlassSurfaceThin>
          <GlassSurfaceBase style={{ padding: '40px' }}>
            Base
          </GlassSurfaceBase>
          <GlassSurfaceElevated style={{ padding: '40px' }}>
            Elevated
          </GlassSurfaceElevated>
          <GlassSurfaceThick style={{ padding: '40px' }}>
            Thick
          </GlassSurfaceThick>
        </div>
      </section>

      {/* GlassButton Section */}
      <section style={sectionStyles}>
        <h2 style={sectionTitleStyles}>GlassButton Variants</h2>
        
        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ marginBottom: '12px', color: 'var(--text-secondary)' }}>Sizes</h4>
          <div style={flexRowStyles}>
            <GlassButton size="xs">Extra Small</GlassButton>
            <GlassButton size="sm">Small</GlassButton>
            <GlassButton size="md">Medium</GlassButton>
            <GlassButton size="lg">Large</GlassButton>
            <GlassButton size="xl">Extra Large</GlassButton>
          </div>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ marginBottom: '12px', color: 'var(--text-secondary)' }}>Variants</h4>
          <div style={flexRowStyles}>
            <GlassButton>Default</GlassButton>
            <GlassButtonPrimary>Primary</GlassButtonPrimary>
            <GlassButtonSuccess>Success</GlassButtonSuccess>
            <GlassButtonDanger>Danger</GlassButtonDanger>
            <GlassButtonGhost>Ghost</GlassButtonGhost>
          </div>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ marginBottom: '12px', color: 'var(--text-secondary)' }}>States</h4>
          <div style={flexRowStyles}>
            <GlassButton disabled>Disabled</GlassButton>
            <GlassButton loading>Loading</GlassButton>
            <GlassIconButton>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </GlassIconButton>
          </div>
        </div>
      </section>

      {/* GlassInput Section */}
      <section style={sectionStyles}>
        <h2 style={sectionTitleStyles}>GlassInput Variants</h2>
        <div style={{ maxWidth: '500px' }}>
          <div style={{ marginBottom: '24px' }}>
            <GlassInput
              placeholder="Default input..."
              fullWidth
              style={{ marginBottom: '16px' }}
            />
            <GlassInput
              placeholder="With label..."
              label="Username"
              fullWidth
              style={{ marginBottom: '16px' }}
            />
            <GlassSearchInput
              placeholder="Search..."
              fullWidth
              style={{ marginBottom: '16px' }}
            />
            <GlassInput
              placeholder="Error state..."
              error
              helperText="This field is required"
              fullWidth
              style={{ marginBottom: '16px' }}
            />
            <GlassInput
              placeholder="Success state..."
              success
              helperText="Looks good!"
              fullWidth
              style={{ marginBottom: '16px' }}
            />
            <GlassInput
              placeholder="Disabled..."
              disabled
              fullWidth
            />
          </div>
        </div>
      </section>

      {/* GlassTooltip Section */}
      <section style={sectionStyles}>
        <h2 style={sectionTitleStyles}>GlassTooltip</h2>
        <div style={flexRowStyles}>
          <GlassTooltip content="This appears above">
            <GlassButton>Hover (Top)</GlassButton>
          </GlassTooltip>
          
          <GlassTooltip content="This appears below" position="bottom">
            <GlassButton>Hover (Bottom)</GlassButton>
          </GlassTooltip>
          
          <GlassTooltip content="This appears on the left" position="left">
            <GlassButton>Hover (Left)</GlassButton>
          </GlassTooltip>
          
          <GlassTooltip content="This appears on the right" position="right">
            <GlassButton>Hover (Right)</GlassButton>
          </GlassTooltip>
        </div>
      </section>

      {/* GlassPopover Section */}
      <section style={sectionStyles}>
        <h2 style={sectionTitleStyles}>GlassPopover</h2>
        <div style={flexRowStyles}>
          <GlassPopover
            content={
              <div style={{ padding: '8px' }}>
                <p style={{ margin: '0 0 8px 0' }}>Popover content goes here</p>
                <GlassButton size="sm" fullWidth>Action</GlassButton>
              </div>
            }
          >
            <GlassButton>Click for Popover</GlassButton>
          </GlassPopover>

          <GlassDropdown
            content={
              <div>
                <div style={{ padding: '8px 16px', cursor: 'pointer' }}>Option 1</div>
                <div style={{ padding: '8px 16px', cursor: 'pointer' }}>Option 2</div>
                <div style={{ padding: '8px 16px', cursor: 'pointer' }}>Option 3</div>
              </div>
            }
          >
            <GlassButton>Dropdown Menu</GlassButton>
          </GlassDropdown>
        </div>
      </section>

      {/* Panels & Dialogs Section */}
      <section style={sectionStyles}>
        <h2 style={sectionTitleStyles}>Panels & Dialogs</h2>
        <div style={flexRowStyles}>
          <GlassButton onClick={() => setDialogOpen(true)}>
            Open Dialog
          </GlassButton>
          <GlassButton onClick={() => setDrawerOpen(true)}>
            Open Drawer
          </GlassButton>
          <GlassButton onClick={() => setSidebarOpen(true)}>
            Open Sidebar
          </GlassButton>
        </div>
      </section>

      {/* useGlass Hook Section */}
      <section style={sectionStyles}>
        <h2 style={sectionTitleStyles}>useGlass Hook</h2>
        <div style={flexRowStyles}>
          <UseGlassDemo />
        </div>
      </section>

      {/* Dialog */}
      <GlassDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Example Dialog"
        description="This is a glass morphism dialog with full styling support."
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p>Dialog content goes here. You can add any components inside.</p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <GlassButtonGhost onClick={() => setDialogOpen(false)}>
              Cancel
            </GlassButtonGhost>
            <GlassButtonPrimary onClick={() => setDialogOpen(false)}>
              Confirm
            </GlassButtonPrimary>
          </div>
        </div>
      </GlassDialog>

      {/* Drawer */}
      <GlassDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        size={400}
      >
        <div style={{ padding: '24px' }}>
          <h2 style={{ margin: '0 0 24px 0' }}>Drawer Content</h2>
          <p style={{ marginBottom: '24px' }}>
            This is a glass morphism drawer panel that slides in from the right.
          </p>
          <GlassButton onClick={() => setDrawerOpen(false)}>
            Close Drawer
          </GlassButton>
        </div>
      </GlassDrawer>

      {/* Sidebar */}
      <GlassSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        size={280}
      >
        <div style={{ padding: '24px' }}>
          <h2 style={{ margin: '0 0 24px 0' }}>Sidebar</h2>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <GlassButtonGhost fullWidth style={{ justifyContent: 'flex-start' }}>
              Dashboard
            </GlassButtonGhost>
            <GlassButtonGhost fullWidth style={{ justifyContent: 'flex-start' }}>
              Settings
            </GlassButtonGhost>
            <GlassButtonGhost fullWidth style={{ justifyContent: 'flex-start' }}>
              Profile
            </GlassButtonGhost>
            <GlassButtonGhost fullWidth style={{ justifyContent: 'flex-start' }}>
              Help
            </GlassButtonGhost>
          </nav>
          <div style={{ marginTop: 'auto', paddingTop: '24px' }}>
            <GlassButton onClick={() => setSidebarOpen(false)} fullWidth>
              Close Sidebar
            </GlassButton>
          </div>
        </div>
      </GlassSidebar>
    </div>
  );
}

// ============================================================================
// useGlass Hook Demo Component
// ============================================================================

function UseGlassDemo() {
  const { className, style, handlers, state } = useGlass({
    elevation: 'floating',
    blur: 'lg',
    hover: 'lift',
    variant: 'primary',
    padding: 'md',
    rounded: 'lg',
    focusable: true,
  });

  return (
    <div
      className={className}
      style={{
        ...style,
        padding: '40px',
        cursor: 'pointer',
      }}
      {...handlers}
      tabIndex={0}
      role="button"
    >
      <h4 style={{ margin: '0 0 8px 0' }}>useGlass Hook Demo</h4>
      <p style={{ margin: 0, fontSize: '14px' }}>
        Hovered: {state.isHovered ? 'Yes' : 'No'} | 
        Active: {state.isActive ? 'Yes' : 'No'} | 
        Focused: {state.isFocused ? 'Yes' : 'No'}
      </p>
      <p style={{ margin: '8px 0 0 0', fontSize: '12px', opacity: 0.7 }}>
        Backdrop Filter: {state.supportsBackdropFilter ? 'Supported' : 'Fallback'}
      </p>
    </div>
  );
}

// ============================================================================
// Default Export
// ============================================================================

export default GlassShowcase;
