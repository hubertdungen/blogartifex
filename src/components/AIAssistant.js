import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import AIService, { getAISettings, getActiveModel, getActiveProvider, isAIConfigured } from '../services/AIService';
import i18n, { t } from '../services/I18nService';
import { getStoredJson } from '../utils/storage';

/**
 * AIAssistant - Chat panel docked next to the post editor.
 *
 * The user talks to the configured AI provider (GPT / Gemini / Claude).
 * The model can answer in chat and/or return actions that BlogArtifex
 * applies directly to the article: rewrite the document, insert HTML,
 * replace the current selection, change the title, insert/resize images.
 */
function AIAssistant({ getTitle, getContent, getSelectionHtml, applyAction, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [configured, setConfigured] = useState(isAIConfigured());
  const [settings, setSettings] = useState(getAISettings());
  const listRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const refresh = () => {
      setSettings(getAISettings());
      setConfigured(isAIConfigured());
    };
    window.addEventListener('blogartifex_ai_settings_updated', refresh);
    return () => window.removeEventListener('blogartifex_ai_settings_updated', refresh);
  }, []);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, busy]);

  const quickActions = [
    { id: 'improve', prompt: t('ai.quickPrompts.improve') },
    { id: 'grammar', prompt: t('ai.quickPrompts.grammar') },
    { id: 'continue', prompt: t('ai.quickPrompts.continue') },
    { id: 'summarize', prompt: t('ai.quickPrompts.summarize') },
    { id: 'titles', prompt: t('ai.quickPrompts.titles') },
    { id: 'images', prompt: t('ai.quickPrompts.images') }
  ];

  const send = async (userMessage) => {
    const text = (userMessage || '').trim();
    if (!text || busy) return;

    const nextMessages = [...messages, { role: 'user', content: text }];
    setMessages(nextMessages);
    setInput('');
    setBusy(true);

    try {
      const selectionHtml = getSelectionHtml ? getSelectionHtml() : '';
      const templates = getStoredJson('blogartifex_templates', []);
      const { reply, actions } = await AIService.chat({
        history: messages,
        userMessage: text,
        title: getTitle(),
        html: getContent(),
        selectionHtml,
        templates,
        locale: i18n.getLocale()
      });

      let appliedCount = 0;
      for (const action of actions) {
        if (applyAction(action)) {
          appliedCount += 1;
        }
      }

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: reply || (appliedCount > 0 ? t('ai.chat.changesApplied') : ''),
        applied: appliedCount
      }]);
    } catch (error) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '',
        error: error.message
      }]);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.focus();
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    send(input);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const provider = getActiveProvider(settings);

  return (
    <aside className="ai-panel" aria-label={t('ai.chat.title')}>
      <div className="ai-panel-header">
        <div className="ai-panel-title">
          <span className="ai-spark" aria-hidden="true">✨</span>
          <div>
            <strong>{t('ai.chat.title')}</strong>
            {configured && (
              <span className="ai-model-badge">{provider.label} · {getActiveModel(settings)}</span>
            )}
          </div>
        </div>
        <button type="button" className="ai-close-button" onClick={onClose} aria-label={t('common.cancel')}>
          ×
        </button>
      </div>

      {!configured ? (
        <div className="ai-not-configured">
          <p>{t('ai.chat.notConfigured')}</p>
          <Link to="/settings" className="ai-settings-link">
            {t('ai.chat.openSettings')}
          </Link>
        </div>
      ) : (
        <>
          <div className="ai-messages" ref={listRef}>
            {messages.length === 0 && (
              <div className="ai-empty-state">
                <p>{t('ai.chat.emptyState')}</p>
              </div>
            )}
            {messages.map((message, index) => (
              <div
                key={index}
                className={`ai-message ${message.role} ${message.error ? 'error' : ''}`}
              >
                {message.error ? (
                  <span>{t('ai.chat.error', { message: message.error })}</span>
                ) : (
                  <span>{message.content}</span>
                )}
                {message.applied > 0 && (
                  <span className="ai-applied-badge">
                    ✓ {t('ai.chat.changesApplied')}
                  </span>
                )}
              </div>
            ))}
            {busy && (
              <div className="ai-message assistant thinking">
                <span className="ai-typing">
                  <i /><i /><i />
                </span>
              </div>
            )}
          </div>

          <div className="ai-quick-actions">
            {quickActions.map(action => (
              <button
                key={action.id}
                type="button"
                className="ai-quick-button"
                disabled={busy}
                onClick={() => send(action.prompt)}
              >
                {t(`ai.quickActions.${action.id}`)}
              </button>
            ))}
          </div>

          <form className="ai-input-row" onSubmit={handleSubmit}>
            <textarea
              ref={inputRef}
              value={input}
              rows={2}
              placeholder={t('ai.chat.placeholder')}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={busy}
            />
            <button type="submit" className="ai-send-button" disabled={busy || !input.trim()}>
              {busy ? '…' : t('ai.chat.send')}
            </button>
          </form>
        </>
      )}
    </aside>
  );
}

export default AIAssistant;
