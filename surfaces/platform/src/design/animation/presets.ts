/**
 * Animation Presets
 * 
 * Predefined animation configurations for common UI patterns.
 * All presets respect reduced motion via the component layer.
 */

import { TargetAndTransition, Transition } from 'framer-motion';
import { animationTiming } from './timing';

/** Modal/dialog animation preset */
export interface ModalPreset {
  overlay: { initial: TargetAndTransition; animate: TargetAndTransition; exit: TargetAndTransition };
  content: { initial: TargetAndTransition; animate: TargetAndTransition; exit: TargetAndTransition };
}

/** Toast notification animation preset */
export interface ToastPreset {
  enter: { initial: TargetAndTransition; animate: TargetAndTransition };
  exit: TargetAndTransition;
}

/** Dropdown menu animation preset */
export interface DropdownPreset {
  enter: { initial: TargetAndTransition; animate: TargetAndTransition };
  exit: TargetAndTransition;
}

/** Tooltip animation preset */
export interface TooltipPreset {
  enter: { initial: TargetAndTransition; animate: TargetAndTransition };
  exit: TargetAndTransition;
}

/** Drawer/sidebar animation preset */
export interface DrawerPreset {
  enter: { initial: TargetAndTransition; animate: TargetAndTransition };
  exit: TargetAndTransition;
}

/**
 * Modal preset - overlay fade + content scale.
 * 
 * @example
 * <motion.div initial="initial" animate="animate" exit="exit" variants={presets.modal.overlay} />
 * <motion.div initial="initial" animate="animate" exit="exit" variants={presets.modal.content} />
 */
const modal: ModalPreset = {
  overlay: {
    initial: { opacity: 0 },
    animate: { 
      opacity: 1,
      transition: { duration: animationTiming.fast }
    },
    exit: { 
      opacity: 0,
      transition: { duration: animationTiming.fast }
    },
  },
  content: {
    initial: { opacity: 0, scale: 0.95, y: 10 },
    animate: { 
      opacity: 1, 
      scale: 1, 
      y: 0,
      transition: { 
        duration: animationTiming.base,
        ease: animationTiming.easing.emphasized 
      }
    },
    exit: { 
      opacity: 0, 
      scale: 0.95, 
      y: 10,
      transition: { duration: animationTiming.fast }
    },
  },
};

/**
 * Toast preset - slide in from right.
 * 
 * @example
 * <motion.div
 *   initial="initial"
 *   animate="animate"
 *   exit="exit"
 *   variants={presets.toast.enter}
 * />
 */
const toast: ToastPreset = {
  enter: {
    initial: { x: 100, opacity: 0 },
    animate: { 
      x: 0, 
      opacity: 1,
      transition: { 
        duration: animationTiming.base,
        ease: animationTiming.easing.emphasized 
      }
    },
  },
  exit: {
    x: 100,
    opacity: 0,
    transition: { duration: animationTiming.fast },
  },
};

/**
 * Dropdown preset - scale + fade from top.
 * 
 * @example
 * <motion.div
 *   initial="initial"
 *   animate="animate"
 *   exit="exit"
 *   variants={presets.dropdown.enter}
 * />
 */
