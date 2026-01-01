// Icon type definitions for node markers
import type { LucideIcon } from 'lucide-react';
import {
  // Priority icons
  CircleDot,
  // Task icons
  Square,
  SquareMinus,
  SquareEqual,
  SquarePlus,
  SquareCheck,
  // Flag icons
  Flag,
  // Smiley icons
  Smile,
  Meh,
  Frown,
  Heart,
  HelpCircle,
  ThumbsUp,
  ThumbsDown,
  // Arrow icons
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  ArrowUpLeft,
  ArrowDownRight,
  ArrowDownLeft,
  // Symbol icons
  Star,
  Zap,
  Flame,
  AlertTriangle,
  Info,
  CircleHelp,
  Check,
  X,
  Clock,
  Bookmark,
  Pin,
} from 'lucide-react';

// Priority icons (1-9)
export type PriorityIcon = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

// Task completion icons
export type TaskIcon = 'empty' | 'quarter' | 'half' | 'three-quarter' | 'done';

// Flag icons
export type FlagIcon = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple';

// Smiley icons
export type SmileyIcon = 'happy' | 'neutral' | 'sad' | 'love' | 'thinking' | 'thumbsup' | 'thumbsdown';

// Arrow icons
export type ArrowIcon = 'up' | 'down' | 'left' | 'right' | 'up-right' | 'up-left' | 'down-right' | 'down-left';

// Symbol icons
export type SymbolIcon = 'star' | 'heart' | 'bolt' | 'fire' | 'warning' | 'info' | 'question' | 'check' | 'cross' | 'clock' | 'bookmark' | 'pin';

// All icon types combined
export type NodeIcon =
  | { type: 'priority'; value: PriorityIcon }
  | { type: 'task'; value: TaskIcon }
  | { type: 'flag'; value: FlagIcon }
  | { type: 'smiley'; value: SmileyIcon }
  | { type: 'arrow'; value: ArrowIcon }
  | { type: 'symbol'; value: SymbolIcon };

// Icon category for picker
export type IconCategory = 'priority' | 'task' | 'flag' | 'smiley' | 'arrow' | 'symbol';

// Icon definitions with display properties
export interface IconDefinition {
  type: IconCategory;
  value: string | number;
  label: string;
  icon: LucideIcon;
  color?: string; // Optional color for the icon
  text?: string; // Optional text to display (for priority numbers)
}

