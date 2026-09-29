import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { CKEditor } from '@ckeditor/ckeditor5-react';
import DateTimePicker from 'react-datetime-picker';
import 'react-datetime-picker/dist/DateTimePicker.css';
import 'react-calendar/dist/Calendar.css';
import 'react-clock/dist/Clock.css';
import { saveAs } from 'file-saver';
import BloggerService from '../services/BloggerService';
import AuthService from '../services/AuthService';
import Feedback from './Feedback';
import AIAssistant from './AIAssistant';
import AISelectionMenu from './AISelectionMenu';
import i18n, { t } from '../services/I18nService';
import { getStoredJson, getStoredValue, setStoredValue } from '../utils/storage';
import { ClassicEditor, buildEditorConfig } from '../utils/editorConfig';
import { toBloggerHtml, fromBloggerHtml } from '../utils/bloggerHtml';
import { shrinkEmbeddedImages, byteSize } from '../utils/webImages';
import { learnBlogStyle, formatLikeBlog, describeBlogStyle, DEFAULT_STYLE } from '../utils/blogStyle';

/**
 * Componente do Editor de Posts
 * 
 * Recursos:
 * - Editor CKEditor para conteúdo rico (semelhante ao Word)
 * - Gerenciamento de tags/labels
 * - Suporte a templates
 * - Agendamento de publicações
 * - Metadados (SEO)
 * - Exportação em diferentes formatos
 */
