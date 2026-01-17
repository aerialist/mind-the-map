import { parseFormattedText } from '../../utils/textFormatting';
import { openLink } from '../../services/tauri';

interface FormattedTextProps {
  text: string;
  className?: string;
}

/**
 * Render text with inline formatting.
 * Supports: <b>, <i>, <u>, <s>, <code>, <a href="url">
 *
 * Note: Text segments use pointer-events-none to allow clicks to bubble up,
 * but links are clickable with pointer-events-auto
 */
function FormattedText({ text, className }: FormattedTextProps) {
  const segments = parseFormattedText(text);

  return (
    <span className={className}>
      {segments.map((segment, index) => {
        const classes: string[] = [];
        const styles: React.CSSProperties = { pointerEvents: 'none' };

        if (segment.bold) classes.push('font-bold');
        if (segment.italic) classes.push('italic');
        if (segment.underline) classes.push('underline');
        if (segment.strikethrough) classes.push('line-through');
        if (segment.code) {
          classes.push('font-mono', 'bg-gray-100', 'dark:bg-gray-800', 'px-1', 'py-0.5', 'rounded', 'text-sm');
        }

        if (segment.link) {
          // Links are clickable and have special styling
          return (
            <a
              key={index}
              href={segment.link}
              className={`text-blue-600 dark:text-blue-400 underline hover:text-blue-700 dark:hover:text-blue-300 cursor-pointer ${classes.join(' ')}`}
              style={{ pointerEvents: 'auto' }}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                openLink(segment.link!);
              }}
            >
              {segment.text}
            </a>
          );
        }

        return (
          <span
            key={index}
            className={classes.join(' ')}
            style={styles}
          >
            {segment.text}
          </span>
        );
      })}
    </span>
  );
}

export default FormattedText;
