import React, { useEffect, useRef } from 'react';
import { t } from '../services/I18nService';

/**
 * Componente de Feedback
 * 
 * Exibe mensagens de carregamento, erro ou sucesso de forma consistente
 */
function Feedback({ type, message, onDismiss, duration, floating = false }) {
  // Messages with a duration close themselves (e.g. "saved" confirmations).
  // onDismiss is usually a new arrow on every render, so read it from a ref
  // instead of restarting the timer on each keystroke.
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;
  useEffect(() => {
    if (!duration) return undefined;
    const timer = setTimeout(() => dismissRef.current && dismissRef.current(), duration);
    return () => clearTimeout(timer);
  }, [duration, message]);

  let className = floating ? 'feedback feedback-fixed' : 'feedback';
  
  // Definir classe CSS com base no tipo
  switch (type) {
    case 'loading':
      className += ' feedback-loading';
      break;
    case 'error':
      className += ' feedback-error';
      break;
    case 'success':
      className += ' feedback-success';
      break;
    case 'warning':
      className += ' feedback-warning';
      break;
    default:
      className += ' feedback-info';
  }
  
  // Função para fechar o feedback (quando aplicável)
  const handleDismiss = () => {
    if (onDismiss && typeof onDismiss === 'function') {
      onDismiss();
    }
  };
  
  return (
    <div className={className}>
      {type === 'loading' && <div className="feedback-spinner"></div>}
      
      <div className="feedback-message">
        {message || (type === 'loading' ? t('common.loading') : t('common.unexpectedError'))}
      </div>
      
      {type !== 'loading' && onDismiss && (
        <button 
          className="feedback-dismiss" 
          onClick={handleDismiss}
          aria-label="Fechar"
        >
          ×
        </button>
      )}
    </div>
  );
}

export default Feedback;