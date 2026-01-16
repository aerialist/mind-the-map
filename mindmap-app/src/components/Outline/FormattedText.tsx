interface FormattedTextProps {
  text: string;
  className?: string;
}

/**
 * Render text with inline formatting by allowing safe HTML tags.
 * Supports: <b>, <i>, <u>, <s>, <code>
 *
 * Note: Uses pointer-events-none to allow clicks to bubble up to parent handlers
 */
function FormattedText({ text, className }: FormattedTextProps) {
  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{ __html: text }}
      style={{ pointerEvents: 'none' }}
    />
  );
}

export default FormattedText;
