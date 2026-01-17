import './ListingCard.css';

function ListingCard({ listing, onClick }) {
  const formatPrice = () => {
    if (listing.is_negotiable) {
      return 'Negociable';
    }
    if (listing.price) {
      const currency = listing.currency || 'CUP';
      const currencySymbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : 'CUP';
      const period = listing.rent_period === 'monthly' ? 'в месяц' : listing.rent_period === 'daily' ? 'в день' : '';
      return `${listing.price} ${currencySymbol}${period ? ' ' + period : ''}`;
    }
    return 'Precio no especificado';
  };

  const getMainPhoto = () => {
    if (listing.photos && listing.photos.length > 0) {
      const photo = listing.photos[0];
      // Если фото начинается с /uploads, добавляем базовый URL API
      if (photo.startsWith('/uploads')) {
        const apiUrl = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3000';
        return `${apiUrl}${photo}`;
      }
      return photo;
    }
    return 'https://via.placeholder.com/400x300?text=No+Image';
  };

  const getLocation = () => {
    // Для недвижимости всегда показываем город
    if (listing.category === 'rent') {
      if (listing.scope === 'NEIGHBORHOOD' && listing.neighborhood) {
        return listing.city || 'Toda Cuba';
      }
      if (listing.scope === 'CITY' && listing.city) {
        return listing.city;
      }
      return listing.city || 'Toda Cuba';
    }
    // Для других категорий
    if (listing.scope === 'NEIGHBORHOOD' && listing.neighborhood) {
      return listing.neighborhood;
    }
    if (listing.scope === 'CITY' && listing.city) {
      return listing.city;
    }
    return 'Toda Cuba';
  };

  const getPropertyInfo = () => {
    if (listing.category !== 'rent') {
      return null;
    }

    const parts = [];
    
    // Количество комнат и тип
    if (listing.rooms) {
      const propertyType = listing.rent_type === 'apartment' ? 'квартира' : 
                          listing.rent_type === 'house' ? 'дом' : 
                          listing.rent_type === 'room' ? 'комната' : 'квартира';
      parts.push(`${listing.rooms}. ${propertyType}`);
    }
    
    // Площадь
    if (listing.total_area) {
      parts.push(`${listing.total_area} м²`);
    }
    
    // Этаж
    if (listing.floor && listing.floor_from) {
      parts.push(`${listing.floor}/${listing.floor_from} эт.`);
    } else if (listing.floor) {
      parts.push(`${listing.floor} эт.`);
    }
    
    return parts.length > 0 ? parts.join(', ') : null;
  };

  return (
    <div className="listing-card" onClick={onClick}>
      <div className="listing-photo">
        <img 
          src={getMainPhoto()} 
          alt={listing.title}
          onError={(e) => {
            e.target.src = 'https://via.placeholder.com/400x300?text=No+Image';
          }}
        />
        {listing.photos && listing.photos.length > 1 && (
          <span className="photo-count">📷 {listing.photos.length}</span>
        )}
      </div>
      <div className="listing-content">
        {getPropertyInfo() && (
          <div className="listing-property-info">{getPropertyInfo()}</div>
        )}
        <div className="listing-price">{formatPrice()}</div>
        <div className="listing-location">{getLocation()}</div>
      </div>
    </div>
  );
}

export default ListingCard;

