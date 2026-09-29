import { toBloggerHtml, fromBloggerHtml } from './bloggerHtml';

const styleOf = (html, selector) => {
  const root = new DOMParser().parseFromString(html, 'text/html').body;
  return root.querySelector(selector).getAttribute('style') || '';
};

test('floats a left-aligned image and keeps its own width', () => {
  const html = '<figure class="image image-style-align-left image_resized" style="width:40%"><img src="a.png"></figure>';
  const out = toBloggerHtml(html);
  expect(styleOf(out, 'figure')).toMatch(/float:left/);
  expect(styleOf(out, 'figure')).toMatch(/width:40%/);
  expect(styleOf(out, 'img')).toMatch(/width:100%/);
});

test('round trip restores the editor HTML exactly', () => {
  const html = '<figure class="image image-style-side"><img src="a.png"><figcaption>Legenda</figcaption></figure>'
    + '<figure class="table"><table style="border:2px solid red;"><tbody><tr><td>1</td></tr></tbody></table></figure>'
    + '<p><mark class="marker-yellow">x</mark></p>';
  const published = toBloggerHtml(html);
  expect(published).toContain('data-ba-style');
  expect(fromBloggerHtml(published)).toBe(new DOMParser().parseFromString(html, 'text/html').body.innerHTML);
});

test('explicit styles win and non-border properties are still added', () => {
  const out = toBloggerHtml('<figure class="table"><table style="border:2px solid red;"><tbody><tr><td>1</td></tr></tbody></table></figure>');
  const table = styleOf(out, 'table');
  expect(table).toMatch(/border:2px solid red/);
  expect(table).not.toMatch(/double/);
  expect(table).toMatch(/border-collapse:collapse/);
});

test('is idempotent and keeps data URIs intact', () => {
  const html = '<p style="background-image:url(data:image/png;base64,AAAA);color:red">x</p><blockquote><p>q</p></blockquote>';
  const once = toBloggerHtml(html);
  expect(toBloggerHtml(once)).toBe(once);
  expect(styleOf(once, 'p')).toContain('url(data:image/png;base64,AAAA)');
});

test('full-width images span the text column on Blogger', () => {
  const out = toBloggerHtml('<figure class="image image-style-full-width"><img src="a.png"><figcaption>c</figcaption></figure>');
  expect(styleOf(out, 'figure')).toMatch(/width:100%/);
  expect(styleOf(out, 'figure')).toMatch(/display:block/);
  expect(styleOf(out, 'img')).toMatch(/width:100%/);
  expect(styleOf(out, 'figcaption')).toMatch(/display:block/);
});
