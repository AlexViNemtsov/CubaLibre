import './PropertyTypeModal.css';

function PropertyTypeModal({ onSelect, onClose }) {
  return (
    <div className="property-type-modal-overlay" onClick={onClose}>
      <div className="property-type-modal" onClick={(e) => e.stopPropagation()}>
        <div className="property-type-modal-header">
          <h2>Selecciona el tipo</h2>
          <button className="close-modal-btn" onClick={onClose}>×</button>
        </div>
        <div className="property-type-modal-content">
          <div className="property-type-section-title">
            <span>Buscar inmueble</span>
          </div>
          
          <button 
            className="property-type-btn"
            onClick={() => onSelect('rent')}
          >
            <div className="property-type-icon">🔑</div>
            <div className="property-type-info">
              <h3>Alquiler</h3>
              <p>Alquilar inmuebles</p>
            </div>
          </button>
          <button 
            className="property-type-btn"
            onClick={() => onSelect('sale')}
          >
            <div className="property-type-icon">💰</div>
            <div className="property-type-info">
              <h3>Comprar</h3>
              <p>Comprar inmuebles</p>
            </div>
          </button>
          
          <div className="property-type-divider">
            <span>Publicar anuncio</span>
          </div>
          
          <button 
            className="property-type-btn property-type-btn-action"
            onClick={() => onSelect('rent_create')}
          >
            <div className="property-type-icon">📝</div>
            <div className="property-type-info">
              <h3>Alquilar</h3>
              <p>Publicar anuncio para alquilar</p>
            </div>
          </button>
          <button 
            className="property-type-btn property-type-btn-action"
            onClick={() => onSelect('sale_create')}
          >
            <div className="property-type-icon">💵</div>
            <div className="property-type-info">
              <h3>Vender</h3>
              <p>Publicar anuncio para vender</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

export default PropertyTypeModal;
