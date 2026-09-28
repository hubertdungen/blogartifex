import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { CKEditor } from '@ckeditor/ckeditor5-react';
import ClassicEditor from '@ckeditor/ckeditor5-build-classic';
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
import ImageTools from './ImageTools';
import './ImageTools.css';
import i18n, { t } from '../services/I18nService';
import { getStoredJson, getStoredValue, setStoredValue } from '../utils/storage';
import {
  Base64UploadAdapterPlugin,
  ImageSizeAttributesPlugin,
  EDITOR_TOOLBAR,
  EDITOR_IMAGE_CONFIG,
  EDITOR_TABLE_CONFIG
} from '../utils/ckeditorExtensions';

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
        content: data.content || '',
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
    
    try {
      setSaving(true);
      
      // Adicionar metadados ao conteúdo
      let finalContent = postData.content;
      
      if (metadata.description) {
        finalContent = insertMetadata(finalContent, 'description', metadata.description);
      }
      
      if (metadata.author) {
        finalContent = insertMetadata(finalContent, 'author', metadata.author);
      }
      
      if (metadata.keywords) {
        finalContent = insertMetadata(finalContent, 'keywords', metadata.keywords);
      }
      
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
      
      setFeedback({
        type: 'error',
        message: t('editor.notifications.error', { message: error.message })
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
    // Criar um arquivo HTML que seja compatível com Word
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${postData.title}</title>
      </head>
      <body>
        <h1>${postData.title}</h1>
        ${postData.content}
      </body>
      </html>
    `;
    
    const blob = new Blob([htmlContent], { type: 'application/msword' });
    saveAs(blob, `${postData.title || 'post'}.doc`);
  };

  /**
   * Importar arquivo (TXT, DOC, DOCX, HTML)
   */
  const handleFileImport = (e) => {
    const file = e.target.files[0];
    
    if (!file) return;
    
    const reader = new FileReader();
    
    reader.onload = (event) => {
      const fileContent = event.target.result;

      // Ficheiros .docx (e .doc modernos) são contentores ZIP binários
      // que não podem ser interpretados como HTML no navegador.
      if (typeof fileContent === 'string' && fileContent.startsWith('PK')) {
        setFeedback({
          type: 'error',
          message: t('editor.errors.importBinary')
        });
        e.target.value = '';
        return;
      }

      // Tentar extrair título e conteúdo
      let title = '';
      let content = '';

      if (file.name.endsWith('.txt')) {
        // Arquivo TXT - primeira linha como título, resto como conteúdo
        const lines = fileContent.split('\n');
        title = lines[0] || '';
        content = lines.slice(1)
          .map(line => (line.trim() ? `<p>${line}</p>` : ''))
          .join('');
      } else {
        // Arquivo Word/HTML - tentar extrair conteúdo
        try {
          const parser = new DOMParser();
          const doc = parser.parseFromString(fileContent, 'text/html');

          // Tentar obter o título
          const titleElement = doc.querySelector('title') || doc.querySelector('h1');
          title = titleElement ? titleElement.textContent : '';

          // Obter o conteúdo do body
          const bodyElement = doc.querySelector('body');
          content = bodyElement ? bodyElement.innerHTML : fileContent;
        } catch (error) {
          console.error('Erro ao processar arquivo:', error);
          content = fileContent;
        }
      }

      setPostData(prev => ({
        ...prev,
        title: title || prev.title,
        content: content || prev.content
      }));

      // Atualizar o editor com o novo conteúdo
      if (editorRef.current && content) {
        editorRef.current.setData(content);
      }
      e.target.value = '';
    };

    reader.readAsText(file);
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
                  <button onClick={() => setShowMetadataEditor(!showMetadataEditor)}>
                    {showMetadataEditor ? t('editor.buttons.hideMetadata') : t('editor.buttons.showMetadata')}
                  </button>
                  <button onClick={handleExportWord}>{t('editor.buttons.exportWord')}</button>
                  <label className="file-input-label">
                    {t('editor.buttons.importFile')}
                    <input
                      type="file"
                      accept=".txt,.doc,.docx,.html"
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
              config={{
                // Plugins adicionais: upload de imagens (base64) e
                // preservação de largura/altura das imagens
                extraPlugins: [Base64UploadAdapterPlugin, ImageSizeAttributesPlugin],
                toolbar: EDITOR_TOOLBAR,
                image: EDITOR_IMAGE_CONFIG,
                table: EDITOR_TABLE_CONFIG,
                language: i18n.getLocale().split('-')[0]
              }}
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
      
      <ImageTools editor={editorInstance} />
      
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
