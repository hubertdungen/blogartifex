/**
 * CKEditor 5 setup shared by the post editor and the template editor.
 *
 * Only the open-source (GPL) feature set is used — no premium plugins, no
 * cloud services — so everything here is free to run. The toolbar follows
 * Word's layout so content written or pasted from Word keeps its fonts,
 * sizes, colours, alignment, lists, tables and images and stays editable.
 */
import {
  ClassicEditor,
  Essentials, Paragraph, Heading, Autoformat, TextTransformation, SelectAll,
  Bold, Italic, Underline, Strikethrough, Subscript, Superscript, Code, RemoveFormat,
  FontFamily, FontSize, FontColor, FontBackgroundColor, Highlight,
  Alignment, Indent, IndentBlock, List, ListProperties,
  BlockQuote, HorizontalLine, CodeBlock, SpecialCharacters, SpecialCharactersEssentials,
  Link, AutoLink, LinkImage,
  Image, ImageCaption, ImageStyle, ImageToolbar, ImageResize, ImageUpload, ImageInsert,
  ImageInsertViaUrl, Base64UploadAdapter,
  Table, TableToolbar, TableProperties, TableCellProperties, TableCaption, TableColumnResize,
  MediaEmbed, PasteFromOffice, GeneralHtmlSupport, SourceEditing,
  FindAndReplace, ShowBlocks, Fullscreen,
  Plugin, ClipboardPipeline, UpcastWriter
} from 'ckeditor5';
import ptTranslations from 'ckeditor5/translations/pt.js';
import 'ckeditor5/ckeditor5.css';
import { t } from '../services/I18nService';

export { ClassicEditor };

/**
 * Word only hands over pasted images through RTF (Word for Windows). From
 * Word for Mac, Word Online or Outlook they arrive as file:/// paths the
 * browser can never load, so drop them and let the page tell the user to
 * insert those images with the image button instead of leaving broken ones.
 */
class DropLocalImages extends Plugin {
  static get requires() {
    return [ClipboardPipeline];
  }

  init() {
    const editor = this.editor;
    editor.plugins.get('ClipboardPipeline').on('inputTransformation', (evt, data) => {
      const writer = new UpcastWriter(editor.editing.view.document);
      const localImages = [];
      for (const { item } of writer.createRangeIn(data.content)) {
        if (item.is('element', 'img') && /^file:/i.test(item.getAttribute('src') || '')) {
          localImages.push(item);
        }
      }
      localImages.forEach(image => writer.remove(image));

      const onDropped = editor.config.get('blogartifex.onLocalImagesDropped');
      if (localImages.length && onDropped) onDropped(localImages.length);
    // After PasteFromOffice ('high', which inlines RTF images) and before
    // the pipeline converts the content to the model ('low').
    }, { priority: 'normal' });
  }
}

const PLUGINS = [
  Essentials, Paragraph, Heading, Autoformat, TextTransformation, SelectAll,
  Bold, Italic, Underline, Strikethrough, Subscript, Superscript, Code, RemoveFormat,
  FontFamily, FontSize, FontColor, FontBackgroundColor, Highlight,
  Alignment, Indent, IndentBlock, List, ListProperties,
  BlockQuote, HorizontalLine, CodeBlock, SpecialCharacters, SpecialCharactersEssentials,
  Link, AutoLink, LinkImage,
  Image, ImageCaption, ImageStyle, ImageToolbar, ImageResize, ImageUpload, ImageInsert,
  ImageInsertViaUrl, Base64UploadAdapter,
  Table, TableToolbar, TableProperties, TableCellProperties, TableCaption, TableColumnResize,
  MediaEmbed, PasteFromOffice, GeneralHtmlSupport, SourceEditing,
  FindAndReplace, ShowBlocks, Fullscreen, DropLocalImages
];

