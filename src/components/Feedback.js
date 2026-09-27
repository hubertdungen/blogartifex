import React from 'react';
import { t } from '../services/I18nService';

/**
 * Componente de Feedback
 * 
 * Exibe mensagens de carregamento, erro ou sucesso de forma consistente
 */
function Feedback({ type, message, onDismiss }) {
  let className = 'feedback';
  
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