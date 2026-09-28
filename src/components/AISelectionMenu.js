import React, { useCallback, useEffect, useRef, useState } from 'react';
import AIService, { isAIConfigured } from '../services/AIService';
import i18n, { t } from '../services/I18nService';

/**
 * AISelectionMenu - Floating tooltip shown when the user selects text
 * inside the editor. Offers one-click AI corrections (improve, fix
 * grammar, shorten, expand) plus a free-form "ask AI" instruction that
 * rewrites the selected fragment in place.
 */
function AISelectionMenu({ editor, getTitle, onFeedback }) {
  const [position, setPosition] = useState(null);
  const [busy, setBusy] = useState(false);
  const [askMode, setAskMode] = useState(false);
  const [instruction, setInstruction] = useState('');
  const menuRef = useRef(null);
  const busyRef = useRef(false);

  const hide = useCallback(() => {
    setPosition(null);
    setAskMode(false);
    setInstruction('');
  }, []);

  // Track the selection inside the CKEditor editable and position the
  // tooltip above it.
  useEffect(() => {
    const updateFromSelection = () => {
      if (busyRef.current) return;

      if (!editor || editor.state === 'destroyed' || !isAIConfigured()) {
        hide();
        return;
      }

      const modelSelection = editor.model.document.selection;
      if (modelSelection.isCollapsed) {
        // Keep the menu open while the user types into the ask box.
        if (!menuRef.current || !menuRef.current.contains(document.activeElement)) {
          hide();
        }
        return;
      }

      const domSelection = window.getSelection();
      if (!domSelection || domSelection.rangeCount === 0) return;

      const editableElement = editor.ui.view.editable.element;
      if (!editableElement || !editableElement.contains(domSelection.anchorNode)) return;

      const rect = domSelection.getRangeAt(0).getBoundingClientRect();
      if (!rect || (rect.width === 0 && rect.height === 0)) return;

      setPosition({
        top: rect.top + window.scrollY - 8,
        left: rect.left + window.scrollX + rect.width / 2
      });
    };

    let removeCKListener = null;

    if (editor && editor.model) {
      const selection = editor.model.document.selection;
      const handler = () => setTimeout(updateFromSelection, 0);
      selection.on('change:range', handler);
      removeCKListener = () => selection.off('change:range', handler);
    }

    document.addEventListener('selectionchange', updateFromSelection);
    window.addEventListener('scroll', hide, true);

    return () => {
      document.removeEventListener('selectionchange', updateFromSelection);
      window.removeEventListener('scroll', hide, true);
      if (removeCKListener) removeCKListener();
    };
  }, [editor, hide]);

  const getSelectionHtml = () => {
    if (!editor) return '';
    try {
      const fragment = editor.model.getSelectedContent(editor.model.document.selection);
      return editor.data.stringify(fragment);
    } catch {
      return '';
    }
  };

  const replaceRange = (html, range) => {
    if (!editor || editor.state === 'destroyed') return false;
    const viewFragment = editor.data.processor.toView(html);
    const modelFragment = editor.data.toModel(viewFragment);
    editor.model.insertContent(modelFragment, range);
    return true;
  };

  const runInstruction = async (instructionText) => {
    if (!editor || editor.state === 'destroyed' || busy) return;

    const selectionHtml = getSelectionHtml();
    if (!selectionHtml.trim()) {
      hide();
      return;
    }

    setBusy(true);
    busyRef.current = true;
    // The reply can take a while and the user may keep typing: a live range
    // follows edits, so the rewrite replaces the text that was sent.
    const targetRange = editor.model.createLiveRange(editor.model.document.selection.getFirstRange());

    try {
      const replacement = await AIService.transformSelection({
        selectionHtml,
        instruction: instructionText,
        title: getTitle ? getTitle() : '',
        locale: i18n.getLocale()
      });

      replaceRange(replacement, targetRange);
      if (onFeedback) {
        onFeedback({ type: 'success', message: t('ai.selection.applied'), duration: 3000 });
      }
    } catch (error) {
      if (onFeedback) {
        onFeedback({ type: 'error', message: t('ai.chat.error', { message: error.message }) });
      }
    } finally {
      targetRange.detach();
      setBusy(false);
      busyRef.current = false;
      hide();
    }
  };

  const handleAskSubmit = (e) => {
    e.preventDefault();
    if (instruction.trim()) {
      runInstruction(instruction.trim());
    }
  };

  if (!position) return null;

  const actions = [
    { id: 'improve', prompt: t('ai.selectionPrompts.improve') },
    { id: 'grammar', prompt: t('ai.selectionPrompts.grammar') },
    { id: 'shorten', prompt: t('ai.selectionPrompts.shorten') },
    { id: 'expand', prompt: t('ai.selectionPrompts.expand') }
  ];

  return (
    <div
      ref={menuRef}
      className="ai-selection-menu"
      style={{ top: position.top, left: position.left }}
      // Prevent the editor from losing its selection when clicking here.
      onMouseDown={(e) => e.preventDefault()}
      role="toolbar"
      aria-label={t('ai.selection.label')}
    >
      {busy ? (
        <div className="ai-selection-busy">
          <span className="ai-typing"><i /><i /><i /></span>
          <span>{t('ai.selection.working')}</span>
        </div>
      ) : askMode ? (
        <form className="ai-selection-ask" onSubmit={handleAskSubmit}>
          <input
            autoFocus
            type="text"
            value={instruction}
            placeholder={t('ai.selection.askPlaceholder')}
            onChange={(e) => setInstruction(e.target.value)}
            // Allow typing: the input receives focus, so re-enable mousedown.
            onMouseDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Escape') hide();
            }}
          />
          <button type="submit" disabled={!instruction.trim()}>
            {t('ai.chat.send')}
          </button>
        </form>
      ) : (
        <>
          {actions.map(action => (
            <button
              key={action.id}
              type="button"
              className="ai-selection-button"
              onClick={() => runInstruction(action.prompt)}
            >
              {t(`ai.selectionActions.${action.id}`)}
            </button>
          ))}
          <button
            type="button"
            className="ai-selection-button ask"
            onClick={() => setAskMode(true)}
          >
            <span role="img" aria-label="AI">✨</span> {t('ai.selectionActions.ask')}
          </button>
        </>
      )}
    </div>
  );
}

export default AISelectionMenu;
