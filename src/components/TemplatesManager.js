import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { CKEditor } from '@ckeditor/ckeditor5-react';
import ClassicEditor from '@ckeditor/ckeditor5-build-classic';
import { saveAs } from 'file-saver';
import Feedback from './Feedback';
import i18n, { t } from '../services/I18nService';
import { getStoredJson } from '../utils/storage';

/**
 * Componente de Gerenciamento de Templates
 * 
 * Permite ao usuário:
 * - Criar novos templates
 * - Editar templates existentes
 * - Excluir templates
 * - Exportar e importar templates
 */
function TemplatesManager({ theme }) {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const editorRef = useRef(null);
  const [, setLocale] = useState(i18n.getLocale());

  useEffect(() => {
    const remove = i18n.addListener(setLocale);
    return remove;
  }, []);
  
  // Carregar templates salvos no localStorage ao montar o componente
  useEffect(() => {
    loadTemplates();
  }, []);
  
  /**
   * Carrega os templates do localStorage
   */
  const loadTemplates = () => {
    try {
      const savedTemplates = getStoredJson('blogartifex_templates', []);
      setTemplates(savedTemplates);
    } catch (error) {
      console.error('Erro ao carregar templates:', error);
      setTemplates([]);
        setFeedback({
          type: 'error',
          message: t('templates.notifications.loadError')
        });
    }
  };
  
  /**
   * Seleciona um template para edição
   */
  const handleSelectTemplate = (template) => {
    setSelectedTemplate(template);
    setTemplateName(template.name);
    setTemplateDescription(template.description || '');
    setIsEditing(true);
  };
  
  /**
   * Inicia a criação de um novo template
   */
  const handleCreateTemplate = () => {
      const newTemplate = {
        id: Date.now(),
        name: t('templates.newTemplate'),
        description: '',
        content: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      setSelectedTemplate(newTemplate);
      setTemplateName(t('templates.newTemplate'));
      setTemplateDescription('');
    setIsEditing(true);
  };
  
  /**
   * Salva o template atual (novo ou editado)
   */
  const handleSaveTemplate = () => {
    if (!templateName.trim()) {
      setFeedback({
        type: 'error',
        message: t('templates.notifications.nameRequired')
      });
      return;
    }
    
    if (!editorRef.current || !editorRef.current.getData) {
      setFeedback({
        type: 'error',
        message: t('templates.notifications.editorNotReady')
      });
      return;
    }
    
    const content = editorRef.current.getData();
    
    if (!content.trim()) {
      setFeedback({
        type: 'error',
        message: t('templates.notifications.contentRequired')
      });
      return;
    }
    
    const updatedTemplate = {
      ...selectedTemplate,
      name: templateName.trim(),
      description: templateDescription.trim(),
      content: content,
      updatedAt: new Date().toISOString()
    };
    
    let updatedTemplates;
    
    if (templates.some(t => t.id === updatedTemplate.id)) {
      // Atualizar template existente
      updatedTemplates = templates.map(t => 
        t.id === updatedTemplate.id ? updatedTemplate : t
      );
    } else {
      // Adicionar novo template
      updatedTemplates = [...templates, updatedTemplate];
    }
    
    // Salvar no localStorage
    localStorage.setItem('blogartifex_templates', JSON.stringify(updatedTemplates));
    
    // Atualizar estado
    setTemplates(updatedTemplates);
    setSelectedTemplate(updatedTemplate);
    
    setFeedback({
      type: 'success',
      message: t('templates.notifications.saved'),
      duration: 3000
    });
  };
  
  /**
   * Exclui um template
   */
  const handleDeleteTemplate = (templateId) => {
    if (!window.confirm(t('templates.actions.confirmDelete'))) {
      return;
    }
    
    const updatedTemplates = templates.filter(t => t.id !== templateId);
    
    // Salvar no localStorage
    localStorage.setItem('blogartifex_templates', JSON.stringify(updatedTemplates));
    
    // Atualizar estado
    setTemplates(updatedTemplates);
    
    if (selectedTemplate && selectedTemplate.id === templateId) {
      setSelectedTemplate(null);
      setTemplateName('');
      setTemplateDescription('');
      setIsEditing(false);
    }
    
    setFeedback({
      type: 'success',
      message: t('templates.notifications.deleted'),
      duration: 3000
    });
  };
  
  /**
   * Exporta um template para arquivo JSON
   */
  const handleExportTemplate = (template) => {
    const templateData = JSON.stringify(template, null, 2);
    const blob = new Blob([templateData], { type: 'application/json' });
    saveAs(blob, `template-${template.name.toLowerCase().replace(/\s+/g, '-')}.json`);
  };
  
  /**
   * Exporta todos os templates para arquivo JSON
   */
  const handleExportAllTemplates = () => {
    if (templates.length === 0) {
      setFeedback({
        type: 'error',
        message: t('templates.notifications.noTemplatesExport')
      });
      return;
    }
    
    const templatesData = JSON.stringify(templates, null, 2);
    const blob = new Blob([templatesData], { type: 'application/json' });
    saveAs(blob, `blogartifex-templates.json`);
  };
  
  /**
   * Importa templates de um arquivo JSON
   */
  const handleImportTemplates = (e) => {
    const file = e.target.files[0];
    
    if (!file) return;
    
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target.result);
        
        // Verificar se é um array ou um único template
        if (Array.isArray(importedData)) {
          // Validar cada template
          const validTemplates = importedData.filter(template => 
            template.id && template.name && template.content
          );
          
          if (validTemplates.length === 0) {
            setFeedback({
              type: 'error',
              message: t('templates.importDialog.noValidTemplates')
            });
            return;
          }
          
          // Perguntar se deseja substituir ou mesclar
          const shouldReplace = window.confirm(
            t('templates.importDialog.replaceOrMerge', { count: validTemplates.length }) + ' ' +
            t('templates.importDialog.replaceConfirm')
          );
          
          let updatedTemplates;
          
          if (shouldReplace) {
            // Substituir todos os templates
            updatedTemplates = [...validTemplates];
          } else {
            // Mesclar, mantendo os templates existentes que não têm IDs conflitantes
            const existingIds = templates.map(t => t.id);
            
            // Filtrar templates importados que não têm ID conflitante
            const nonConflictingTemplates = validTemplates.filter(
              t => !existingIds.includes(t.id)
            );
            
            // Verificar se há conflitos e perguntar o que fazer com eles
            const conflictingTemplates = validTemplates.filter(
              t => existingIds.includes(t.id)
            );
            
            if (conflictingTemplates.length > 0) {
              const shouldOverwrite = window.confirm(
                t('templates.importDialog.conflictDetected', { count: conflictingTemplates.length }) + ' ' +
                t('templates.importDialog.conflictAction') + ' ' +
                t('templates.importDialog.conflictConfirm')
              );
              
              if (shouldOverwrite) {
                // Criar um mapa com os templates importados para substituição
                const importMap = Object.fromEntries(
                  validTemplates.map(t => [t.id, t])
                );
                
                // Substituir templates existentes com os importados quando houver ID igual
                updatedTemplates = [
                  ...templates.map(t => importMap[t.id] || t),
                  ...nonConflictingTemplates
                ];
              } else {
                // Manter templates existentes e adicionar apenas os não conflitantes
                updatedTemplates = [...templates, ...nonConflictingTemplates];
              }
            } else {
              // Nenhum conflito, simplesmente adicionar os novos templates
              updatedTemplates = [...templates, ...validTemplates];
            }
          }
          
          // Salvar no localStorage
          localStorage.setItem('blogartifex_templates', JSON.stringify(updatedTemplates));
          
          // Atualizar estado
          setTemplates(updatedTemplates);
          
          setFeedback({
            type: 'success',
        message: t('templates.importDialog.importSuccess', { count: validTemplates.length }),
            duration: 3000
          });
        } else if (importedData.id && importedData.name && importedData.content) {
          // É um único template
          const newTemplate = {
            ...importedData,
            // Gerar um novo ID para evitar conflitos
            id: Date.now(),
            updatedAt: new Date().toISOString()
          };
          
          const updatedTemplates = [...templates, newTemplate];
          
          // Salvar no localStorage
          localStorage.setItem('blogartifex_templates', JSON.stringify(updatedTemplates));
          
          // Atualizar estado
          setTemplates(updatedTemplates);
          
          setFeedback({
            type: 'success',
          message: t('templates.notifications.saved'),
            duration: 3000
          });
        } else {
        setFeedback({
          type: 'error',
          message: t('templates.importDialog.noValidTemplates')
        });
        }
      } catch (error) {
        console.error('Erro ao importar templates:', error);
        setFeedback({
          type: 'error',
          message: t('templates.importDialog.importError', { message: t('templates.importDialog.invalidJson') })
        });
      }
    };
    
    reader.readAsText(file);
  };
  
  /**
   * Cancela a edição do template atual
   */
  const handleCancelEdit = () => {
    if (window.confirm(t('templates.actions.cancelConfirm'))) {
      setSelectedTemplate(null);
      setTemplateName('');
      setTemplateDescription('');
      setIsEditing(false);
    }
  };
  
  /**
   * Usa o template atual para criar um novo post
   */
  const handleUseTemplate = (template) => {
    navigate('/editor', { state: { 
      content: template.content,
      fromTemplate: template.id
    }});
  };
  
  /**
   * Formata a data para exibição
   */
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString(i18n.getLocale(), {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  return (
    <div className="templates-content">
      <div className="templates-header">
        <h1>{t('templates.title')}</h1>
        
        <div className="templates-actions">
          <button
            className="create-template-button"
            onClick={handleCreateTemplate}
            disabled={isEditing}
          >
            {t('templates.createNew')}
          </button>
          
          <button
            className="export-all-button"
            onClick={handleExportAllTemplates}
            disabled={templates.length === 0}
          >
            {t('templates.exportAll')}
          </button>
          
          <label className="import-button">
            {t('templates.importTemplates')}
            <input
              type="file"
              accept=".json"
              onChange={handleImportTemplates}
              style={{ display: 'none' }}
            />
          </label>
        </div>
      </div>
      
      {feedback && (
        <Feedback 
          type={feedback.type} 
          message={feedback.message} 
          onDismiss={() => setFeedback(null)}
        />
      )}
      
      <div className="templates-layout">
        <div className="templates-list">
          <h2>{t('templates.availableTemplates', { count: templates.length })}</h2>
          
          {templates.length === 0 ? (
            <div className="templates-empty">
              <p>{t('templates.noTemplates')}</p>
              <p>{t('templates.createOrImport')}</p>
            </div>
          ) : (
            templates.map(template => (
              <div 
                key={template.id} 
                className={`template-item ${selectedTemplate && selectedTemplate.id === template.id ? 'selected' : ''}`}
              >
                <div className="template-info" onClick={() => handleSelectTemplate(template)}>
                  <h3>{template.name}</h3>
                  {template.description && (
                    <p className="template-description">{template.description}</p>
                  )}
                  <p className="template-date">
                    Atualizado em: {formatDate(template.updatedAt || template.createdAt)}
                  </p>
                </div>
                
                <div className="template-actions">
                  <button
                    className="use-template-button"
                    onClick={() => handleUseTemplate(template)}
                    title={t('templates.actions.use')}
                  >
                    {t('templates.actions.use')}
                  </button>
                  
                  <button
                    className="export-template-button"
                    onClick={() => handleExportTemplate(template)}
                    title={t('templates.actions.export')}
                  >
                    {t('templates.actions.export')}
                  </button>
                  
                  <button 
                    className="delete-template-button"
                    onClick={() => handleDeleteTemplate(template.id)}
                    title={t('templates.actions.delete')}
                  >
                    {t('templates.actions.delete')}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
        
        {isEditing && selectedTemplate && (
          <div className="template-editor">
            <div className="template-editor-header">
              <h2>{selectedTemplate.id ? t('templates.editTemplate') : t('templates.newTemplate')}</h2>
              
              <div className="template-editor-actions">
                <button 
                  className="save-template-button"
                  onClick={handleSaveTemplate}
                >
                  {t('templates.actions.save')}
                </button>
                
                <button
                  className="cancel-edit-button"
                  onClick={handleCancelEdit}
                >
                  {t('templates.actions.cancel')}
                </button>
              </div>
            </div>
            
            <div className="template-form">
              <div className="template-form-field">
                <label htmlFor="template-name">{t('templates.templateName')}</label>
                <input
                  id="template-name"
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder={t('templates.placeholders.name')}
                  required
                />
              </div>
              
              <div className="template-form-field">
                <label htmlFor="template-description">{t('templates.templateDescription')}</label>
                <input
                  id="template-description"
                  type="text"
                  value={templateDescription}
                  onChange={(e) => setTemplateDescription(e.target.value)}
                  placeholder={t('templates.placeholders.description')}
                />
              </div>
              
              <div className="template-editor-content">
                <label>{t('templates.templateContent')}</label>
                <CKEditor
                  editor={ClassicEditor}
                  data={selectedTemplate.content}
                  onReady={editor => {
                    // Armazenar referência ao editor
                    editorRef.current = editor;
                    
                    // Configurações adicionais
                    editor.ui.view.editable.element.style.minHeight = '400px';
                  }}
                  onChange={(event, editor) => {
                    // Nada a fazer aqui, salvamos apenas quando o usuário clica em salvar
                  }}
                  config={{
                    toolbar: [
                      'heading',
                      '|',
                      'bold', 'italic', 'strikethrough', 'underline',
                      '|',
                      'link', 'bulletedList', 'numberedList',
                      '|',
                      'indent', 'outdent',
                      '|',
                      'blockQuote', 'insertTable',
                      '|',
                      'undo', 'redo'
                    ],
                    language: i18n.getLocale().split('-')[0]
                  }}
                />
              </div>
            </div>
          </div>
        )}
        
        {!isEditing && (
          <div className="template-preview">
            <h2>{t('templates.selectToEdit')}</h2>
            <p>{t('templates.orCreateNew')}</p>
            
            <div className="template-tips">
              <h3>{t('templates.tips.title')}</h3>
              <ul>
                {t('templates.tips.items').map((tip, idx) => (
                  <li key={idx}>{tip}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default TemplatesManager;
