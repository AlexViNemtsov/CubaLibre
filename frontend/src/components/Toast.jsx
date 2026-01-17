import { useEffect } from 'react';
import './Toast.css';

function Toast({ message, type = 'success', onClose, duration = 3000 }) {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        if (onClose) onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  return (
    <div className={`toast toast-${type}`}>
      <div className="toast-content">
        {type === 'success' && '✓'}
        {type === 'error' && '✕'}
        {type === 'info' && 'ℹ'}
        <span className="toast-message">{message}</span>
      </div>
      {onClose && (
        <button className="toast-close" onClick={onClose}>×</button>
      )}
    </div>
  );
}

export default Toast;