// CKEditor's community "pt" translation is European Portuguese, but a few
// labels are wrong or differ from Word's pt-PT wording.
const PT_PT_OVERRIDES = {
  pt: {
    dictionary: {
      'Heading': 'Título',
      'Choose heading': 'Escolher estilo',
      'Heading 1': 'Título 1',
      'Heading 2': 'Título 2',
      'Heading 3': 'Título 3',
      'Heading 4': 'Título 4',
      'Font Family': 'Tipo de letra',
      'Font Size': 'Tamanho do tipo de letra',
      'Font Color': 'Cor do tipo de letra',
      'Font Background Color': 'Cor de fundo do texto',
      'Default': 'Predefinido',
      'Strikethrough': 'Rasurado',
      'Bulleted List': 'Lista com marcas',
      'Numbered List': 'Lista numerada',
      'Block quote': 'Citação',
      'Insert code block': 'Inserir bloco de código',
      'Source': 'Código-fonte HTML',
      'Link image': 'Hiperligação na imagem'
    }
  }
};

// Same order and grouping as Word's Home ribbon, then Insert, then tools.
const TOOLBAR = [
  'undo', 'redo',
  '|', 'heading',
  '|', 'fontFamily', 'fontSize',
  '|', 'bold', 'italic', 'underline', 'strikethrough', 'subscript', 'superscript', 'code',
  '|', 'fontColor', 'fontBackgroundColor', 'highlight', 'removeFormat',
  '|', 'alignment',
  '|', 'bulletedList', 'numberedList', 'outdent', 'indent',
  '|', 'link', 'insertImage', 'insertTable', 'mediaEmbed',
  'blockQuote', 'codeBlock', 'horizontalLine', 'specialCharacters',
  '|', 'findAndReplace', 'showBlocks', 'sourceEditing', 'fullscreen'
];

// Phones show only what fits before the "⋮" overflow, so lead with the
// everyday actions; everything else is still one tap away.
const MOBILE_FIRST = ['bold', 'italic', 'underline', 'bulletedList', 'numberedList', 'link', 'insertImage', 'heading'];
const MOBILE_TOOLBAR = [
  ...MOBILE_FIRST,
  '|',
  ...TOOLBAR.filter(item => !MOBILE_FIRST.includes(item))
    .filter((item, index, list) => !(item === '|' && list[index - 1] === '|'))
];

const FONT_FAMILIES = [
  'default',
  'Arial, Helvetica, sans-serif',
  'Calibri, Carlito, sans-serif',
  'Cambria, Caladea, Georgia, serif',
  'Georgia, serif',
  'Times New Roman, Times, serif',
  'Verdana, Geneva, sans-serif',
  'Trebuchet MS, Helvetica, sans-serif',
  'Tahoma, Geneva, sans-serif',
  'Courier New, Courier, monospace'
];

// Numeric sizes (px) render as inline styles, so they survive on Blogger;
// supportAllValues keeps Word's pt sizes on paste.
const FONT_SIZES = [10, 11, 12, 13, 14, 'default', 18, 20, 24, 28, 32, 40, 48];

/**
 * Builds the editor config for the current UI language.
 * @param {object} options
 * @param {string} options.locale - UI locale (e.g. 'pt-PT', 'en-US')
 * @param {string} [options.placeholder]
 * @param {boolean} [options.compact] - true for the smaller template editor
 * @param {function(number)} [options.onLocalImagesDropped] - called with the
 *   number of pasted Word images that could not be read
 */
