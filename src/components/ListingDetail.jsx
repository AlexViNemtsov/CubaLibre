import { useState } from 'react';
import './ListingDetail.css';

function ListingDetail({ listing, onBack }) {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  const getPhotos = () => {
    if (listing.photos && listing.photos.length > 0) {
      const apiUrl = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3000';
      return listing.photos.map(photo => 
        photo.startsWith('/uploads') ? `${apiUrl}${photo}` : photo
      );
    }
    return ['https://via.placeholder.com/400x300?text=No+Image'];
  };

  const photos = getPhotos();

  const formatPrice = () => {
    if (listing.is_negotiable) {
      return 'Negociable';
    }
    if (listing.price) {
      return `${listing.price} ${listing.currency || 'CUP'}`;
    }
    return 'Precio no especificado';
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
    const username = listing.contact_telegram || listing.username;
    if (username) {
      window.open(`https://t.me/${username.replace('@', '')}`, '_blank');
    }
  };

  const handleWhatsAppClick = () => {
    const phone = listing.contact_whatsapp;
    if (phone) {
      window.open(`https://wa.me/${phone.replace(/[^0-9]/g, '')}`, '_blank');
    }
  };

  return (
    <div className="listing-detail">
      <div className="detail-header">
        <button className="btn-back" onClick={onBack}>←</button>
        <h1>Anuncio</h1>
      </div>

      <div className="detail-photos">
        <div className="main-photo">
          <img 
            src={photos[currentPhotoIndex]} 
            alt={listing.title}
            onError={(e) => {
              e.target.src = 'https://via.placeholder.com/400x300?text=No+Image';
            }}
          />
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
                  e.target.src = 'https://via.placeholder.com/80x80?text=No+Image';
                }}
              />
            ))}
          </div>
        )}
      </div>

      <div className="detail-content">
        <div className="detail-title-section">
          <h2>{listing.title}</h2>
          {getScopeBadge()}
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
          {listing.contact_telegram && (
            <button className="btn btn-primary" onClick={handleTelegramClick}>
              ✉️ Escribir en Telegram
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

