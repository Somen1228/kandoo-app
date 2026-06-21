import { NOTE_EXPORT_FORMATS } from './noteExportFormats';

export { NOTE_EXPORT_FORMATS } from './noteExportFormats';

const BLOCK_TAGS = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'PRE', 'BLOCKQUOTE']);

function safeFilename(value) {
  return (value || 'note').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'note';
}

function escapeHtml(value = '') {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeXml(value = '') {
  return escapeHtml(value).replace(/'/g, '&apos;');
}

function cleanExportRoot(html = '') {
  const doc = new DOMParser().parseFromString(`<article>${html}</article>`, 'text/html');
  const root = doc.body.firstElementChild;
  root.querySelectorAll('script, style, iframe, object, embed').forEach((node) => node.remove());
  root.querySelectorAll('*').forEach((node) => {
    [...node.attributes].forEach((attribute) => {
      if (attribute.name.toLowerCase().startsWith('on')) node.removeAttribute(attribute.name);
    });
    if (node.matches('a[href^="javascript:" i]')) node.removeAttribute('href');
    if (node.matches('img[src^="javascript:" i]')) node.removeAttribute('src');
    if (node.tagName === 'INPUT') node.setAttribute('disabled', '');
    node.removeAttribute('contenteditable');
    node.removeAttribute('draggable');
  });
  return root;
}

function inlinePlainText(node) {
  if (node.nodeType === Node.TEXT_NODE) return node.nodeValue || '';
  if (node.nodeType !== Node.ELEMENT_NODE) return '';
  if (node.tagName === 'BR') return '\n';
  if (node.tagName === 'IMG') return `[Image${node.getAttribute('alt') ? `: ${node.getAttribute('alt')}` : ''}]`;
  if (node.tagName === 'INPUT' && node.getAttribute('type') === 'checkbox') return node.checked ? '☒ ' : '☐ ';
  if (node.tagName === 'UL' || node.tagName === 'OL') return '';
  return [...node.childNodes].map(inlinePlainText).join('');
}

function listPlainText(list, depth = 0) {
  const ordered = list.tagName === 'OL';
  return [...list.children].filter((node) => node.tagName === 'LI').map((item, index) => {
    const checked = item.getAttribute('data-checked');
    const prefix = checked != null ? (checked === 'true' ? '☒ ' : '☐ ') : ordered ? `${index + 1}. ` : '• ';
    const own = [...item.childNodes].filter((node) => !['UL', 'OL'].includes(node.tagName)).map(inlinePlainText).join('').trim();
    const nested = [...item.children].filter((node) => ['UL', 'OL'].includes(node.tagName))
      .map((node) => `\n${listPlainText(node, depth + 1)}`).join('');
    return `${'  '.repeat(depth)}${prefix}${own}${nested}`;
  }).join('\n');
}

function rootToPlainText(root) {
  const parts = [];
  for (const node of root.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.nodeValue?.trim()) parts.push(node.nodeValue.trim());
      continue;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    if (node.tagName === 'UL' || node.tagName === 'OL') parts.push(listPlainText(node));
    else if (node.tagName === 'TABLE') {
      const rows = [...node.querySelectorAll('tr')].map((row) =>
        [...row.children].map((cell) => inlinePlainText(cell).trim()).join('\t'));
      parts.push(rows.join('\n'));
    } else if (node.tagName === 'HR') parts.push('---');
    else if (node.tagName === 'IMG') parts.push(inlinePlainText(node));
    else if (BLOCK_TAGS.has(node.tagName)) parts.push(inlinePlainText(node).trim());
    else parts.push(inlinePlainText(node).trim());
  }
  return parts.filter(Boolean).join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function dataUriParts(src = '') {
  const match = src.match(/^data:([^;,]+);base64,([\s\S]+)$/i);
  if (!match) return null;
  const mime = match[1].toLowerCase();
  const extensions = {
    'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg',
    'image/gif': 'gif', 'image/webp': 'webp', 'image/svg+xml': 'svg',
  };
  return { mime, base64: match[2], extension: extensions[mime] || 'bin' };
}

function base64ToBytes(base64) {
  const binary = atob(base64.replace(/\s/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function extractEmbeddedImages(root, folder, onImage) {
  const assets = [];
  [...root.querySelectorAll('img[src]')].forEach((image, index) => {
    const parts = dataUriParts(image.getAttribute('src'));
    if (!parts) return;
    const name = `${folder}/image-${index + 1}.${parts.extension}`;
    onImage(name, parts);
    image.setAttribute('src', name);
    assets.push({ name, mime: parts.mime });
  });
  return assets;
}

function noteHtmlDocument(title, body) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title><style>
body{max-width:794px;margin:48px auto;padding:0 42px;color:#172033;background:#fff;font:16px/1.7 system-ui,-apple-system,"Segoe UI",sans-serif}
h1{font-size:2.15rem;line-height:1.2;margin:0 0 1.2rem}h2{font-size:1.65rem}h3{font-size:1.3rem}img{max-width:100%;height:auto;border-radius:8px}
blockquote{margin-left:0;padding-left:1rem;border-left:3px solid #6d5dfc;color:#4b5563}pre{overflow:auto;padding:1rem;border-radius:8px;background:#111827;color:#e5e7eb}
code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}table{width:100%;border-collapse:collapse}th,td{padding:.45rem .6rem;border:1px solid #d7dce5;text-align:left}
ul[data-type="taskList"]{list-style:none;padding-left:0}a{color:#5b4ce3}hr{border:0;border-top:1px solid #d7dce5;margin:1.5rem 0}
</style></head><body><h1>${escapeHtml(title)}</h1>${body}</body></html>`;
}

async function buildMarkdown(title, root) {
  const [{ default: TurndownService }, { gfm }] = await Promise.all([
    import('turndown'), import('turndown-plugin-gfm'),
  ]);
  const service = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-', codeBlockStyle: 'fenced' });
  service.use(gfm);
  service.addRule('kandooTaskItems', {
    filter: (node) => node.nodeName === 'LI' && node.getAttribute('data-checked') != null,
    replacement: (content, node) => `\n- [${node.getAttribute('data-checked') === 'true' ? 'x' : ' '}] ${content.trim()}`,
  });
  return `# ${title}\n\n${service.turndown(root.innerHTML).trim()}\n`;
}

function rtfEscape(value = '') {
  let output = '';
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    const char = value[index];
    if (char === '\\' || char === '{' || char === '}') output += `\\${char}`;
    else if (char === '\n') output += '\\line ';
    else if (code > 127) output += `\\u${code > 32767 ? code - 65536 : code}?`;
    else output += char;
  }
  return output;
}

function rtfInline(node) {
  if (node.nodeType === Node.TEXT_NODE) return rtfEscape(node.nodeValue || '');
  if (node.nodeType !== Node.ELEMENT_NODE) return '';
  const content = [...node.childNodes].map(rtfInline).join('');
  if (['STRONG', 'B'].includes(node.tagName)) return `{\\b ${content}}`;
  if (['EM', 'I'].includes(node.tagName)) return `{\\i ${content}}`;
  if (node.tagName === 'U') return `{\\ul ${content}}`;
  if (['S', 'STRIKE', 'DEL'].includes(node.tagName)) return `{\\strike ${content}}`;
  if (node.tagName === 'CODE') return `{\\f1 ${content}}`;
  if (node.tagName === 'A') return `${content} (${rtfEscape(node.getAttribute('href') || '')})`;
  if (node.tagName === 'BR') return '\\line ';
  if (node.tagName === 'IMG') return '[Image]';
  return content;
}

function rtfBlocks(root) {
  return [...root.children].map((node) => {
    if (/^H[1-6]$/.test(node.tagName)) {
      const sizes = [38, 32, 28, 25, 23, 21];
      return `{\\b\\fs${sizes[Number(node.tagName[1]) - 1]} ${rtfInline(node)}}\\par\n`;
    }
    if (node.tagName === 'UL' || node.tagName === 'OL') {
      const ordered = node.tagName === 'OL';
      return [...node.children].map((item, index) =>
        `\\pard\\li360 ${ordered ? `${index + 1}.` : '\\u8226?'} ${rtfInline(item)}\\par\n`).join('');
    }
    if (node.tagName === 'TABLE') {
      return [...node.querySelectorAll('tr')].map((row) =>
        `${[...row.children].map((cell) => rtfInline(cell)).join('\\tab ')}\\par\n`).join('');
    }
    if (node.tagName === 'HR') return '\\pard ______________________________\\par\n';
    if (node.tagName === 'BLOCKQUOTE') return `\\pard\\li480\\i ${rtfInline(node)}\\i0\\par\n`;
    if (node.tagName === 'PRE') return `\\pard\\f1 ${rtfInline(node)}\\f0\\par\n`;
    return `\\pard ${rtfInline(node)}\\par\n`;
  }).join('');
}

function buildRtf(title, root) {
  return `{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Arial;}{\\f1 Courier New;}}\n` +
    `{\\b\\fs42 ${rtfEscape(title)}}\\par\\sa240\n${rtfBlocks(root)}}`;
}

function odtInline(node) {
  if (node.nodeType === Node.TEXT_NODE) return escapeXml(node.nodeValue || '');
  if (node.nodeType !== Node.ELEMENT_NODE) return '';
  const content = [...node.childNodes].map(odtInline).join('');
  if (['STRONG', 'B'].includes(node.tagName)) return `<text:span text:style-name="Bold">${content}</text:span>`;
  if (['EM', 'I'].includes(node.tagName)) return `<text:span text:style-name="Italic">${content}</text:span>`;
  if (node.tagName === 'U') return `<text:span text:style-name="Underline">${content}</text:span>`;
  if (['S', 'STRIKE', 'DEL'].includes(node.tagName)) return `<text:span text:style-name="Strike">${content}</text:span>`;
  if (node.tagName === 'CODE') return `<text:span text:style-name="Code">${content}</text:span>`;
  if (node.tagName === 'A' && node.getAttribute('href')) return `<text:a xlink:href="${escapeXml(node.getAttribute('href'))}">${content}</text:a>`;
  if (node.tagName === 'BR') return '<text:line-break/>';
  if (node.tagName === 'IMG' && node.getAttribute('src')?.startsWith('Pictures/')) {
    return `<draw:frame draw:name="Image" text:anchor-type="as-char" svg:width="15cm"><draw:image xlink:href="${escapeXml(node.getAttribute('src'))}" xlink:type="simple" xlink:show="embed" xlink:actuate="onLoad"/></draw:frame>`;
  }
  if (node.tagName === 'IMG') return '<text:span>[Image]</text:span>';
  return content;
}

function odtList(node) {
  return `<text:list>${[...node.children].filter((item) => item.tagName === 'LI').map((item) => {
    const checked = item.getAttribute('data-checked');
    const prefix = checked == null ? '' : checked === 'true' ? '☒ ' : '☐ ';
    return `<text:list-item><text:p>${escapeXml(prefix)}${odtInline(item)}</text:p></text:list-item>`;
  }).join('')}</text:list>`;
}

function odtBlocks(root) {
  return [...root.children].map((node) => {
    if (/^H[1-6]$/.test(node.tagName)) return `<text:h text:outline-level="${node.tagName[1]}">${odtInline(node)}</text:h>`;
    if (node.tagName === 'UL' || node.tagName === 'OL') return odtList(node);
    if (node.tagName === 'TABLE') {
      const rows = [...node.querySelectorAll('tr')].map((row) => `<table:table-row>${[...row.children].map((cell) =>
        `<table:table-cell office:value-type="string"><text:p>${odtInline(cell)}</text:p></table:table-cell>`).join('')}</table:table-row>`).join('');
      return `<table:table table:name="Table">${rows}</table:table>`;
    }
    if (node.tagName === 'HR') return '<text:p text:style-name="Rule"> </text:p>';
    if (node.tagName === 'BLOCKQUOTE') return `<text:p text:style-name="Quote">${odtInline(node)}</text:p>`;
    if (node.tagName === 'PRE') return `<text:p text:style-name="CodeBlock">${odtInline(node)}</text:p>`;
    if (node.tagName === 'IMG') return `<text:p>${odtInline(node)}</text:p>`;
    return `<text:p>${odtInline(node)}</text:p>`;
  }).join('');
}

async function buildOdt(title, sourceRoot) {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  zip.file('mimetype', 'application/vnd.oasis.opendocument.text', { compression: 'STORE' });
  const root = sourceRoot.cloneNode(true);
  const images = extractEmbeddedImages(root, 'Pictures', (name, parts) => zip.file(name, parts.base64, { base64: true }));
  const body = odtBlocks(root);
  zip.file('content.xml', `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0" office:version="1.3">
<office:automatic-styles>
<style:style xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" style:name="Bold" style:family="text"><style:text-properties fo:font-weight="bold" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"/></style:style>
<style:style xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" style:name="Italic" style:family="text"><style:text-properties fo:font-style="italic" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"/></style:style>
<style:style xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" style:name="Underline" style:family="text"><style:text-properties style:text-underline-style="solid"/></style:style>
<style:style xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" style:name="Strike" style:family="text"><style:text-properties style:text-line-through-style="solid"/></style:style>
<style:style xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" style:name="Code" style:family="text"><style:text-properties style:font-name="Courier New"/></style:style>
</office:automatic-styles><office:body><office:text><text:h text:outline-level="1">${escapeXml(title)}</text:h>${body}</office:text></office:body></office:document-content>`);
  zip.file('styles.xml', `<?xml version="1.0" encoding="UTF-8"?><office:document-styles xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" office:version="1.3"><office:styles/></office:document-styles>`);
  zip.file('meta.xml', `<?xml version="1.0" encoding="UTF-8"?><office:document-meta xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:dc="http://purl.org/dc/elements/1.1/" office:version="1.3"><office:meta><dc:title>${escapeXml(title)}</dc:title><dc:creator>Kandoo</dc:creator></office:meta></office:document-meta>`);
  const manifestImages = images.map((asset) => `<manifest:file-entry manifest:full-path="${escapeXml(asset.name)}" manifest:media-type="${escapeXml(asset.mime)}"/>`).join('');
  zip.file('META-INF/manifest.xml', `<?xml version="1.0" encoding="UTF-8"?><manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.3"><manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.text"/><manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/><manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/><manifest:file-entry manifest:full-path="meta.xml" manifest:media-type="text/xml"/>${manifestImages}</manifest:manifest>`);
  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.oasis.opendocument.text', compression: 'DEFLATE' });
}

function xhtmlVoidTags(html) {
  return html
    .replace(/<br([^>]*)>/gi, '<br$1/>')
    .replace(/<hr([^>]*)>/gi, '<hr$1/>')
    .replace(/<img([^>]*?)(?:\s*\/?)>/gi, '<img$1/>')
    .replace(/<input([^>]*?)(?:\s*\/?)>/gi, '<input$1/>');
}

async function buildEpub(title, sourceRoot) {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  const root = sourceRoot.cloneNode(true);
  const images = extractEmbeddedImages(root, 'images', (name, parts) => zip.file(`OEBPS/${name}`, parts.base64, { base64: true }));
  zip.file('META-INF/container.xml', `<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`);
  zip.file('OEBPS/chapter.xhtml', `<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml" lang="en"><head><title>${escapeXml(title)}</title><link rel="stylesheet" type="text/css" href="style.css"/></head><body><h1>${escapeXml(title)}</h1>${xhtmlVoidTags(root.innerHTML)}</body></html>`);
  zip.file('OEBPS/nav.xhtml', `<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Contents</title></head><body><nav epub:type="toc"><h1>Contents</h1><ol><li><a href="chapter.xhtml">${escapeXml(title)}</a></li></ol></nav></body></html>`);
  zip.file('OEBPS/style.css', 'body{max-width:42em;margin:2em auto;font:1em/1.65 serif}img{max-width:100%;height:auto}table{border-collapse:collapse;width:100%}th,td{border:1px solid #999;padding:.35em}pre{white-space:pre-wrap}');
  const id = typeof crypto?.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  const imageManifest = images.map((asset, index) => `<item id="image-${index + 1}" href="${escapeXml(asset.name)}" media-type="${escapeXml(asset.mime)}"/>`).join('');
  zip.file('OEBPS/content.opf', `<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" unique-identifier="book-id" version="3.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="book-id">urn:uuid:${escapeXml(id)}</dc:identifier><dc:title>${escapeXml(title)}</dc:title><dc:language>en</dc:language><dc:creator>Kandoo</dc:creator><meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')}</meta></metadata><manifest><item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="css" href="style.css" media-type="text/css"/>${imageManifest}</manifest><spine><itemref idref="chapter"/></spine></package>`);
  return zip.generateAsync({ type: 'blob', mimeType: 'application/epub+zip', compression: 'DEFLATE', compressionOptions: { level: 9 } });
}

async function buildHtmlZip(title, sourceRoot) {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const root = sourceRoot.cloneNode(true);
  extractEmbeddedImages(root, 'assets', (name, parts) => zip.file(name, parts.base64, { base64: true }));
  zip.file('index.html', noteHtmlDocument(title, root.innerHTML));
  return zip.generateAsync({ type: 'blob', mimeType: 'application/zip', compression: 'DEFLATE' });
}

function imageElementDimensions(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve({ width: image.naturalWidth || 560, height: image.naturalHeight || 315 });
    image.onerror = reject;
    image.src = src;
  });
}

async function docxImageOptions(src) {
  try {
    const parts = dataUriParts(src);
    let mime = parts?.mime;
    let data = parts ? base64ToBytes(parts.base64) : null;
    if (!data) {
      const response = await fetch(src);
      if (!response.ok) throw new Error('Image download failed');
      mime = response.headers.get('content-type') || '';
      data = new Uint8Array(await response.arrayBuffer());
    }
    let dimensions = { width: 560, height: 315 };
    try { dimensions = await imageElementDimensions(src); } catch { /* use fallback */ }
    const scale = Math.min(1, 560 / dimensions.width, 700 / dimensions.height);
    let type = mime === 'image/png' ? 'png' : /jpe?g/.test(mime) ? 'jpg' : mime === 'image/gif' ? 'gif' : null;
    if (!type) {
      const image = await new Promise((resolve, reject) => {
        const element = new Image();
        element.crossOrigin = 'anonymous';
        element.onload = () => resolve(element);
        element.onerror = reject;
        element.src = src;
      });
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      canvas.getContext('2d').drawImage(image, 0, 0);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      data = new Uint8Array(await blob.arrayBuffer());
      type = 'png';
    }
    return {
      type, data,
      transformation: { width: Math.max(1, Math.round(dimensions.width * scale)), height: Math.max(1, Math.round(dimensions.height * scale)) },
    };
  } catch {
    return null;
  }
}

function runOptions(node, marks = {}) {
  const next = { ...marks };
  if (['STRONG', 'B'].includes(node.tagName)) next.bold = true;
  if (['EM', 'I'].includes(node.tagName)) next.italics = true;
  if (node.tagName === 'U') next.underline = {};
  if (['S', 'STRIKE', 'DEL'].includes(node.tagName)) next.strike = true;
  if (node.tagName === 'CODE') next.font = 'Courier New';
  const color = node.style?.color?.match(/#([0-9a-f]{6})/i)?.[1];
  if (color) next.color = color.toUpperCase();
  const px = parseFloat(node.style?.fontSize || '');
  if (Number.isFinite(px)) next.size = Math.round(px * 1.5);
  return next;
}

async function docxInline(node, marks, D) {
  if (node.nodeType === Node.TEXT_NODE) return [new D.TextRun({ text: node.nodeValue || '', ...marks })];
  if (node.nodeType !== Node.ELEMENT_NODE) return [];
  if (node.tagName === 'BR') return [new D.TextRun({ break: 1, ...marks })];
  if (node.tagName === 'IMG') {
    const image = await docxImageOptions(node.getAttribute('src') || '');
    return image ? [new D.ImageRun(image)] : [new D.TextRun({ text: '[Image]', italics: true })];
  }
  const nextMarks = runOptions(node, marks);
  if (node.tagName === 'A' && node.getAttribute('href')) {
    const text = node.textContent || node.getAttribute('href');
    return [new D.ExternalHyperlink({
      link: node.getAttribute('href'),
      children: [new D.TextRun({ text, style: 'Hyperlink', color: '0563C1', underline: {} })],
    })];
  }
  const output = [];
  for (const child of node.childNodes) output.push(...await docxInline(child, nextMarks, D));
  return output;
}

async function docxBlocks(root, D) {
  const blocks = [];
  for (const node of root.children) {
    if (/^H[1-6]$/.test(node.tagName)) {
      const headings = [D.HeadingLevel.HEADING_1, D.HeadingLevel.HEADING_2, D.HeadingLevel.HEADING_3, D.HeadingLevel.HEADING_4, D.HeadingLevel.HEADING_5, D.HeadingLevel.HEADING_6];
      blocks.push(new D.Paragraph({ heading: headings[Number(node.tagName[1]) - 1], children: await docxInline(node, {}, D) }));
    } else if (node.tagName === 'UL' || node.tagName === 'OL') {
      const ordered = node.tagName === 'OL';
      let index = 0;
      for (const item of node.children) {
        if (item.tagName !== 'LI') continue;
        index += 1;
        const checked = item.getAttribute('data-checked');
        const prefix = checked != null ? (checked === 'true' ? '☒ ' : '☐ ') : ordered ? `${index}. ` : '';
        blocks.push(new D.Paragraph({
          ...(ordered || checked != null ? {} : { bullet: { level: 0 } }),
          children: [new D.TextRun(prefix), ...await docxInline(item, {}, D)],
        }));
      }
    } else if (node.tagName === 'TABLE') {
      const rows = [];
      for (const row of node.querySelectorAll('tr')) {
        const cells = [];
        for (const cell of row.children) cells.push(new D.TableCell({ children: [new D.Paragraph({ children: await docxInline(cell, {}, D) })] }));
        rows.push(new D.TableRow({ children: cells }));
      }
      if (rows.length) blocks.push(new D.Table({ rows, width: { size: 100, type: D.WidthType.PERCENTAGE } }));
    } else if (node.tagName === 'HR') {
      blocks.push(new D.Paragraph({ text: '────────────────────────' }));
    } else if (node.tagName === 'BLOCKQUOTE') {
      blocks.push(new D.Paragraph({ indent: { left: 480 }, children: await docxInline(node, { italics: true }, D) }));
    } else if (node.tagName === 'PRE') {
      blocks.push(new D.Paragraph({ children: await docxInline(node, { font: 'Courier New' }, D) }));
    } else {
      blocks.push(new D.Paragraph({ children: await docxInline(node, {}, D) }));
    }
  }
  return blocks;
}

async function buildDocx(title, root) {
  const D = await import('docx');
  const children = [
    new D.Paragraph({ heading: D.HeadingLevel.TITLE, children: [new D.TextRun({ text: title, bold: true })] }),
    ...await docxBlocks(root, D),
  ];
  const documentFile = new D.Document({
    creator: 'Kandoo', title,
    styles: { default: { document: { run: { font: 'Aptos', size: 22 }, paragraph: { spacing: { line: 320, after: 120 } } } } },
    sections: [{ children }],
  });
  return D.Packer.toBlob(documentFile);
}

async function buildPdf(title, root) {
  const [{ jsPDF }] = await Promise.all([import('jspdf'), import('html2canvas')]);
  const host = document.createElement('article');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;box-sizing:border-box;padding:54px 62px;background:#fff;color:#172033;font:16px/1.65 Arial,sans-serif;';
  host.innerHTML = `<style>h1{font-size:34px;line-height:1.2}h2{font-size:27px}h3{font-size:22px}img{max-width:100%;height:auto}table{border-collapse:collapse;width:100%}th,td{border:1px solid #bbb;padding:6px 8px}blockquote{border-left:3px solid #6d5dfc;padding-left:12px;color:#4b5563}pre{white-space:pre-wrap;background:#f3f4f6;padding:12px}</style><h1>${escapeHtml(title)}</h1>${root.innerHTML}`;
  document.body.appendChild(host);
  try {
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
    await pdf.html(host, {
      x: 12, y: 12, width: 186, windowWidth: 794, autoPaging: 'text',
      html2canvas: { scale: 0.75, useCORS: true, logging: false, backgroundColor: '#ffffff' },
    });
    return pdf.output('blob');
  } finally {
    host.remove();
  }
}

export async function buildNoteExport({ title = 'Untitled', html = '' }, format) {
  if (!NOTE_EXPORT_FORMATS.some((item) => item.id === format)) throw new Error('Unsupported note export format');
  const root = cleanExportRoot(html);
  const base = `${safeFilename(title)}-${new Date().toISOString().slice(0, 10)}`;
  let blob;
  let filename;

  if (format === 'txt') {
    blob = new Blob([`${title}\n${'='.repeat(Math.min(title.length, 72))}\n\n${rootToPlainText(root)}\n`], { type: 'text/plain;charset=utf-8' });
    filename = `${base}.txt`;
  } else if (format === 'md') {
    blob = new Blob([await buildMarkdown(title, root)], { type: 'text/markdown;charset=utf-8' });
    filename = `${base}.md`;
  } else if (format === 'rtf') {
    blob = new Blob([buildRtf(title, root)], { type: 'application/rtf' });
    filename = `${base}.rtf`;
  } else if (format === 'html') {
    blob = await buildHtmlZip(title, root);
    filename = `${base}-web.zip`;
  } else if (format === 'epub') {
    blob = await buildEpub(title, root);
    filename = `${base}.epub`;
  } else if (format === 'odt') {
    blob = await buildOdt(title, root);
    filename = `${base}.odt`;
  } else if (format === 'docx') {
    blob = await buildDocx(title, root);
    filename = `${base}.docx`;
  } else if (format === 'pdf') {
    blob = await buildPdf(title, root);
    filename = `${base}.pdf`;
  }

  return { blob, filename, size: blob.size };
}

export async function exportNote(note, format) {
  const result = await buildNoteExport(note, format);
  downloadBlob(result.blob, result.filename);
  return { filename: result.filename, size: result.size };
}