// All available icons organized by category
export const ICON_DEFINITIONS: Record<IconCategory, IconDefinition[]> = {
  priority: [
    { type: 'priority', value: 1, label: 'Priority 1', icon: CircleDot, color: '#ef4444', text: '1' },
    { type: 'priority', value: 2, label: 'Priority 2', icon: CircleDot, color: '#f97316', text: '2' },
    { type: 'priority', value: 3, label: 'Priority 3', icon: CircleDot, color: '#eab308', text: '3' },
    { type: 'priority', value: 4, label: 'Priority 4', icon: CircleDot, color: '#22c55e', text: '4' },
    { type: 'priority', value: 5, label: 'Priority 5', icon: CircleDot, color: '#3b82f6', text: '5' },
    { type: 'priority', value: 6, label: 'Priority 6', icon: CircleDot, color: '#8b5cf6', text: '6' },
    { type: 'priority', value: 7, label: 'Priority 7', icon: CircleDot, color: '#6b7280', text: '7' },
    { type: 'priority', value: 8, label: 'Priority 8', icon: CircleDot, color: '#6b7280', text: '8' },
    { type: 'priority', value: 9, label: 'Priority 9', icon: CircleDot, color: '#6b7280', text: '9' },
  ],
  task: [
    { type: 'task', value: 'empty', label: 'Not Started', icon: Square, color: '#6b7280' },
    { type: 'task', value: 'quarter', label: '25% Done', icon: SquareMinus, color: '#f97316' },
    { type: 'task', value: 'half', label: '50% Done', icon: SquareEqual, color: '#eab308' },
    { type: 'task', value: 'three-quarter', label: '75% Done', icon: SquarePlus, color: '#22c55e' },
    { type: 'task', value: 'done', label: 'Complete', icon: SquareCheck, color: '#22c55e' },
  ],
  flag: [
    { type: 'flag', value: 'red', label: 'Red Flag', icon: Flag, color: '#ef4444' },
    { type: 'flag', value: 'orange', label: 'Orange Flag', icon: Flag, color: '#f97316' },
    { type: 'flag', value: 'yellow', label: 'Yellow Flag', icon: Flag, color: '#eab308' },
    { type: 'flag', value: 'green', label: 'Green Flag', icon: Flag, color: '#22c55e' },
    { type: 'flag', value: 'blue', label: 'Blue Flag', icon: Flag, color: '#3b82f6' },
    { type: 'flag', value: 'purple', label: 'Purple Flag', icon: Flag, color: '#8b5cf6' },
  ],
  smiley: [
    { type: 'smiley', value: 'happy', label: 'Happy', icon: Smile, color: '#22c55e' },
    { type: 'smiley', value: 'neutral', label: 'Neutral', icon: Meh, color: '#eab308' },
    { type: 'smiley', value: 'sad', label: 'Sad', icon: Frown, color: '#ef4444' },
    { type: 'smiley', value: 'love', label: 'Love', icon: Heart, color: '#ec4899' },
    { type: 'smiley', value: 'thinking', label: 'Thinking', icon: HelpCircle, color: '#8b5cf6' },
    { type: 'smiley', value: 'thumbsup', label: 'Thumbs Up', icon: ThumbsUp, color: '#22c55e' },
    { type: 'smiley', value: 'thumbsdown', label: 'Thumbs Down', icon: ThumbsDown, color: '#ef4444' },
  ],
  arrow: [
    { type: 'arrow', value: 'up', label: 'Up', icon: ArrowUp, color: '#3b82f6' },
    { type: 'arrow', value: 'down', label: 'Down', icon: ArrowDown, color: '#3b82f6' },
    { type: 'arrow', value: 'left', label: 'Left', icon: ArrowLeft, color: '#3b82f6' },
    { type: 'arrow', value: 'right', label: 'Right', icon: ArrowRight, color: '#3b82f6' },
    { type: 'arrow', value: 'up-right', label: 'Up Right', icon: ArrowUpRight, color: '#22c55e' },
    { type: 'arrow', value: 'up-left', label: 'Up Left', icon: ArrowUpLeft, color: '#22c55e' },
    { type: 'arrow', value: 'down-right', label: 'Down Right', icon: ArrowDownRight, color: '#ef4444' },
    { type: 'arrow', value: 'down-left', label: 'Down Left', icon: ArrowDownLeft, color: '#ef4444' },
  ],
  symbol: [
    { type: 'symbol', value: 'star', label: 'Star', icon: Star, color: '#eab308' },
    { type: 'symbol', value: 'heart', label: 'Heart', icon: Heart, color: '#ef4444' },
    { type: 'symbol', value: 'bolt', label: 'Lightning', icon: Zap, color: '#eab308' },
    { type: 'symbol', value: 'fire', label: 'Fire', icon: Flame, color: '#f97316' },
    { type: 'symbol', value: 'warning', label: 'Warning', icon: AlertTriangle, color: '#eab308' },
    { type: 'symbol', value: 'info', label: 'Info', icon: Info, color: '#3b82f6' },
    { type: 'symbol', value: 'question', label: 'Question', icon: CircleHelp, color: '#8b5cf6' },
    { type: 'symbol', value: 'check', label: 'Check', icon: Check, color: '#22c55e' },
    { type: 'symbol', value: 'cross', label: 'Cross', icon: X, color: '#ef4444' },
    { type: 'symbol', value: 'clock', label: 'Clock', icon: Clock, color: '#6b7280' },
    { type: 'symbol', value: 'bookmark', label: 'Bookmark', icon: Bookmark, color: '#8b5cf6' },
    { type: 'symbol', value: 'pin', label: 'Pin', icon: Pin, color: '#ef4444' },
  ],
};

// Helper to get icon definition for a NodeIcon
export const getIconDefinition = (icon: NodeIcon): IconDefinition | undefined => {
  const category = ICON_DEFINITIONS[icon.type];
  return category.find((d) => d.value === icon.value);
};

// Helper to get the next icon in the same category (cycles back to first)
export const getNextIconInCategory = (icon: NodeIcon): NodeIcon => {
  const category = ICON_DEFINITIONS[icon.type];
  const currentIndex = category.findIndex((d) => d.value === icon.value);
  const nextIndex = (currentIndex + 1) % category.length;
  const nextDef = category[nextIndex];
  return { type: icon.type, value: nextDef.value } as NodeIcon;
};

// Helper to get all icons as a flat array
export const getAllIcons = (): IconDefinition[] => {
  return Object.values(ICON_DEFINITIONS).flat();
};

// Category labels for display
export const ICON_CATEGORY_LABELS: Record<IconCategory, string> = {
  priority: 'Priority',
  task: 'Task',
  flag: 'Flag',
  smiley: 'Smiley',
  arrow: 'Arrow',
  symbol: 'Symbol',
};
