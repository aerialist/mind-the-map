// SVG strings for icons used in PixiJS MindMap canvas
// These are imported from lucide-static for consistent rendering

// Import SVG strings from lucide-static
import CircleDot from 'lucide-static/icons/circle-dot.svg?raw';
import Circle from 'lucide-static/icons/circle.svg?raw';
import CircleDashed from 'lucide-static/icons/circle-dashed.svg?raw';
import CircleCheck from 'lucide-static/icons/circle-check.svg?raw';
import CirclePause from 'lucide-static/icons/circle-pause.svg?raw';
import CircleX from 'lucide-static/icons/circle-x.svg?raw';
import Clock from 'lucide-static/icons/clock.svg?raw';
import Lock from 'lucide-static/icons/lock.svg?raw';
import Flag from 'lucide-static/icons/flag.svg?raw';
import Laugh from 'lucide-static/icons/laugh.svg?raw';
import Smile from 'lucide-static/icons/smile.svg?raw';
import Meh from 'lucide-static/icons/meh.svg?raw';
import Frown from 'lucide-static/icons/frown.svg?raw';
import Angry from 'lucide-static/icons/angry.svg?raw';
import AlarmClock from 'lucide-static/icons/alarm-clock.svg?raw';
import Timer from 'lucide-static/icons/timer.svg?raw';
import Calendar from 'lucide-static/icons/calendar.svg?raw';
import CalendarCheck from 'lucide-static/icons/calendar-check.svg?raw';
import CalendarX from 'lucide-static/icons/calendar-x.svg?raw';
import Hourglass from 'lucide-static/icons/hourglass.svg?raw';
import History from 'lucide-static/icons/history.svg?raw';
import User from 'lucide-static/icons/user.svg?raw';
import Users from 'lucide-static/icons/users.svg?raw';
import UserPlus from 'lucide-static/icons/user-plus.svg?raw';
import UserCheck from 'lucide-static/icons/user-check.svg?raw';
import UserX from 'lucide-static/icons/user-x.svg?raw';
import UserCog from 'lucide-static/icons/user-cog.svg?raw';
import MessageCircle from 'lucide-static/icons/message-circle.svg?raw';
import MessageCircleMore from 'lucide-static/icons/message-circle-more.svg?raw';
import Mail from 'lucide-static/icons/mail.svg?raw';
import Phone from 'lucide-static/icons/phone.svg?raw';
import Send from 'lucide-static/icons/send.svg?raw';
import AtSign from 'lucide-static/icons/at-sign.svg?raw';
import AudioLines from 'lucide-static/icons/audio-lines.svg?raw';
import FileText from 'lucide-static/icons/file-text.svg?raw';
import File from 'lucide-static/icons/file.svg?raw';
import Image from 'lucide-static/icons/image.svg?raw';
import Link from 'lucide-static/icons/link.svg?raw';
import Map from 'lucide-static/icons/map.svg?raw';
import Paperclip from 'lucide-static/icons/paperclip.svg?raw';
import FolderOpen from 'lucide-static/icons/folder-open.svg?raw';
import Database from 'lucide-static/icons/database.svg?raw';
import Code from 'lucide-static/icons/code.svg?raw';
import Video from 'lucide-static/icons/video.svg?raw';
import Star from 'lucide-static/icons/star.svg?raw';
import Heart from 'lucide-static/icons/heart.svg?raw';
import HeartCrack from 'lucide-static/icons/heart-crack.svg?raw';
import ThumbsUp from 'lucide-static/icons/thumbs-up.svg?raw';
import ThumbsDown from 'lucide-static/icons/thumbs-down.svg?raw';
import Bookmark from 'lucide-static/icons/bookmark.svg?raw';
import MapPin from 'lucide-static/icons/map-pin.svg?raw';
import Lightbulb from 'lucide-static/icons/lightbulb.svg?raw';
import Target from 'lucide-static/icons/target.svg?raw';
import Trophy from 'lucide-static/icons/trophy.svg?raw';
import Gift from 'lucide-static/icons/gift.svg?raw';
import Zap from 'lucide-static/icons/zap.svg?raw';
import Flame from 'lucide-static/icons/flame.svg?raw';
import Rocket from 'lucide-static/icons/rocket.svg?raw';
import Sparkles from 'lucide-static/icons/sparkles.svg?raw';
import Info from 'lucide-static/icons/info.svg?raw';
import CircleHelp from 'lucide-static/icons/circle-help.svg?raw';
import TriangleAlert from 'lucide-static/icons/triangle-alert.svg?raw';
import OctagonX from 'lucide-static/icons/octagon-x.svg?raw';
import AlertCircle from 'lucide-static/icons/alert-circle.svg?raw';
import Eye from 'lucide-static/icons/eye.svg?raw';
import EyeOff from 'lucide-static/icons/eye-off.svg?raw';
import Bug from 'lucide-static/icons/bug.svg?raw';
import Wrench from 'lucide-static/icons/wrench.svg?raw';
import Shield from 'lucide-static/icons/shield.svg?raw';
import ShieldCheck from 'lucide-static/icons/shield-check.svg?raw';
import HelpCircle from 'lucide-static/icons/help-circle.svg?raw';

