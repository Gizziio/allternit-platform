/**
 * Lucide Icon Mapping
 * 
 * Maps IconName type to actual Lucide React components.
 * This provides a unified interface while leveraging the Lucide icon library.
 * 
 * @module @allternit/platform/icons/lucide-mapping
 */

import type { LucideIcon } from 'lucide-react';
import {
  // Navigation
  Home,
  LayoutDashboard,
  Settings,
  User,
  Menu,
  X,
  ArrowLeft,
  ArrowRight,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  Navigation,
  PanelLeft,
  Maximize,
  Minimize,
  ExternalLink,
  
  // Actions
  Plus,
  Minus,
  Pencil,
  Trash2,
  Save,
  XCircle,
  Check,
  Search,
  Filter,
  ArrowUpDown,
  RefreshCw,
  Download,
  Upload,
  Copy,
  ClipboardPaste,
  Scissors,
  Undo,
  Redo,
  MoreHorizontal,
  MoreVertical,
  GripVertical,
  Maximize2,
  Minimize2,
  Pin,
  PinOff,
  Link,
  Unlink,
  Send,
  Play,
  Pause,
  Square,
  
  // Status
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  Loader2,
  Clock,
  CheckCircle,
  AlertOctagon,
  HelpCircle,
  CircleHelp,
  History,
  Timer,
  BadgeCheck,
  Shield,
  ShieldCheck,
  Lock,
  Unlock,
  
  // Files
  File,
  Folder,
  Image,
  Video,
  Music,
  Code,
  FileText,
  FileArchive,
  FileDown,
  FileUp,
  FileCode,
  FileJson,
  FolderOpen,
  FolderPlus,
  FolderMinus,
  FolderTree,
  Archive,
  Trash,
  
  // Communication
  MessageSquare,
  MessageCircle,
  Mail,
  Phone,
  Share2,
  Bell,
  AtSign,
  Inbox,
  Reply,
  Forward,
  PhoneCall,
  Voicemail,
  Rss,
  Wifi,
  WifiOff,
  
  // Agents/AI
  Bot,
  Sparkles,
  Wand2,
  Brain,
  GitBranch,
  GitCommit,
  CircleDot,
  GitMerge,
  Cpu,
  Zap,
  Lightbulb,
  Target,
  Scan,
  ScanFace,
  Fingerprint,
  
  // Cloud/DevOps
  Cloud,
  Server,
  Database,
  Container,
  Ship,
  Rocket,
  Hammer,
  FlaskConical,
  Activity,
  CloudUpload,
  CloudDownload,
  CloudOff,
  HardDrive,
  Disc,
  Layers,
  Box,
  Package,
  Terminal,
  Command,
  GitPullRequest,
  
  // Media/Editor
  Eye,
  EyeOff,
  ImagePlus,
  ImageMinus,
  Camera,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Volume1,
  Volume,
  Headphones,
  Film,
  Palette,
  PenTool,
  Brush,
  Type,
  Bold,
  Italic,
  Underline,
  
  // Users/Organization
  Users,
  UserPlus,
  UserMinus,
  UserCheck,
  Building,
  MapPin,
  Map,
  Globe,
  Flag,
  Bookmark,
  BookmarkPlus,
  Heart,
  Star,
  ThumbsUp,
} from 'lucide-react';

import type { IconName } from './types';
import {
  A2RLogo,
  A2RMark,
  ShellIcon,
  CapsuleIcon,
  BeadIcon,
  SubstrateIcon,
  KernelIcon,
  ArchonIcon,
} from './custom';

// ============================================================================
// Type for Custom Icon Components
// ============================================================================

/** Custom icon component type that matches LucideIcon interface */
type CustomIconComponent = React.ComponentType<{
  size?: number;
  className?: string;
  'aria-label'?: string;
  'aria-hidden'?: boolean | 'true' | 'false';
}>;

// ============================================================================
// Icon Mapping Record
// ============================================================================

