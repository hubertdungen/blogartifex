/**
 * "Format like the blog": learn the house style from published posts and
 * apply it to the current article — no AI, no API key, instant, undoable.
 *
 * learnBlogStyle() reads recent posts and finds which heading levels mark
 * sections and subsections (or whether the author uses bold lines instead),
 * whether body text is justified, the dominant font and size, and whether
 * images usually span the text width.
 *
 * formatLikeBlog() then detects the structure of the article — real
 * headings, "fake" headings (short bold or larger lines, typical of Word),
 * body paragraphs, hand-typed lists — cleans Word's leftovers and applies
 * that style.
 */

const HEADINGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
const BLOCK_TAGS = new Set(['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'table', 'figure', 'blockquote', 'pre', 'hr']);
const BULLET = /^\s*[•·▪◦‣●○■□–—*-]\s+/;
const NUMBERED = /^\s*(\d{1,3}|[a-z])[.)]\s+/i;
const WORD_ONLY_STYLES = /^(font-family|font-size|line-height|margin.*|text-indent|mso-.*|tab-stops|layout-grid-mode)$/i;

export const DEFAULT_STYLE = {
  sectionTag: 'h2',
  subsectionTag: 'h3',
  boldHeadings: false,
  justify: false,
  fontFamily: null,
  fontSize: null,
  fullWidthImages: false,
  postsAnalysed: 0
};

const parse = html => new DOMParser().parseFromString(`<body>${html || ''}</body>`, 'text/html').body;
const textOf = element => (element.textContent || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();

const styleValue = (element, property) => {
  const match = ((element.getAttribute && element.getAttribute('style')) || '')
    .match(new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`, 'i'));
  return match ? match[1].trim().replace(/["']/g, '') : null;
};

const dominant = (values, share = 0.6) => {
  if (!values.length) return null;
  const counts = new Map();
  values.forEach(value => counts.set(value, (counts.get(value) || 0) + 1));
  const [value, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return value !== null && count / values.length >= share ? value : null;
};

// A paragraph-like element: holds text and no nested blocks.
const isParagraph = element =>
  ['p', 'div'].includes(element.tagName.toLowerCase())
  && ![...element.children].some(child => BLOCK_TAGS.has(child.tagName.toLowerCase()))
  && textOf(element).length > 0;

const isAllBold = element => {
  const text = textOf(element);
  if (!text) return false;
  const bold = [...element.querySelectorAll('b, strong')].map(textOf).join(' ').replace(/\s+/g, ' ').trim();
  const styledBold = /font-weight\s*:\s*(bold|[6-9]00)/i.test(element.getAttribute('style') || '');
  return styledBold || bold.length >= text.length;
};

// Font styles set on the paragraph or on a single span wrapping its text.
const inlineFont = (element, property) => {
  const own = styleValue(element, property);
  if (own) return own;
  const spans = [...element.querySelectorAll('span[style]')].filter(span => textOf(span).length >= textOf(element).length * 0.9);
  for (const span of spans) {
    const value = styleValue(span, property);
    if (value) return value;
  }
  return null;
};

const toPx = size => {
  if (!size) return null;
  const match = size.match(/^([\d.]+)\s*(px|pt|em|rem)?$/i);
  if (!match) return null;
  const value = parseFloat(match[1]);
  const unit = (match[2] || 'px').toLowerCase();
  return unit === 'pt' ? value * 4 / 3 : unit === 'px' ? value : value * 16;
};

/**
 * @param {string[]} postsHtml - content of recent published posts
 * @returns {typeof DEFAULT_STYLE}
 */
export const learnBlogStyle = (postsHtml = []) => {
  const posts = postsHtml.filter(Boolean);
  if (!posts.length) return { ...DEFAULT_STYLE };

  const headingCounts = {};
  let boldLineCount = 0;
  const aligns = [];
  const families = [];
  const sizes = [];
  let images = 0;
  let wideImages = 0;

  for (const html of posts) {
    const root = parse(html);
    HEADINGS.forEach(tag => { headingCounts[tag] = (headingCounts[tag] || 0) + root.querySelectorAll(tag).length; });

    for (const element of root.querySelectorAll('p, div')) {
      if (!isParagraph(element)) continue;
      const text = textOf(element);
      if (text.length <= 90 && !/[.,;:]$/.test(text) && isAllBold(element)) {
        boldLineCount += 1;
        continue;
      }
      if (text.length < 40) continue; // captions, credits, one-liners
      aligns.push((styleValue(element, 'text-align') || 'left').toLowerCase());
      families.push(inlineFont(element, 'font-family'));
      sizes.push(inlineFont(element, 'font-size'));
    }

    for (const image of root.querySelectorAll('img')) {
      images += 1;
      const width = styleValue(image, 'width') || image.getAttribute('width') || '';
      const figure = image.closest('figure');
      if (/100%/.test(width) || parseInt(width, 10) >= 600
        || (figure && /image-style-full-width/.test(figure.className))) {
        wideImages += 1;
      }
    }
  }

  const used = HEADINGS.filter(tag => tag !== 'h1' && headingCounts[tag] > 0);
  const headingTotal = used.reduce((sum, tag) => sum + headingCounts[tag], 0);
  const boldHeadings = boldLineCount > headingTotal && boldLineCount >= posts.length;

  const sectionTag = used[0] || DEFAULT_STYLE.sectionTag;
  const nextLevel = `h${Math.min(6, Number(sectionTag[1]) + 1)}`;
  const subsectionTag = used[1] || nextLevel;

  return {
    sectionTag,
    subsectionTag,
    boldHeadings,
    justify: dominant(aligns) === 'justify',
    fontFamily: dominant(families),
    fontSize: dominant(sizes),
    fullWidthImages: images >= 2 && wideImages / images >= 0.6,
    postsAnalysed: posts.length
  };
};

const cleanStyles = element => {
  const kept = (element.getAttribute('style') || '')
    .split(';')
    .map(declaration => declaration.trim())
    .filter(declaration => declaration && !WORD_ONLY_STYLES.test(declaration.split(':')[0].trim()));
  if (kept.length) element.setAttribute('style', kept.join(';') + ';');
  else element.removeAttribute('style');
};

const makeHeading = (doc, text, level, style) => {
  if (style.boldHeadings) {
    const paragraph = doc.createElement('p');
    const strong = doc.createElement('strong');
    strong.textContent = text;
    paragraph.appendChild(strong);
    return paragraph;
  }
  const heading = doc.createElement(level === 'section' ? style.sectionTag : style.subsectionTag);
  heading.textContent = text;
  return heading;
};

/**
 * @param {string} html - editor HTML
 * @param {typeof DEFAULT_STYLE} style - from learnBlogStyle()
 * @param {{ extractTitle?: boolean }} [options] - take a leading document
 *   title (a lone top heading, or a much bigger first line) out of the body
 * @returns {{ html: string, title: string, stats: { sections: number, subsections: number, detected: number, lists: number, removed: number } }}
 */
export const formatLikeBlog = (html, style = DEFAULT_STYLE, { extractTitle = false } = {}) => {
  const root = parse(html);
  const doc = root.ownerDocument;
  const stats = { sections: 0, subsections: 0, detected: 0, lists: 0, removed: 0 };
  const created = new WeakSet(); // headings made here aren't re-detected
  let title = '';

  // 1. Word/Blogger wrap text in <div>s: turn text-only divs into paragraphs.
  root.querySelectorAll('div').forEach(div => {
    if (isParagraph(div) && !div.querySelector('img, iframe')) {
      const paragraph = doc.createElement('p');
      [...div.attributes].forEach(attribute => paragraph.setAttribute(attribute.name, attribute.value));
      paragraph.innerHTML = div.innerHTML;
      div.replaceWith(paragraph);
    }
  });

  // 2. Drop empty paragraphs (Word uses them as spacing).
  root.querySelectorAll('p').forEach(paragraph => {
    if (!textOf(paragraph) && !paragraph.querySelector('img, iframe, br + br')) {
      paragraph.remove();
      stats.removed += 1;
    }
  });

  // 3. Body text size, to tell "bigger" lines apart.
  const bodySizes = [...root.querySelectorAll('p')]
    .filter(paragraph => textOf(paragraph).length >= 60)
    .map(paragraph => toPx(inlineFont(paragraph, 'font-size')))
    .filter(Boolean)
    .sort((a, b) => a - b);
  const bodySize = bodySizes.length ? bodySizes[Math.floor(bodySizes.length / 2)] : 16;

  // 3b. Document title: a first line far bigger than the text, or a lone
  //     top-level heading at the start (Word's "Title"/Heading 1).
  const first = root.firstElementChild;
  if (extractTitle && first) {
    const firstSize = toPx(inlineFont(first, 'font-size'));
    const tag = first.tagName.toLowerCase();
    const loneHeading = HEADINGS.includes(tag) && root.querySelectorAll(tag).length === 1
      && ![...root.querySelectorAll(HEADINGS.join(','))].some(h => Number(h.tagName[1]) < Number(tag[1]));
    const bigLine = tag === 'p' && firstSize && firstSize >= bodySize * 1.45 && textOf(first).length <= 120;
    if (loneHeading || bigLine) {
      title = textOf(first);
      first.remove();
    }
  }

  // 4. Real headings keep their order: highest level used → section, the
  //    next → subsection (h1 included: the post title lives outside).
  const levels = [...new Set([...root.querySelectorAll(HEADINGS.join(','))].map(h => Number(h.tagName[1])))].sort();
  const hasRealSections = levels.length > 0;
  root.querySelectorAll(HEADINGS.join(',')).forEach(heading => {
    const text = textOf(heading);
    if (!text) { heading.remove(); stats.removed += 1; return; }
    const level = levels.indexOf(Number(heading.tagName[1])) === 0 ? 'section' : 'subsection';
    stats[level === 'section' ? 'sections' : 'subsections'] += 1;
    const made = makeHeading(doc, text, level, style);
    created.add(made);
    heading.replaceWith(made);
  });

  // 5. Fake headings: short lines, no closing punctuation, all bold or
  //    clearly bigger than the body text (or ALL CAPS).
  root.querySelectorAll('p').forEach(paragraph => {
    if (created.has(paragraph) || paragraph.parentElement !== root) return;
    if (paragraph.querySelector('img, iframe')) return;
    const text = textOf(paragraph);
    const words = text.split(' ').length;
    if (text.length < 2 || text.length > 100 || words > 14 || /[.,;:]$/.test(text)) return;
    if (BULLET.test(text) || NUMBERED.test(text)) return;

    const size = toPx(inlineFont(paragraph, 'font-size'));
    const bigger = size && size >= bodySize * 1.2;
    const shouting = text.length >= 4 && text === text.toUpperCase() && /[A-ZÀ-Ý]/.test(text);
    if (!bigger && !isAllBold(paragraph) && !shouting) return;

    const level = bigger && size >= bodySize * 1.45 ? 'section' : (hasRealSections || bigger ? 'subsection' : 'section');
    stats.detected += 1;
    stats[level === 'section' ? 'sections' : 'subsections'] += 1;
    const made = makeHeading(doc, text, level, style);
    created.add(made);
    paragraph.replaceWith(made);
  });

  // 6. Hand-typed lists: consecutive "• item" / "1. item" paragraphs.
  const blocks = [...root.children];
  for (let index = 0; index < blocks.length; index++) {
    const kind = element => {
      if (element.tagName.toLowerCase() !== 'p') return null;
      const text = textOf(element);
      return BULLET.test(text) ? 'ul' : NUMBERED.test(text) ? 'ol' : null;
    };
    const type = kind(blocks[index]);
    if (!type) continue;
    let end = index;
    while (end + 1 < blocks.length && kind(blocks[end + 1]) === type) end++;
    if (end === index) continue; // a single "1." line is just text
    const list = doc.createElement(type);
    for (let item = index; item <= end; item++) {
      const li = doc.createElement('li');
      li.innerHTML = blocks[item].innerHTML.replace(type === 'ul' ? /^\s*(<[^>]+>\s*)*[•·▪◦‣●○■□–—*-]\s+/ : /^\s*(<[^>]+>\s*)*(\d{1,3}|[a-zA-Z])[.)]\s+/, '$1');
      list.appendChild(li);
    }
    blocks[index].replaceWith(list);
    for (let item = index + 1; item <= end; item++) blocks[item].remove();
    stats.lists += 1;
    index = end;
  }

  // 7. Body text: drop Word's fonts/margins, keep colour, bold, highlight…
  //    then apply the blog's own font, size and alignment.
  root.querySelectorAll('p, li').forEach(block => {
    [block, ...block.querySelectorAll('[style]')].forEach(cleanStyles);
    block.querySelectorAll('span:not([style]):not([class])').forEach(span => span.replaceWith(...span.childNodes));
    block.innerHTML = block.innerHTML.replace(/(&nbsp;| ){2,}/g, ' ');

    if (!textOf(block)) return;
    if (block.tagName.toLowerCase() === 'p' && style.justify && !styleValue(block, 'text-align') && textOf(block).length >= 60) {
      block.setAttribute('style', `${block.getAttribute('style') || ''}text-align:justify;`);
    }
    if ((style.fontFamily || style.fontSize) && !(style.boldHeadings && isAllBold(block))) {
      const span = doc.createElement('span');
      span.setAttribute('style', [
        style.fontFamily && `font-family:${style.fontFamily}`,
        style.fontSize && `font-size:${style.fontSize}`
      ].filter(Boolean).join(';') + ';');
      span.append(...block.childNodes);
      block.appendChild(span);
    }
  });

  // 8. Images: follow the blog's habit of text-width images.
  if (style.fullWidthImages) {
    root.querySelectorAll('figure.image').forEach(figure => {
      if (!/image-style-|image_resized/.test(figure.className)) figure.classList.add('image-style-full-width');
    });
  }

  return { html: root.innerHTML, title, stats };
};

/** Short human description of a style, for the AI prompt. */
export const describeBlogStyle = (style) => [
  style.boldHeadings
    ? 'Section titles are bold paragraphs (<p><strong>…</strong></p>), not heading tags.'
    : `Sections use <${style.sectionTag}>, subsections <${style.subsectionTag}>.`,
  style.justify ? 'Body paragraphs are justified (style="text-align:justify").' : 'Body paragraphs are left-aligned.',
  style.fontFamily || style.fontSize
    ? `Body text is wrapped in <span style="${[style.fontFamily && `font-family:${style.fontFamily}`, style.fontSize && `font-size:${style.fontSize}`].filter(Boolean).join(';')}">.`
    : 'Body text uses the theme font (no inline font styles).',
  style.fullWidthImages ? 'Images span the text width (<figure class="image image-style-full-width">).' : 'Images are centred at their own size.'
].join(' ');
