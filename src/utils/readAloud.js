// Parse inert HTML: never insert article markup into the live page.
export function articleText(title, html) {
  const doc = new DOMParser().parseFromString(html || '', 'text/html');
  doc.querySelectorAll('script,style,iframe,object,svg,nav,[hidden],[aria-hidden="true"]').forEach(node => node.remove());
  doc.querySelectorAll('br').forEach(node => node.replaceWith('\n'));
  doc.querySelectorAll('p,div,h1,h2,h3,h4,h5,h6,li,blockquote,tr,figcaption').forEach(node => node.append('\n'));
  return [title, doc.body.textContent].filter(Boolean).join('\n').replace(/[ \t]+/g, ' ').replace(/\n\s*\n/g, '\n').trim();
}

// Short utterances avoid engines truncating long articles. Prefer punctuation.
export function speechChunks(text, limit = 220) {
  const chunks = [];
  let remaining = text.trim();
  while (remaining) {
    if (remaining.length <= limit) { chunks.push(remaining); break; }
    const head = remaining.slice(0, limit);
    const punctuation = [...head.matchAll(/[.!?;:\n](?:\s|$)/g)].pop();
    let end = punctuation && punctuation.index > limit / 3 ? punctuation.index + 1 : head.lastIndexOf(' ');
    if (end < 1) end = limit;
    chunks.push(remaining.slice(0, end).trim());
    remaining = remaining.slice(end).trim();
  }
  return chunks;
}

export function rankVoices(voices, language) {
  const score = voice => {
    const lang = voice.lang.replace('_', '-').toLowerCase();
    const target = language.toLowerCase();
    return (lang === target ? 100 : lang.split('-')[0] === target.split('-')[0] ? 50 : 0)
      + (/natural|neural|premium|enhanced/i.test(voice.name) ? 20 : 0);
  };
  return [...voices].sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name));
}
