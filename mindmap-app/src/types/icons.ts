// Icon type definitions for node markers
import type { LucideIcon } from 'lucide-react';
import {
  // Priority icons
  CircleDot,
  // Status icons
  Circle,
  CircleDashed,
  CircleCheck,
  CirclePause,
  CircleX,
  Clock,
  Lock,
  // Flag icons
  Flag,
  // Mood icons
  Laugh,
  Smile,
  Meh,
  Frown,
  Angry,
  // Time icons
  AlarmClock,
  Timer,
  Calendar,
  CalendarCheck,
  CalendarX,
  Hourglass,
  History,
  // People icons
  User,
  Users,
  UserPlus,
  UserCheck,
  UserX,
  UserCog,
  // Communication icons
  MessageCircle,
  MessageCircleMore,
  Mail,
  Phone,
  Send,
  AtSign,
  // Document icons
  AudioLines,
  FileText,
  File,
  Image,
  Link,
  Map,
  Paperclip,
  FolderOpen,
  Database,
  Code,
  Video,
  // Symbol icons
  Star,
  Heart,
  HeartCrack,
  ThumbsUp,
  ThumbsDown,
  Bookmark,
  MapPin,
  Lightbulb,
  Target,
  Trophy,
  Gift,
  Zap,
  Flame,
  Rocket,
  Sparkles,
  // Notice icons
  Info,
  CircleHelp,
  TriangleAlert,
  OctagonX,
  AlertCircle,
  Eye,
  EyeOff,
  Bug,
  Wrench,
  Shield,
  ShieldCheck,
  // Fallback icon for unknown icons
  HelpCircle,
} from 'lucide-react';

// Priority icons (1-5)
export type PriorityIcon = 1 | 2 | 3 | 4 | 5;

// Status icons
export type StatusIcon = 'todo' | 'in-progress' | 'done' | 'paused' | 'cancelled' | 'waiting' | 'locked';

// Flag icons
export type FlagIcon = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'black';

// Mood icons
export type MoodIcon = 'very-positive' | 'positive' | 'neutral' | 'negative' | 'very-negative';

// Time icons
export type TimeIcon = 'clock' | 'alarm' | 'timer' | 'calendar' | 'calendar-check' | 'calendar-x' | 'hourglass' | 'history';

// People icons
export type PeopleIcon = 'user' | 'users' | 'user-plus' | 'user-check' | 'user-x' | 'user-cog';

// Communication icons
export type CommunicationIcon = 'message' | 'message-more' | 'mail' | 'phone' | 'send' | 'at-sign';

// Document icons
export type DocumentIcon =
  | 'file-text'
  | 'file'
  | 'image'
  | 'audio-lines'
  | 'video'
  | 'map'
  | 'link'
  | 'attachment'
  | 'folder'
  | 'database'
  | 'code';

// Symbol icons
export type SymbolIcon = 'star' | 'heart' | 'heart-crack' | 'thumbs-up' | 'thumbs-down' | 'bookmark' | 'map-pin' | 'lightbulb' | 'target' | 'trophy' | 'gift' | 'zap' | 'flame' | 'rocket' | 'sparkles';

// Notice icons
export type NoticeIcon = 'info' | 'help' | 'warning' | 'error' | 'alert' | 'eye' | 'eye-off' | 'bug' | 'wrench' | 'shield' | 'shield-check';

// All icon types combined
export type NodeIcon =
  | { type: 'priority'; value: PriorityIcon }
  | { type: 'status'; value: StatusIcon }
  | { type: 'flag'; value: FlagIcon }
  | { type: 'mood'; value: MoodIcon }
  | { type: 'time'; value: TimeIcon }
  | { type: 'people'; value: PeopleIcon }
  | { type: 'communication'; value: CommunicationIcon }
  | { type: 'document'; value: DocumentIcon }
  | { type: 'symbol'; value: SymbolIcon }
  | { type: 'notice'; value: NoticeIcon };