const dropdown: DropdownPreset = {
  enter: {
    initial: { opacity: 0, scale: 0.95, y: -10 },
    animate: { 
      opacity: 1, 
      scale: 1, 
      y: 0,
      transition: { 
        duration: animationTiming.fast,
        ease: animationTiming.easing.emphasized 
      }
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: -10,
    transition: { duration: animationTiming.instant },
  },
};

/**
 * Tooltip preset - subtle fade + slight movement.
 * 
 * @example
 * <motion.div
 *   initial="initial"
 *   animate="animate"
 *   exit="exit"
 *   variants={presets.tooltip.enter}
 * />
 */
const tooltip: TooltipPreset = {
  enter: {
    initial: { opacity: 0, y: 5 },
    animate: { 
      opacity: 1, 
      y: 0,
      transition: { 
        duration: animationTiming.fast,
        ease: animationTiming.easing.standard 
      }
    },
  },
  exit: {
    opacity: 0,
    y: 5,
    transition: { duration: animationTiming.instant },
  },
};

/**
 * Drawer preset - slide from left.
 * 
 * @example
 * <motion.div
 *   initial="initial"
 *   animate="animate"
 *   exit="exit"
 *   variants={presets.drawer.enter}
 * />
 */
const drawer: DrawerPreset = {
  enter: {
    initial: { x: '-100%' },
    animate: { 
      x: 0,
      transition: { 
        duration: animationTiming.slow,
        ease: animationTiming.easing.emphasized 
      }
    },
  },
  exit: {
    x: '-100%',
    transition: { 
      duration: animationTiming.base,
      ease: animationTiming.easing.exit 
    },
  },
};

/**
 * Popover preset - similar to dropdown but with origin.
 */
const popover: DropdownPreset = {
  enter: {
    initial: { opacity: 0, scale: 0.9, y: 5 },
    animate: { 
      opacity: 1, 
      scale: 1, 
      y: 0,
      transition: { 
        duration: animationTiming.fast,
        ease: animationTiming.easing.standard
      }
    },
  },
  exit: {
    opacity: 0,
    scale: 0.9,
    y: 5,
    transition: { duration: animationTiming.instant },
  },
};

/**
 * Sheet preset - slide up from bottom (mobile-style).
 */
const sheet = {
  overlay: {
    initial: { opacity: 0 },
    animate: { 
      opacity: 1,
      transition: { duration: animationTiming.fast }
    },
    exit: { 
      opacity: 0,
      transition: { duration: animationTiming.fast }
    },
  },
  content: {
    initial: { y: '100%' },
    animate: { 
      y: 0,
      transition: { 
        duration: animationTiming.slow,
        ease: animationTiming.easing.emphasized 
      }
    },
    exit: { 
      y: '100%',
      transition: { 
        duration: animationTiming.base,
        ease: animationTiming.easing.exit 
      }
    },
  },
};

/**
 * Alert preset - shake for error, bounce for success.
 */
const alert = {
  error: {
    initial: { x: 0 },
    animate: { 
      x: [-4, 4, -4, 4, 0],
      transition: { duration: 0.4 }
    },
  },
  success: {
    initial: { scale: 0.9, opacity: 0 },
    animate: { 
      scale: 1, 
      opacity: 1,
      transition: { 
        duration: animationTiming.base,
        ease: animationTiming.easing.standard
      }
    },
  },
};

/**
 * Snackbar preset - slide up from bottom.
 */
const snackbar: ToastPreset = {
  enter: {
    initial: { y: 100, opacity: 0 },
    animate: { 
      y: 0, 
      opacity: 1,
      transition: { 
        duration: animationTiming.base,
        ease: animationTiming.easing.emphasized 
      }
    },
  },
  exit: {
    y: 100,
    opacity: 0,
    transition: { duration: animationTiming.fast },
  },
};

/**
 * Accordion preset - expand/collapse.
 */
const accordion = {
  expand: {
    initial: { height: 0, opacity: 0 },
    animate: { 
      height: 'auto', 
      opacity: 1,
      transition: { 
        height: { duration: animationTiming.base, ease: animationTiming.easing.standard },
        opacity: { duration: animationTiming.fast }
      }
    },
    exit: { 
      height: 0, 
      opacity: 0,
      transition: { 
        height: { duration: animationTiming.fast, ease: animationTiming.easing.exit },
        opacity: { duration: animationTiming.instant }
      }
    },
  },
  chevron: {
    initial: { rotate: 0 },
    animate: { 
      rotate: 180,
      transition: { duration: animationTiming.base }
    },
    exit: { 
      rotate: 0,
      transition: { duration: animationTiming.base }
    },
  },
};

/**
 * Tab preset - underline slide.
 */
const tab = {
  underline: {
    layoutId: 'activeTab',
    transition: { 
      type: 'spring' as const, 
      stiffness: 500, 
      damping: 35 
    },
  },
  content: {
    initial: { opacity: 0, x: -10 },
    animate: { 
      opacity: 1, 
      x: 0,
      transition: { duration: animationTiming.fast }
    },
    exit: { 
      opacity: 0, 
      x: 10,
      transition: { duration: animationTiming.instant }
    },
  },
};

/**
 * All animation presets exported as a collection.
 */
export const presets = {
  modal,
  toast,
  dropdown,
  tooltip,
  drawer,
  popover,
  sheet,
  alert,
  snackbar,
  accordion,
  tab,
};

/** Flattened variants for direct use */
export const flatPresets = {
  modalOverlay: modal.overlay,
  modalContent: modal.content,
  toastEnter: toast.enter,
  toastExit: toast.exit,
  dropdownEnter: dropdown.enter,
  dropdownExit: dropdown.exit,
  tooltipEnter: tooltip.enter,
  tooltipExit: tooltip.exit,
  drawerEnter: drawer.enter,
  drawerExit: drawer.exit,
  popoverEnter: popover.enter,
  popoverExit: popover.exit,
  sheetOverlay: sheet.overlay,
  sheetContent: sheet.content,
  accordionExpand: accordion.expand,
  accordionChevron: accordion.chevron,
  tabUnderline: tab.underline,
  tabContent: tab.content,
};