export const buildEditorConfig = ({ locale, placeholder, compact = false, onLocalImagesDropped }) => {
  const isPortuguese = (locale || '').toLowerCase().startsWith('pt');
  // Word-like: every button visible (wrapping) when there is room; on
  // narrow screens the overflow goes behind a "more" button instead.
  const wideScreen = typeof window !== 'undefined' && window.innerWidth > 900;

  return {
    licenseKey: 'GPL',
    plugins: PLUGINS,
    blogartifex: { onLocalImagesDropped },
    language: isPortuguese ? 'pt' : 'en',
    // CKEditor crashes on an empty translations array; English is built in
    ...(isPortuguese ? { translations: [ptTranslations, PT_PT_OVERRIDES] } : {}),
    placeholder,
    // The toolbar sticks while scrolling; on phones it must sit below the
    // app's own sticky top bar (logo + navigation, ~96px).
    ui: { viewportOffset: { top: wideScreen || typeof window === 'undefined' || window.innerWidth > 768 ? 0 : 96 } },
    toolbar: {
      items: compact
        ? TOOLBAR.filter(item => !['fullscreen', 'showBlocks', 'findAndReplace'].includes(item))
        : (wideScreen ? TOOLBAR : MOBILE_TOOLBAR),
      shouldNotGroupWhenFull: wideScreen && !compact
    },
    heading: {
      options: [
        { model: 'paragraph', title: 'Paragraph', class: 'ck-heading_paragraph' },
        { model: 'heading1', view: 'h1', title: 'Heading 1', class: 'ck-heading_heading1' },
        { model: 'heading2', view: 'h2', title: 'Heading 2', class: 'ck-heading_heading2' },
        { model: 'heading3', view: 'h3', title: 'Heading 3', class: 'ck-heading_heading3' },
        { model: 'heading4', view: 'h4', title: 'Heading 4', class: 'ck-heading_heading4' }
      ]
    },
    fontFamily: { options: FONT_FAMILIES, supportAllValues: true },
    fontSize: { options: FONT_SIZES, supportAllValues: true },
    fontColor: { columns: 6, documentColors: 12, colorPicker: { format: 'hex' } },
    fontBackgroundColor: { columns: 6, documentColors: 12, colorPicker: { format: 'hex' } },
    alignment: { options: ['left', 'center', 'right', 'justify'] },
    list: { properties: { styles: true, startIndex: true, reversed: true } },
    link: {
      defaultProtocol: 'https://',
      decorators: {
        openInNewTab: {
          mode: 'manual',
          label: t('editor.link.openInNewTab'),
          attributes: { target: '_blank', rel: 'noopener noreferrer' }
        }
      }
    },
    image: {
      toolbar: [
        {
          name: 'imageStyle:wrapText',
          title: t('editor.image.wrapText'),
          items: ['imageStyle:alignLeft', 'imageStyle:alignRight'],
          defaultItem: 'imageStyle:alignLeft'
        },
        {
          name: 'imageStyle:breakText',
          title: t('editor.image.breakText'),
          items: ['imageStyle:alignBlockLeft', 'imageStyle:alignCenter', 'imageStyle:alignBlockRight'],
          defaultItem: 'imageStyle:alignCenter'
        },
        'imageStyle:inline', 'imageStyle:side',
        '|', 'resizeImage',
        '|', 'toggleImageCaption', 'imageTextAlternative', 'linkImage'
      ],
      styles: {
        options: ['inline', 'alignLeft', 'alignRight', 'alignCenter', 'alignBlockLeft', 'alignBlockRight', 'block', 'side']
      },
      resizeUnit: '%',
      resizeOptions: [
        { name: 'resizeImage:original', value: null, label: t('editor.image.original') },
        { name: 'resizeImage:25', value: '25', label: '25%' },
        { name: 'resizeImage:33', value: '33', label: '33%' },
        { name: 'resizeImage:50', value: '50', label: '50%' },
        { name: 'resizeImage:75', value: '75', label: '75%' },
        { name: 'resizeImage:100', value: '100', label: '100%' }
      ],
      insert: { integrations: ['upload', 'url'] }
    },
    table: {
      contentToolbar: [
        'tableColumn', 'tableRow', 'mergeTableCells',
        'tableProperties', 'tableCellProperties', 'toggleTableCaption'
      ]
    },
    codeBlock: {
      languages: [
        { language: 'plaintext', label: t('editor.codeBlock.plain') },
        { language: 'html', label: 'HTML' },
        { language: 'css', label: 'CSS' },
        { language: 'javascript', label: 'JavaScript' },
        { language: 'python', label: 'Python' },
        { language: 'bash', label: 'Bash' },
        { language: 'json', label: 'JSON' }
      ]
    },
    // Blogger cannot render <oembed>; keep the real <iframe> in the HTML.
    mediaEmbed: { previewsInData: true },
    // Keep any HTML Word or Blogger produces (styles, classes, attributes)
    // instead of silently dropping what has no dedicated feature — but
    // never inline event handlers.
    htmlSupport: {
      allow: [{ name: /.*/, attributes: true, classes: true, styles: true }],
      // Event handlers never; Word's VML leftovers and paste bookkeeping
      // are noise in a blog post.
      disallow: [{
        attributes: [
          { key: /^on/i, value: true },
          { key: /^(v|o|w):/i, value: true },
          { key: /^uploadprocessed$/i, value: true }
        ]
      }]
    }
  };
};