function PostEditor({ theme, toggleTheme }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { postId } = useParams();
  const editorRef = useRef(null);
  const [, setLocale] = useState(i18n.getLocale());

  useEffect(() => {
    const remove = i18n.addListener(setLocale);
    return remove;
  }, []);
  
  // Estados do editor. Ao abrir um post existente começa já em "loading":
  // se o CKEditor montasse e fosse logo desmontado pelo fetchPost, a criação
  // assíncrona que ficou a meio rebentava (editor-create-initial-data).
  const [loading, setLoading] = useState(!!postId);
  const [saving, setSaving] = useState(false);
  const [blogs, setBlogs] = useState([]);
  const [selectedBlog, setSelectedBlog] = useState('');
  const [postData, setPostData] = useState({
    title: '',
    content: '',
    labels: [],
    isDraft: true,
    scheduledPublish: null
  });
  
  // Estados para templates
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templates, setTemplates] = useState([]);
  
  // Estados para metadados
  const [metadata, setMetadata] = useState({
    description: '',
    author: '',
    keywords: ''
  });
  const [showMetadataEditor, setShowMetadataEditor] = useState(false);
  
  // Estado para mensagens de feedback
  const [feedback, setFeedback] = useState(null);
  const locale = i18n.getLocale();
  // The editor reads its config once, at creation
  const editorConfig = useMemo(
    () => buildEditorConfig({
      locale,
      placeholder: t('editor.placeholders.content'),
      onLocalImagesDropped: count => setFeedback({
        type: 'warning',
        message: t('editor.import.localImages', { count }),
        duration: 8000
      })
    }),
    [locale]
  );
  const autoSaveDataRef = useRef({ postData, metadata, selectedBlog, postId });

  // Assistente de IA
  const [editorInstance, setEditorInstance] = useState(null);
  const [showAIPanel, setShowAIPanel] = useState(() => getStoredValue('blogartifex_ai_panel_open') === 'true');
  const draftCheckedRef = useRef(false);
  const wasLiveRef = useRef(false);

  useEffect(() => {
    autoSaveDataRef.current = { postData, metadata, selectedBlog, postId };
  }, [metadata, postData, postId, selectedBlog]);

  // Efeito para carregar dados iniciais
  useEffect(() => {
    // Carregar templates salvos localmente
    const savedTemplates = getStoredJson('blogartifex_templates', []);
    setTemplates(savedTemplates);
    
    // Carregar lista de blogs do usuário
    fetchUserBlogs();
    
    // Verificar se há dados passados via state (rota)
    if (location.state) {
      const { blogId, title, content, labels } = location.state;
      
      if (blogId) {
        setSelectedBlog(blogId);
      }
      
      if (title || content || labels) {
        setPostData(prev => ({
          ...prev,
          title: title || prev.title,
          content: content || prev.content,
          labels: labels || prev.labels
        }));
      }
    }
    
    // Configurar autosalvamento
    const settings = getStoredJson('blogartifex_settings', {});
    const autoSaveInterval = settings.autoSaveInterval || 5; // 5 minutos padrão
    
    const timer = setInterval(() => {
      handleAutoSave();
    }, autoSaveInterval * 60 * 1000);
    
    // Limpar timer ao desmontar componente
    return () => {
      if (timer) {
        clearInterval(timer);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, postId]);
  
  // Carregar o post existente assim que houver blog selecionado
  useEffect(() => {
    if (postId && selectedBlog) {
      fetchPost(selectedBlog, postId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBlog, postId]);

  /**
   * Ao criar um novo post: oferece a restauração do rascunho local
   * (auto-guardado) ou aplica o template padrão das definições.
   */
  useEffect(() => {
    if (draftCheckedRef.current || !selectedBlog || postId) return;
    if (location.state && (location.state.title || location.state.content)) return;

    draftCheckedRef.current = true;

    const draftKey = `blogartifex_draft_${selectedBlog}_new`;
    const draft = getStoredJson(draftKey, null);

    if (draft && (draft.title || draft.content)) {
      const savedAt = draft.savedAt ? new Date(draft.savedAt).toLocaleString() : '';
      if (window.confirm(t('editor.draft.restoreConfirm', { time: savedAt }))) {
        setPostData(prev => ({
          ...prev,
          title: draft.title || '',
          content: draft.content || '',
          labels: draft.labels || []
        }));
        if (draft.metadata) {
          setMetadata(draft.metadata);
        }
        if (editorRef.current && draft.content) {
          editorRef.current.setData(draft.content);
        }
        return;
      }
      localStorage.removeItem(draftKey);
    }

    // Sem rascunho: aplicar o template padrão definido nas Definições.
    const settings = getStoredJson('blogartifex_settings', {});
    if (settings.defaultTemplate) {
      const savedTemplates = getStoredJson('blogartifex_templates', []);
      const defaultTemplate = savedTemplates.find(
        tpl => String(tpl.id) === String(settings.defaultTemplate)
      );
      if (defaultTemplate && defaultTemplate.content) {
        setPostData(prev => (prev.content ? prev : { ...prev, content: defaultTemplate.content }));
        if (editorRef.current) {
          editorRef.current.setData(defaultTemplate.content);
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBlog, postId]);


  /**
   * Auto-salva o post atual como rascunho
   */
  const handleAutoSave = () => {
    const current = autoSaveDataRef.current;
    if (!(current.postData.title || current.postData.content) || !current.selectedBlog) return;
    
    // Salvar como rascunho local
    const key = `blogartifex_draft_${current.selectedBlog}_${current.postId || 'new'}`;
    const draftData = {
      ...current.postData,
      metadata: current.metadata,
      savedAt: new Date().toISOString()
    };
    
    if (!setStoredValue(key, JSON.stringify(draftData))) {
      setFeedback({
        type: 'error',
        message: t('editor.saving.autoSaveError')
      });
      return;
    }
    
    setFeedback({
      type: 'info',
      message: t('editor.saving.autoSave', { time: new Date().toLocaleTimeString() }),
      duration: 3000
    });
  };

  /**
   * Busca a lista de blogs do usuário autenticado
   */
  const fetchUserBlogs = async () => {
    try {
      const token = localStorage.getItem('blogartifex_token');
      
      if (!token) {
        navigate('/');
        return;
      }
      
      // Sem setLoading aqui: o seletor de blogs já mostra o seu próprio
      // estado de carregamento, e esconder a página desmontava o editor.

      // Buscar blogs usando o serviço
      const data = await BloggerService.getUserBlogs();
      
      if (data.items) {
        setBlogs(data.items);

        // Se não houver blog selecionado, usar o blog padrão das
        // definições (quando existir) ou o primeiro da lista
        // (update funcional: a closure deste efeito vê sempre selectedBlog vazio)
        if (data.items.length > 0) {
          const settings = getStoredJson('blogartifex_settings', {});
          const preferred = data.items.find(blog => blog.id === settings.defaultBlogId);
          setSelectedBlog(prev => prev || (preferred || data.items[0]).id);
        }
      }
      // Sem blogs não há post para carregar: não deixar a página presa
      if (!data.items || data.items.length === 0) {
        setLoading(false);
      }
    } catch (error) {
      console.error('Erro ao buscar blogs:', error);
      setLoading(false);

      // Se for erro de autenticação, redirecionar para login
      if (error.code === 'AUTH') {
        AuthService.removeAuthToken();
        navigate('/', { replace: true });
        return;
      }

      setFeedback({
        type: 'error',
        message: t('editor.errors.loadBlogs')
      });
    }
  };

  /**
   * Busca os dados de um post existente
   */
  const fetchPost = async (blogId, postId) => {
    try {
      setLoading(true);
      
      // Buscar o post existente
      const data = await BloggerService.getPost(blogId, postId);
      
      // Extrair metadados do conteúdo (se houver)
      const metaDescription = extractMetadata(data.content, 'description');
      const metaAuthor = extractMetadata(data.content, 'author');
      const metaKeywords = extractMetadata(data.content, 'keywords');
      
      wasLiveRef.current = data.status === 'LIVE';
      setPostData({
        title: data.title || '',
        content: fromBloggerHtml(data.content || ''),
        labels: data.labels || [],
        isDraft: data.status !== 'LIVE',
        // A API não tem campo "scheduled": um post agendado vem com
        // status SCHEDULED e a data futura em "published".
        scheduledPublish: data.status === 'SCHEDULED' && data.published ? new Date(data.published) : null
      });
      
      setMetadata({
        description: metaDescription || '',
        author: metaAuthor || '',
        keywords: metaKeywords || ''
      });
    } catch (error) {
      console.error('Erro ao buscar post:', error);

      // Se for erro de autenticação, redirecionar para login
      if (error.code === 'AUTH') {
        AuthService.removeAuthToken();
        navigate('/', { replace: true });
        return;
      }

      setFeedback({
        type: 'error',
        message: t('editor.errors.loadPost')
      });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Extrai metadados do conteúdo HTML
   */
  const extractMetadata = (content, metaType) => {
    if (!content) return '';
    
    const metaRegex = new RegExp(`<meta name="${metaType}" content="([^"]*)"`, 'i');
    const match = content.match(metaRegex);
    
    if (!match) return '';
    const decoder = document.createElement('textarea');
    decoder.innerHTML = match[1];
    return decoder.value;
  };

  /**
   * Handler para mudanças no editor CKEditor
   */
  const handleEditorChange = (event, editor) => {
    const content = editor.getData();
    setPostData(prev => ({
      ...prev,
      content
    }));
  };

  /**
   * Handler para mudança no título
   */
  const handleTitleChange = (e) => {
    setPostData(prev => ({
      ...prev,
      title: e.target.value
    }));
  };

  /**
   * Handler para mudança nas tags/labels
   */
  const handleLabelsChange = (e) => {
    const labels = e.target.value.split(',').map(label => label.trim()).filter(Boolean);
    setPostData(prev => ({
      ...prev,
      labels
    }));
  };

  /**
   * Handler para mudança na data de agendamento
   */
  const handleScheduleChange = (date) => {
    setPostData(prev => ({
      ...prev,
      scheduledPublish: date
    }));
  };

  /**
   * Handler para alternar entre rascunho e publicado
   */
  const handleDraftToggle = () => {
    setPostData(prev => ({
      ...prev,
      isDraft: !prev.isDraft
    }));
  };

  /**
   * Handler para mudanças nos metadados
   */
  const handleMetadataChange = (e, field) => {
    setMetadata(prev => ({
      ...prev,
      [field]: e.target.value
    }));
  };

  /**
   * Salva o conteúdo atual como template
   */
  const handleSaveTemplate = () => {
    const templateName = prompt(t('editor.templates.templateName'));
    
    if (!templateName) return;
    
    const newTemplate = {
      id: Date.now(),
      name: templateName,
      content: postData.content,
      createdAt: new Date().toISOString()
    };
    
    const updatedTemplates = [...templates, newTemplate];
    setTemplates(updatedTemplates);
    localStorage.setItem('blogartifex_templates', JSON.stringify(updatedTemplates));
    
    setFeedback({
      type: 'success',
      message: t('templates.notifications.saved'),
      duration: 3000
    });
  };

  /**
   * Carrega um template selecionado
   */
  const handleTemplateSelect = (e) => {
    const templateId = e.target.value;
    
    if (templateId === '0') {
      setSelectedTemplate(null);
      return;
    }
    
    // Ids importados podem ser strings: comparar como texto.
    const template = templates.find(tpl => String(tpl.id) === templateId);
    
    if (template) {
      if (postData.content && !window.confirm(t('editor.templates.replaceConfirm'))) {
        return;
      }
      setSelectedTemplate(template);
      setPostData(prev => ({
        ...prev,
        content: template.content
      }));
      
      // Atualizar o editor com o conteúdo do template
      if (editorRef.current) {
        editorRef.current.setData(template.content);
      }
    }
  };

  /**
   * Insere metadata no conteúdo HTML
   */
  const insertMetadata = (content, metaType, metaValue) => {
    const escaped = metaValue.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const metaTag = `<meta name="${metaType}" content="${escaped}">`;
    
    // Verificar se já existe a meta tag
    const metaRegex = new RegExp(`<meta name="${metaType}" content="[^"]*"`, 'i');
    
    if (metaRegex.test(content)) {
      // Substituir a meta tag existente
      return content.replace(metaRegex, metaTag);
    } else {
      // Adicionar nova meta tag após a tag <head> ou no início do documento
      if (content.includes('<head>')) {
        return content.replace('<head>', `<head>\n  ${metaTag}`);
      } else if (content.includes('<html>')) {
        return content.replace('<html>', `<html>\n<head>\n  ${metaTag}\n</head>`);
      } else {
        return `<head>\n  ${metaTag}\n</head>\n${content}`;
      }
    }
  };

  /**
   * Insere um fragmento HTML no editor mantendo o histórico de undo.
   * @param {string} html - Fragmento HTML a inserir
   * @param {Object} [range] - Range do modelo a substituir (opcional)
   */
  const insertHtmlInEditor = (html, range = null) => {
    const editor = editorRef.current;
    if (!editor) return false;

    const viewFragment = editor.data.processor.toView(html);
    const modelFragment = editor.data.toModel(viewFragment);

    if (range) {
      editor.model.insertContent(modelFragment, range);
    } else {
      editor.model.insertContent(modelFragment);
    }
    return true;
  };

  /**
   * Aplica uma ação devolvida pelo assistente de IA diretamente no
   * artigo (documento completo, inserção, substituição da seleção ou
   * título). As alterações passam pelo modelo do CKEditor, por isso
   * podem ser desfeitas com Ctrl+Z.
   */
  const applyAIAction = (action) => {
    const editor = editorRef.current;

    switch (action.type) {
      case 'set_title':
        setPostData(prev => ({ ...prev, title: action.title }));
        return true;

      case 'replace_document': {
        if (!editor) {
          setPostData(prev => ({ ...prev, content: action.html }));
          return true;
        }
        const root = editor.model.document.getRoot();
        const range = editor.model.createRangeIn(root);
        return insertHtmlInEditor(action.html, range);
      }

      case 'insert_html':
      case 'replace_selection':
        return insertHtmlInEditor(action.html);

      default:
        return false;
    }
  };

  /**
   * Devolve o HTML atualmente selecionado no editor (para dar contexto
   * ao assistente de IA).
   */
  const getEditorSelectionHtml = () => {
    const editor = editorRef.current;
    if (!editor) return '';

    try {
      const selection = editor.model.document.selection;
      if (selection.isCollapsed) return '';
      return editor.data.stringify(editor.model.getSelectedContent(selection));
    } catch {
      return '';
    }
  };

  /**
   * Alterna o painel do assistente de IA
   */
  const toggleAIPanel = () => {
    setShowAIPanel(prev => {
      setStoredValue('blogartifex_ai_panel_open', String(!prev));
      return !prev;
    });
  };

  /**
   * Salva o post (como rascunho ou publicado)
   */
  const handleSavePost = async (publish = false) => {
    if (!selectedBlog) {
      setFeedback({
        type: 'error',
        message: t('editor.errors.selectBlog')
      });
      return;
    }
    
    if (!postData.title.trim()) {
      setFeedback({
        type: 'error',
        message: t('editor.errors.enterTitle')
      });
      return;
    }
    
    let payloadSize = 0;
    try {
      setSaving(true);
      
      // Adicionar metadados ao conteúdo
      // Inline the layout styles Blogger themes don't have
      // Web-size embedded images first: imported or pasted photos can be
      // megabytes each and Blogger then refuses the post. The editor is
      // updated too, so this only happens once per image.
      const shrunk = await shrinkEmbeddedImages(postData.content);
      if (shrunk.saved) {
        if (editorRef.current) editorRef.current.setData(shrunk.html);
        setPostData(prev => ({ ...prev, content: shrunk.html }));
      }
      let finalContent = toBloggerHtml(shrunk.html);
      
      if (metadata.description) {
        finalContent = insertMetadata(finalContent, 'description', metadata.description);
      }
      
      if (metadata.author) {
        finalContent = insertMetadata(finalContent, 'author', metadata.author);
      }
      
      if (metadata.keywords) {
        finalContent = insertMetadata(finalContent, 'keywords', metadata.keywords);
      }
      
      payloadSize = byteSize(finalContent);

      const postPayload = {
        kind: 'blogger#post',
        title: postData.title,
        content: finalContent,
        labels: postData.labels
      };

      // Sempre salvar como rascunho para controlar publicação
      const saveOptions = { params: { isDraft: true } };
      let savedPost;

      // Determinar se estamos criando ou atualizando um post
      if (postId) {
        // Atualizar post existente
        savedPost = await BloggerService.updatePost(selectedBlog, postId, postPayload);
        // Post publicado com a caixa "Rascunho" marcada: despublicar.
        if (!publish && wasLiveRef.current && postData.isDraft) {
          await BloggerService.revertToDraft(selectedBlog, postId);
        }
      } else {
        // Criar novo post como rascunho
        savedPost = await BloggerService.createPost(selectedBlog, postPayload, saveOptions);
      }

      // Publicar imediatamente ou agendar
      if (publish) {
        await BloggerService.publishPost(
          selectedBlog,
          savedPost.id,
          postData.scheduledPublish || undefined
        );
      }

      setFeedback({
        type: 'success',
        message: publish && postData.scheduledPublish
          ? t('editor.notifications.scheduled')
          : publish
            ? t('editor.notifications.published')
            : t('editor.notifications.draftSaved'),
        duration: 3000
      });
      
      // Limpar rascunho local após salvar
      const draftKey = `blogartifex_draft_${selectedBlog}_${postId || 'new'}`;
      localStorage.removeItem(draftKey);
      
      // Redirecionar para o dashboard após um breve atraso; os botões
      // ficam desativados até lá para um 2.º clique não duplicar o post.
      setTimeout(() => {
        navigate('/dashboard');
      }, 1500);
      return;
    } catch (error) {
      console.error('Erro ao salvar post:', error);
      
      // Se for erro de autenticação, redirecionar para login
      if (error.code === 'AUTH') {
        // Guardar o texto localmente antes de sair, para não se perder.
        handleAutoSave();
        AuthService.removeAuthToken();
        navigate('/', { replace: true });
        return;
      }
      
      // Blogger answers a generic 400 when a post is too big — almost always
      // images embedded in the HTML. Say that instead of "invalid argument".
      const tooLarge = /invalid argument/i.test(error.message) && payloadSize > 512 * 1024;
      setFeedback({
        type: 'error',
        message: tooLarge
          ? t('editor.errors.postTooLarge', { size: (payloadSize / 1048576).toFixed(1) })
          : t('editor.notifications.error', { message: error.message })
      });
    }
    setSaving(false);
  };

  /**
   * Salvar post como rascunho
   */
  const handleSaveAsDraft = () => {
    handleSavePost(false);
  };

  /**
   * Publicar post
   */
  const handlePublish = () => {
    handleSavePost(true);
  };

  /**
   * Exportar para Word
   */
  const handleExportWord = () => {
    // HTML with Word's namespaces opens in Word's Print Layout, with the
    // same inline layout styles that go to Blogger.
    const title = (postData.title || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const htmlContent = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="UTF-8">
<title>${title}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>body{font-family:Calibri,Arial,sans-serif;font-size:11pt;line-height:1.5}img{max-width:100%}</style>
</head>
<body>
<h1>${title}</h1>
${toBloggerHtml(postData.content)}
</body>
</html>`;

    const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword' });
    saveAs(blob, `${postData.title || 'post'}.doc`);
  };

  /**
   * Importar arquivo (TXT, DOC, DOCX, HTML)
   */
  const applyImportedContent = async (title, rawContent) => {
    // Word documents carry full-resolution photos; bring them to web size now
    const { html: content } = await shrinkEmbeddedImages(rawContent);
    setPostData(prev => ({
      ...prev,
      title: title || prev.title,
      content: content || prev.content
    }));

    if (editorRef.current && content) {
      editorRef.current.setData(content);
    }
  };

  // .docx → HTML in the browser (mammoth, BSD, loaded on demand): headings,
  // lists, tables, links, bold/italic and embedded images.
  const importDocx = async (arrayBuffer) => {
    const { default: mammoth } = await import('mammoth');
    const result = await mammoth.convertToHtml(
      { arrayBuffer },
      { styleMap: ["p[style-name='Title'] => h1.ba-doc-title:fresh"] }
    );

    const doc = new DOMParser().parseFromString(result.value, 'text/html');
    // The document title (Word "Title" style, or a leading Heading 1)
    // becomes the post title instead of repeating it in the body.
    const titleElement = doc.querySelector('h1.ba-doc-title')
      || (doc.body.firstElementChild?.tagName === 'H1' ? doc.body.firstElementChild : null);
    const title = titleElement ? titleElement.textContent.trim() : '';
    if (titleElement) titleElement.remove();

    await applyImportedContent(title, doc.body.innerHTML);
    setFeedback({ type: 'success', message: t('editor.import.docxDone'), duration: 5000 });
  };

  // House style learnt from the blog's recent posts, per blog
  const blogStyleCache = useRef({});

  const getBlogStyle = async () => {
    const cached = blogStyleCache.current[selectedBlog];
    if (cached) return cached;

    let learnt = { style: { ...DEFAULT_STYLE }, labels: [] };
    try {
      const data = await BloggerService.getPosts(selectedBlog, {
        status: 'live',
        maxResults: 8,
        fetchBodies: true,
        fields: 'items(content,labels)'
      });
      const items = data.items || [];
      const labelCounts = {};
      items.forEach(item => (item.labels || []).forEach(label => { labelCounts[label] = (labelCounts[label] || 0) + 1; }));
      learnt = {
        style: learnBlogStyle(items.map(item => fromBloggerHtml(item.content || ''))),
        labels: Object.keys(labelCounts).sort((a, b) => labelCounts[b] - labelCounts[a])
      };
    } catch (error) {
      console.warn('Could not learn the blog style, using defaults', error);
    }
    blogStyleCache.current[selectedBlog] = learnt;
    return learnt;
  };

  const handleFormatLikeBlog = async () => {
    const editor = editorRef.current;
    if (!editor || !editor.getData().trim()) {
      setFeedback({ type: 'info', message: t('editor.format.empty'), duration: 4000 });
      return;
    }

    setFeedback({ type: 'loading', message: t('editor.format.learning') });
    const { style } = await getBlogStyle();
    // An empty title field takes the document's own title line
    const { html, title, stats } = formatLikeBlog(editor.getData(), style, { extractTitle: !postData.title.trim() });
    if (title) setPostData(prev => ({ ...prev, title }));

    // One model change: Ctrl+Z restores the article exactly as it was
    editor.model.change(() => {
      insertHtmlInEditor(html, editor.model.createRangeIn(editor.model.document.getRoot()));
    });

    setFeedback({
      type: 'success',
      message: [
        title ? t('editor.format.title', { title }) : '',
        t('editor.format.done', stats),
        style.postsAnalysed
          ? t('editor.format.learnt', { count: style.postsAnalysed })
          : t('editor.format.defaults'),
        t('editor.format.undo')
      ].filter(Boolean).join(' '),
      duration: 9000
    });
  };

  const getBlogStyleHint = async () => {
    const { style, labels } = await getBlogStyle();
    return describeBlogStyle(style)
      + (labels.length ? ` Labels already used on this blog: ${labels.slice(0, 30).join(', ')}.` : '');
  };

  const handleFileImport = async (e) => {
    const input = e.target;
    const file = input.files[0];
    if (!file) return;

    try {
      if (/\.docx$/i.test(file.name)) {
        await importDocx(await file.arrayBuffer());
        return;
      }

      // Old binary .doc (Word 97-2003), RTF and OpenDocument: the server
      // converts them to .docx with LibreOffice, then the .docx path runs.
      const legacy = file.name.match(/\.(doc|rtf|odt)$/i);
      if (legacy) {
        setFeedback({ type: 'loading', message: t('editor.import.converting') });
        const response = await fetch(`./api/convert?from=${legacy[1].toLowerCase()}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${AuthService.getAuthToken()}`,
            'Content-Type': 'application/octet-stream'
          },
          body: file
        });
        if (!response.ok) {
          const reason = { 401: 'auth', 413: 'tooLarge', 429: 'busy', 501: 'unavailable' }[response.status] || 'failed';
          setFeedback({
            type: 'error',
            message: t(`editor.import.convert.${reason}`, { message: `HTTP ${response.status}` })
          });
          return;
        }
        await importDocx(await response.arrayBuffer());
        return;
      }

      const fileContent = await file.text();

      // Binary files (old .doc, a renamed .docx) — text and HTML never contain NUL
      if (fileContent.startsWith('PK') || fileContent.includes('\u0000')) {
        setFeedback({ type: 'error', message: t('editor.errors.importBinary') });
        return;
      }

      if (/\.txt$/i.test(file.name)) {
        // TXT: first line is the title, the rest one paragraph per line
        const escape = text => text.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
        const lines = fileContent.split('\n');
        await applyImportedContent(
          lines[0] || '',
          lines.slice(1).map(line => (line.trim() ? `<p>${escape(line)}</p>` : '')).join('')
        );
        return;
      }

      // HTML (including Word's "Web Page" export)
      const doc = new DOMParser().parseFromString(fileContent, 'text/html');
      const titleElement = doc.querySelector('title') || doc.querySelector('h1');
      await applyImportedContent(
        titleElement ? titleElement.textContent.trim() : '',
        doc.body ? doc.body.innerHTML : fileContent
      );
    } catch (error) {
      console.error('Erro ao importar ficheiro:', error);
      setFeedback({ type: 'error', message: t('editor.import.failed', { message: error.message }) });
    } finally {
      input.value = '';
    }
  };

  // Contagem de palavras/caracteres do artigo (sem markup)
  const plainText = postData.content
    ? postData.content
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    : '';
  const wordCount = plainText ? plainText.split(' ').length : 0;
  const charCount = plainText.length;

  /**
   * Render do componente
   */
  return (
    <div className="editor-content">
      <div className="editor-header">
        <h1>{t('editor.title')}</h1>
        
        <div className="editor-actions">
          <button
            className={`ai-toggle-button ${showAIPanel ? 'active' : ''}`}
            onClick={toggleAIPanel}
            title={t('ai.toggleTooltip')}
          >
            <span role="img" aria-label="AI">✨</span> {t('ai.toggle')}
          </button>

          <button
            className="save-draft-button"
            onClick={handleSaveAsDraft}
            disabled={saving}
          >
            {saving ? t('editor.saving.saving') : t('editor.buttons.saveDraft')}
          </button>

          <button
            className="publish-button"
            onClick={handlePublish}
            disabled={saving}
          >
            {saving ? t('editor.saving.saving') : (postData.scheduledPublish ? t('editor.buttons.schedule') : t('editor.buttons.publish'))}
          </button>
        </div>
      </div>
      
      {feedback && (
        <Feedback 
          type={feedback.type} 
          message={feedback.message} 
          onDismiss={() => setFeedback(null)}
          duration={feedback.duration}
          floating
        />
      )}
      
      {loading ? (
        <div className="loading">{t('common.loading')}</div>
      ) : (
        <div className={`editor-body ${showAIPanel ? 'with-ai' : ''}`}>
        <div className="editor-main">
          <div className="blog-selector">
            <label>{t('editor.labels.blog')}</label>
            <select
              value={selectedBlog}
              onChange={(e) => setSelectedBlog(e.target.value)}
              disabled={!!postId} // Não permitir trocar o blog ao editar um post existente
            >
              {blogs.length === 0 ? (
                <option value="">{t('dashboard.loadingBlogs')}</option>
              ) : (
                blogs.map(blog => (
                  <option key={blog.id} value={blog.id}>{blog.name}</option>
                ))
              )}
            </select>
          </div>
          
          <div className="post-options">
            <div className="title-input">
              <input
                type="text"
                placeholder={t('editor.placeholders.title')}
                value={postData.title}
                onChange={handleTitleChange}
              />
            </div>
            
            <div className="post-actions">
              <div className="post-fields">
                <div className="labels-input">
                  <label>{t('editor.labels.tags')}</label>
                  <input
                    type="text"
                    value={postData.labels.join(', ')}
                    onChange={handleLabelsChange}
                    placeholder={t('editor.placeholders.tags')}
                  />
                </div>

                <div className="template-select">
                  <label>{t('editor.labels.template')}</label>
                  <select onChange={handleTemplateSelect} value={selectedTemplate?.id || 0}>
                    <option value={0}>{t('editor.templates.select')}</option>
                    {templates.map(template => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                  <button onClick={handleSaveTemplate}>{t('editor.buttons.saveTemplate')}</button>
                </div>
              </div>

              <div className="post-toolbar">
                <div className="schedule-input">
                  <label>
                    <input
                      type="checkbox"
                      checked={!!postData.scheduledPublish}
                      onChange={() => handleScheduleChange(postData.scheduledPublish ? null : new Date())}
                    />
                    {t('editor.labels.schedule')}
                  </label>

                  {postData.scheduledPublish && (
                    <DateTimePicker
                      onChange={handleScheduleChange}
                      value={postData.scheduledPublish}
                      minDate={new Date()}
                      format="dd/MM/yyyy HH:mm"
                      locale={i18n.getLocale()}
                    />
                  )}
                </div>

                <div className="draft-toggle">
                  <label>
                    <input
                      type="checkbox"
                      checked={postData.isDraft}
                      onChange={handleDraftToggle}
                    />
                    {t('editor.labels.draft')}
                  </label>
                </div>

                <div className="post-toolbar-buttons">
                  <button type="button" className="format-blog-button" onClick={handleFormatLikeBlog}>
                    {t('editor.format.button')}
                  </button>
                  <button onClick={() => setShowMetadataEditor(!showMetadataEditor)}>
                    {showMetadataEditor ? t('editor.buttons.hideMetadata') : t('editor.buttons.showMetadata')}
                  </button>
                  <button onClick={handleExportWord}>{t('editor.buttons.exportWord')}</button>
                  <label className="file-input-label">
                    {t('editor.buttons.importFile')}
                    <input
                      type="file"
                      accept=".docx,.doc,.rtf,.odt,.html,.htm,.txt"
                      onChange={handleFileImport}
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>
              </div>
            </div>
            
            {showMetadataEditor && (
                <div className="metadata-editor">
                  <h3>{t('editor.metadata.title')}</h3>

                  <div className="metadata-field">
                    <label>{t('editor.metadata.description')}</label>
                    <input
                      type="text"
                      value={metadata.description}
                      onChange={(e) => handleMetadataChange(e, 'description')}
                      placeholder={t('editor.metadata.descriptionPlaceholder')}
                    />
                  </div>
                
                <div className="metadata-field">
                    <label>{t('editor.metadata.author')}</label>
                    <input
                      type="text"
                      value={metadata.author}
                      onChange={(e) => handleMetadataChange(e, 'author')}
                      placeholder={t('editor.metadata.authorPlaceholder')}
                    />
                  </div>
                
                <div className="metadata-field">
                    <label>{t('editor.metadata.keywords')}</label>
                    <input
                      type="text"
                      value={metadata.keywords}
                      onChange={(e) => handleMetadataChange(e, 'keywords')}
                      placeholder={t('editor.metadata.keywordsPlaceholder')}
                    />
                  </div>
                </div>
            )}
          </div>
          
          <div className="rich-editor">
            <CKEditor
              editor={ClassicEditor}
              data={postData.content}
              onChange={handleEditorChange}
              onReady={editor => {
                // Armazenar referência ao editor
                editorRef.current = editor;
                setEditorInstance(editor);
                // A altura mínima do editor é definida em CSS
                // (.rich-editor .ck-editor__editable_inline); defini-la aqui
                // via style inline não funciona porque o CKEditor limpa o
                // atributo style do editável quando este recebe foco.
              }}
              config={editorConfig}
            />
          </div>

          <div className="editor-statusbar">
            <span>{t('editor.stats.words', { count: wordCount })}</span>
            <span>·</span>
            <span>{t('editor.stats.characters', { count: charCount })}</span>
          </div>
        </div>

        {showAIPanel && (
          <AIAssistant
            getTitle={() => autoSaveDataRef.current.postData.title}
            getContent={() => autoSaveDataRef.current.postData.content}
            getSelectionHtml={getEditorSelectionHtml}
            getBlogStyleHint={getBlogStyleHint}
            applyAction={applyAIAction}
            onClose={toggleAIPanel}
          />
        )}
        </div>
      )}

      <AISelectionMenu
        editor={editorInstance}
        getTitle={() => autoSaveDataRef.current.postData.title}
        onFeedback={setFeedback}
      />
      
      
      {/* Indicador de salvamento */}
      {saving && (
        <div className="save-indicator show saving">
            {t('editor.saving.saving')}
          </div>
        )}
      </div>
  );
}

export default PostEditor;
