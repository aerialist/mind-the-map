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
 * - <span class="colored c-{color}">text</span> for text color (Workflowy compatible)
 * - <span class="colored bc-{color}">text</span> for background highlight (Workflowy compatible)
 *
 * Supported colors: red, orange, yellow, green, teal, sky, blue, purple, pink, gray
 */

/**
 * Supported color values for text color and highlight
 */
export type TextColor = 'red' | 'orange' | 'yellow' | 'green' | 'teal' | 'sky' | 'blue' | 'purple' | 'pink' | 'gray';

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
  color?: TextColor; // Text color (Workflowy c-* classes)
  highlight?: TextColor; // Background highlight (Workflowy bc-* classes)
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
  // Matches: <b>text</b>, <i>text</i>, <a href="url">text</a>, <span class="colored c-red">text</span>, etc.
  const tagRegex = /<(b|i|u|s|code)>(.*?)<\/\1>|<a href="([^"]+)">(.*?)<\/a>|<span class="colored (c|bc)-(red|orange|yellow|green|teal|sky|blue|purple|pink|gray)">(.*?)<\/span>/g;

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
    }
    // Check if it's a color/highlight span tag
    else if (match[5] && match[6] && match[7]) {
      // Span tag: <span class="colored c-red">text</span> or <span class="colored bc-red">text</span>
      const colorType = match[5]; // 'c' or 'bc'
      const colorValue = match[6] as TextColor;
      const content = match[7];

      // Recursively parse the content to handle nested tags
      const innerSegments = parseFormattedText(content);

      // Apply color or highlight to all inner segments
      for (const seg of innerSegments) {
        const formattedSeg: TextSegment = { ...seg };
        if (colorType === 'c') {
          formattedSeg.color = colorValue;
        } else {
          formattedSeg.highlight = colorValue;
        }
        segments.push(formattedSeg);
      }
    }
    else {
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
      // Color and highlight are innermost (wrap the actual text content)
      if (segment.color) {
        text = `<span class="colored c-${segment.color}">${text}</span>`;
      }
      if (segment.highlight) {
        text = `<span class="colored bc-${segment.highlight}">${text}</span>`;
      }
      // Strikethrough
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
    .replace(/<(b|i|u|s|code)>(.*?)<\/\1>/g, '$2')
    .replace(/<span class="colored (c|bc)-(red|orange|yellow|green|teal|sky|blue|purple|pink|gray)">(.*?)<\/span>/g, '$3');
}

/**
 * Check if text contains any formatting tags
 *
 * @param text - Text to check
 * @returns True if text contains formatting tags
 */
export function hasFormatting(text: string): boolean {
  return (
    /<(b|i|u|s|code)>.*?<\/\1>/g.test(text) ||
    /<a href="[^"]+">(.*?)<\/a>/g.test(text) ||
    /<span class="colored (c|bc)-(red|orange|yellow|green|teal|sky|blue|purple|pink|gray)">.*?<\/span>/g.test(text)
  );
}
