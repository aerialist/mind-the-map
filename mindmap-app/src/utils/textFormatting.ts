/**
 * Text formatting utilities for inline formatting (bold, italic, etc.)
 *
 * Supports Workflowy-style formatting tags:
 * - <b>text</b> for bold
 * - Future: <i>text</i> for italic, <u>text</u> for underline, etc.
 */

/**
 * A text segment with optional formatting
 */
export interface TextSegment {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  code?: boolean;
}

/**
 * Parse text with inline formatting tags into segments
 *
 * @param text - Text with formatting tags (e.g., "Hello <b>world</b>!")
 * @returns Array of text segments with formatting metadata
 */
export function parseFormattedText(text: string): TextSegment[] {
  const segments: TextSegment[] = [];

  // Regular expression to match formatting tags
  // Matches: <b>text</b>, <i>text</i>, etc.
  const tagRegex = /<(b|i|u|s|code)>(.*?)<\/\1>/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tagRegex.exec(text)) !== null) {
    // Add text before the tag (if any)
    if (match.index > lastIndex) {
      segments.push({
        text: text.substring(lastIndex, match.index),
      });
    }

    // Add the formatted text
    const tag = match[1];
    const content = match[2];
    const segment: TextSegment = { text: content };

    switch (tag) {
      case 'b':
        segment.bold = true;
        break;
      case 'i':
        segment.italic = true;
        break;
      case 'u':
        segment.underline = true;
        break;
      case 's':
        segment.strikethrough = true;
        break;
      case 'code':
        segment.code = true;
        break;
    }

    segments.push(segment);
    lastIndex = tagRegex.lastIndex;
  }

  // Add any remaining text after the last tag
  if (lastIndex < text.length) {
    segments.push({
      text: text.substring(lastIndex),
    });
  }

  // If no tags were found, return the entire text as a single segment
  if (segments.length === 0) {
    segments.push({ text });
  }

  return segments;
}

/**
 * Convert text segments back to formatted text string
 *
 * @param segments - Array of text segments with formatting
 * @returns Text with formatting tags
 */
export function serializeFormattedText(segments: TextSegment[]): string {
  return segments
    .map((segment) => {
      let text = segment.text;

      if (segment.code) {
        text = `<code>${text}</code>`;
      }
      if (segment.bold) {
        text = `<b>${text}</b>`;
      }
      if (segment.italic) {
        text = `<i>${text}</i>`;
      }
      if (segment.underline) {
        text = `<u>${text}</u>`;
      }
      if (segment.strikethrough) {
        text = `<s>${text}</s>`;
      }

      return text;
    })
    .join('');
}

/**
 * Get plain text from formatted text (strip all tags)
 *
 * @param text - Text with formatting tags
 * @returns Plain text without tags
 */
export function getPlainText(text: string): string {
  return text.replace(/<(b|i|u|s|code)>(.*?)<\/\1>/g, '$2');
}

/**
 * Check if text contains any formatting tags
 *
 * @param text - Text to check
 * @returns True if text contains formatting tags
 */
export function hasFormatting(text: string): boolean {
  return /<(b|i|u|s|code)>.*?<\/\1>/g.test(text);
}
