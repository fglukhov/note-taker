const URL_RE =
  /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)$/;

const HREF_OK = /^https?:\/\//i;

function insertAtCursor(
  input: HTMLInputElement | HTMLTextAreaElement,
  insert: string,
  onChange: (value: string) => void,
): void {
  const { value, selectionStart: ss, selectionEnd: se } = input;
  if (ss === null || se === null) return;
  const before = value.slice(0, ss);
  const after = value.slice(se);
  const newValue = before + insert + after;
  const newPos = ss + insert.length;
  onChange(newValue);
  requestAnimationFrame(() => {
    input.setSelectionRange(newPos, newPos);
  });
}

function collapseTitleWhitespace(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

type HtmlWalkCtx = { inStrong?: boolean };

function walkHtmlNodeToTitleMd(node: Node, ctx: HtmlWalkCtx): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? '';
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return '';

  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();

  if (tag === 'script' || tag === 'style' || tag === 'meta') return '';

  const children = () =>
    Array.from(el.childNodes)
      .map((ch) => walkHtmlNodeToTitleMd(ch, ctx))
      .join('');

  if (tag === 'strong' || tag === 'b') {
    const inner = Array.from(el.childNodes)
      .map((ch) => walkHtmlNodeToTitleMd(ch, { ...ctx, inStrong: true }))
      .join('');
    return inner ? `**${inner}**` : '';
  }

  if (tag === 'em' || tag === 'i') {
    const inner = Array.from(el.childNodes)
      .map((ch) => walkHtmlNodeToTitleMd(ch, ctx))
      .join('');
    if (!inner) return '';
    const delim = ctx.inStrong ? '_' : '*';
    return `${delim}${inner}${delim}`;
  }

  if (tag === 'a') {
    const href = el.getAttribute('href')?.trim() ?? '';
    const inner = children();
    const label = inner || href;
    if (!href || !HREF_OK.test(href)) return inner;
    return `[${label}](${href})`;
  }

  if (tag === 'br') return ' ';
  if (tag === 'p' || tag === 'div' || tag === 'li' || /^h[1-6]$/.test(tag)) {
    const inner = children();
    return inner ? `${inner} ` : '';
  }

  return children();
}

/** HTML clipboard → inline MD supported in titles (** * _..._ links). */
export function htmlClipboardToTitleMarkdown(html: string): string {
  const stripped = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  const doc = new DOMParser().parseFromString(stripped, 'text/html');
  const raw = walkHtmlNodeToTitleMd(doc.body, {});
  return collapseTitleWhitespace(raw);
}

/**
 * Title field paste: URL → md link (existing), HTML → bold/italic/link md,
 * multi-line plain → single line. Returns true if handled (call preventDefault).
 */
export function handleTitleMarkdownPaste(
  e: React.ClipboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  onChange: (value: string) => void,
): boolean {
  if (handleUrlPaste(e, onChange)) return true;

  const html = e.clipboardData.getData('text/html').trim();
  const plain = e.clipboardData.getData('text/plain') ?? '';

  const input = e.currentTarget;

  if (html && /<[a-z][\s\S]*>/i.test(html)) {
    const md = htmlClipboardToTitleMarkdown(html);
    if (md.length > 0) {
      insertAtCursor(input, md, onChange);
      e.preventDefault();
      return true;
    }
  }

  if (plain.includes('\r') || plain.includes('\n')) {
    insertAtCursor(input, collapseTitleWhitespace(plain), onChange);
    e.preventDefault();
    return true;
  }

  return false;
}

/**
 * Call from an input's onPaste handler.
 * If the pasted text is a URL:
 *   - selected text → [selected text](url)
 *   - no selection  → [url](url)
 * Returns true if the paste was handled (call e.preventDefault() in that case).
 */
export function handleUrlPaste(
  e: React.ClipboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  onChange: (value: string) => void,
): boolean {
  const pasted = e.clipboardData.getData('text');
  if (!URL_RE.test(pasted.trim())) return false;

  const url = pasted.trim();
  const input = e.currentTarget;
  const { value, selectionStart: ss, selectionEnd: se } = input;
  if (ss === null || se === null) return false;

  const before = value.slice(0, ss);
  const selected = value.slice(ss, se);
  const after = value.slice(se);

  const label = selected || url;
  const mdLink = `[${label}](${url})`;

  const newValue = before + mdLink + after;
  const newCursor = ss + mdLink.length;

  onChange(newValue);
  requestAnimationFrame(() => {
    input.setSelectionRange(newCursor, newCursor);
  });

  return true;
}

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
