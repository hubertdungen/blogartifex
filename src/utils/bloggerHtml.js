/**
 * Makes editor HTML render on Blogger as it does in the editor.
 *
 * CKEditor lays out images, captions, tables and highlights with CSS classes
 * (image-style-align-left, marker-yellow, …) that Blogger themes don't know,
 * so a post would lose its layout once published. toBloggerHtml() adds the
 * equivalent inline styles — only properties the element doesn't already set,
 * so explicit choices (table borders, image widths) win — and records which
 * ones it added in data-ba-style. fromBloggerHtml() removes exactly those when
 * the post is opened again, so the editor's own classes stay the single
 * source of truth and a later change of alignment isn't pinned by stale
 * inline styles.
 */

const MARKER = 'data-ba-style';

// Most specific rules first: a property already set is never overwritten.
const RULES = [
  ['figure.image.image-style-align-left', { float: 'left', margin: '0.3em 1.5em 1em 0' }],
  ['figure.image.image-style-align-right', { float: 'right', margin: '0.3em 0 1em 1.5em' }],
  ['figure.image.image-style-side', { float: 'right', margin: '0.3em 0 1em 1.5em', 'max-width': '50%' }],
  ['figure.image.image-style-full-width', { display: 'block', width: '100%', 'max-width': '100%', margin: '1em 0', clear: 'both' }],
  ['figure.image.image-style-block-align-left', { margin: '0.9em auto 0.9em 0' }],
  ['figure.image.image-style-block-align-right', { margin: '0.9em 0 0.9em auto' }],
  ['figure.image.image_resized', { display: 'block', 'max-width': '100%', 'box-sizing': 'border-box' }],
  ['figure.image', { display: 'table', clear: 'both', 'text-align': 'center', margin: '0.9em auto', 'max-width': '100%' }],
  ['figure.image.image_resized > img', { width: '100%' }],
  ['figure.image.image-style-full-width > img', { width: '100%' }],
  ['figure.image img', { display: 'block', margin: '0 auto', 'max-width': '100%', height: 'auto' }],
  ['figure.image.image_resized > figcaption', { display: 'block' }],
  ['figure.image.image-style-full-width > figcaption', { display: 'block' }],
  ['figure.image > figcaption', {
    display: 'table-caption', 'caption-side': 'bottom', padding: '0.6em',
    'font-size': '0.85em', color: '#555', 'text-align': 'center'
  }],
  ['img.image-style-align-left', { float: 'left', margin: '0.3em 1em 0.5em 0' }],
  ['img.image-style-align-right', { float: 'right', margin: '0.3em 0 0.5em 1em' }],
  ['img.image_resized', { 'max-width': '100%', height: 'auto' }],
  ['figure.table', { display: 'table', margin: '0.9em auto' }],
  ['figure.table > table', { 'border-collapse': 'collapse', 'border-spacing': '0', width: '100%', border: '1px double #b3b3b3' }],
  ['figure.table th', { border: '1px solid #bfbfbf', padding: '0.4em', 'min-width': '2em', 'font-weight': 'bold', 'background-color': 'rgba(0, 0, 0, 0.05)' }],
  ['figure.table td', { border: '1px solid #bfbfbf', padding: '0.4em', 'min-width': '2em' }],
  ['figure.table > figcaption', {
    display: 'table-caption', 'caption-side': 'top', padding: '0.6em',
    'font-size': '0.9em', 'text-align': 'center'
  }],
  ['mark.marker-yellow', { 'background-color': '#fdfd77' }],
  ['mark.marker-green', { 'background-color': '#62f962' }],
  ['mark.marker-pink', { 'background-color': '#fc7899' }],
  ['mark.marker-blue', { 'background-color': '#72ccfd' }],
  ['mark.pen-red', { color: '#e71313', 'background-color': 'transparent' }],
  ['mark.pen-green', { color: '#128a00', 'background-color': 'transparent' }],
  ['pre', {
    'background-color': '#f4f4f5', padding: '1em 1.2em', 'border-radius': '6px', 'overflow-x': 'auto',
    'font-family': 'Consolas, Menlo, monospace', 'font-size': '0.9em', 'line-height': '1.5'
  }],
  ['blockquote', { 'border-left': '4px solid #ccc', margin: '1em 0', padding: '0.2em 1.2em', 'font-style': 'italic' }]
];

// Split on ';' outside parentheses: url(data:image/png;base64,…) stays whole.
const parseStyle = (style = '') => {
  const declarations = [];
  let depth = 0;
  let current = '';
  for (const char of style) {
    if (char === '(') depth++;
    if (char === ')') depth = Math.max(0, depth - 1);
    if (char === ';' && depth === 0) {
      declarations.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  declarations.push(current);

  return declarations
    .map(declaration => {
      const colon = declaration.indexOf(':');
      if (colon === -1) return null;
      const property = declaration.slice(0, colon).trim().toLowerCase();
      const value = declaration.slice(colon + 1).trim();
      return property && value ? [property, value] : null;
    })
    .filter(Boolean);
};

// Same format CKEditor emits (prop:value;), so a round trip is byte-exact.
const serializeStyle = declarations =>
  declarations.map(([property, value]) => `${property}:${value};`).join('');

// Not longhands of "border", despite the name.
const STANDALONE = ['border-collapse', 'border-spacing'];
const related = (a, b) => !STANDALONE.includes(a) && !STANDALONE.includes(b) && a.startsWith(`${b}-`);

// "margin" is already set when margin or margin-left… is present.
const hasProperty = (declarations, property) =>
  declarations.some(([existing]) =>
    existing === property || related(existing, property) || related(property, existing));

const parse = html => new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html').body;

const stripMarkedStyles = root => {
  root.querySelectorAll(`[${MARKER}]`).forEach(element => {
    const added = element.getAttribute(MARKER).split(',');
    const kept = parseStyle(element.getAttribute('style') || '')
      .filter(([property]) => !added.includes(property));
    element.removeAttribute(MARKER);
    if (kept.length) {
      element.setAttribute('style', serializeStyle(kept));
    } else {
      element.removeAttribute('style');
    }
  });
};

/**
 * Editor HTML → HTML to publish on Blogger (or export).
 * @param {string} html
 * @returns {string}
 */
export const toBloggerHtml = (html) => {
  if (!html) return html;
  const root = parse(html);
  stripMarkedStyles(root); // idempotent if called twice

  for (const [selector, styles] of RULES) {
    root.querySelectorAll(selector).forEach(element => {
      const declarations = parseStyle(element.getAttribute('style') || '');
      const added = (element.getAttribute(MARKER) || '').split(',').filter(Boolean);

      for (const [property, value] of Object.entries(styles)) {
        if (!hasProperty(declarations, property)) {
          declarations.push([property, value]);
          added.push(property);
        }
      }

      if (added.length) {
        element.setAttribute('style', serializeStyle(declarations));
        element.setAttribute(MARKER, added.join(','));
      }
    });
  }

  return root.innerHTML;
};

/**
 * Blogger HTML → editor HTML: drops only the styles toBloggerHtml added.
 * @param {string} html
 * @returns {string}
 */
export const fromBloggerHtml = (html) => {
  if (!html || !html.includes(MARKER)) return html;
  const root = parse(html);
  stripMarkedStyles(root);
  return root.innerHTML;
};
