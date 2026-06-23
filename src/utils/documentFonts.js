// Single source of truth for the fonts a note can use. The editor's font picker,
// the PDF exporter (pdfmake) and the DOCX exporter all read from this list so a
// font chosen in the document is faithfully embedded/named on export.
//
// `css`   — the value stored on the text via TipTap's FontFamily mark, and the
//           @font-face family name loaded for the editor.
// `match` — a lowercase token to detect the font in an element's font-family
//           (the browser may re-quote/re-order the stack, so we match loosely).
// `pdf`   — pdfmake font key (registered in pdfFonts.js FONT_SPEC).
// `docx`  — font name written into the .docx run.
export const DOCUMENT_FONTS = [
  { id: 'default', label: 'Default', category: 'default', css: '', match: null, pdf: 'Inter', docx: null, mono: false },

  // Sans-serif
  { id: 'inter',     label: 'Inter',      category: 'sans', css: 'Inter, sans-serif',     match: 'inter',     pdf: 'Inter',    docx: 'Inter',     mono: false },
  { id: 'roboto',    label: 'Roboto',     category: 'sans', css: 'Roboto, sans-serif',    match: 'roboto',    pdf: 'Roboto',   docx: 'Roboto',    mono: false },
  { id: 'opensans',  label: 'Open Sans',  category: 'sans', css: '"Open Sans", sans-serif', match: 'open sans', pdf: 'OpenSans', docx: 'Open Sans', mono: false },
  { id: 'lato',      label: 'Lato',       category: 'sans', css: 'Lato, sans-serif',      match: 'lato',      pdf: 'Lato',     docx: 'Lato',      mono: false },
  { id: 'worksans',  label: 'Work Sans',  category: 'sans', css: '"Work Sans", sans-serif', match: 'work sans', pdf: 'WorkSans', docx: 'Work Sans', mono: false },

  // Serif
  { id: 'lora',        label: 'Lora',            category: 'serif', css: 'Lora, serif',               match: 'lora',        pdf: 'Lora',          docx: 'Lora',             mono: false },
  { id: 'merriweather',label: 'Merriweather',    category: 'serif', css: 'Merriweather, serif',       match: 'merriweather', pdf: 'Merriweather',  docx: 'Merriweather',     mono: false },
  { id: 'playfair',    label: 'Playfair Display', category: 'serif', css: '"Playfair Display", serif', match: 'playfair',    pdf: 'PlayfairDisplay', docx: 'Playfair Display', mono: false },
  { id: 'ptserif',     label: 'PT Serif',        category: 'serif', css: '"PT Serif", serif',         match: 'pt serif',    pdf: 'PTSerif',       docx: 'PT Serif',         mono: false },
  { id: 'sourceserif', label: 'Source Serif 4',  category: 'serif', css: '"Source Serif 4", serif',   match: 'source serif', pdf: 'SourceSerif4',  docx: 'Source Serif 4',   mono: false },

  // Monospace
  { id: 'jetbrains',   label: 'JetBrains Mono',  category: 'mono', css: '"JetBrains Mono", monospace', match: 'jetbrains',   pdf: 'JetBrainsMono', docx: 'JetBrains Mono',  mono: true },
  { id: 'sourcecode',  label: 'Source Code Pro', category: 'mono', css: '"Source Code Pro", monospace', match: 'source code', pdf: 'SourceCodePro', docx: 'Source Code Pro', mono: true },
  { id: 'ibmplexmono', label: 'IBM Plex Mono',   category: 'mono', css: '"IBM Plex Mono", monospace',  match: 'ibm plex',    pdf: 'IBMPlexMono',   docx: 'IBM Plex Mono',   mono: true },
  { id: 'robotomono',  label: 'Roboto Mono',     category: 'mono', css: '"Roboto Mono", monospace',    match: 'roboto mono', pdf: 'RobotoMono',    docx: 'Roboto Mono',     mono: true },
  { id: 'firacode',    label: 'Fira Code',       category: 'mono', css: '"Fira Code", monospace',      match: 'fira code',   pdf: 'FiraCode',      docx: 'Fira Code',       mono: true },
];

export const FONT_CATEGORIES = [
  { id: 'sans', label: 'Sans-serif' },
  { id: 'serif', label: 'Serif' },
  { id: 'mono', label: 'Monospace' },
];

// The font code blocks / inline code always export as (faithful monospace).
export const CODE_FONT = DOCUMENT_FONTS.find((font) => font.id === 'jetbrains');

// Resolve an element's CSS font-family to a registry entry (or null = inherit).
// Longer match tokens are checked first so "roboto mono" beats "roboto".
const FONTS_BY_MATCH = [...DOCUMENT_FONTS]
  .filter((font) => font.match)
  .sort((a, b) => b.match.length - a.match.length);

export function fontFromFamily(cssFamily) {
  if (!cssFamily) return null;
  const lower = String(cssFamily).toLowerCase();
  return FONTS_BY_MATCH.find((font) => lower.includes(font.match)) || null;
}
