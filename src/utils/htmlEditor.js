// HTML sanitization, markdown→HTML migration, and html→plain-text helpers
// for the contentEditable rich-text editor in tasks.

const ALLOWED_TAGS = new Set([
  'STRONG', 'B', 'EM', 'I', 'U', 'BR', 'DIV', 'P', 'A', 'SPAN',
  // Note-editor extensions
  'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI', 'BLOCKQUOTE',
  // Inline text styling extensions
  'S', 'STRIKE', 'DEL', 'SUP', 'SUB', 'HR',
  // Code block + inline code
  'PRE', 'CODE',
]);

// Style attribute allowlist — execCommand emits these via styleWithCSS.
// font-weight / font-style are required so Bold and Italic survive sanitisation
// (execCommand bold→`font-weight:bold`, italic→`font-style:italic`).
const ALLOWED_STYLE_PROPS = new Set([
  'color',
  'background-color',
  'font-weight',
  'font-style',
  'text-align',
  'text-decoration',
  'margin-left',
  'padding-left',
]);

function sanitizeStyleAttr(value) {
  if (typeof value !== 'string') return '';
  return value
    .split(';')
    .map((d) => d.trim())
    .filter(Boolean)
    .filter((decl) => {
      const colon = decl.indexOf(':');
      if (colon < 0) return false;
      const prop = decl.slice(0, colon).trim().toLowerCase();
      const val  = decl.slice(colon + 1).trim().toLowerCase();
      // Block dangerous values
      if (val.includes('url(') || val.includes('javascript:') || val.includes('expression(')) return false;
      return ALLOWED_STYLE_PROPS.has(prop);
    })
    .join('; ');
}
const ALLOWED_ATTRS = {
  A: ['href', 'target', 'rel'],
  // Class names are needed for hljs syntax highlighting + language chip
  PRE:  ['class', 'data-lang'],
  CODE: ['class'],
  // style attr allowlist needed for color / highlight / alignment / indent
  SPAN: ['class', 'style'],
  P:    ['style'],
  DIV:  ['style'],
  H1:   ['style'], H2: ['style'], H3: ['style'],
  H4:   ['style'], H5: ['style'], H6: ['style'],
  BLOCKQUOTE: ['style'],
  UL:   ['style'], OL: ['style'], LI: ['style'],
};

export function sanitizeHtml(html) {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstChild;

  function walk(node) {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType === 3) return; // text
      if (child.nodeType !== 1) { child.remove(); return; }

      if (!ALLOWED_TAGS.has(child.tagName)) {
        // Unwrap: replace child with its children
        while (child.firstChild) node.insertBefore(child.firstChild, child);
        child.remove();
        return;
      }

      const okAttrs = ALLOWED_ATTRS[child.tagName] || [];
      [...child.attributes].forEach((attr) => {
        const name = attr.name.toLowerCase();
        if (!okAttrs.includes(name)) {
          child.removeAttribute(attr.name);
          return;
        }
        // Sanitize the style attribute — keep only allowlisted CSS properties
        if (name === 'style') {
          const clean = sanitizeStyleAttr(attr.value);
          if (clean) child.setAttribute('style', clean);
          else child.removeAttribute('style');
        }
      });

      // Reject javascript: and other dangerous URLs
      if (child.tagName === 'A') {
        const href = child.getAttribute('href') || '';
        if (!/^https?:\/\//i.test(href)) child.removeAttribute('href');
      }

      walk(child);
    });
  }
  walk(root);
  return root.innerHTML;
}

const HTML_TAG_RX = /<(strong|b|em|i|u|s|strike|del|sup|sub|hr|br|div|p|a|span|h[1-6]|ul|ol|li|blockquote|pre|code)\b/i;
export function isHtml(value) {
  return HTML_TAG_RX.test(value || '');
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Migrate plain-text-with-markdown to HTML for the editor.
// Order matters: ** before __ before _ to avoid partial matches.
export function markdownToHtml(text) {
  if (!text) return '';
  let html = escapeHtml(text);
  html = html.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__([^_\n]+)__/g, '<u>$1</u>');
  html = html.replace(/_([^_\n]+)_/g, '<em>$1</em>');
  html = html.replace(/\n/g, '<br>');
  return html;
}

export function htmlToText(html) {
  if (!html) return '';
  const div = document.createElement('div');
  div.innerHTML = html;
  return (div.textContent || '').trim();
}
