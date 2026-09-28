// Jest can't load CKEditor's ESM bundle; tests don't exercise the editor.
const React = require('react');

class Stub {}

module.exports = new Proxy({
  __esModule: true,
  default: {},
  CKEditor: () => React.createElement('div', { 'data-testid': 'ckeditor' })
}, {
  get: (target, name) => (name in target ? target[name] : Stub)
});
