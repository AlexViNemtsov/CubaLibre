import './ListingCard.css';

function ListingCard({ listing, onClick }) {
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffTime / (1000 * 60));

    if (diffMinutes < 1) return 'Ahora';
    if (diffMinutes < 60) return `${diffMinutes}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return `${diffDays}d`;
    if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return `${weeks}s`;
    }
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  };
  const formatPrice = () => {
    if (listing.is_negotiable) {
      return 'Negociable';
    }
    if (listing.price) {
      return `${listing.price} ${listing.currency || 'CUP'}`;
    }
    return 'Precio no especificado';
  };

  // Базовый URL API (без /api) для изображений
  const getApiBaseUrl = () => {
    return (
      import.meta.env.VITE_API_URL?.replace('/api', '') ||
      (import.meta.env.DEV ? 'http://localhost:3000' : 'https://cubalibre.onrender.com')
    );
  };

  const getMainPhoto = () => {
    if (listing.photos && listing.photos.length > 0) {
      let photo = listing.photos[0];
      const apiBase = getApiBaseUrl();

      // Логируем для отладки (только в dev или для первых нескольких объявлений)
      if (import.meta.env.DEV || (listing.id && listing.id <= 5)) {
        console.log('📸 ListingCard photo processing:', {
          listingId: listing.id,
          originalPhoto: photo,
          apiBase: apiBase,
          VITE_API_URL: import.meta.env.VITE_API_URL
        });
      }

      // Cloudinary или другой внешний CDN: полный URL начинается с http/https
      if (photo.startsWith('http://') || photo.startsWith('https://')) {
        // Это уже полный URL (Cloudinary, CDN и т.д.) - используем как есть
        if (import.meta.env.DEV || (listing.id && listing.id <= 5)) {
          console.log('📸 Using Cloudinary/external URL:', photo);
        }
        return photo;
      }

      // Новый формат: относительный путь /uploads/... (локальное хранилище)
      if (photo.startsWith('/uploads')) {
        const finalUrl = `${apiBase}${photo}`;
        if (import.meta.env.DEV || (listing.id && listing.id <= 5)) {
          console.log('📸 Final URL (relative):', finalUrl);
        }
        return finalUrl;
      }

      // Старый формат: полный URL на домен reg.ru (legacy)
      if (photo.startsWith('http')) {
        try {
          const url = new URL(photo);
          // Если фото указывает на старый домен, переписываем на Render
          if (url.hostname === 'cuba-clasificados.online') {
            const finalUrl = `${apiBase}${url.pathname}`;
            if (import.meta.env.DEV || (listing.id && listing.id <= 5)) {
              console.log('📸 Final URL (rewritten from old domain):', finalUrl);
            }
            return finalUrl;
          }
        } catch (e) {
          console.warn('📸 Invalid photo URL:', photo, e);
          // Если URL некорректный, возвращаем placeholder
          return '/images/placeholder.svg';
        }
      }

      // Если фото не начинается ни с /uploads, ни с http - это странно
      console.warn('📸 Unexpected photo format:', photo, 'for listing', listing.id);
      // Любые другие случаи – используем как есть (может быть относительный путь без /)
      return photo;
    }
    return '/images/placeholder.svg';
  };

  const getLocation = () => {
    // Для недвижимости (rent) всегда показываем город, если он есть
    if (listing.category === 'rent') {
      if (listing.city) {
        // Если есть район, показываем его, иначе город
        if (listing.scope === 'NEIGHBORHOOD' && listing.neighborhood) {
          return listing.neighborhood;
        }
        // Преобразуем ID города в читаемое название
        const cityNames = {
          'la-habana': 'Habana',
          'santiago': 'Santiago de Cuba',
          'camaguey': 'Camagüey',
          'holguin': 'Holguín',
          'santa-clara': 'Santa Clara',
          'guantanamo': 'Guantánamo',
          'bayamo': 'Bayamo',
          'pinar-del-rio': 'Pinar del Río',
          'cienfuegos': 'Cienfuegos',
          'matanzas': 'Matanzas'
        };
        return cityNames[listing.city] || listing.city;
      }
      // Если для недвижимости нет города - это ошибка данных, но показываем что есть
      if (listing.neighborhood) {
        return listing.neighborhood;
      }
      return 'Ciudad no especificada';
    }
    
    // Для других категорий используем старую логику
    if (listing.scope === 'NEIGHBORHOOD' && listing.neighborhood) {
      return listing.neighborhood;
    }
    if (listing.scope === 'CITY' && listing.city) {
      const cityNames = {
        'la-habana': 'Habana',
        'santiago': 'Santiago de Cuba',
        'camaguey': 'Camagüey',
        'holguin': 'Holguín',
        'santa-clara': 'Santa Clara',
        'guantanamo': 'Guantánamo',
        'bayamo': 'Bayamo',
        'pinar-del-rio': 'Pinar del Río',
        'cienfuegos': 'Cienfuegos',
        'matanzas': 'Matanzas'
      };
      return cityNames[listing.city] || listing.city;
    }
    return 'Toda Cuba';
  };

  const getRoomsInfo = () => {
    if (listing.category === 'rent' && listing.rooms) {
      return `${listing.rooms} hab.`;
    }
    return null;
  };

  return (
    <div className="listing-card" onClick={onClick}>
      <div className="listing-photo">
        <img 
          src={getMainPhoto()} 
          alt={listing.title}
          onError={(e) => {
            e.target.src = '/images/placeholder.svg';
          }}
        />
        {listing.photos && listing.photos.length > 1 && (
          <span className="photo-count">📷 {listing.photos.length}</span>
        )}
      </div>
      <div className="listing-content">
        <div className="listing-location">{getLocation()}</div>
        {getRoomsInfo() && (
          <div className="listing-rooms">{getRoomsInfo()}</div>
        )}
        <div className="listing-price">{formatPrice()}</div>
        {listing.created_at && (
          <div className="listing-date" style={{ 
            fontSize: '11px', 
            color: '#999', 
            marginTop: '4px' 
          }}>
            {formatDate(listing.created_at)}
          </div>
        )}
      </div>
    </div>
  );
}

export default ListingCard;

