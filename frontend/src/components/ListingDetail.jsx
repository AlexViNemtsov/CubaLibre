import { useState, useEffect } from 'react';
import { getUser, getInitData, showConfirm } from '../utils/telegram';
import './ListingDetail.css';

// Определяем API URL
const getApiUrl = () => {
  if (import.meta.env.DEV) {
    return 'http://localhost:3000/api';
  }
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  return 'https://cubalibre.onrender.com/api';
};

const API_URL = getApiUrl();

// Базовый URL без /api для изображений
const getApiBaseUrl = () => {
  return (
    import.meta.env.VITE_API_URL?.replace('/api', '') ||
    (import.meta.env.DEV ? 'http://localhost:3000' : 'https://cubalibre.onrender.com')
  );
};

function ListingDetail({ listing, onBack, onEdit, onDelete, onSuccess }) {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isMarkingSold, setIsMarkingSold] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Проверяем, является ли текущий пользователь владельцем
  const currentUser = getUser();
  // Приводим к числу для сравнения, так как telegram_id может быть строкой или числом
  const currentUserId = currentUser ? Number(currentUser.id) : null;
  const listingTelegramId = listing.telegram_id ? Number(listing.telegram_id) : null;
  
  // В dev режиме показываем кнопки для всех объявлений (для тестирования)
  // В production только для владельца
  const isOwner = import.meta.env.DEV 
    ? true  // В dev режиме всегда показываем кнопки для тестирования
    : (currentUserId && listingTelegramId && currentUserId === listingTelegramId);
  
  // Проверяем, является ли пользователь администратором
  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const headers = {};
        const initData = getInitData();
        if (initData) {
          headers['X-Telegram-Init-Data'] = initData;
        }
        
        const response = await fetch(`${API_URL}/listings/check-admin`, {
          method: 'GET',
          headers
        });
        
        if (response.ok) {
          const data = await response.json();
          setIsAdmin(data.isAdmin || false);
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
        setIsAdmin(false);
      }
    };
    
    if (currentUser) {
      checkAdmin();
    }
  }, [currentUser]);
  
  // Для отладки
  if (import.meta.env.DEV) {
    console.log('ListingDetail - Owner check:', {
      currentUser,
      currentUserId,
      listingTelegramId,
      isOwner,
      isAdmin,
      listingId: listing.id,
      isDev: import.meta.env.DEV
    });
  }

  const getPhotos = () => {
    if (listing.photos && listing.photos.length > 0) {
      const apiBase = getApiBaseUrl();
      return listing.photos.map((photo) => {
        // Cloudinary или другой внешний CDN: полный URL начинается с http/https
        if (photo.startsWith('http://') || photo.startsWith('https://')) {
          // Это уже полный URL (Cloudinary, CDN и т.д.) - используем как есть
          return photo;
        }

        // Новый формат: относительный путь /uploads/... (локальное хранилище)
        if (photo.startsWith('/uploads')) {
          return `${apiBase}${photo}`;
        }

        // Старый формат: полный URL на домен reg.ru (legacy)
        if (photo.startsWith('http')) {
          try {
            const url = new URL(photo);
            if (url.hostname === 'cuba-clasificados.online') {
              return `${apiBase}${url.pathname}`;
            }
          } catch (e) {
            // Некорректный URL – отдаем как есть
          }
        }

        // Остальное – без изменений
        return photo;
      });
    }
    return ['/images/placeholder.svg'];
  };

  const photos = getPhotos();

  // Прокрутка вверх при монтировании компонента
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const formatPrice = () => {
    if (listing.is_negotiable) {
      return 'Negociable';
    }
    if (listing.price) {
      return `${listing.price} ${listing.currency || 'CUP'}`;
    }
    return 'Precio no especificado';
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffTime / (1000 * 60));

    if (diffMinutes < 1) return 'Hace un momento';
    if (diffMinutes < 60) return `Hace ${diffMinutes} ${diffMinutes === 1 ? 'minuto' : 'minutos'}`;
    if (diffHours < 24) return `Hace ${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`;
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return `Hace ${diffDays} ${diffDays === 1 ? 'día' : 'días'}`;
    if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return `Hace ${weeks} ${weeks === 1 ? 'semana' : 'semanas'}`;
    }
    if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return `Hace ${months} ${months === 1 ? 'mes' : 'meses'}`;
    }
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const getScopeBadge = () => {
    if (listing.scope === 'NEIGHBORHOOD') {
      return <span className="badge badge-neighborhood">📍 {listing.neighborhood || 'Barrio'}</span>;
    }
    if (listing.scope === 'CITY') {
      return <span className="badge badge-city">🏙 {listing.city}</span>;
    }
    return <span className="badge badge-country">🇨🇺 Toda Cuba</span>;
  };

  const getGoogleMapsUrl = () => {
    const parts = [];
    if (listing.landmark) parts.push(listing.landmark);
    if (listing.neighborhood) parts.push(listing.neighborhood);
    if (listing.city) parts.push(listing.city);
    parts.push('Cuba');
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts.join(', '))}`;
  };

  const handleTelegramClick = () => {
    // Используем contact_telegram из объявления или username пользователя
    const username = listing.contact_telegram || listing.username;
    if (username) {
      // Убираем @ если есть, и отправляем на Telegram
      const cleanUsername = username.replace('@', '').trim();
      if (cleanUsername) {
        window.open(`https://t.me/${cleanUsername}`, '_blank');
      }
    }
  };

  const handleWhatsAppClick = () => {
    const phone = listing.contact_whatsapp;
    if (phone) {
      window.open(`https://wa.me/${phone.replace(/[^0-9]/g, '')}`, '_blank');
    }
  };

  const handleEdit = () => {
    if (onEdit) {
      onEdit(listing);
    }
  };

  const handleMarkAsSold = async () => {
    const confirmed = window.confirm('¿Marcar este anuncio como vendido? El anuncio ya no se mostrará en las búsquedas, pero permanecerá en "Mis anuncios".');
    
    if (!confirmed) return;

    setIsMarkingSold(true);
    try {
      const headers = {
        'Content-Type': 'application/json'
      };
      const initData = getInitData();
      if (initData) {
        headers['X-Telegram-Init-Data'] = initData;
        // Парсим initData для логирования (без чувствительных данных)
        try {
          const urlParams = new URLSearchParams(initData);
          const userStr = urlParams.get('user');
          if (userStr) {
            const user = JSON.parse(userStr);
            console.log('Telegram user from initData (mark as sold):', {
              id: user.id,
              username: user.username,
              first_name: user.first_name
            });
          }
        } catch (e) {
          console.warn('Could not parse user from initData:', e);
        }
      } else {
        console.warn('⚠️ No initData available for mark as sold request');
      }

      console.log('Marking listing as sold:', listing.id);
      console.log('Listing owner (if available):', listing.telegram_id);
      console.log('API URL:', `${API_URL}/listings/${listing.id}/status`);
      console.log('Headers:', Object.keys(headers));

      const response = await fetch(`${API_URL}/listings/${listing.id}/status`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: 'sold' })
      });

      console.log('Mark as sold response status:', response.status);

      if (!response.ok) {
        let errorMessage = 'Error al marcar el anuncio como vendido';
        
        try {
          const errorData = await response.json();
          console.error('Mark as sold error:', errorData);
          errorMessage = errorData.error || errorMessage;
        } catch (parseError) {
          // Если не удалось распарсить JSON, используем статус
          console.error('Failed to parse error response:', parseError);
          if (response.status === 404) {
            errorMessage = 'El anuncio no fue encontrado';
          } else if (response.status === 403) {
            errorMessage = 'No tienes permiso para marcar este anuncio como vendido';
          } else if (response.status === 401) {
            errorMessage = 'Debes iniciar sesión para marcar anuncios como vendidos';
          } else {
            errorMessage = `Error ${response.status}: ${response.statusText || 'Error del servidor'}`;
          }
        }
        
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('Mark as sold success:', result);

      // Показываем уведомление об успехе
      if (onSuccess) {
        onSuccess('Anuncio marcado como vendido');
      }

      // Обновляем статус объявления локально
      if (onDelete) {
        onDelete(); // Используем onDelete для обновления списка
      } else {
        onBack();
      }
    } catch (error) {
      console.error('Error marking listing as sold:', error);
      alert(`Error al marcar el anuncio como vendido: ${error.message}. Por favor, intenta de nuevo.`);
    } finally {
      setIsMarkingSold(false);
    }
  };

  // Функция для получения ссылки на объявление
  const getListingUrl = () => {
    // Используем Web App URL из переменных окружения или текущий URL
    const webAppUrl = import.meta.env.VITE_WEB_APP_URL || 
                      (typeof window !== 'undefined' ? window.location.origin : 'https://cuba-clasificados.online');
    const url = `${webAppUrl}?listing=${listing.id}`;
    console.log('Generated listing URL:', url);
    return url;
  };

  // Функция для копирования ссылки в буфер обмена
  const handleShare = async () => {
    try {
      const url = getListingUrl();
      console.log('Sharing listing URL:', url);
      
      // Пробуем использовать Web Share API, если доступен
      if (navigator.share) {
        try {
          await navigator.share({
            title: listing.title,
            text: listing.description ? listing.description.substring(0, 100) + '...' : listing.title,
            url: url
          });
          console.log('Shared via Web Share API');
          return;
        } catch (shareError) {
          // Если пользователь отменил, не показываем ошибку
          if (shareError.name === 'AbortError') {
            console.log('Share cancelled by user');
            return;
          }
          console.warn('Web Share API failed, falling back to clipboard:', shareError);
        }
      }
      
      // Если Web Share API не доступен или не сработал, копируем в буфер обмена
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
        console.log('URL copied to clipboard');
        if (onSuccess) {
          onSuccess('¡Enlace copiado al portapapeles!');
        } else {
          alert('¡Enlace copiado al portapapeles!');
        }
      } else {
        // Fallback: показываем ссылку в prompt
        const copied = prompt('Copia este enlace:', url);
        if (copied) {
          if (onSuccess) {
            onSuccess('¡Enlace listo para compartir!');
          }
        }
      }
    } catch (error) {
      console.error('Error in handleShare:', error);
      const url = getListingUrl();
      // Последний fallback: показываем ссылку
      prompt('Copia este enlace:', url);
    }
  };

  const handleDelete = async () => {
    // Используем стандартный confirm для браузера
    const confirmed = window.confirm('¿Estás seguro de que quieres eliminar este anuncio? Esta acción no se puede deshacer.');
    
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      const headers = {};
      const initData = getInitData();
      if (initData) {
        headers['X-Telegram-Init-Data'] = initData;
        // Парсим initData для логирования (без чувствительных данных)
        try {
          const urlParams = new URLSearchParams(initData);
          const userStr = urlParams.get('user');
          if (userStr) {
            const user = JSON.parse(userStr);
            console.log('Telegram user from initData:', {
              id: user.id,
              username: user.username,
              first_name: user.first_name
            });
          }
        } catch (e) {
          console.warn('Could not parse user from initData:', e);
        }
      } else {
        console.warn('⚠️ No initData available for delete request');
      }

      console.log('Deleting listing:', listing.id);
      console.log('Listing owner (if available):', listing.user_id);
      console.log('API URL:', `${API_URL}/listings/${listing.id}`);
      console.log('Headers:', Object.keys(headers));

      const response = await fetch(`${API_URL}/listings/${listing.id}`, {
        method: 'DELETE',
        headers
      });

      console.log('Delete response status:', response.status);

      if (!response.ok) {
        let errorMessage = 'Error al eliminar el anuncio';
        
        try {
          const errorData = await response.json();
          console.error('Delete error:', errorData);
          errorMessage = errorData.error || errorMessage;
        } catch (parseError) {
          // Если не удалось распарсить JSON, используем статус
          console.error('Failed to parse error response:', parseError);
          if (response.status === 404) {
            errorMessage = 'El anuncio no fue encontrado';
          } else if (response.status === 403) {
            errorMessage = 'No tienes permiso para eliminar este anuncio';
          } else if (response.status === 401) {
            errorMessage = 'Debes iniciar sesión para eliminar anuncios';
          } else {
            errorMessage = `Error ${response.status}: ${response.statusText || 'Error del servidor'}`;
          }
        }
        
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('Delete success:', result);

      // Показываем уведомление об успехе
      if (onSuccess) {
        onSuccess('Anuncio eliminado exitosamente');
      }

      if (onDelete) {
        onDelete();
      } else {
        onBack();
      }
    } catch (error) {
      console.error('Error deleting listing:', error);
      
      // Обработка сетевых ошибок
      let errorMessage = error.message || 'Error al eliminar el anuncio';
      
      if (error.message === 'Load failed' || error.message === 'Failed to fetch' || 
          error.message.includes('NetworkError') || error.message.includes('fetch')) {
        errorMessage = 'Error de conexión. Verifica tu conexión a internet e intenta de nuevo.';
      }
      
      alert(`Error al eliminar el anuncio: ${errorMessage}. Por favor, intenta de nuevo.`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="listing-detail">
      <div className="detail-header">
        <button className="btn-back" onClick={onBack}>←</button>
        <div className="logo-container">
          <img src="/images/logo.png" alt="Cuba Clasificados" className="app-logo-small" onError={(e) => {
            e.target.style.display = 'none';
          }} />
        </div>
        <h1>Anuncio</h1>
      </div>

      <div className="detail-photos">
        <div className="photo-carousel">
          <div className="main-photo">
            <img 
              src={photos[currentPhotoIndex]} 
              alt={listing.title}
            onError={(e) => {
              e.target.src = '/images/placeholder.svg';
            }}
            />
            {photos.length > 1 && (
              <>
                <button 
                  className="carousel-btn carousel-btn-prev"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentPhotoIndex((prev) => (prev === 0 ? photos.length - 1 : prev - 1));
                  }}
                  aria-label="Foto anterior"
                >
                  ‹
                </button>
                <button 
                  className="carousel-btn carousel-btn-next"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentPhotoIndex((prev) => (prev === photos.length - 1 ? 0 : prev + 1));
                  }}
                  aria-label="Foto siguiente"
                >
                  ›
                </button>
                <div className="photo-counter">
                  {currentPhotoIndex + 1} / {photos.length}
                </div>
              </>
            )}
          </div>
          {photos.length > 1 && (
            <div className="photo-thumbnails">
              {photos.map((photo, index) => (
                <img
                  key={index}
                  src={photo}
                  alt={`${listing.title} ${index + 1}`}
                  className={index === currentPhotoIndex ? 'active' : ''}
                  onClick={() => setCurrentPhotoIndex(index)}
                onError={(e) => {
                  e.target.src = '/images/placeholder.svg';
                }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="detail-content">
        <div className="detail-title-section">
          <h2>{listing.title}</h2>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginTop: '8px' }}>
            {getScopeBadge()}
            {listing.created_at && (
              <span style={{ 
                fontSize: '13px', 
                color: '#666', 
                fontWeight: '500' 
              }}>
                📅 {formatDate(listing.created_at)}
              </span>
            )}
            {listing.updated_at && listing.updated_at !== listing.created_at && (
              <span style={{ 
                fontSize: '13px', 
                color: '#666', 
                fontWeight: '500' 
              }}>
                ✏️ Editado {formatDate(listing.updated_at)}
              </span>
            )}
            {listing.views !== undefined && listing.views !== null && (
              <span style={{ 
                fontSize: '13px', 
                color: '#666', 
                fontWeight: '500' 
              }}>
                👁️ {listing.views} {listing.views === 1 ? 'vista' : 'vistas'}
              </span>
            )}
          </div>
        </div>

        <div className="detail-price">
          {formatPrice()}
        </div>

        <div className="detail-description">
          <h3>Descripción</h3>
          <p>{listing.description}</p>
        </div>

        {/* Дополнительная информация по категориям */}
        {listing.category === 'rent' && (
          <div className="detail-info">
            <h3>Información del alquiler</h3>
            <div className="info-row">
              <span>Tipo:</span>
              <span>{listing.rent_type === 'room' ? 'Habitación' : listing.rent_type === 'apartment' ? 'Apartamento' : 'Casa'}</span>
            </div>
            <div className="info-row">
              <span>Período:</span>
              <span>{listing.rent_period === 'daily' ? 'Diario' : 'Mensual'}</span>
            </div>
            {listing.landmark && (
              <div className="info-row">
                <span>Referencia:</span>
                <span>{listing.landmark}</span>
              </div>
            )}
          </div>
        )}

        {listing.category === 'items' && (
          <div className="detail-info">
            <h3>Información del artículo</h3>
            {listing.item_condition && (
              <div className="info-row">
                <span>Estado:</span>
                <span>{listing.item_condition === 'new' ? 'Nuevo' : 'Usado'}</span>
              </div>
            )}
            {listing.item_brand && (
              <div className="info-row">
                <span>Marca:</span>
                <span>{listing.item_brand}</span>
              </div>
            )}
            {listing.delivery_type && (
              <div className="info-row">
                <span>Entrega:</span>
                <span>{listing.delivery_type === 'pickup' ? 'Recogida' : 'Envío a otra ciudad'}</span>
              </div>
            )}
          </div>
        )}

        {listing.category === 'services' && (
          <div className="detail-info">
            <h3>Información del servicio</h3>
            {listing.service_format && (
              <div className="info-row">
                <span>Formato:</span>
                <span>{listing.service_format === 'one-time' ? 'Una vez' : 'Continuo'}</span>
              </div>
            )}
            {listing.service_area && (
              <div className="info-row">
                <span>Zona de trabajo:</span>
                <span>{listing.service_area}</span>
              </div>
            )}
          </div>
        )}

        <div className="detail-location">
          <h3>Ubicación</h3>
          <p>{listing.city}</p>
          {listing.neighborhood && <p>Barrio: {listing.neighborhood}</p>}
          {listing.landmark && <p>Referencia: {listing.landmark}</p>}
        </div>

        <div className="detail-actions">
          {isOwner && (
            <div className="owner-actions" style={{ 
              display: 'flex', 
              gap: '10px', 
              marginBottom: '15px', 
              flexWrap: 'wrap',
              width: '100%'
            }}>
              <button 
                className="btn btn-primary" 
                onClick={handleEdit}
                style={{ 
                  flex: '1', 
                  minWidth: '120px',
                  padding: '12px 20px',
                  fontSize: '16px',
                  fontWeight: '600'
                }}
              >
                ✏️ Editar
              </button>
              {listing.status !== 'sold' && (
                <button 
                  type="button"
                  className="btn btn-success" 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleMarkAsSold();
                  }}
                  disabled={isMarkingSold}
                  style={{ 
                    flex: '1', 
                    minWidth: '120px', 
                    backgroundColor: '#28a745', 
                    borderColor: '#28a745',
                    color: 'white',
                    padding: '12px 20px',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: isMarkingSold ? 'not-allowed' : 'pointer',
                    opacity: isMarkingSold ? 0.6 : 1,
                    border: 'none',
                    borderRadius: '8px'
                  }}
                >
                  {isMarkingSold ? 'Marcando...' : '✅ Vendido'}
                </button>
              )}
              <button 
                type="button"
                className="btn btn-danger" 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('Delete button clicked');
                  handleDelete();
                }}
                disabled={isDeleting}
                style={{ 
                  flex: '1', 
                  minWidth: '120px', 
                  backgroundColor: '#dc3545', 
                  borderColor: '#dc3545',
                  color: 'white',
                  padding: '12px 20px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                  opacity: isDeleting ? 0.6 : 1,
                  border: 'none',
                  borderRadius: '8px'
                }}
              >
                {isDeleting ? 'Eliminando...' : '🗑️ Eliminar'}
              </button>
            </div>
          )}
          {isAdmin && !isOwner && (
            <div className="admin-actions" style={{ 
              display: 'flex', 
              gap: '10px', 
              marginBottom: '15px', 
              flexWrap: 'wrap',
              width: '100%'
            }}>
              <button 
                type="button"
                className="btn btn-danger" 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const confirmed = window.confirm('⚠️ Вы администратор. Вы уверены, что хотите удалить это объявление?');
                  if (confirmed) {
                    handleDelete();
                  }
                }}
                disabled={isDeleting}
                style={{ 
                  width: '100%', 
                  backgroundColor: '#dc3545', 
                  borderColor: '#dc3545',
                  color: 'white',
                  padding: '12px 20px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                  opacity: isDeleting ? 0.6 : 1,
                  border: 'none',
                  borderRadius: '8px'
                }}
              >
                {isDeleting ? 'Eliminando...' : '🔨 Удалить объявление (Админ)'}
              </button>
            </div>
          )}
          
          {/* Кнопка "Поделиться" - всегда видна, в самом верху секции действий */}
          <button 
            className="btn btn-primary" 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('Share button clicked');
              try {
                handleShare();
              } catch (error) {
                console.error('Error sharing:', error);
                alert('Error al compartir. Por favor, intenta de nuevo.');
              }
            }}
            style={{ 
              width: '100%',
              backgroundColor: '#667eea',
              borderColor: '#667eea',
              color: 'white',
              padding: '12px 20px',
              fontSize: '16px',
              fontWeight: '600',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              marginBottom: '15px',
              marginTop: (isOwner || (isAdmin && !isOwner)) ? '15px' : '0',
              display: 'block'
            }}
          >
            📤 Compartir anuncio
          </button>
          
          {(listing.contact_telegram || listing.username) && (
            <button className="btn btn-primary" onClick={handleTelegramClick}>
              ✉️ Escribir en Telegram
              {listing.contact_telegram || listing.username ? ` (@${(listing.contact_telegram || listing.username).replace('@', '')})` : ''}
            </button>
          )}
          {listing.contact_whatsapp && (
            <button className="btn btn-primary" onClick={handleWhatsAppClick}>
              📲 Escribir en WhatsApp
            </button>
          )}
          {listing.landmark && (
            <a 
              href={getGoogleMapsUrl()} 
              target="_blank" 
              rel="noopener noreferrer"
              className="btn btn-outline"
            >
              🗺 Abrir en mapas
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export default ListingDetail;

