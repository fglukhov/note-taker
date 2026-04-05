/**
 * Toggle inline markdown syntax (e.g. ** or *) around the current selection
 * in a plain <input> or <textarea>.
 *
 * - If text is selected: wraps / unwraps the selection.
 * - If nothing is selected: wraps / unwraps the entire value.
 *
 * Calls `onChange` with the new value and then restores the cursor / selection
 * on the next animation frame.
 */
export function applyInlineMarkdown(
  input: HTMLInputElement | HTMLTextAreaElement,
  syntax: string,
  onChange: (value: string) => void,
): void {
  const { value, selectionStart: ss, selectionEnd: se } = input;
  if (ss === null || se === null) return;

  const len = syntax.length;
  const hasSelection = ss !== se;

  let newValue: string;
  let newStart: number;
  let newEnd: number;

  if (hasSelection) {
    const before = value.slice(0, ss);
    const selected = value.slice(ss, se);
    const after = value.slice(se);

    const alreadyWrapped =
      selected.startsWith(syntax) &&
      selected.endsWith(syntax) &&
      selected.length > 2 * len;

    if (alreadyWrapped) {
      const inner = selected.slice(len, -len);
      newValue = before + inner + after;
      newStart = ss;
      newEnd = se - 2 * len;
    } else {
      newValue = before + syntax + selected + syntax + after;
      newStart = ss + len;
      newEnd = se + len;
    }
  } else {
    const alreadyWrapped =
      value.startsWith(syntax) &&
      value.endsWith(syntax) &&
      value.length > 2 * len;

    if (alreadyWrapped) {
      newValue = value.slice(len, -len);
      newStart = Math.max(0, ss - len);
      newEnd = Math.max(0, se - len);
    } else {
      newValue = syntax + value + syntax;
      newStart = ss + len;
      newEnd = se + len;
    }
  }

  onChange(newValue);

  requestAnimationFrame(() => {
    input.setSelectionRange(newStart, newEnd);
  });
}