/**
 * Complete mapping from IconName to Lucide icons or custom icons.
 * This is the single source of truth for icon resolution.
 */
export const iconMapping: Record<IconName, LucideIcon | CustomIconComponent> = {
  // ==========================================================================
  // Navigation (20 icons)
  // ==========================================================================
  'home': Home,
  'dashboard': LayoutDashboard,
  'settings': Settings,
  'profile': User,
  'menu': Menu,
  'close': X,
  'back': ArrowLeft,
  'forward': ArrowRight,
  'chevron-up': ChevronUp,
  'chevron-down': ChevronDown,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  'arrow-up': ArrowUp,
  'arrow-down': ArrowDown,
  'arrow-left': ArrowLeft,
  'arrow-right': ArrowRight,
  'navigation': Navigation,
  'sidebar': PanelLeft,
  'fullscreen': Maximize,
  'exit-fullscreen': Minimize,
  'external-link': ExternalLink,

  // ==========================================================================
  // Actions (31 icons)
  // ==========================================================================
  'add': Plus,
  'remove': Minus,
  'edit': Pencil,
  'delete': Trash2,
  'save': Save,
  'cancel': XCircle,
  'submit': Check,
  'search': Search,
  'filter': Filter,
  'sort': ArrowUpDown,
  'refresh': RefreshCw,
  'download': Download,
  'upload': Upload,
  'copy': Copy,
  'paste': ClipboardPaste,
  'cut': Scissors,
  'undo': Undo,
  'redo': Redo,
  'more-horizontal': MoreHorizontal,
  'more-vertical': MoreVertical,
  'drag-handle': GripVertical,
  'maximize': Maximize2,
  'minimize': Minimize2,
  'pin': Pin,
  'unpin': PinOff,
  'link': Link,
  'unlink': Unlink,
  'send': Send,
  'play': Play,
  'pause': Pause,
  'stop': Square,

  // ==========================================================================
  // Status (24 icons)
  // ==========================================================================
  'success': CheckCircle2,
  'error': AlertCircle,
  'warning': AlertTriangle,
  'info': Info,
  'loading': Loader2,
  'pending': Clock,
  'check': Check,
  'check-circle': CheckCircle,
  'x': X,
  'x-circle': XCircle,
  'alert': AlertOctagon,
  'alert-triangle': AlertTriangle,
  'alert-circle': AlertCircle,
  'help': HelpCircle,
  'help-circle': HelpCircle,
  'question': CircleHelp,
  'question-circle': CircleHelp,
  'clock': Clock,
  'history': History,
  'timer': Timer,
  'verified': BadgeCheck,
  'shield': Shield,
  'shield-check': ShieldCheck,
  'lock': Lock,
  'unlock': Unlock,

  // ==========================================================================
  // Files (21 icons)
  // ==========================================================================
  'file': File,
  'folder': Folder,
  'image': Image,
  'video': Video,
  'audio': Music,
  'code': Code,
  'document': FileText,
  'pdf': FileText,
  'zip': FileArchive,
  'download-file': FileDown,
  'upload-file': FileUp,
  'file-text': FileText,
  'file-code': FileCode,
  'file-json': FileJson,
  'folder-open': FolderOpen,
  'folder-plus': FolderPlus,
  'folder-minus': FolderMinus,
  'folder-tree': FolderTree,
  'archive': Archive,
  'trash': Trash,
  'trash-2': Trash2,

  // ==========================================================================
  // Communication (19 icons)
  // ==========================================================================
  'chat': MessageSquare,
  'message': MessageCircle,
  'email': Mail,
  'phone': Phone,
  'video-call': Video,
  'share': Share2,
  'notification': Bell,
  'bell': Bell,
  'mention': AtSign,
  'mail': Mail,
  'inbox': Inbox,
  'send-message': Send,
  'reply': Reply,
  'forward-message': Forward,
  'phone-call': PhoneCall,
  'voicemail': Voicemail,
  'rss': Rss,
  'wifi': Wifi,
  'wifi-off': WifiOff,

  // ==========================================================================
  // Agents/AI (22 icons)
  // ==========================================================================
  'agent': Bot,
  'bot': Bot,
  'ai': Sparkles,
  'sparkles': Sparkles,
  'magic': Wand2,
  'wand': Wand2,
  'brain': Brain,
  'workflow': GitBranch,
  'pipeline': GitCommit,
  'node': CircleDot,
  'connection': GitMerge,
  'robot': Bot,
  'cpu': Cpu,
  'chip': Cpu,
  'network': GitMerge,
  'circuit': GitBranch,
  'zap': Zap,
  'lightbulb': Lightbulb,
  'target': Target,
  'crosshair': Target,
  'scan': Scan,
  'scan-face': ScanFace,
  'fingerprint': Fingerprint,

  // ==========================================================================
  // Cloud/DevOps (23 icons)
  // ==========================================================================
  'cloud': Cloud,
  'server': Server,
  'database': Database,
  'container': Container,
  'kubernetes': Ship,
  'deploy': Rocket,
  'build': Hammer,
  'test': FlaskConical,
  'monitor': Activity,
  'cloud-upload': CloudUpload,
  'cloud-download': CloudDownload,
  'cloud-off': CloudOff,
  'hard-drive': HardDrive,
  'disc': Disc,
  'layers': Layers,
  'box': Box,
  'package': Package,
  'terminal': Terminal,
  'command': Command,
  'git-branch': GitBranch,
  'git-commit': GitCommit,
  'git-merge': GitMerge,
  'git-pull-request': GitPullRequest,

  // ==========================================================================
  // Media/Editor (22 icons)
  // ==========================================================================
  'eye': Eye,
  'eye-off': EyeOff,
  'image-plus': ImagePlus,
  'image-minus': ImageMinus,
  'camera': Camera,
  'mic': Mic,
  'mic-off': MicOff,
  'volume': Volume2,
  'volume-off': VolumeX,
  'volume-low': Volume1,
  'volume-high': Volume,
  'music': Music,
  'headphones': Headphones,
  'film': Film,
  'palette': Palette,
  'pen': Pencil,
  'pencil': Pencil,
  'brush': Brush,
  'type': Type,
  'bold': Bold,
  'italic': Italic,
  'underline': Underline,

  // ==========================================================================
  // Users/Organization (20 icons)
  // ==========================================================================
  'user': User,
  'users': Users,
  'user-plus': UserPlus,
  'user-minus': UserMinus,
  'user-check': UserCheck,
  'user-circle': User,
  'group': Users,
  'team': Users,
  'organization': Building,
  'building': Building,
  'office': Building,
  'map-pin': MapPin,
  'map': Map,
  'globe': Globe,
  'flag': Flag,
  'bookmark': Bookmark,
  'bookmark-plus': BookmarkPlus,
  'heart': Heart,
  'star': Star,
  'thumbs-up': ThumbsUp,

  // ==========================================================================
  // Custom A2rchitect Brand Icons (8 icons)
  // ==========================================================================
  'a2r-logo': A2RLogo,
  'a2r-mark': A2RMark,
  'shell': ShellIcon,
  'capsule': CapsuleIcon,
  'bead': BeadIcon,
  'substrate': SubstrateIcon,
  'kernel': KernelIcon,
  'archon': ArchonIcon,
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if an icon name exists in the mapping
 */
export function hasIcon(name: IconName): boolean {
  return name in iconMapping;
}

/**
 * Get the Lucide component for an icon name
 * Returns undefined if not found (should not happen with proper typing)
 */
export function getIconComponent(name: IconName): LucideIcon | CustomIconComponent | undefined {
  return iconMapping[name];
}

/**
 * Get all available icon names
 */
export function getAllIconNames(): IconName[] {
  return Object.keys(iconMapping) as IconName[];
}
