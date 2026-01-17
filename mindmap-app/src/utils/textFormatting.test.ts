import { describe, it, expect } from 'vitest';
import {
  parseFormattedText,
  serializeFormattedText,
  getPlainText,
  hasFormatting,
  type TextSegment,
} from './textFormatting';

describe('textFormatting', () => {
  describe('parseFormattedText', () => {
    it('should parse plain text without formatting', () => {
      const result = parseFormattedText('Hello world');
      expect(result).toEqual([{ text: 'Hello world' }]);
    });

    it('should parse bold text', () => {
      const result = parseFormattedText('Hello <b>world</b>!');
      expect(result).toEqual([
        { text: 'Hello ' },
        { text: 'world', bold: true },
        { text: '!' },
      ]);
    });

    it('should parse italic text', () => {
      const result = parseFormattedText('This is <i>italic</i> text');
      expect(result).toEqual([
        { text: 'This is ' },
        { text: 'italic', italic: true },
        { text: ' text' },
      ]);
    });

    it('should parse underline text', () => {
      const result = parseFormattedText('This is <u>underlined</u> text');
      expect(result).toEqual([
        { text: 'This is ' },
        { text: 'underlined', underline: true },
        { text: ' text' },
      ]);
    });

    it('should parse strikethrough text', () => {
      const result = parseFormattedText('This is <s>crossed out</s> text');
      expect(result).toEqual([
        { text: 'This is ' },
        { text: 'crossed out', strikethrough: true },
        { text: ' text' },
      ]);
    });

    it('should parse inline code', () => {
      const result = parseFormattedText('Run <code>npm install</code> here');
      expect(result).toEqual([
        { text: 'Run ' },
        { text: 'npm install', code: true },
        { text: ' here' },
      ]);
    });

    it('should parse hyperlinks', () => {
      const result = parseFormattedText('Visit <a href="https://example.com">our website</a> here');
      expect(result).toEqual([
        { text: 'Visit ' },
        { text: 'our website', link: 'https://example.com' },
        { text: ' here' },
      ]);
    });

    it('should parse multiple formatting tags', () => {
      const result = parseFormattedText('This is <b>bold</b> and <i>italic</i> text');
      expect(result).toEqual([
        { text: 'This is ' },
        { text: 'bold', bold: true },
        { text: ' and ' },
        { text: 'italic', italic: true },
        { text: ' text' },
      ]);
    });

    it('should handle text with only formatting tags', () => {
      const result = parseFormattedText('<b>bold</b>');
      expect(result).toEqual([{ text: 'bold', bold: true }]);
    });

    it('should handle empty segments gracefully', () => {
      const result = parseFormattedText('<b></b>test');
      // Empty segments are filtered out
      expect(result).toEqual([
        { text: 'test' },
      ]);
    });

    it('should parse nested formatting tags', () => {
      const result = parseFormattedText('<i><u><s>nested</s></u></i>');
      expect(result).toEqual([
        { text: 'nested', italic: true, underline: true, strikethrough: true },
      ]);
    });

    it('should parse partially nested formatting tags', () => {
      const result = parseFormattedText('<b>bold and <i>bold italic</i></b>');
      expect(result).toEqual([
        { text: 'bold and ', bold: true },
        { text: 'bold italic', bold: true, italic: true },
      ]);
    });

    it('should parse complex nested formatting', () => {
      const result = parseFormattedText('Start <b>bold <i>both</i> end</b> finish');
      expect(result).toEqual([
        { text: 'Start ' },
        { text: 'bold ', bold: true },
        { text: 'both', bold: true, italic: true },
        { text: ' end', bold: true },
        { text: ' finish' },
      ]);
    });

    it('should parse link with nested formatting', () => {
      const result = parseFormattedText('<a href="https://example.com"><b>bold link</b></a>');
      expect(result).toEqual([
        { text: 'bold link', bold: true, link: 'https://example.com' },
      ]);
    });

    it('should parse nested formatting inside code', () => {
      const result = parseFormattedText('<code><b>npm install</b></code>');
      expect(result).toEqual([
        { text: 'npm install', code: true, bold: true },
      ]);
    });
  });

  describe('serializeFormattedText', () => {
    it('should serialize plain text', () => {
      const segments: TextSegment[] = [{ text: 'Hello world' }];
      expect(serializeFormattedText(segments)).toBe('Hello world');
    });

    it('should serialize bold text', () => {
      const segments: TextSegment[] = [
        { text: 'Hello ' },
        { text: 'world', bold: true },
        { text: '!' },
      ];
      expect(serializeFormattedText(segments)).toBe('Hello <b>world</b>!');
    });

    it('should serialize italic text', () => {
      const segments: TextSegment[] = [
        { text: 'This is ' },
        { text: 'italic', italic: true },
        { text: ' text' },
      ];
      expect(serializeFormattedText(segments)).toBe('This is <i>italic</i> text');
    });

    it('should serialize underline text', () => {
      const segments: TextSegment[] = [
        { text: 'This is ' },
        { text: 'underlined', underline: true },
        { text: ' text' },
      ];
      expect(serializeFormattedText(segments)).toBe('This is <u>underlined</u> text');
    });

    it('should serialize strikethrough text', () => {
      const segments: TextSegment[] = [
        { text: 'This is ' },
        { text: 'crossed out', strikethrough: true },
        { text: ' text' },
      ];
      expect(serializeFormattedText(segments)).toBe('This is <s>crossed out</s> text');
    });

    it('should serialize inline code', () => {
      const segments: TextSegment[] = [
        { text: 'Run ' },
        { text: 'npm install', code: true },
        { text: ' here' },
      ];
      expect(serializeFormattedText(segments)).toBe('Run <code>npm install</code> here');
    });

    it('should serialize hyperlinks', () => {
      const segments: TextSegment[] = [
        { text: 'Visit ' },
        { text: 'our website', link: 'https://example.com' },
        { text: ' here' },
      ];
      expect(serializeFormattedText(segments)).toBe('Visit <a href="https://example.com">our website</a> here');
    });

    it('should serialize multiple formatting types on the same text', () => {
      const segments: TextSegment[] = [
        { text: 'formatted', bold: true, italic: true, underline: true },
      ];
      const result = serializeFormattedText(segments);
      // Order from innermost to outermost: strikethrough, underline, italic, bold, code, link
      expect(result).toBe('<b><i><u>formatted</u></i></b>');
    });

    it('should serialize link with other formatting', () => {
      const segments: TextSegment[] = [
        { text: 'click here', link: 'https://example.com', bold: true },
      ];
      const result = serializeFormattedText(segments);
      // Link is outermost, bold is inside
      expect(result).toBe('<a href="https://example.com"><b>click here</b></a>');
    });
  });

  describe('getPlainText', () => {
    it('should return plain text without any formatting', () => {
      expect(getPlainText('Hello world')).toBe('Hello world');
    });

    it('should strip bold tags', () => {
      expect(getPlainText('Hello <b>world</b>!')).toBe('Hello world!');
    });

    it('should strip italic tags', () => {
      expect(getPlainText('This is <i>italic</i> text')).toBe('This is italic text');
    });

    it('should strip underline tags', () => {
      expect(getPlainText('This is <u>underlined</u> text')).toBe('This is underlined text');
    });

    it('should strip strikethrough tags', () => {
      expect(getPlainText('This is <s>crossed out</s> text')).toBe('This is crossed out text');
    });

    it('should strip code tags', () => {
      expect(getPlainText('Run <code>npm install</code> here')).toBe('Run npm install here');
    });

    it('should strip link tags', () => {
      expect(getPlainText('Visit <a href="https://example.com">our website</a> here')).toBe('Visit our website here');
    });

    it('should strip all formatting tags', () => {
      const formatted = 'This is <b>bold</b>, <i>italic</i>, <u>underlined</u>, <s>strikethrough</s>, <code>code</code>, and <a href="https://example.com">a link</a>';
      expect(getPlainText(formatted)).toBe('This is bold, italic, underlined, strikethrough, code, and a link');
    });
  });

  describe('hasFormatting', () => {
    it('should return false for plain text', () => {
      expect(hasFormatting('Hello world')).toBe(false);
    });

    it('should return true for bold text', () => {
      expect(hasFormatting('Hello <b>world</b>!')).toBe(true);
    });

    it('should return true for italic text', () => {
      expect(hasFormatting('This is <i>italic</i> text')).toBe(true);
    });

    it('should return true for underline text', () => {
      expect(hasFormatting('This is <u>underlined</u> text')).toBe(true);
    });

    it('should return true for strikethrough text', () => {
      expect(hasFormatting('This is <s>crossed out</s> text')).toBe(true);
    });

    it('should return true for code text', () => {
      expect(hasFormatting('Run <code>npm install</code> here')).toBe(true);
    });

    it('should return true for links', () => {
      expect(hasFormatting('Visit <a href="https://example.com">our website</a> here')).toBe(true);
    });
  });

  describe('round-trip consistency', () => {
    it('should maintain text through parse and serialize', () => {
      const original = 'Hello <b>bold</b> and <i>italic</i> and <u>underlined</u> text';
      const parsed = parseFormattedText(original);
      const serialized = serializeFormattedText(parsed);
      expect(serialized).toBe(original);
    });

    it('should maintain link formatting through round-trip', () => {
      const original = 'Visit <a href="https://example.com">our website</a> for more info';
      const parsed = parseFormattedText(original);
      const serialized = serializeFormattedText(parsed);
      expect(serialized).toBe(original);
    });

    it('should maintain code formatting through round-trip', () => {
      const original = 'Run <code>npm install</code> to install dependencies';
      const parsed = parseFormattedText(original);
      const serialized = serializeFormattedText(parsed);
      expect(serialized).toBe(original);
    });

    it('should maintain strikethrough formatting through round-trip', () => {
      const original = 'This is <s>old information</s> outdated';
      const parsed = parseFormattedText(original);
      const serialized = serializeFormattedText(parsed);
      expect(serialized).toBe(original);
    });

    it('should maintain nested formatting through round-trip', () => {
      const original = '<i><u><s>nested</s></u></i>';
      const parsed = parseFormattedText(original);
      const serialized = serializeFormattedText(parsed);
      expect(serialized).toBe(original);
    });

    it('should maintain complex nested formatting through round-trip', () => {
      const original = 'Start <b>bold <i>both</i> end</b> finish';
      const parsed = parseFormattedText(original);
      const serialized = serializeFormattedText(parsed);
      // Note: The serialization may create separate tags for each segment,
      // but the semantic meaning is preserved
      expect(serialized).toBe('Start <b>bold </b><b><i>both</i></b><b> end</b> finish');

      // Verify that parsing the serialized text produces the same segments
      const reparsed = parseFormattedText(serialized);
      expect(reparsed).toEqual(parsed);
    });

    it('should maintain link with nested formatting through round-trip', () => {
      const original = '<a href="https://example.com"><b>bold link</b></a>';
      const parsed = parseFormattedText(original);
      const serialized = serializeFormattedText(parsed);
      expect(serialized).toBe(original);
    });
  });
});
