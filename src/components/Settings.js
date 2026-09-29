import React, { useState, useEffect } from 'react';
import { googleLogout } from '@react-oauth/google';
import { useNavigate } from 'react-router-dom';
import AuthService from '../services/AuthService';
import BloggerService from '../services/BloggerService';

// Importar o serviço de internacionalização
import i18n, { LOCALES, t } from '../services/I18nService';
import { getStoredJson } from '../utils/storage';
import AIService, { AI_PROVIDERS, getAISettings, saveAISettings, getCachedModels, modelListIsStale, refreshModels } from '../services/AIService';

/**
 * Componente Settings - Configurações da aplicação
 * 
 * Permite ao utilizador configurar:
 * - Blog padrão
 * - Template padrão
 * - Intervalo de salvamento automático
 * - Backup automático
 * - Preferências visuais
 * - Idioma da interface
 */
function Settings({ theme, toggleTheme }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [blogs, setBlogs] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [language, setLanguage] = useState(i18n.getLocale());
  const [settings, setSettings] = useState({
    defaultBlogId: '',
    defaultTemplate: '',
    autoSaveInterval: 5,
    autoBackup: true,
    confirmBeforeDelete: true,
    defaultPublishStatus: 'draft',
    wideLayout: false,
    contentAlignment: 'center',
    showDebugger: false
  });
  const [error, setError] = useState(null);

  // Definições do assistente de IA
  const [aiSettings, setAISettings] = useState(getAISettings());
  const [showApiKey, setShowApiKey] = useState(false);
  // Live model list of the selected AI provider (see refreshModels)
  const [modelInfo, setModelInfo] = useState({});
  const [modelsState, setModelsState] = useState({ status: 'idle', message: '' });
  const [aiTestState, setAITestState] = useState({ status: 'idle', message: '' });

  // Carregar configurações e dados ao montar o componente
  useEffect(() => {
    loadSettings();
    loadBlogs();
    loadTemplates();
  }, []);

  /**
   * Carrega as configurações salvas
   */
  const loadSettings = () => {
    try {
      const savedSettings = getStoredJson('blogartifex_settings', {});
      
      setSettings({
        defaultBlogId: savedSettings.defaultBlogId || '',
        defaultTemplate: savedSettings.defaultTemplate || '',
        autoSaveInterval: savedSettings.autoSaveInterval || 5,
        autoBackup: savedSettings.autoBackup !== undefined ? savedSettings.autoBackup : true,
        confirmBeforeDelete: savedSettings.confirmBeforeDelete !== undefined ? savedSettings.confirmBeforeDelete : true,
        defaultPublishStatus: savedSettings.defaultPublishStatus || 'draft',
        wideLayout: savedSettings.wideLayout !== undefined ? savedSettings.wideLayout : false,
        contentAlignment: savedSettings.contentAlignment || 'center',
        showDebugger: savedSettings.showDebugger !== undefined ? savedSettings.showDebugger : false
      });
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
      setError(t('settings.confirmations.loadError'));
    }
  };

  /**
   * Carrega os blogs do utilizador
   */
  const loadBlogs = async () => {
    try {
      setLoading(true);
      
      const data = await BloggerService.getUserBlogs();
      
      if (data.items) {
        setBlogs(data.items);
      }
    } catch (error) {
      console.error('Erro ao buscar blogs:', error);
      setError(t('common.error', { message: error.message }));
    } finally {
      setLoading(false);
    }
  };

  /**
   * Carrega os templates salvos
   */
  const loadTemplates = () => {
    try {
      const savedTemplates = getStoredJson('blogartifex_templates', []);
      setTemplates(savedTemplates);
    } catch (error) {
      console.error('Erro ao carregar templates:', error);
      setTemplates([]);
    }
  };

  /**
   * Atualiza uma configuração
   */
  const handleSettingChange = (e, setting) => {
    const value =
      setting === 'autoBackup' || setting === 'confirmBeforeDelete' || setting === 'wideLayout' || setting === 'showDebugger'
        ? e.target.checked
        : setting === 'autoSaveInterval'
          ? parseInt(e.target.value, 10)
          : e.target.value;
    
    setSettings(prev => ({
      ...prev,
      [setting]: value
    }));
  };

  const handleAlignmentChange = (alignment) => {
    setSettings(prev => ({
      ...prev,
      contentAlignment: alignment
    }));
  };

  /**
   * Atualiza uma definição do assistente de IA
   */
  const currentAIKey = (aiSettings.apiKeys[aiSettings.provider] || '').trim();

  const loadModels = async (provider, key) => {
    setModelsState({ status: 'loading', message: '' });
    try {
      setModelInfo(await refreshModels(provider, key));
      setModelsState({ status: 'idle', message: '' });
    } catch (error) {
      setModelsState({ status: 'error', message: error.message });
    }
  };

  // Show the cached list at once; refresh it when older than a day and a
  // key is there (OpenRouter's list is public and needs none).
  useEffect(() => {
    const provider = aiSettings.provider;
    setModelInfo(getCachedModels(provider));
    setModelsState({ status: 'idle', message: '' });
    if (!modelListIsStale(provider) || (!currentAIKey && provider !== 'openrouter')) return undefined;
    const timer = setTimeout(() => loadModels(provider, currentAIKey), 800);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiSettings.provider, currentAIKey]);

  const handleAIChange = (field, value) => {
    setAITestState({ status: 'idle', message: '' });
    setAISettings(prev => {
      if (field === 'apiKey') {
        return { ...prev, apiKeys: { ...prev.apiKeys, [prev.provider]: value } };
      }
      if (field === 'model') {
        return { ...prev, models: { ...prev.models, [prev.provider]: value } };
      }
      return { ...prev, [field]: value };
    });
  };

  /**
   * Testa a ligação ao fornecedor de IA com as definições atuais
   */
  const handleTestAI = async () => {
    setAITestState({ status: 'testing', message: '' });
    // Guardar primeiro para que o serviço use as definições atuais
    saveAISettings(aiSettings);

    try {
      await AIService.testConnection();
      setAITestState({ status: 'success', message: t('ai.settings.testSuccess') });
    } catch (error) {
      setAITestState({ status: 'error', message: error.message });
    }
  };

  /**
   * Manipula a mudança de idioma
   */
  const handleLanguageChange = (e) => {
    const newLocale = e.target.value;
    setLanguage(newLocale);
  };

  /**
   * Salva as configurações
   */
  const handleSaveSettings = () => {
    try {
      // Salvar configurações gerais
      localStorage.setItem('blogartifex_settings', JSON.stringify(settings));
      // Notificar outros componentes sobre a atualização das configurações
      window.dispatchEvent(
        new CustomEvent('blogartifex_settings_update', {
          detail: {
            wideLayout: settings.wideLayout,
            contentAlignment: settings.contentAlignment,
            showDebugger: settings.showDebugger
          }
        })
      );

      // Salvar definições do assistente de IA
      saveAISettings(aiSettings);

      // Salvar idioma
      i18n.setLocale(language);

      // Notify application about settings update
      window.dispatchEvent(new Event('blogartifex_settings_updated'));

      alert(t('settings.confirmations.saveSuccess'));
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      alert(t('common.error', { message: error.message }));
    }
  };

  /**
   * Restaura as configurações padrão
   */
  const handleResetSettings = () => {
    if (window.confirm(t('settings.confirmations.resetConfirm'))) {
      const defaultSettings = {
        defaultBlogId: '',
        defaultTemplate: '',
        autoSaveInterval: 5,
        autoBackup: true,
        confirmBeforeDelete: true,
        defaultPublishStatus: 'draft',
        wideLayout: false,
        contentAlignment: 'center',
        showDebugger: false
      };

      setSettings(defaultSettings);
      localStorage.setItem('blogartifex_settings', JSON.stringify(defaultSettings));
      window.dispatchEvent(
        new CustomEvent('blogartifex_settings_update', {
          detail: {
            wideLayout: defaultSettings.wideLayout,
            contentAlignment: defaultSettings.contentAlignment,
            showDebugger: defaultSettings.showDebugger
          }
        })
      );
      window.dispatchEvent(new Event('blogartifex_settings_updated'));
      alert(t('settings.confirmations.resetSuccess'));
    }
  };

  /**
   * Limpa todos os dados locais
   */
  const handleClearData = () => {
    if (window.confirm(t('settings.confirmations.clearDataConfirm'))) {
      // Manter apenas o token de autenticação
      const token = localStorage.getItem('blogartifex_token');
      const currentLocale = i18n.getLocale(); // Preservar o idioma atual
      
      // Limpar localStorage
      localStorage.clear();
      
      // Restaurar o token e idioma
      if (token) {
        localStorage.setItem('blogartifex_token', token);
      }
      localStorage.setItem('blogartifex_locale', currentLocale);
      
      // Recarregar a página
      window.location.reload();
    }
  };

  /**
   * Realiza logout
   */
  const handleLogout = () => {
    if (window.confirm(t('auth.confirmLogout'))) {
      googleLogout();
      AuthService.clearAuthSession('Settings-logout');
      navigate('/');
    }
  };

  return (
    <div className="settings-content">
      <h1>{t('settings.title')}</h1>

      {loading ? (
        <div className="loading">{t('common.loading')}</div>
      ) : error ? (
        <div className="error-message">{t('common.error', { message: error })}</div>
      ) : (
        <div className="settings-form">
            <div className="setting-group">
              <h2>{t('settings.sections.general')}</h2>
              
              <div className="setting-item">
                <label htmlFor="defaultBlog">{t('settings.fields.defaultBlog')}</label>
                <select
                  id="defaultBlog"
                  value={settings.defaultBlogId}
                  onChange={(e) => handleSettingChange(e, 'defaultBlogId')}
                >
                  <option value="">{t('common.selectOption')}</option>
                  {blogs.map(blog => (
                    <option key={blog.id} value={blog.id}>{blog.name}</option>
                  ))}
                </select>
                <p className="setting-description">{t('settings.fields.defaultBlogDesc')}</p>
              </div>
              
              <div className="setting-item">
                <label htmlFor="defaultTemplate">{t('settings.fields.defaultTemplate')}</label>
                <select
                  id="defaultTemplate"
                  value={settings.defaultTemplate}
                  onChange={(e) => handleSettingChange(e, 'defaultTemplate')}
                >
                  <option value="">{t('editor.templates.none')}</option>
                  {templates.map(template => (
                    <option key={template.id} value={template.id}>{template.name}</option>
                  ))}
                </select>
                <p className="setting-description">{t('settings.fields.defaultTemplateDesc')}</p>
              </div>
              
              <div className="setting-item">
                <label htmlFor="defaultPublishStatus">{t('settings.fields.publishStatus')}</label>
                <select
                  id="defaultPublishStatus"
                  value={settings.defaultPublishStatus}
                  onChange={(e) => handleSettingChange(e, 'defaultPublishStatus')}
                >
                  <option value="draft">{t('dashboard.posts.status.draft')}</option>
                  <option value="publish">{t('dashboard.posts.status.published')}</option>
                  <option value="scheduled">{t('dashboard.posts.status.scheduled')}</option>
                </select>
                <p className="setting-description">{t('settings.fields.publishStatusDesc')}</p>
              </div>
            </div>
            
            <div className="setting-group">
              <h2>{t('settings.sections.autoSave')}</h2>
              
              <div className="setting-item">
                <label htmlFor="autoSaveInterval">{t('settings.fields.autoSaveInterval')}</label>
                <input
                  id="autoSaveInterval"
                  type="number"
                  min="1"
                  max="60"
                  value={settings.autoSaveInterval}
                  onChange={(e) => handleSettingChange(e, 'autoSaveInterval')}
                />
                <p className="setting-description">{t('settings.fields.autoSaveIntervalDesc')}</p>
              </div>
              
              <div className="setting-item">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={settings.autoBackup}
                    onChange={(e) => handleSettingChange(e, 'autoBackup')}
                  />
                  {t('settings.fields.autoBackup')}
                </label>
                <p className="setting-description">{t('settings.fields.autoBackupDesc')}</p>
              </div>
            </div>
            
            <div className="setting-group">
              <h2>{t('settings.sections.security')}</h2>
              
              <div className="setting-item">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={settings.confirmBeforeDelete}
                    onChange={(e) => handleSettingChange(e, 'confirmBeforeDelete')}
                  />
                  {t('settings.fields.confirmDelete')}
                </label>
                <p className="setting-description">{t('settings.fields.confirmDeleteDesc')}</p>
              </div>
            </div>
            
            <div className="setting-group">
              <h2>{t('settings.sections.appearance')}</h2>

              <div className="setting-item">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={settings.wideLayout}
                    onChange={(e) => handleSettingChange(e, 'wideLayout')}
                  />
                  {t('settings.fields.wideLayout')}
                </label>
                <p className="setting-description">{t('settings.fields.wideLayoutDesc')}</p>
              </div>

              <div className="setting-item">
                <label>{t('settings.fields.alignment')}</label>
                <div className="alignment-toggle">
                  <button
                    className={`alignment-button ${settings.contentAlignment === 'left' ? 'active' : ''}`}
                    onClick={() => handleAlignmentChange('left')}
                  >
                    {t('settings.fields.alignLeft')}
                  </button>
                  <button
                    className={`alignment-button ${settings.contentAlignment === 'center' ? 'active' : ''}`}
                    onClick={() => handleAlignmentChange('center')}
                  >
                    {t('settings.fields.alignCenter')}
                  </button>
                  <button
                    className={`alignment-button ${settings.contentAlignment === 'right' ? 'active' : ''}`}
                    onClick={() => handleAlignmentChange('right')}
                  >
                    {t('settings.fields.alignRight')}
                  </button>
                </div>
                <p className="setting-description">{t('settings.fields.alignmentDesc')}</p>
              </div>

              <div className="setting-item">
                <label>{t('settings.fields.theme')}</label>
                <div className="theme-toggle">
                  <button
                    className={`theme-button ${theme === 'light' ? 'active' : ''}`}
                    onClick={() => toggleTheme('light')}
                  >
                    {t('settings.fields.themeLight')}
                  </button>
                  <button 
                    className={`theme-button ${theme === 'dark' ? 'active' : ''}`}
                    onClick={() => toggleTheme('dark')}
                  >
                    {t('settings.fields.themeDark')}
                  </button>
                </div>
                <p className="setting-description">{t('settings.fields.themeDesc')}</p>
              </div>
              
              {/* Seleção de idioma */}
              <div className="setting-item">
                <label htmlFor="language">{t('settings.fields.language')}</label>
                <select
                  id="language"
                  value={language}
                  onChange={handleLanguageChange}
                >
                  <option value={LOCALES.PT_PT}>Português</option>
                  <option value={LOCALES.EN_US}>English</option>
                </select>
                <p className="setting-description">{t('settings.fields.languageDesc')}</p>
              </div>
            </div>
            <div className="setting-group">
              <h2>{t('ai.settings.section')}</h2>

              <div className="setting-item">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={aiSettings.enabled}
                    onChange={(e) => handleAIChange('enabled', e.target.checked)}
                  />
                  {t('ai.settings.enable')}
                </label>
                <p className="setting-description">{t('ai.settings.enableDesc')}</p>
              </div>

              {aiSettings.enabled && (
                <>
                  <div className="setting-item">
                    <label htmlFor="aiProvider">{t('ai.settings.provider')}</label>
                    <select
                      id="aiProvider"
                      value={aiSettings.provider}
                      onChange={(e) => handleAIChange('provider', e.target.value)}
                    >
                      {Object.values(AI_PROVIDERS).map(provider => (
                        <option key={provider.id} value={provider.id}>{provider.label}</option>
                      ))}
                    </select>
                    <p className="setting-description">{t('ai.settings.providerDesc')}</p>
                  </div>

                  <div className="setting-item">
                    <label htmlFor="aiApiKey">{t('ai.settings.apiKey')}</label>
                    <div className="ai-key-row">
                      <input
                        id="aiApiKey"
                        type={showApiKey ? 'text' : 'password'}
                        autoComplete="off"
                        value={aiSettings.apiKeys[aiSettings.provider] || ''}
                        placeholder={AI_PROVIDERS[aiSettings.provider].keyPlaceholder}
                        onChange={(e) => handleAIChange('apiKey', e.target.value)}
                      />
                      <button
                        type="button"
                        className="ai-key-toggle"
                        onClick={() => setShowApiKey(prev => !prev)}
                      >
                        {showApiKey ? t('ai.settings.hideKey') : t('ai.settings.showKey')}
                      </button>
                    </div>
                    <p className="setting-description">
                      {t('ai.settings.apiKeyDesc')}{' '}
                      <a
                        href={AI_PROVIDERS[aiSettings.provider].keyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {t('ai.settings.getKey')}
                      </a>
                    </p>
                  </div>

                  <div className="setting-item">
                    <label htmlFor="aiModel">{t('ai.settings.model')}</label>
                    <div className="ai-model-row">
                      <select
                        id="aiModel"
                        value={aiSettings.models[aiSettings.provider] || ''}
                        onChange={(e) => handleAIChange('model', e.target.value)}
                      >
                        <option value="">
                          {t('ai.settings.autoModel', { model: modelInfo.auto || AI_PROVIDERS[aiSettings.provider].defaultModel })}
                        </option>
                        {(() => {
                          const live = modelInfo.models && modelInfo.models.length
                            ? modelInfo.models
                            : AI_PROVIDERS[aiSettings.provider].models.map(id => ({ id }));
                          const chosen = aiSettings.models[aiSettings.provider];
                          const list = live.slice(0, 200);
                          if (chosen && !list.some(model => model.id === chosen)) list.unshift({ id: chosen });
                          return list.map(model => (
                            <option key={model.id} value={model.id}>
                              {model.free ? `${model.id} — ${t('ai.settings.free')}` : model.id}
                            </option>
                          ));
                        })()}
                      </select>
                      <button
                        type="button"
                        className="ai-models-refresh"
                        disabled={modelsState.status === 'loading' || (!currentAIKey && aiSettings.provider !== 'openrouter')}
                        onClick={() => loadModels(aiSettings.provider, currentAIKey)}
                        title={t('ai.settings.refreshModels')}
                      >
                        {modelsState.status === 'loading' ? '…' : '↻'}
                      </button>
                    </div>
                    <p className="setting-description">
                      {modelsState.status === 'error'
                        ? t('ai.settings.modelsError', { message: modelsState.message })
                        : modelInfo.at
                          ? t('ai.settings.modelsUpdated', { date: new Date(modelInfo.at).toLocaleString(i18n.getLocale()) })
                          : t('ai.settings.modelsNeedKey')}
                    </p>
                    <p className="setting-description">{t('ai.settings.modelDesc')}</p>
                  </div>

                  <div className="setting-item">
                    <label htmlFor="aiTone">{t('ai.settings.tone')}</label>
                    <select
                      id="aiTone"
                      value={aiSettings.tone || 'default'}
                      onChange={(e) => handleAIChange('tone', e.target.value)}
                    >
                      <option value="default">{t('ai.settings.toneOptions.default')}</option>
                      <option value="casual">{t('ai.settings.toneOptions.casual')}</option>
                      <option value="humorous">{t('ai.settings.toneOptions.humorous')}</option>
                      <option value="inspirational">{t('ai.settings.toneOptions.inspirational')}</option>
                      <option value="technical">{t('ai.settings.toneOptions.technical')}</option>
                      <option value="custom">{t('ai.settings.toneOptions.custom')}</option>
                    </select>
                    <p className="setting-description">{t('ai.settings.toneDesc')}</p>
                  </div>
                  
                  {aiSettings.tone === 'custom' && (
                    <div className="setting-item">
                      <label htmlFor="aiCustomTone">{t('ai.settings.customTone')}</label>
                      <input
                        id="aiCustomTone"
                        type="text"
                        value={aiSettings.customTone || ''}
                        placeholder={t('ai.settings.customToneDesc')}
                        onChange={(e) => handleAIChange('customTone', e.target.value)}
                      />
                    </div>
                  )}

                  <div className="setting-item">
                    <div className="ai-test-row">
                      <button
                        type="button"
                        className="ai-test-button"
                        onClick={handleTestAI}
                        disabled={aiTestState.status === 'testing' || !(aiSettings.apiKeys[aiSettings.provider] || '').trim()}
                      >
                        {aiTestState.status === 'testing' ? t('ai.settings.testing') : t('ai.settings.testConnection')}
                      </button>
                      {aiTestState.status === 'success' && (
                        <span className="ai-test-result success">✓ {aiTestState.message}</span>
                      )}
                      {aiTestState.status === 'error' && (
                        <span className="ai-test-result error">✗ {aiTestState.message}</span>
                      )}
                    </div>
                  </div>

                  <p className="ai-security-note">{t('ai.settings.securityNote')}</p>
                </>
              )}
            </div>

            <div className="setting-group">
              <h2>{t('settings.sections.debug')}</h2>

              <div className="setting-item">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={settings.showDebugger}
                    onChange={(e) => handleSettingChange(e, 'showDebugger')}
                  />
                  {t('settings.fields.showDebugger')}
                </label>
                <p className="setting-description">{t('settings.fields.showDebuggerDesc')}</p>
              </div>
            </div>

            <div className="setting-group">
              <h2>{t('settings.sections.dataManagement')}</h2>

              <div className="data-actions">
                <button className="reset-settings-button" onClick={handleResetSettings}>
                  {t('settings.buttons.reset')}
                </button>

                <button className="clear-data-button" onClick={handleClearData}>
                  {t('settings.buttons.clearData')}
                </button>
              </div>
            </div>
            
            <div className="setting-actions">
              <button className="save-settings-button" onClick={handleSaveSettings}>
                {t('settings.buttons.save')}
              </button>
              
              <button className="logout-button" onClick={handleLogout}>
                {t('auth.logout')}
              </button>
            </div>
          </div>
        )}
    </div>
  );
}

export default Settings;