// Icon category for picker
export type IconCategory = 'priority' | 'status' | 'flag' | 'mood' | 'time' | 'people' | 'communication' | 'document' | 'symbol' | 'notice';

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
    { type: 'priority', value: 1, label: 'Priority 1 - Highest', icon: CircleDot, color: '#ef4444', text: '1' },
    { type: 'priority', value: 2, label: 'Priority 2 - High', icon: CircleDot, color: '#f97316', text: '2' },
    { type: 'priority', value: 3, label: 'Priority 3 - Medium', icon: CircleDot, color: '#eab308', text: '3' },
    { type: 'priority', value: 4, label: 'Priority 4 - Low', icon: CircleDot, color: '#22c55e', text: '4' },
    { type: 'priority', value: 5, label: 'Priority 5 - Lowest', icon: CircleDot, color: '#3b82f6', text: '5' },
  ],
  status: [
    { type: 'status', value: 'todo', label: 'Todo - Not started', icon: Circle, color: '#6b7280' },
    { type: 'status', value: 'in-progress', label: 'In Progress - Active work', icon: CircleDashed, color: '#3b82f6' },
    { type: 'status', value: 'done', label: 'Done - Completed', icon: CircleCheck, color: '#22c55e' },
    { type: 'status', value: 'paused', label: 'Paused - Temporarily stopped', icon: CirclePause, color: '#f97316' },
    { type: 'status', value: 'cancelled', label: 'Cancelled - Won\'t be done', icon: CircleX, color: '#ef4444' },
    { type: 'status', value: 'waiting', label: 'Waiting - Scheduled or blocked', icon: Clock, color: '#8b5cf6' },
    { type: 'status', value: 'locked', label: 'Locked - Frozen, cannot change', icon: Lock, color: '#6b7280' },
  ],
  flag: [
    { type: 'flag', value: 'red', label: 'Red Flag', icon: Flag, color: '#ef4444' },
    { type: 'flag', value: 'orange', label: 'Orange Flag', icon: Flag, color: '#f97316' },
    { type: 'flag', value: 'yellow', label: 'Yellow Flag', icon: Flag, color: '#eab308' },
    { type: 'flag', value: 'green', label: 'Green Flag', icon: Flag, color: '#22c55e' },
    { type: 'flag', value: 'blue', label: 'Blue Flag', icon: Flag, color: '#3b82f6' },
    { type: 'flag', value: 'purple', label: 'Purple Flag', icon: Flag, color: '#8b5cf6' },
    { type: 'flag', value: 'black', label: 'Black Flag', icon: Flag, color: '#1f2937' },
  ],
  mood: [
    { type: 'mood', value: 'very-positive', label: 'Very Positive - Excited, great', icon: Laugh, color: '#22c55e' },
    { type: 'mood', value: 'positive', label: 'Positive - Good, satisfied', icon: Smile, color: '#84cc16' },
    { type: 'mood', value: 'neutral', label: 'Neutral - Okay, uncertain', icon: Meh, color: '#eab308' },
    { type: 'mood', value: 'negative', label: 'Negative - Concerned, disappointed', icon: Frown, color: '#f97316' },
    { type: 'mood', value: 'very-negative', label: 'Very Negative - Frustrated, serious issue', icon: Angry, color: '#ef4444' },
  ],
  time: [
    { type: 'time', value: 'clock', label: 'General time reference', icon: Clock, color: '#6b7280' },
    { type: 'time', value: 'alarm', label: 'Reminder or deadline', icon: AlarmClock, color: '#ef4444' },
    { type: 'time', value: 'timer', label: 'Time-sensitive, countdown', icon: Timer, color: '#f97316' },
    { type: 'time', value: 'calendar', label: 'Scheduled date', icon: Calendar, color: '#3b82f6' },
    { type: 'time', value: 'calendar-check', label: 'Date confirmed', icon: CalendarCheck, color: '#22c55e' },
    { type: 'time', value: 'calendar-x', label: 'Date cancelled or unavailable', icon: CalendarX, color: '#ef4444' },
    { type: 'time', value: 'hourglass', label: 'Waiting, time passing', icon: Hourglass, color: '#eab308' },
    { type: 'time', value: 'history', label: 'Past event, historical', icon: History, color: '#6b7280' },
  ],
  people: [
    { type: 'people', value: 'user', label: 'Single person assigned', icon: User, color: '#3b82f6' },
    { type: 'people', value: 'users', label: 'Team or group', icon: Users, color: '#8b5cf6' },
    { type: 'people', value: 'user-plus', label: 'Need to add someone', icon: UserPlus, color: '#22c55e' },
    { type: 'people', value: 'user-check', label: 'Person confirmed or approved', icon: UserCheck, color: '#22c55e' },
    { type: 'people', value: 'user-x', label: 'Person removed or unavailable', icon: UserX, color: '#ef4444' },
    { type: 'people', value: 'user-cog', label: 'Person responsible for setup/config', icon: UserCog, color: '#6b7280' },
  ],
  communication: [
    { type: 'communication', value: 'message', label: 'Discussion needed', icon: MessageCircle, color: '#3b82f6' },
    { type: 'communication', value: 'message-more', label: 'Ongoing conversation', icon: MessageCircleMore, color: '#8b5cf6' },
    { type: 'communication', value: 'mail', label: 'Email required', icon: Mail, color: '#6b7280' },
    { type: 'communication', value: 'phone', label: 'Call required', icon: Phone, color: '#22c55e' },
    { type: 'communication', value: 'send', label: 'To be sent', icon: Send, color: '#3b82f6' },
    { type: 'communication', value: 'at-sign', label: 'Mention or notification', icon: AtSign, color: '#f97316' },
  ],
  document: [
    { type: 'document', value: 'file-text', label: 'Document or note', icon: FileText, color: '#3b82f6' },
    { type: 'document', value: 'file', label: 'Generic file', icon: File, color: '#6b7280' },
    { type: 'document', value: 'image', label: 'Image or visual', icon: Image, color: '#8b5cf6' },
    { type: 'document', value: 'audio-lines', label: 'Audio file', icon: AudioLines, color: '#f97316' },
    { type: 'document', value: 'video', label: 'Video file', icon: Video, color: '#8b5cf6' },
    { type: 'document', value: 'map', label: 'Mind map', icon: Map, color: '#22c55e' },
    { type: 'document', value: 'link', label: 'External link', icon: Link, color: '#3b82f6' },
    { type: 'document', value: 'attachment', label: 'Attachment', icon: Paperclip, color: '#6b7280' },
    { type: 'document', value: 'folder', label: 'Folder or collection', icon: FolderOpen, color: '#eab308' },
    { type: 'document', value: 'database', label: 'Data source', icon: Database, color: '#22c55e' },
    { type: 'document', value: 'code', label: 'Code or technical', icon: Code, color: '#f97316' },
  ],
  symbol: [
    { type: 'symbol', value: 'star', label: 'Favorite, important', icon: Star, color: '#eab308' },
    { type: 'symbol', value: 'heart', label: 'Liked, loved', icon: Heart, color: '#ef4444' },
    { type: 'symbol', value: 'heart-crack', label: 'Broken, disappointing', icon: HeartCrack, color: '#6b7280' },
    { type: 'symbol', value: 'thumbs-up', label: 'Approved, agree', icon: ThumbsUp, color: '#22c55e' },
    { type: 'symbol', value: 'thumbs-down', label: 'Rejected, disagree', icon: ThumbsDown, color: '#ef4444' },
    { type: 'symbol', value: 'bookmark', label: 'Save for later', icon: Bookmark, color: '#8b5cf6' },
    { type: 'symbol', value: 'map-pin', label: 'Location reference', icon: MapPin, color: '#ef4444' },
    { type: 'symbol', value: 'lightbulb', label: 'Idea', icon: Lightbulb, color: '#eab308' },
    { type: 'symbol', value: 'target', label: 'Goal', icon: Target, color: '#ef4444' },
    { type: 'symbol', value: 'trophy', label: 'Achievement, milestone', icon: Trophy, color: '#eab308' },
    { type: 'symbol', value: 'gift', label: 'Reward, bonus', icon: Gift, color: '#ec4899' },
    { type: 'symbol', value: 'zap', label: 'Quick, energy, action', icon: Zap, color: '#eab308' },
    { type: 'symbol', value: 'flame', label: 'Hot, urgent, trending', icon: Flame, color: '#f97316' },
    { type: 'symbol', value: 'rocket', label: 'Launch, fast-track', icon: Rocket, color: '#8b5cf6' },
    { type: 'symbol', value: 'sparkles', label: 'New, special', icon: Sparkles, color: '#eab308' },
  ],
  notice: [
    { type: 'notice', value: 'info', label: 'Information', icon: Info, color: '#3b82f6' },
    { type: 'notice', value: 'help', label: 'Question, needs clarification', icon: CircleHelp, color: '#8b5cf6' },
    { type: 'notice', value: 'warning', label: 'Warning, caution', icon: TriangleAlert, color: '#eab308' },
    { type: 'notice', value: 'error', label: 'Error, critical stop', icon: OctagonX, color: '#ef4444' },
    { type: 'notice', value: 'alert', label: 'Alert, attention needed', icon: AlertCircle, color: '#f97316' },
    { type: 'notice', value: 'eye', label: 'Review needed, visible', icon: Eye, color: '#3b82f6' },
    { type: 'notice', value: 'eye-off', label: 'Hidden, ignore', icon: EyeOff, color: '#6b7280' },
    { type: 'notice', value: 'bug', label: 'Issue, problem', icon: Bug, color: '#ef4444' },
    { type: 'notice', value: 'wrench', label: 'Needs fixing, configuration', icon: Wrench, color: '#6b7280' },
    { type: 'notice', value: 'shield', label: 'Security, protected', icon: Shield, color: '#3b82f6' },
    { type: 'notice', value: 'shield-check', label: 'Verified, secure', icon: ShieldCheck, color: '#22c55e' },
  ],
};

