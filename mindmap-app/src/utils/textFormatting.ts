/**
 * Text formatting utilities for inline formatting (bold, italic, etc.)
 *
 * Supported formatting tags:
 * - <b>text</b> for bold
 * - <i>text</i> for italic
 * - <u>text</u> for underline
 * - <s>text</s> for strikethrough
 * - <code>text</code> for inline code
 * - <a href="url">text</a> for hyperlinks
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
  link?: string; // URL for hyperlink
}

/**
 * Parse text with inline formatting tags into segments
 *
 * @param text - Text with formatting tags (e.g., "Hello <b>world</b>!")
 * @returns Array of text segments with formatting metadata
 */
export function parseFormattedText(text: string): TextSegment[] {
  const segments: TextSegment[] = [];

  // Regular expression to match any formatting tag (outermost first)
  // Matches: <b>text</b>, <i>text</i>, <a href="url">text</a>, etc.
  const tagRegex = /<(b|i|u|s|code)>(.*?)<\/\1>|<a href="([^"]+)">(.*?)<\/a>/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tagRegex.exec(text)) !== null) {
    // Add text before the tag (if any)
    if (match.index > lastIndex) {
      const plainText = text.substring(lastIndex, match.index);
      if (plainText) {
        segments.push({ text: plainText });
      }
    }

    // Check if it's a link tag
    if (match[3] && match[4]) {
      // Link tag: <a href="url">text</a>
      // Recursively parse the content inside the link
      const innerSegments = parseFormattedText(match[4]);
      // Merge all inner segments and add link to each
      for (const seg of innerSegments) {
        segments.push({ ...seg, link: match[3] });
      }
    } else {
      // Regular formatting tag
      const tag = match[1];
      const content = match[2];

      // Recursively parse the content to handle nested tags
      const innerSegments = parseFormattedText(content);

      // Apply the current tag's formatting to all inner segments
      for (const seg of innerSegments) {
        const formattedSeg: TextSegment = { ...seg };

        switch (tag) {
          case 'b':
            formattedSeg.bold = true;
            break;
          case 'i':
            formattedSeg.italic = true;
            break;
          case 'u':
            formattedSeg.underline = true;
            break;
          case 's':
            formattedSeg.strikethrough = true;
            break;
          case 'code':
            formattedSeg.code = true;
            break;
        }

        segments.push(formattedSeg);
      }
    }

    lastIndex = tagRegex.lastIndex;
  }

  // Add any remaining text after the last tag
  if (lastIndex < text.length) {
    const plainText = text.substring(lastIndex);
    if (plainText) {
      segments.push({ text: plainText });
    }
  }

  // If no tags were found, return the entire text as a single segment
  if (segments.length === 0 && text) {
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

      // Apply formatting in order from innermost to outermost
      // Strikethrough is innermost
      if (segment.strikethrough) {
        text = `<s>${text}</s>`;
      }
      if (segment.underline) {
        text = `<u>${text}</u>`;
      }
      if (segment.italic) {
        text = `<i>${text}</i>`;
      }
      if (segment.bold) {
        text = `<b>${text}</b>`;
      }
      if (segment.code) {
        text = `<code>${text}</code>`;
      }
      // Link is outermost
      if (segment.link) {
        text = `<a href="${segment.link}">${text}</a>`;
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
  return text
    .replace(/<a href="[^"]+">(.*?)<\/a>/g, '$1')
    .replace(/<(b|i|u|s|code)>(.*?)<\/\1>/g, '$2');
}

/**
 * Check if text contains any formatting tags
 *
 * @param text - Text to check
 * @returns True if text contains formatting tags
 */
export function hasFormatting(text: string): boolean {
  return /<(b|i|u|s|code)>.*?<\/\1>/g.test(text) || /<a href="[^"]+">(.*?)<\/a>/g.test(text);
}
