import { useState, useEffect } from 'react';
import './CreateListing.css';

// Определяем API URL
const getApiUrl = () => {
  // В dev режиме всегда используем localhost:3000
  if (import.meta.env.DEV) {
    return 'http://localhost:3000/api';
  }
  // Если явно указан VITE_API_URL, используем его
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  // В production по умолчанию используем Render API
  return 'https://cubalibre.onrender.com/api';
};

const API_URL = getApiUrl();

function CreateListing({ category, city, neighborhood, onBack, onCreated, initData, editingListing, propertyTransactionType = 'rent' }) {
  const isEditing = !!editingListing;
  
  const [formData, setFormData] = useState({
    title: editingListing?.title || '',
    description: editingListing?.description || '',
    price: editingListing?.price || '',
    currency: editingListing?.currency || 'CUP',
    is_negotiable: editingListing?.is_negotiable || false,
    scope: editingListing?.scope || (category === 'rent' ? 'NEIGHBORHOOD' : category === 'items' ? 'COUNTRY' : 'CITY'),
    // Аренда
    rent_type: editingListing?.rent_type || '',
    rent_period: editingListing?.rent_period || '',
    available_from: editingListing?.available_from || '',
    is_available_now: editingListing?.is_available_now !== false,
    landmark: editingListing?.landmark || '',
    // Дополнительные поля для квартир
    rooms: editingListing?.rooms || '',
    total_area: editingListing?.total_area || '',
    living_area: editingListing?.living_area || '',
    floor: editingListing?.floor || '',
    floor_from: editingListing?.floor_from || '',
    renovation: editingListing?.renovation || '',
    furniture: editingListing?.furniture || '',
    appliances: editingListing?.appliances || '',
    internet: editingListing?.internet || '',
    // Личные вещи
    item_subcategory: editingListing?.item_subcategory || '',
    item_condition: editingListing?.item_condition || '',
    item_brand: editingListing?.item_brand || '',
    delivery_type: editingListing?.delivery_type || '',
    // Услуги
    service_subcategory: editingListing?.service_subcategory || '',
    service_format: editingListing?.service_format || '',
    service_area: editingListing?.service_area || ''
  });

  const [photos, setPhotos] = useState([]);
  const [existingPhotos, setExistingPhotos] = useState(editingListing?.photos || []);
  const [photosToDelete, setPhotosToDelete] = useState([]); // Массив URL фотографий для удаления
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cities, setCities] = useState([]);
  const [transactionType, setTransactionType] = useState(
    propertyTransactionType || 'rent'
  );
  const [selectedCity, setSelectedCity] = useState(
    editingListing?.city || (city && city !== 'all' ? city : 'la-habana')
  );

  // Загружаем список городов
  useEffect(() => {
    fetch(`${API_URL}/cities`)
      .then(res => {
        if (!res.ok) throw new Error('Network response was not ok');
        return res.json();
      })
      .then(data => {
        const citiesList = data.cities || [];
        // Сортируем: сначала Habana, потом Toda Cuba, затем остальные
        const sortedCities = citiesList.sort((a, b) => {
          if (a.id === 'la-habana') return -1;
          if (b.id === 'la-habana') return 1;
          if (a.id === 'all') return -1;
          if (b.id === 'all') return 1;
          return a.name.localeCompare(b.name);
        });
        setCities(sortedCities);
        // Если передан city из пропсов, используем его
        // Для недвижимости не используем 'all'
        if (city && city !== 'all') {
          setSelectedCity(city);
        } else if (category === 'rent') {
          // Для недвижимости устанавливаем дефолтный город если не передан
          setSelectedCity('la-habana');
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

  // Автоматически устанавливаем scope на основе выбранного города
  useEffect(() => {
    // Для недвижимости всегда требуется город, scope не может быть COUNTRY
    if (category === 'rent') {
      if (selectedCity && selectedCity !== 'all') {
        // Если выбран район, устанавливаем scope в NEIGHBORHOOD, иначе CITY
        if (neighborhood) {
          setFormData(prev => ({ ...prev, scope: 'NEIGHBORHOOD' }));
        } else {
          setFormData(prev => ({ ...prev, scope: 'CITY' }));
        }
      }
    } else {
      // Для других категорий
      if (selectedCity === 'all') {
        setFormData(prev => ({ ...prev, scope: 'COUNTRY' }));
      } else if (neighborhood) {
        setFormData(prev => ({ ...prev, scope: 'NEIGHBORHOOD' }));
      } else {
        setFormData(prev => ({ ...prev, scope: 'CITY' }));
      }
    }
  }, [selectedCity, category, neighborhood]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handlePhotoChange = (e) => {
    const newFiles = Array.from(e.target.files || []);
    if (newFiles.length === 0) {
      console.log('No files selected');
      return;
    }

    console.log('Files selected:', newFiles.length, newFiles.map(f => f.name));

    // Используем функциональное обновление для получения актуального состояния
    setPhotos(prev => {
      // Вычисляем общее количество фотографий с учетом текущего состояния
      const currentExisting = existingPhotos.length - photosToDelete.length;
      const totalPhotos = prev.length + currentExisting;
      const remainingSlots = Math.max(0, 5 - totalPhotos);
      
      console.log('Photo state:', {
        prev: prev.length,
        existing: existingPhotos.length,
        toDelete: photosToDelete.length,
        currentExisting,
        totalPhotos,
        remainingSlots
      });
      
      if (remainingSlots <= 0) {
        console.warn('No remaining slots for photos');
        return prev;
      }
      
      const filesToAdd = newFiles.slice(0, remainingSlots);
      console.log('Adding files:', filesToAdd.length);
      
      const newPhotos = [...prev, ...filesToAdd];
      console.log('New photos array length:', newPhotos.length);
      
      return newPhotos;
    });
    
    // Сбрасываем значение input, чтобы можно было выбрать тот же файл снова
    e.target.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Валидация для аренды: rent_period обязателен
      if (category === 'rent' && transactionType === 'rent' && !formData.rent_period) {
        setError('Por favor, selecciona el período de alquiler');
        setLoading(false);
        return;
      }

      // Валидация длины заголовка (максимум 100 символов)
      if (formData.title && formData.title.length > 100) {
        setError('El título es demasiado largo. Máximo 100 caracteres');
        setLoading(false);
        return;
      }
      
      // Валидация: минимум 1 фото обязательно
      const totalPhotos = photos.length + (existingPhotos.length - photosToDelete.length);
      console.log('Photo validation:', {
        photos: photos.length,
        existingPhotos: existingPhotos.length,
        photosToDelete: photosToDelete.length,
        totalPhotos,
        isEditing
      });
      
      // При создании нового объявления должны быть новые фото
      if (!isEditing && photos.length === 0) {
        console.error('❌ No new photos for new listing');
        setError('Por favor, agrega al menos una fotografía');
        setLoading(false);
        return;
      }
      
      // При редактировании проверяем общее количество (новые + существующие - удаленные)
      if (isEditing && totalPhotos === 0) {
        console.error('❌ No photos after edit');
        setError('El anuncio debe tener al menos una fotografía');
        setLoading(false);
        return;
      }
      
      // Общая проверка на минимум 1 фото
      if (totalPhotos === 0) {
        console.error('❌ Total photos is 0');
        setError('Por favor, agrega al menos una fotografía');
        setLoading(false);
        return;
      }
      
      console.log('✅ Photo validation passed:', totalPhotos, 'photos');
      
      // Валидация цены: цена обязательна для всех категорий (либо указана цена, либо отмечено "Negociable")
      if (!formData.price && !formData.is_negotiable) {
        setError('Por favor, indica el precio o marca "Negociable"');
        setLoading(false);
        return;
      }

      const submitData = new FormData();
      
      // Основные поля (кроме rent_period, который обработаем отдельно)
      Object.keys(formData).forEach(key => {
        // Для продажи не отправляем rent_period
        if (key === 'rent_period' && category === 'rent' && transactionType === 'sale') {
          // Не отправляем rent_period для продажи
          return;
        }
        // Для аренды всегда отправляем rent_period (даже если пустой, но после валидации он не будет пустым)
        if (key === 'rent_period' && category === 'rent' && transactionType === 'rent') {
          // Обязательно отправляем rent_period для аренды
          submitData.append(key, formData[key]);
          return;
        }
        if (formData[key] !== '' && formData[key] !== null && formData[key] !== undefined) {
          submitData.append(key, formData[key]);
        }
      });

      submitData.append('category', category);
      
      // Используем выбранный город из формы
      // Для недвижимости город обязателен и не может быть 'all'
      if (category === 'rent') {
        if (!selectedCity || selectedCity === 'all') {
          setError('Por favor, selecciona una ciudad para anuncios de inmuebles');
          setLoading(false);
          return;
        }
        submitData.append('city', selectedCity);
      } else {
        const cityToSubmit = selectedCity === 'all' ? 'Habana' : selectedCity;
        submitData.append('city', cityToSubmit);
      }
      if (neighborhood) {
        submitData.append('neighborhood', neighborhood);
      }

      // Фотографии
      photos.forEach(photo => {
        submitData.append('photos', photo);
      });

      // Фотографии для удаления (при редактировании)
      if (isEditing && photosToDelete.length > 0) {
        // Отправляем массив URL фотографий для удаления
        // Для FormData отправляем каждое значение отдельно с одинаковым ключом
        photosToDelete.forEach(photoUrl => {
          submitData.append('delete_photos', photoUrl);
        });
      }

      const headers = {};
      if (initData) {
        headers['X-Telegram-Init-Data'] = initData;
      }

      // Убеждаемся что URL правильный
      const requestUrl = isEditing 
        ? `${API_URL}/listings/${editingListing.id}`
        : `${API_URL}/listings`;
      const method = isEditing ? 'PUT' : 'POST';
      
      console.log('API_URL:', API_URL);
      console.log('Sending request to:', requestUrl);
      console.log('Method:', method);
      console.log('Environment:', {
        DEV: import.meta.env.DEV,
        PROD: import.meta.env.PROD,
        VITE_API_URL: import.meta.env.VITE_API_URL
      });
      
      const response = await fetch(requestUrl, {
        method,
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
        <div className="logo-container">
          <img src="/images/logo.png" alt="Cuba Clasificados" className="app-logo-small" onError={(e) => {
            e.target.style.display = 'none';
          }} />
        </div>
        <h1>{isEditing ? 'Editar anuncio' : 'Publicar anuncio'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="create-form">
        {error && <div className="error-message">{error}</div>}

        {category === 'rent' && (
          <div className="form-group">
            <label>Tipo de transacción *</label>
            <select
              name="transaction_type"
              value={transactionType}
              onChange={(e) => setTransactionType(e.target.value)}
              className="select"
              required
            >
              <option value="rent">Alquilar</option>
              <option value="sale">Vender</option>
            </select>
            <small className="form-hint">Selecciona si quieres alquilar o vender el inmueble</small>
          </div>
        )}

        <div className="form-group">
          <label>Título * (máximo 100 caracteres)</label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleChange}
            required
            className="input"
            placeholder="Descripción breve"
            maxLength={100}
          />
          <small className="form-hint">
            {formData.title ? `${formData.title.length}/100 caracteres` : '0/100 caracteres'}
          </small>
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
            <label>Precio *</label>
            <input
              type="number"
              name="price"
              value={formData.price}
              onChange={handleChange}
              className="input"
              placeholder="0"
              required={!formData.is_negotiable}
            />
            <small className="form-hint">O marca "Precio negociable" si el precio es negociable</small>
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
          <small className="form-hint">Marca esta opción si el precio es negociable</small>
        </div>

        <div className="form-group">
          <label>Ciudad {category === 'rent' ? '*' : ''}</label>
          <select
            name="city"
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            className="select"
            required={category === 'rent'}
          >
            {cities.map(cityOption => {
              // Для недвижимости скрываем опцию "Toda Cuba"
              if (category === 'rent' && cityOption.id === 'all') {
                return null;
              }
              return (
                <option key={cityOption.id} value={cityOption.id}>
                  {cityOption.name}
                </option>
              );
            })}
          </select>
          {category === 'rent' && (
            <small className="form-hint">Para anuncios de inmuebles, la ciudad es obligatoria</small>
          )}
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

            {transactionType === 'rent' && (
              <div className="form-group">
                <label>Período de alquiler *</label>
                <select
                  name="rent_period"
                  value={formData.rent_period}
                  onChange={handleChange}
                  className="select"
                  required={transactionType === 'rent'}
                >
                  <option value="">Selecciona...</option>
                  <option value="daily">Diario</option>
                  <option value="monthly">Mensual</option>
                </select>
              </div>
            )}

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
          <label>Fotografías * (mínimo 1, hasta 5)</label>
          <div style={{ position: 'relative' }}>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handlePhotoChange}
              className="file-input"
              required
              id="photo-upload-input"
              style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
            />
            <label 
              htmlFor="photo-upload-input"
              style={{
                display: 'inline-block',
                padding: '12px 24px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                borderRadius: '12px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '14px',
                textAlign: 'center',
                transition: 'all 0.3s ease',
                boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
              }}
            >
              📷 Seleccionar fotografías
            </label>
          </div>
          <small className="form-hint" style={{ display: 'block', marginTop: '8px' }}>
            {photos.length + (existingPhotos.length - photosToDelete.length)} / 5 fotografías
            {(photos.length + (existingPhotos.length - photosToDelete.length)) === 0 && ' - Se requiere al menos 1 fotografía'}
          </small>
          {photos.length > 0 && (
            <div style={{ marginTop: '8px', fontSize: '12px', color: '#28a745', fontWeight: '600' }}>
              ✓ {photos.length} {photos.length === 1 ? 'fotografía nueva' : 'fotografías nuevas'} seleccionada{photos.length > 1 ? 's' : ''}
            </div>
          )}
          {photos.length > 0 && (
            <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
              📷 {photos.length} {photos.length === 1 ? 'fotografía nueva' : 'fotografías nuevas'} seleccionada{photos.length > 1 ? 's' : ''}
            </div>
          )}
          {existingPhotos.length > 0 && (
            <div className="photo-preview">
              <p style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>Fotografías actuales:</p>
              {existingPhotos.map((photo, index) => {
                const apiUrl = import.meta.env.VITE_API_URL?.replace('/api', '') || 
                              (import.meta.env.DEV ? 'http://localhost:3000' : 'https://cubalibre.onrender.com');
                const photoUrl = photo.startsWith('/uploads') ? `${apiUrl}${photo}` : photo;
                return (
                  <div key={`existing-${index}`} className="photo-preview-item" style={{ position: 'relative' }}>
                    <img src={photoUrl} alt={`Existing ${index + 1}`} />
                    <button
                      type="button"
                      onClick={() => {
                        const photoUrl = photo.startsWith('/uploads') 
                          ? photo 
                          : photo.replace(/^https?:\/\/[^\/]+/, '');
                        // Сохраняем URL фотографии для удаления на сервере
                        setPhotosToDelete(prev => [...prev, photoUrl]);
                        // Удаляем из отображаемых
                        setExistingPhotos(prev => prev.filter((_, i) => i !== index));
                      }}
                      style={{
                        position: 'absolute',
                        top: '5px',
                        right: '5px',
                        background: 'rgba(220, 53, 69, 0.9)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '50%',
                        width: '28px',
                        height: '28px',
                        cursor: 'pointer',
                        fontSize: '18px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        lineHeight: 1,
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
                      }}
                      title="Eliminar foto"
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          {photos.length > 0 && (
            <div className="photo-preview">
              <p style={{ fontSize: '12px', color: '#666', marginBottom: '8px', marginTop: existingPhotos.length > 0 ? '12px' : '0' }}>
                Nuevas fotografías:
              </p>
              {photos.map((photo, index) => (
                <div key={`new-${index}`} className="photo-preview-item" style={{ position: 'relative' }}>
                  <img src={URL.createObjectURL(photo)} alt={`Preview ${index + 1}`} />
                  <button
                    type="button"
                    onClick={() => {
                      setPhotos(prev => prev.filter((_, i) => i !== index));
                    }}
                    style={{
                      position: 'absolute',
                      top: '5px',
                      right: '5px',
                      background: 'rgba(220, 53, 69, 0.9)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '50%',
                      width: '28px',
                      height: '28px',
                      cursor: 'pointer',
                      fontSize: '18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      lineHeight: 1,
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
                    }}
                    title="Eliminar foto"
                  >
                    ×
                  </button>
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
          {loading ? (isEditing ? 'Guardando...' : 'Publicando...') : (isEditing ? 'Guardar cambios' : 'Publicar')}
        </button>
      </form>
    </div>
  );
}

export default CreateListing;