// Fallback icon definition for unknown/legacy icons
const FALLBACK_ICON_DEFINITION: IconDefinition = {
  type: 'notice',
  value: 'unknown',
  label: 'Unknown Icon',
  icon: HelpCircle,
  color: '#9ca3af',
};

// Helper to get icon definition for a NodeIcon (with backward compatibility for unknown icons)
export const getIconDefinition = (icon: NodeIcon): IconDefinition | undefined => {
  // Safety check for malformed icon data
  if (!icon || typeof icon !== 'object' || !icon.type) {
    return undefined;
  }
  
  // Check if the category exists (handles legacy categories like 'task', 'smiley', 'arrow')
  const category = ICON_DEFINITIONS[icon.type as IconCategory];
  if (!category) {
    // Return fallback for unknown category
    return {
      ...FALLBACK_ICON_DEFINITION,
      label: `Unknown: ${icon.type}/${icon.value}`,
    };
  }
  
  // Find the icon in the category
  const iconDef = category.find((d) => d.value === icon.value);
  if (!iconDef) {
    // Return fallback for unknown value in known category
    return {
      ...FALLBACK_ICON_DEFINITION,
      type: icon.type as IconCategory,
      label: `Unknown: ${icon.type}/${icon.value}`,
    };
  }
  
  return iconDef;
};

