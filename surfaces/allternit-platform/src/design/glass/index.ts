/**
 * Glass Morphism Design System
 * 
 * A comprehensive glass morphism component library with:
 * - Backdrop blur with fallbacks
 * - GPU-accelerated transforms
 * - Focus ring styling
 * - Hover/active/disabled states
 * - Light/dark mode support
 * 
 * @module glass
 */

// Core utilities
export { type GlassBlur, type GlassBorder, type GlassElevation, type GlassHover, type GlassOpacity, type GlassOptions, type GlassPadding, type GlassRounded, type GlassTransition, type GlassVariant, blurValues, borderStyles, buildGlassClasses, buildGlassStyles, elevationShadows, fallbackBackgrounds, getActiveStyles, getHoverStyles, paddingValues, roundedValues, supportsBackdropFilter, transitionValues, variantColors } from './glass-utils';

// Hook
export { type UseGlassOptions, type UseGlassReturn, useGlass, useGlassButton, useGlassCard, useGlassDialog, useGlassInput, useGlassPanel, useGlassTooltip } from './useGlass';

// Components
export { type GlassIntensity, GlassSurface, GlassSurfaceBase, GlassSurfaceElevated, type GlassSurfaceProps, GlassSurfaceThick, GlassSurfaceThin } from './GlassSurface';
export { GlassCard, GlassCardDanger, GlassCardFlat, GlassCardFloating, GlassCardInteractive, GlassCardPrimary, type GlassCardProps, GlassCardSuccess, GlassCardWarning } from './GlassCard';
export { GlassBottomPanel, GlassDrawer, GlassPanel, type GlassPanelProps, GlassSidebar, GlassTopPanel } from './GlassPanel';
export { GlassAlertDialog, GlassConfirmDialog, GlassDialog, GlassDialogFull, GlassDialogLarge, type GlassDialogProps, GlassDialogSmall } from './GlassDialog';
export { GlassTooltip, type GlassTooltipProps, GlassTooltipSimple } from './GlassTooltip';
export { GlassContextMenu, GlassDropdown, GlassHoverCard, GlassPopover, type GlassPopoverProps } from './GlassPopover';
export { GlassInput, GlassInputLarge, type GlassInputProps, GlassInputSmall, GlassSearchInput } from './GlassInput';
export { GlassButton, GlassButtonDanger, GlassButtonGhost, GlassButtonLarge, GlassButtonPrimary, type GlassButtonProps, GlassButtonSmall, GlassButtonSuccess, GlassIconButton } from './GlassButton';
