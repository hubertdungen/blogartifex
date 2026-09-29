import { suggestLabels } from './autoLabels';

const posts = [
  { labels: ['Filosofia'], text: 'Platão e Aristóteles discutem a ética, a virtude e a metafísica do ser.' },
  { labels: ['Filosofia', 'Identidade'], text: 'A identidade europeia e a ética da virtude na filosofia clássica.' },
  { labels: ['Ciência'], text: 'Física quântica, partículas, energia e o universo em expansão segundo a cosmologia.' },
  { labels: ['Ciência'], text: 'A biologia evolutiva explica genes, espécies e a seleção natural.' },
  { labels: ['Pensar e Governar'], text: 'O governo, o estado e a política económica do mercado e do consumo.' }
];

test('picks the labels whose posts talk about the same things', () => {
  const found = suggestLabels({ articleText: 'A ética da virtude em Aristóteles e a metafísica', posts }).map(s => s.label);
  expect(found[0]).toBe('Filosofia');
  expect(found).not.toContain('Ciência');
});

test('a label named in the article gets a bonus, current labels are skipped', () => {
  const found = suggestLabels({ articleText: 'Ciência e universo: cosmologia e energia', posts, current: ['filosofia'] }).map(s => s.label);
  expect(found[0]).toBe('Ciência');
  expect(found).not.toContain('Filosofia');
});

test('nothing when the article matches nothing', () => {
  expect(suggestLabels({ articleText: 'receita de bolo de chocolate com morangos', posts })).toEqual([]);
});