// Helper to get the next icon in the same category (cycles back to first)
export const getNextIconInCategory = (icon: NodeIcon): NodeIcon => {
  // Safety check for malformed icon data
  if (!icon || typeof icon !== 'object' || !icon.type) {
    return { type: 'priority', value: 1 };
  }
  
  const category = ICON_DEFINITIONS[icon.type as IconCategory];
  
  // If category doesn't exist (legacy), return first priority icon
  if (!category) {
    return { type: 'priority', value: 1 };
  }
  
  const currentIndex = category.findIndex((d) => d.value === icon.value);
  
  // If icon value not found in category, return first icon in category
  if (currentIndex === -1) {
    return { type: icon.type, value: category[0].value } as NodeIcon;
  }
  
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
  status: 'Status',
  flag: 'Flag',
  mood: 'Mood',
  time: 'Time',
  people: 'People',
  communication: 'Communication',
  document: 'Document',
  symbol: 'Symbols',
  notice: 'Notice',
};

// Icon display order - categories are displayed in this order on nodes
const ICON_DISPLAY_ORDER: IconCategory[] = [
  'priority',
  'status',
  'flag',
  'mood',
  'time',
  'people',
  'communication',
  'document',
  'symbol',
  'notice',
];

// Helper to sort icons by their category order for consistent display
export const sortIconsByDisplayOrder = (icons: NodeIcon[]): NodeIcon[] => {
  return [...icons].sort((a, b) => {
    const orderA = ICON_DISPLAY_ORDER.indexOf(a.type as IconCategory);
    const orderB = ICON_DISPLAY_ORDER.indexOf(b.type as IconCategory);
    
    // If category not found in order, place at end
    const indexA = orderA === -1 ? ICON_DISPLAY_ORDER.length : orderA;
    const indexB = orderB === -1 ? ICON_DISPLAY_ORDER.length : orderB;
    
    return indexA - indexB;
  });
};
