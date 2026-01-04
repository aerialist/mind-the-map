// Type exports

export type { Node, NodeContent, NodeMap, Position } from './node';
export type {
  Document,
  DocumentMetadata,
  DocumentView,
  ViewMode,
  Viewport,
} from './document';
export type {
  NodeIcon,
  IconCategory,
  IconDefinition,
  PriorityIcon,
  StatusIcon,
  FlagIcon,
  MoodIcon,
  TimeIcon,
  PeopleIcon,
  CommunicationIcon,
  DocumentIcon,
  SymbolIcon,
  NoticeIcon,
} from './icons';
export {
  ICON_DEFINITIONS,
  ICON_CATEGORY_LABELS,
  getIconDefinition,
  getNextIconInCategory,
  getAllIcons,
  sortIconsByDisplayOrder,
} from './icons';
export { getIconSvg, ICON_SVG_MAP, FALLBACK_ICON_SVG } from './iconSvg';
