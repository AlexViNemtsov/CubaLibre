import { useEffect, useState } from 'react';
import { getUser } from '../utils/telegram';
import './SubscriptionGate.css';

const API_URL = import.meta.env.DEV
  ? 'http://localhost:3000/api'
  : (import.meta.env.VITE_API_URL || 'https://cubalibre.onrender.com/api');
const REQUIRED_CHANNEL = '@CubaClasificados';

function SubscriptionGate({ children }) {
  const [isSubscribed, setIsSubscribed] = useState(null); // null = проверка, true = подписан, false = не подписан
  const [isChecking, setIsChecking] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    checkSubscription();
  }, []);

  const checkSubscription = async (showLoading = false) => {
    if (showLoading) {
      setIsVerifying(true);
      setErrorMessage(null);
    }
    
    try {
      // Даем время Telegram Web App инициализироваться
      await new Promise(resolve => setTimeout(resolve, 500));
      
      let user = getUser();
      console.log('🔍 Checking subscription, user from getUser():', user);
      
      // Пытаемся получить пользователя напрямую из Telegram WebApp если getUser() не сработал
      if ((!user || !user.id) && typeof window !== 'undefined' && window.Telegram && window.Telegram.WebApp) {
        const webApp = window.Telegram.WebApp;
        const telegramUser = webApp.initDataUnsafe?.user;
        console.log('🔍 Trying to get user from window.Telegram.WebApp:', telegramUser);
        
        if (telegramUser && telegramUser.id) {
          console.log('✅ Got user from Telegram WebApp directly:', telegramUser);
          user = telegramUser;
        }
      }
      
      if (!user || !user.id) {
        console.warn('⚠️  No user data available');
        // В режиме разработки разрешаем доступ
        if (import.meta.env.DEV) {
          console.warn('⚠️  Development mode: Allowing access without user check');
          setIsSubscribed(true);
          setIsChecking(false);
          setIsVerifying(false);
          return;
        }
        // В production требуем пользователя - это важно для безопасности
        setIsSubscribed(false);
        setIsChecking(false);
        setIsVerifying(false);
        setErrorMessage('No se pudo obtener la información del usuario. Por favor, abre la aplicación desde Telegram.');
        return;
      }

      console.log('📡 Sending request to:', `${API_URL}/subscription/check`);
      console.log('👤 User ID:', user.id, 'Type:', typeof user.id);

      // Убеждаемся, что userId - это число
      const userId = typeof user.id === 'string' ? parseInt(user.id, 10) : user.id;
      
      if (isNaN(userId)) {
        console.error('Invalid user ID:', user.id);
        throw new Error('Invalid user ID format');
      }

      const response = await fetch(`${API_URL}/subscription/check`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: userId }),
      });

      console.log('📥 Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.error('❌ Subscription API non-OK response:', {
          status: response.status,
          statusText: response.statusText,
          bodyPreview: errorText.slice(0, 200)
        });

        // Не блокируем пользователей, если проверка подписки недоступна/сломалась
        console.warn('⚠️ Subscription check failed (non-OK). Allowing access.');
        setIsSubscribed(true);
        setErrorMessage(null);
        return;
      }

      const data = await response.json();
      console.log('✅ Subscription check result:', data);
      
      setIsSubscribed(data.subscribed || false);
      
      if (!data.subscribed && data.error) {
        setErrorMessage(data.error);
      } else {
        setErrorMessage(null);
      }
    } catch (error) {
      console.error('❌ Error checking subscription:', error);
      console.error('Error details:', error.message, error.stack);
      
      // Не блокируем пользователей, если проверка подписки недоступна/сломалась
      console.warn('⚠️ Subscription check threw error. Allowing access.', error.message);
      setIsSubscribed(true);
      setErrorMessage(null);
    } finally {
      setIsChecking(false);
      setIsVerifying(false);
    }
  };

  const handleSubscribe = () => {
    window.open(`https://t.me/${REQUIRED_CHANNEL.replace('@', '')}`, '_blank');
    // Проверяем подписку через 2 секунды после открытия канала
    setTimeout(() => {
      checkSubscription();
    }, 2000);
  };

  if (isChecking) {
    return (
      <div className="subscription-gate">
        <div className="subscription-checking">
          <div className="spinner"></div>
          <p>Verificando suscripción...</p>
        </div>
      </div>
    );
  }

  if (!isSubscribed) {
    return (
      <div className="subscription-gate">
        <div className="subscription-required">
          <div className="subscription-icon">📢</div>
          <h2>Suscríbete al canal</h2>
          <p>
            Para usar esta aplicación, necesitas estar suscrito a nuestro canal:
          </p>
          <div className="channel-name">{REQUIRED_CHANNEL}</div>
          <button 
            className="btn-subscribe" 
            onClick={handleSubscribe}
            disabled={isVerifying}
          >
            📢 Suscribirse al canal
          </button>
          <button 
            className="btn-check" 
            onClick={() => checkSubscription(true)}
            disabled={isVerifying}
            style={{ 
              opacity: isVerifying ? 0.6 : 1,
              cursor: isVerifying ? 'wait' : 'pointer'
            }}
          >
            {isVerifying ? '⏳ Verificando...' : '🔄 Ya me suscribí, verificar'}
          </button>
          {errorMessage && (
            <p style={{ 
              color: '#dc3545', 
              fontSize: '13px', 
              marginTop: '12px',
              padding: '8px',
              background: 'rgba(220, 53, 69, 0.1)',
              borderRadius: '8px'
            }}>
              ⚠️ {errorMessage}
            </p>
          )}
          <p className="subscription-hint">
            Después de suscribirte, presiona el botón de verificación
          </p>
        </div>
      </div>
    );
  }

  return children;
}

export default SubscriptionGate;
