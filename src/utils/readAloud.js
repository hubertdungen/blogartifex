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

// Cheap language guess from common words; null when the text does not lean clearly either way.
export function detectLanguage(text) {
  const sample = ' ' + String(text || '').slice(0, 4000).toLowerCase().replace(/[^\p{L}\s]/gu, ' ') + ' ';
  const count = words => words.reduce((n, w) => n + sample.split(' ' + w + ' ').length - 1, 0);
  const pt = count(['de', 'que', 'não', 'uma', 'para', 'com', 'os', 'do', 'da', 'é', 'em', 'mais', 'por', 'como', 'mas', 'isso', 'são', 'também', 'ao', 'dos', 'das', 'já', 'ele', 'ela', 'seu', 'sua', 'foi', 'muito', 'até', 'onde']);
  const en = count(['the', 'and', 'of', 'to', 'in', 'is', 'that', 'it', 'for', 'was', 'with', 'as', 'on', 'be', 'at', 'by', 'this', 'have', 'from', 'or', 'are', 'not', 'but', 'they', 'his', 'her', 'which', 'you', 'were', 'there']);
  return en > pt * 1.2 ? 'en-US' : pt > en * 1.2 ? 'pt-PT' : null;
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
