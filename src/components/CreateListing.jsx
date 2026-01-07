import { useState, useEffect } from 'react';
import './CreateListing.css';

// Определяем API URL
const getApiUrl = () => {
  // В dev режиме всегда используем localhost:3000
  if (import.meta.env.DEV) {
    return 'http://localhost:3000/api';
  }
  // Если явно указан VITE_API_URL и это не dev режим, используем его
  if (import.meta.env.VITE_API_URL && import.meta.env.PROD) {
    return import.meta.env.VITE_API_URL;
  }
  // В production используем относительный путь
  return '/api';
};

const API_URL = getApiUrl();

function CreateListing({ category, city, neighborhood, onBack, onCreated, initData }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    currency: 'CUP',
    is_negotiable: false,
    scope: category === 'rent' ? 'NEIGHBORHOOD' : category === 'items' ? 'COUNTRY' : 'CITY',
    // Аренда
    rent_type: '',
    rent_period: '',
    available_from: '',
    is_available_now: true,
    landmark: '',
    // Дополнительные поля для квартир
    rooms: '',
    total_area: '',
    living_area: '',
    floor: '',
    floor_from: '',
    renovation: '',
    furniture: '',
    appliances: '',
    internet: '',
    // Личные вещи
    item_subcategory: '',
    item_condition: '',
    item_brand: '',
    delivery_type: '',
    // Услуги
    service_subcategory: '',
    service_format: '',
    service_area: ''
  });

  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cities, setCities] = useState([]);
  const [selectedCity, setSelectedCity] = useState(city || 'la-habana');

  // Загружаем список городов
  useEffect(() => {
    fetch(`${API_URL}/cities`)
      .then(res => {
        if (!res.ok) throw new Error('Network response was not ok');
        return res.json();
      })
      .then(data => {
        setCities(data.cities || []);
        // Если передан city из пропсов, используем его
        if (city && city !== 'all') {
          setSelectedCity(city);
        }
      })
      .catch(err => {
        console.error('Error fetching cities:', err);
        // Дефолтные города при ошибке
        setCities([
          { id: 'la-habana', name: 'Habana', default: true },
          { id: 'all', name: 'Toda Cuba' }
        ]);
      });
  }, [city]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handlePhotoChange = (e) => {
    const files = Array.from(e.target.files).slice(0, 8);
    setPhotos(files);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const submitData = new FormData();
      
      // Основные поля
      Object.keys(formData).forEach(key => {
        if (formData[key] !== '' && formData[key] !== null) {
          submitData.append(key, formData[key]);
        }
      });

      submitData.append('category', category);
      // Используем выбранный город из формы
      const cityToSubmit = selectedCity === 'all' ? 'Habana' : selectedCity;
      submitData.append('city', cityToSubmit);
      if (neighborhood) {
        submitData.append('neighborhood', neighborhood);
      }

      // Фотографии
      photos.forEach(photo => {
        submitData.append('photos', photo);
      });

      const headers = {};
      if (initData) {
        headers['X-Telegram-Init-Data'] = initData;
      }

      // Убеждаемся что URL правильный
      const requestUrl = `${API_URL}/listings`;
      console.log('API_URL:', API_URL);
      console.log('Sending request to:', requestUrl);
      console.log('Environment:', {
        DEV: import.meta.env.DEV,
        PROD: import.meta.env.PROD,
        VITE_API_URL: import.meta.env.VITE_API_URL
      });
      
      const response = await fetch(requestUrl, {
        method: 'POST',
        headers,
        body: submitData
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);

      // Если 404, значит URL неправильный
      if (response.status === 404) {
        throw new Error(`Error 404: No se encontró el servidor. Verifica que el backend esté ejecutándose en ${API_URL}`);
      }

      // Проверяем, есть ли контент для парсинга JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Non-JSON response:', text);
        throw new Error(text || `Error ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Response data:', result);

      if (!response.ok) {
        throw new Error(result.error || `Error ${response.status}: ${response.statusText}`);
      }

      onCreated();
    } catch (err) {
      console.error('Error creating listing:', err);
      console.error('Error details:', {
        message: err.message,
        stack: err.stack,
        API_URL: API_URL
      });
      
      // Показываем более понятное сообщение об ошибке
      let errorMessage = err.message || 'Error al crear el anuncio. Por favor, intenta de nuevo.';
      
      if (err.message.includes('404') || err.message.includes('Failed to fetch')) {
        errorMessage = 'Error 404: No se pudo conectar con el servidor. Verifica que el backend esté ejecutándose.';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-listing">
      <div className="create-header">
        <button className="btn-back" onClick={onBack}>←</button>
        <h1>Publicar anuncio</h1>
      </div>

      <form onSubmit={handleSubmit} className="create-form">
        {error && <div className="error-message">{error}</div>}

        <div className="form-group">
          <label>Título *</label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleChange}
            required
            className="input"
            placeholder="Descripción breve"
          />
        </div>

        <div className="form-group">
          <label>Descripción *</label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            required
            className="textarea"
            rows="4"
            placeholder="Descripción detallada"
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Precio</label>
            <input
              type="number"
              name="price"
              value={formData.price}
              onChange={handleChange}
              className="input"
              placeholder="0"
            />
          </div>
          <div className="form-group">
            <label>Moneda</label>
            <select
              name="currency"
              value={formData.currency}
              onChange={handleChange}
              className="select"
            >
              <option value="CUP">CUP</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
        </div>

        <div className="form-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              name="is_negotiable"
              checked={formData.is_negotiable}
              onChange={handleChange}
            />
            Precio negociable
          </label>
        </div>

        <div className="form-group">
          <label>Ciudad *</label>
          <select
            name="city"
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            className="select"
            required
          >
            {cities.map(cityOption => (
              <option key={cityOption.id} value={cityOption.id}>
                {cityOption.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Alcance del anuncio *</label>
          <div className="scope-buttons">
            <button
              type="button"
              className={`scope-btn ${formData.scope === 'NEIGHBORHOOD' ? 'active' : ''} ${category === 'rent' ? '' : category === 'items' ? 'disabled' : ''}`}
              onClick={() => setFormData({ ...formData, scope: 'NEIGHBORHOOD' })}
              disabled={category === 'rent' ? false : category === 'items' ? false : false}
            >
              📍 Barrio
            </button>
            <button
              type="button"
              className={`scope-btn ${formData.scope === 'CITY' ? 'active' : ''}`}
              onClick={() => setFormData({ ...formData, scope: 'CITY' })}
            >
              🏙 Ciudad
            </button>
            <button
              type="button"
              className={`scope-btn ${formData.scope === 'COUNTRY' ? 'active' : ''} ${category === 'rent' ? 'disabled' : ''}`}
              onClick={() => setFormData({ ...formData, scope: 'COUNTRY' })}
              disabled={category === 'rent'}
            >
              🇨🇺 Toda Cuba
            </button>
          </div>
        </div>

        {category === 'rent' && (
          <>
            <div className="form-group">
              <label>Tipo de propiedad</label>
              <select
                name="rent_type"
                value={formData.rent_type}
                onChange={handleChange}
                className="select"
              >
                <option value="">Selecciona...</option>
                <option value="room">Habitación</option>
                <option value="apartment">Apartamento</option>
                <option value="house">Casa</option>
              </select>
            </div>

            <div className="form-group">
              <label>Período de alquiler</label>
              <select
                name="rent_period"
                value={formData.rent_period}
                onChange={handleChange}
                className="select"
              >
                <option value="">Selecciona...</option>
                <option value="daily">Diario</option>
                <option value="monthly">Mensual</option>
              </select>
            </div>

            <div className="form-group">
              <label>Referencia / cerca de...</label>
              <input
                type="text"
                name="landmark"
                value={formData.landmark}
                onChange={handleChange}
                className="input"
                placeholder="No indiques la dirección exacta"
              />
            </div>

            {/* Дополнительные поля для квартир */}
            <div className="form-group">
              <label>Cantidad de habitaciones:</label>
              <select
                name="rooms"
                value={formData.rooms}
                onChange={handleChange}
                className="select"
              >
                <option value="">(seleccionar)</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5+">5+</option>
              </select>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Área total:</label>
                <input
                  type="number"
                  name="total_area"
                  value={formData.total_area}
                  onChange={handleChange}
                  className="input"
                  placeholder="m²"
                />
              </div>
              <div className="form-group">
                <label>Área habitable:</label>
                <input
                  type="number"
                  name="living_area"
                  value={formData.living_area}
                  onChange={handleChange}
                  className="input"
                  placeholder="m²"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Piso:</label>
                <input
                  type="number"
                  name="floor"
                  value={formData.floor}
                  onChange={handleChange}
                  className="input"
                  placeholder=""
                />
              </div>
              <div className="form-group">
                <label>de</label>
                <input
                  type="number"
                  name="floor_from"
                  value={formData.floor_from}
                  onChange={handleChange}
                  className="input"
                  placeholder=""
                />
              </div>
            </div>

            <div className="form-group">
              <label>Remodelación:</label>
              <select
                name="renovation"
                value={formData.renovation}
                onChange={handleChange}
                className="select"
              >
                <option value="">(seleccionar)</option>
                <option value="cosmetic">Cosmética</option>
                <option value="euro">Euro</option>
                <option value="designer">Diseñador</option>
                <option value="none">Sin remodelación</option>
              </select>
            </div>

            <div className="form-group">
              <label>Muebles:</label>
              <select
                name="furniture"
                value={formData.furniture}
                onChange={handleChange}
                className="select"
              >
                <option value="">(seleccionar)</option>
                <option value="yes">Sí</option>
                <option value="no">No</option>
                <option value="partial">Parcial</option>
              </select>
            </div>

            <div className="form-group">
              <label>Electrodomésticos:</label>
              <select
                name="appliances"
                value={formData.appliances}
                onChange={handleChange}
                className="select"
              >
                <option value="">(seleccionar)</option>
                <option value="yes">Sí</option>
                <option value="no">No</option>
                <option value="partial">Parcial</option>
              </select>
            </div>

            <div className="form-group">
              <label>Internet y TV:</label>
              <select
                name="internet"
                value={formData.internet}
                onChange={handleChange}
                className="select"
              >
                <option value="">(seleccionar)</option>
                <option value="wifi">Wi-Fi</option>
                <option value="cable">Cable</option>
                <option value="both">Wi-Fi + Cable</option>
                <option value="no">No</option>
              </select>
            </div>
          </>
        )}

        {category === 'items' && (
          <>
            <div className="form-group">
              <label>Subcategoría</label>
              <select
                name="item_subcategory"
                value={formData.item_subcategory}
                onChange={handleChange}
                className="select"
              >
                <option value="">Selecciona...</option>
                <option value="clothing">Ropa</option>
                <option value="electronics">Electrónica</option>
                <option value="furniture">Muebles</option>
                <option value="kids">Infantil</option>
                <option value="other">Otro</option>
              </select>
            </div>

            <div className="form-group">
              <label>Estado</label>
              <select
                name="item_condition"
                value={formData.item_condition}
                onChange={handleChange}
                className="select"
              >
                <option value="">Selecciona...</option>
                <option value="new">Nuevo</option>
                <option value="used">Usado</option>
              </select>
            </div>

            <div className="form-group">
              <label>Marca (opcional)</label>
              <input
                type="text"
                name="item_brand"
                value={formData.item_brand}
                onChange={handleChange}
                className="input"
              />
            </div>

            <div className="form-group">
              <label>Entrega</label>
              <select
                name="delivery_type"
                value={formData.delivery_type}
                onChange={handleChange}
                className="select"
              >
                <option value="">Selecciona...</option>
                <option value="pickup">Recogida</option>
                <option value="shipping">Envío a otra ciudad</option>
              </select>
            </div>
          </>
        )}

        {category === 'services' && (
          <>
            <div className="form-group">
              <label>Subcategoría</label>
              <select
                name="service_subcategory"
                value={formData.service_subcategory}
                onChange={handleChange}
                className="select"
              >
                <option value="">Selecciona...</option>
                <option value="repair">Reparación</option>
                <option value="cleaning">Limpieza</option>
                <option value="transport">Transporte</option>
                <option value="food">Comida</option>
                <option value="other">Otro</option>
              </select>
            </div>

            <div className="form-group">
              <label>Formato</label>
              <select
                name="service_format"
                value={formData.service_format}
                onChange={handleChange}
                className="select"
              >
                <option value="">Selecciona...</option>
                <option value="one-time">Una vez</option>
                <option value="ongoing">Continuo</option>
              </select>
            </div>

            <div className="form-group">
              <label>Zona de trabajo</label>
              <input
                type="text"
                name="service_area"
                value={formData.service_area}
                onChange={handleChange}
                className="input"
                placeholder="¿Dónde trabajas?"
              />
            </div>
          </>
        )}

        <div className="form-group">
          <label>Fotografías (hasta 8)</label>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handlePhotoChange}
            className="file-input"
          />
          {photos.length > 0 && (
            <div className="photo-preview">
              {photos.map((photo, index) => (
                <div key={index} className="photo-preview-item">
                  <img src={URL.createObjectURL(photo)} alt={`Preview ${index + 1}`} />
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          type="submit"
          className="btn btn-primary submit-btn"
          disabled={loading}
        >
          {loading ? 'Publicando...' : 'Publicar'}
        </button>
      </form>
    </div>
  );
}

export default CreateListing;

