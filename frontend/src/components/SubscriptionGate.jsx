import { useEffect, useState } from 'react';
import { getUser } from '../utils/telegram';
import './SubscriptionGate.css';

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3000/api' : '/api');
const REQUIRED_CHANNEL = '@CubaClasificados';

function SubscriptionGate({ children }) {
  const [isSubscribed, setIsSubscribed] = useState(null); // null = проверка, true = подписан, false = не подписан
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    checkSubscription();
  }, []);

  const checkSubscription = async () => {
    try {
      const user = getUser();
      if (!user || !user.id) {
        // В режиме разработки разрешаем доступ
        if (import.meta.env.DEV) {
          console.warn('⚠️  Development mode: Allowing access without user check');
          setIsSubscribed(true);
          setIsChecking(false);
          return;
        }
        setIsSubscribed(false);
        setIsChecking(false);
        return;
      }

      const response = await fetch(`${API_URL}/subscription/check`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.id }),
      });

      const data = await response.json();
      setIsSubscribed(data.subscribed || false);
    } catch (error) {
      console.error('Error checking subscription:', error);
      // В режиме разработки разрешаем доступ при ошибке
      if (import.meta.env.DEV) {
        setIsSubscribed(true);
      } else {
        setIsSubscribed(false);
      }
    } finally {
      setIsChecking(false);
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
          <button className="btn-subscribe" onClick={handleSubscribe}>
            📢 Suscribirse al canal
          </button>
          <button className="btn-check" onClick={checkSubscription}>
            🔄 Ya me suscribí, verificar
          </button>
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
