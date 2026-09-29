/**
 * Suggests which of the blog's existing labels fit an article — no AI.
 *
 * Each label gets a vocabulary from the posts that already carry it, with
 * words weighted by how few labels use them. The article is scored against
 * every label by cosine similarity, plus a bonus when it keeps using the
 * label's own words. Only labels the blog already uses are suggested.
 */

const STOPWORDS = new Set(`
a o as os um uma uns umas de do da dos das em no na nos nas por pelo pela pelos pelas para com sem sob sobre entre
e ou mas nem que se como quando onde porque pois porém contudo todavia assim também já ainda mais menos muito muita
muitos muitas pouco pouca poucos poucas tão tanto tanta este esta estes estas esse essa esses essas aquele aquela
aqueles aquelas isto isso aquilo ele ela eles elas nós vós eu tu seu sua seus suas nosso nossa nossos nossas meu minha
lhe lhes me te nos vos é são foi foram ser estar está estão era eram tem têm ter há havia pode podem deve devem cada
todo toda todos todas outro outra outros outras mesmo mesma qual quais quem cujo cuja sua não sim só apenas bem
the of and to in is it that for on with as by at an be this are was were from or but not have has had which their
its his her they them we our you your into than then there these those such can will would should about more most
`.split(/\s+/).filter(Boolean));

const normalise = text => (text || '')
  .toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9\s-]/g, ' ');

// Crude stemming by prefix is enough to group consumo/consumismo/consumidor
const stem = word => (word.length > 6 ? word.slice(0, 6) : word);

export const tokens = text => normalise(text)
  .split(/[\s-]+/)
  .filter(word => word.length >= 4 && !STOPWORDS.has(word) && !/^\d+$/.test(word))
  .map(stem);

const termCounts = words => {
  const counts = new Map();
  words.forEach(word => counts.set(word, (counts.get(word) || 0) + 1));
  return counts;
};

const cosine = (a, b) => {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  a.forEach((value, term) => {
    normA += value * value;
    if (b.has(term)) dot += value * b.get(term);
  });
  b.forEach(value => { normB += value * value; });
  return normA && normB ? dot / Math.sqrt(normA * normB) : 0;
};

/**
 * @param {object} input
 * @param {string} input.articleText - title + plain text of the article
 * @param {{ labels: string[], text: string }[]} input.posts - the blog's posts
 * @param {string[]} [input.current] - labels already on the article
 * @param {number} [input.max] - most labels to add (default 4)
 * @returns {{ label: string, score: number }[]} best first, excluding current
 */
export const suggestLabels = ({ articleText, posts, current = [], max = 4 }) => {
  const labelled = posts.filter(post => post.labels && post.labels.length);
  if (!labelled.length) return [];

  // Each label's vocabulary: term counts over all its posts
  const labelVectors = new Map();
  labelled.forEach(post => {
    const counts = termCounts(tokens(post.text));
    post.labels.forEach(label => {
      if (!labelVectors.has(label)) labelVectors.set(label, new Map());
      const vector = labelVectors.get(label);
      counts.forEach((count, term) => vector.set(term, (vector.get(term) || 0) + count));
    });
  });

  // Weigh terms by how few labels use them: words every label shares say
  // nothing about which label fits (a blog's common vocabulary).
  const labelCount = labelVectors.size;
  const lf = new Map();
  labelVectors.forEach(vector => vector.forEach((_, term) => lf.set(term, (lf.get(term) || 0) + 1)));
  const weight = term => Math.log((labelCount + 1) / ((lf.get(term) || 0) + 1));
  labelVectors.forEach(vector => vector.forEach((count, term) => vector.set(term, Math.log(1 + count) * weight(term))));

  const articleCounts = termCounts(tokens(articleText));
  const article = new Map();
  articleCounts.forEach((count, term) => article.set(term, Math.log(1 + count) * weight(term)));
  const articleSize = [...articleCounts.values()].reduce((sum, count) => sum + count, 0) || 1;

  const taken = new Set(current.map(label => label.toLowerCase()));
  const scored = [...labelVectors.entries()]
    .filter(([label]) => !taken.has(label.toLowerCase()))
    .map(([label, vector]) => {
      // Bonus when the article keeps using the label's own words
      const nameWords = tokens(label);
      const mentions = nameWords.length ? Math.min(...nameWords.map(word => articleCounts.get(word) || 0)) : 0;
      const bonus = Math.min(0.25, (mentions / articleSize) * 40);
      return { label, score: cosine(article, vector) + bonus };
    })
    .sort((a, b) => b.score - a.score);

  if (!scored.length) return [];
  // Keep labels close to the best match, and never pure noise
  const best = scored[0].score;
  return scored
    .filter(({ score }) => score >= 0.06 && score >= best * 0.6)
    .slice(0, max);
};