import type { IconCategory } from './icons';

// Map of icon category + value to SVG string
type IconSvgMap = Record<string, Record<string, string>>;

export const ICON_SVG_MAP: IconSvgMap = {
  priority: {
    // Priority uses CircleDot for all values
    '1': CircleDot,
    '2': CircleDot,
    '3': CircleDot,
    '4': CircleDot,
    '5': CircleDot,
  },
  status: {
    'todo': Circle,
    'in-progress': CircleDashed,
    'done': CircleCheck,
    'paused': CirclePause,
    'cancelled': CircleX,
    'waiting': Clock,
    'locked': Lock,
  },
  flag: {
    'red': Flag,
    'orange': Flag,
    'yellow': Flag,
    'green': Flag,
    'blue': Flag,
    'purple': Flag,
    'black': Flag,
  },
  mood: {
    'very-positive': Laugh,
    'positive': Smile,
    'neutral': Meh,
    'negative': Frown,
    'very-negative': Angry,
  },
  time: {
    'clock': Clock,
    'alarm': AlarmClock,
    'timer': Timer,
    'calendar': Calendar,
    'calendar-check': CalendarCheck,
    'calendar-x': CalendarX,
    'hourglass': Hourglass,
    'history': History,
  },
  people: {
    'user': User,
    'users': Users,
    'user-plus': UserPlus,
    'user-check': UserCheck,
    'user-x': UserX,
    'user-cog': UserCog,
  },
  communication: {
    'message': MessageCircle,
    'message-more': MessageCircleMore,
    'mail': Mail,
    'phone': Phone,
    'send': Send,
    'at-sign': AtSign,
  },
  document: {
    'file-text': FileText,
    'file': File,
    'image': Image,
    'audio-lines': AudioLines,
    'video': Video,
    'map': Map,
    'link': Link,
    'attachment': Paperclip,
    'folder': FolderOpen,
    'database': Database,
    'code': Code,
  },
  symbol: {
    'star': Star,
    'heart': Heart,
    'heart-crack': HeartCrack,
    'thumbs-up': ThumbsUp,
    'thumbs-down': ThumbsDown,
    'bookmark': Bookmark,
    'map-pin': MapPin,
    'lightbulb': Lightbulb,
    'target': Target,
    'trophy': Trophy,
    'gift': Gift,
    'zap': Zap,
    'flame': Flame,
    'rocket': Rocket,
    'sparkles': Sparkles,
  },
  notice: {
    'info': Info,
    'help': CircleHelp,
    'warning': TriangleAlert,
    'error': OctagonX,
    'alert': AlertCircle,
    'eye': Eye,
    'eye-off': EyeOff,
    'bug': Bug,
    'wrench': Wrench,
    'shield': Shield,
    'shield-check': ShieldCheck,
  },
};

// Fallback SVG for unknown icons
export const FALLBACK_ICON_SVG = HelpCircle;

/**
 * Get SVG string for an icon
 * @param type Icon category
 * @param value Icon value
 * @returns SVG string or fallback if not found
 */
export function getIconSvg(type: IconCategory | string, value: string | number): string {
  const categoryMap = ICON_SVG_MAP[type];
  if (!categoryMap) {
    return FALLBACK_ICON_SVG;
  }
  
  const svg = categoryMap[String(value)];
  return svg || FALLBACK_ICON_SVG;
}
