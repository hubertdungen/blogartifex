import { learnBlogStyle, formatLikeBlog, DEFAULT_STYLE } from './blogStyle';

const body = html => new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html').body;
const long = 'Este é um parágrafo de texto corrido com frases suficientes para contar como corpo do artigo.';

test('learns headings, justification and font from published posts', () => {
  const post = `<h3>Secção</h3><p style="text-align:justify"><span style="font-family:Georgia,serif;font-size:17px">${long}</span></p>`
    + `<h4>Sub</h4><p style="text-align:justify"><span style="font-family:Georgia,serif;font-size:17px">${long}</span></p>`;
  const style = learnBlogStyle([post, post]);
  expect(style).toMatchObject({ sectionTag: 'h3', subsectionTag: 'h4', justify: true, fontFamily: 'Georgia,serif', fontSize: '17px', boldHeadings: false });
});

test('detects bold-line headings as the blog convention', () => {
  const post = `<p><b>Primeira parte</b></p><div>${long}</div><p><strong>Segunda parte</strong></p><div>${long}</div>`;
  expect(learnBlogStyle([post]).boldHeadings).toBe(true);
});

test('turns Word structure into the blog structure', () => {
  const word = `<h1>Capítulo</h1><p><span style="font-family:Calibri;font-size:11pt">${long}</span></p>`
    + `<p><strong>Um subtítulo a negrito</strong></p><p>&nbsp;</p>`
    + `<p>• primeiro</p><p>• segundo</p><p>1. um</p><p>2. dois</p>`
    + `<p><span style="font-size:20pt">Título grande</span></p><p style="margin-left:0cm"><span style="color:#c00000">${long}</span></p>`;
  const style = { ...DEFAULT_STYLE, sectionTag: 'h3', subsectionTag: 'h4', justify: true };
  const { html, stats } = formatLikeBlog(word, style);
  const root = body(html);

  expect([...root.children].map(e => e.tagName.toLowerCase())).toEqual(['h3', 'p', 'h4', 'ul', 'ol', 'h3', 'p']);
  expect(root.querySelector('h3').textContent).toBe('Capítulo');
  expect(root.querySelectorAll('ul li')[0].textContent).toBe('primeiro');
  expect(root.querySelectorAll('ol li')[1].textContent).toBe('dois');
  expect(html).not.toMatch(/Calibri|11pt|margin-left/);
  expect(html).toMatch(/color:#c00000/); // meaningful formatting survives
  expect(root.querySelector('p').getAttribute('style')).toMatch(/text-align:justify/);
  expect(stats).toMatchObject({ lists: 2, removed: 1, detected: 2 });
});

test('bold-heading blogs get bold paragraphs, counted once', () => {
  const { html, stats } = formatLikeBlog(`<h2>Parte</h2><p>${long}</p>`, { ...DEFAULT_STYLE, boldHeadings: true });
  expect(html).toMatch(/^<p><strong>Parte<\/strong><\/p>/);
  expect(stats.sections).toBe(1);
  expect(stats.detected).toBe(0);
});

test('applies the blog font and text-width images', () => {
  const { html } = formatLikeBlog(`<p>${long}</p><figure class="image"><img src="a.png"></figure>`,
    { ...DEFAULT_STYLE, fontFamily: 'Georgia,serif', fontSize: '17px', fullWidthImages: true });
  expect(html).toMatch(/<span style="font-family:Georgia,serif;font-size:17px;">/);
  expect(html).toMatch(/image-style-full-width/);
});

test('takes the document title out of the body when asked', () => {
  const big = `<p><span style="font-size:20pt">Um dia em Sintra</span></p><p><span style="font-size:11pt">${long}</span></p><p><b>O que visitar</b></p>`;
  const { html, title } = formatLikeBlog(big, DEFAULT_STYLE, { extractTitle: true });
  expect(title).toBe('Um dia em Sintra');
  expect(html).not.toMatch(/Um dia em Sintra/);
  expect(formatLikeBlog('<h1>Só um</h1><h2>A</h2><p>x</p>', DEFAULT_STYLE, { extractTitle: true }).title).toBe('Só um');
  expect(formatLikeBlog(big, DEFAULT_STYLE).title).toBe('');
});
