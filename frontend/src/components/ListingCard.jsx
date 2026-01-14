import './ListingCard.css';

function ListingCard({ listing, onClick }) {
  const formatPrice = () => {
    if (listing.is_negotiable) {
      return 'Negociable';
    }
    if (listing.price) {
      return `${listing.price} ${listing.currency || 'CUP'}`;
    }
    return 'Precio no especificado';
  };

      const getMainPhoto = () => {
        if (listing.photos && listing.photos.length > 0) {
          const photo = listing.photos[0];
          // Если фото начинается с /uploads, добавляем базовый URL API
          if (photo.startsWith('/uploads')) {
            const apiUrl = import.meta.env.VITE_API_URL?.replace('/api', '') || 
                          (import.meta.env.DEV ? 'http://localhost:3000' : 'https://cubalibre.onrender.com');
            return `${apiUrl}${photo}`;
          }
          return photo;
        }
        return 'https://via.placeholder.com/400x300?text=No+Image';
      };

  const getLocation = () => {
    if (listing.scope === 'NEIGHBORHOOD' && listing.neighborhood) {
      return listing.neighborhood;
    }
    if (listing.scope === 'CITY' && listing.city) {
      return listing.city;
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
            e.target.src = 'https://via.placeholder.com/400x300?text=No+Image';
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
      </div>
    </div>
  );
}

export default ListingCard;

