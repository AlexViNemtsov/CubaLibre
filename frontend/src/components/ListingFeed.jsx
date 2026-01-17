import { useState, useEffect } from 'react';
import ListingCard from './ListingCard';
import './ListingFeed.css';

// Определяем API URL
const getApiUrl = () => {
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

function ListingFeed({ category, city, neighborhood, onListingClick, initData, propertyTransactionType = null }) {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('date'); // date, price_asc, price_desc
  const [filters, setFilters] = useState({ 
    minPrice: '', 
    maxPrice: '',
    // Фильтры для квартир
    rooms: '',
    totalArea: '',
    livingArea: '',
    floor: '',
    floorFrom: '',
    renovation: '',
    furniture: '',
    appliances: '',
    internet: ''
  });
  const [showFilters, setShowFilters] = useState(false);
  const [resultsCount, setResultsCount] = useState(0);

  const loadListings = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        category,
        status: 'active',
        limit: '50'
      });

      // Добавляем city только если он указан и не равен 'all'
      if (city && city !== 'all') {
        params.append('city', city);
      }

      if (neighborhood) {
        params.append('neighborhood', neighborhood);
      }

      if (searchQuery) {
        params.append('search', searchQuery);
      }

      if (filters.minPrice) {
        params.append('minPrice', filters.minPrice);
      }

      if (filters.maxPrice) {
        params.append('maxPrice', filters.maxPrice);
      }

      // Фильтрация по типу транзакции (аренда/продажа)
      // Для аренды: rent_period должен быть заполнен (daily/monthly)
      // Для продажи: rent_period должен быть пустым или null
      if (category === 'rent' && propertyTransactionType) {
        if (propertyTransactionType === 'rent') {
          // Показываем только объявления с rent_period (аренда)
          params.append('has_rent_period', 'true');
        } else if (propertyTransactionType === 'sale') {
          // Показываем только объявления без rent_period (продажа)
          params.append('has_rent_period', 'false');
        }
      }

      // Фильтры для квартир (только для категории rent)
      if (category === 'rent') {
        if (filters.rooms) {
          params.append('rooms', filters.rooms);
        }
        if (filters.totalArea) {
          params.append('totalArea', filters.totalArea);
        }
        if (filters.livingArea) {
          params.append('livingArea', filters.livingArea);
        }
        if (filters.floor) {
          params.append('floor', filters.floor);
        }
        if (filters.floorFrom) {
          params.append('floorFrom', filters.floorFrom);
        }
        if (filters.renovation) {
          params.append('renovation', filters.renovation);
        }
        if (filters.furniture) {
          params.append('furniture', filters.furniture);
        }
        if (filters.appliances) {
          params.append('appliances', filters.appliances);
        }
        if (filters.internet) {
          params.append('internet', filters.internet);
        }
      }

      const headers = {};
      if (initData) {
        headers['X-Telegram-Init-Data'] = initData;
      }

      const response = await fetch(`${API_URL}/listings?${params}`, { headers });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error loading listings:', response.status, errorText);
        throw new Error(`Failed to load listings: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data || !data.listings) {
        console.error('Invalid response format:', data);
        setListings([]);
        setResultsCount(0);
        setLoading(false);
        return;
      }
      
      // Сортируем: сначала район, потом город, потом страна
      const sorted = data.listings.sort((a, b) => {
        if (a.scope === 'NEIGHBORHOOD' && b.scope !== 'NEIGHBORHOOD') return -1;
        if (a.scope !== 'NEIGHBORHOOD' && b.scope === 'NEIGHBORHOOD') return 1;
        if (a.scope === 'CITY' && b.scope === 'COUNTRY') return -1;
        if (a.scope === 'COUNTRY' && b.scope === 'CITY') return 1;
        return 0;
      });

      // Сортировка результатов
      let finalSorted = [...sorted];
      if (sortBy === 'price_asc') {
        finalSorted.sort((a, b) => {
          const priceA = a.price || 0;
          const priceB = b.price || 0;
          return priceA - priceB;
        });
      } else if (sortBy === 'price_desc') {
        finalSorted.sort((a, b) => {
          const priceA = a.price || 0;
          const priceB = b.price || 0;
          return priceB - priceA;
        });
      } else if (sortBy === 'date') {
        finalSorted.sort((a, b) => {
          const dateA = new Date(a.created_at || 0);
          const dateB = new Date(b.created_at || 0);
          return dateB - dateA; // Новые сначала
        });
      }

      setListings(finalSorted);
      setResultsCount(finalSorted.length);
    } catch (error) {
      console.error('Error loading listings:', error);
    } finally {
      setLoading(false);
    }
  };

  // Начальная загрузка при монтировании
  useEffect(() => {
    loadListings();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Обновление при изменении фильтров, поиска, сортировки или параметров
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadListings();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, filters, sortBy, category, city, neighborhood, propertyTransactionType]); // eslint-disable-line react-hooks/exhaustive-deps

  // Получаем активные фильтры для отображения в чипсах
  const getActiveFilters = () => {
    const active = [];
    if (filters.minPrice) active.push({ key: 'minPrice', label: `Desde ${filters.minPrice}`, value: filters.minPrice });
    if (filters.maxPrice) active.push({ key: 'maxPrice', label: `Hasta ${filters.maxPrice}`, value: filters.maxPrice });
    if (filters.rooms) active.push({ key: 'rooms', label: `${filters.rooms} hab.`, value: filters.rooms });
    if (filters.totalArea) active.push({ key: 'totalArea', label: `${filters.totalArea} m²`, value: filters.totalArea });
    if (filters.renovation) {
      const labels = { cosmetic: 'Cosmética', euro: 'Euro', designer: 'Diseñador', none: 'Sin remodelación' };
      active.push({ key: 'renovation', label: labels[filters.renovation] || filters.renovation, value: filters.renovation });
    }
    if (filters.furniture) {
      const labels = { yes: 'Con muebles', no: 'Sin muebles', partial: 'Muebles parciales' };
      active.push({ key: 'furniture', label: labels[filters.furniture] || filters.furniture, value: filters.furniture });
    }
    if (filters.appliances) {
      const labels = { yes: 'Con electrodomésticos', no: 'Sin electrodomésticos', partial: 'Electrodomésticos parciales' };
      active.push({ key: 'appliances', label: labels[filters.appliances] || filters.appliances, value: filters.appliances });
    }
    if (filters.internet) {
      const labels = { wifi: 'Wi-Fi', cable: 'Cable', both: 'Wi-Fi + Cable', no: 'Sin internet' };
      active.push({ key: 'internet', label: labels[filters.internet] || filters.internet, value: filters.internet });
    }
    return active;
  };

  const removeFilter = (key) => {
    setFilters({ ...filters, [key]: '' });
  };

  const clearAllFilters = () => {
    setFilters({
      minPrice: '',
      maxPrice: '',
      rooms: '',
      totalArea: '',
      livingArea: '',
      floor: '',
      floorFrom: '',
      renovation: '',
      furniture: '',
      appliances: '',
      internet: ''
    });
    setSearchQuery('');
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  const activeFilters = getActiveFilters();

  return (
    <div className="listing-feed">
      {/* Поисковая строка в стиле Avito */}
      <div className="avito-search-container">
        <div className="avito-search-box">
          <div className="search-icon">🔍</div>
          <input
            type="text"
            className="avito-search-input"
            placeholder="Buscar..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button 
              className="search-clear-btn"
              onClick={() => setSearchQuery('')}
            >
              ×
            </button>
          )}
        </div>
        <button 
          className="avito-filters-btn"
          onClick={() => setShowFilters(!showFilters)}
        >
          <span>⚙️</span>
          <span>Filtros</span>
          {activeFilters.length > 0 && (
            <span className="filter-badge">{activeFilters.length}</span>
          )}
        </button>
      </div>

      {/* Чипсы активных фильтров */}
      {(activeFilters.length > 0 || searchQuery) && (
        <div className="active-filters-chips">
          {searchQuery && (
            <span className="filter-chip">
              "{searchQuery}"
              <button onClick={() => setSearchQuery('')}>×</button>
            </span>
          )}
          {activeFilters.map(filter => (
            <span key={filter.key} className="filter-chip">
              {filter.label}
              <button onClick={() => removeFilter(filter.key)}>×</button>
            </span>
          ))}
          <button className="clear-all-filters" onClick={clearAllFilters}>
            Limpiar todo
          </button>
        </div>
      )}

      {/* Сортировка и количество результатов */}
      <div className="results-header">
        <div className="results-count">
          {resultsCount > 0 ? `Encontrados: ${resultsCount}` : 'No hay resultados'}
        </div>
        <div className="sort-controls">
          <select 
            className="sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="date">Por fecha</option>
            <option value="price_asc">Precio: menor a mayor</option>
            <option value="price_desc">Precio: mayor a menor</option>
          </select>
        </div>
      </div>

      {/* Модальное окно фильтров */}
      {showFilters && (
        <div className="filters-modal-overlay" onClick={() => setShowFilters(false)}>
          <div className="filters-modal" onClick={(e) => e.stopPropagation()}>
            <div className="filters-modal-header">
              <h2>Filtros</h2>
              <button className="close-filters-btn" onClick={() => setShowFilters(false)}>×</button>
            </div>
            
            <div className="filters-modal-content">
              <div className="filter-section">
                <h3>Precio</h3>
                <div className="price-filters">
                  <input
                    type="number"
                    className="price-input"
                    placeholder="Desde"
                    value={filters.minPrice}
                    onChange={(e) => setFilters({ ...filters, minPrice: e.target.value })}
                  />
                  <input
                    type="number"
                    className="price-input"
                    placeholder="Hasta"
                    value={filters.maxPrice}
                    onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value })}
                  />
                </div>
              </div>

              {/* Фильтры для квартир */}
              {category === 'rent' && (
                <div className="filter-section">
                  <h3>Características</h3>
                  
                  <div className="filter-group">
                    <label>Cantidad de habitaciones</label>
                    <select
                      className="filter-select"
                      value={filters.rooms}
                      onChange={(e) => setFilters({ ...filters, rooms: e.target.value })}
                    >
                      <option value="">Cualquiera</option>
                      <option value="1">1</option>
                      <option value="2">2</option>
                      <option value="3">3</option>
                      <option value="4">4</option>
                      <option value="5+">5+</option>
                    </select>
                  </div>

                  <div className="filter-group">
                    <label>Área, m²</label>
                    <div className="filter-row">
                      <input
                        type="number"
                        className="filter-input"
                        placeholder="Desde"
                        value={filters.totalArea}
                        onChange={(e) => setFilters({ ...filters, totalArea: e.target.value })}
                      />
                      <input
                        type="number"
                        className="filter-input"
                        placeholder="Hasta"
                        value={filters.livingArea}
                        onChange={(e) => setFilters({ ...filters, livingArea: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="filter-group">
                    <label>Piso</label>
                    <div className="filter-row">
                      <input
                        type="number"
                        className="filter-input-small"
                        placeholder="Piso"
                        value={filters.floor}
                        onChange={(e) => setFilters({ ...filters, floor: e.target.value })}
                      />
                      <span className="filter-separator">de</span>
                      <input
                        type="number"
                        className="filter-input-small"
                        placeholder="Total"
                        value={filters.floorFrom}
                        onChange={(e) => setFilters({ ...filters, floorFrom: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="filter-group">
                    <label>Remodelación</label>
                    <select
                      className="filter-select"
                      value={filters.renovation}
                      onChange={(e) => setFilters({ ...filters, renovation: e.target.value })}
                    >
                      <option value="">Cualquiera</option>
                      <option value="cosmetic">Cosmética</option>
                      <option value="euro">Euro</option>
                      <option value="designer">Diseñador</option>
                      <option value="none">Sin remodelación</option>
                    </select>
                  </div>

                  <div className="filter-group">
                    <label>Muebles</label>
                    <select
                      className="filter-select"
                      value={filters.furniture}
                      onChange={(e) => setFilters({ ...filters, furniture: e.target.value })}
                    >
                      <option value="">Cualquiera</option>
                      <option value="yes">Sí</option>
                      <option value="no">No</option>
                      <option value="partial">Parcial</option>
                    </select>
                  </div>

                  <div className="filter-group">
                    <label>Electrodomésticos</label>
                    <select
                      className="filter-select"
                      value={filters.appliances}
                      onChange={(e) => setFilters({ ...filters, appliances: e.target.value })}
                    >
                      <option value="">Cualquiera</option>
                      <option value="yes">Sí</option>
                      <option value="no">No</option>
                      <option value="partial">Parcial</option>
                    </select>
                  </div>

                  <div className="filter-group">
                    <label>Internet y TV</label>
                    <select
                      className="filter-select"
                      value={filters.internet}
                      onChange={(e) => setFilters({ ...filters, internet: e.target.value })}
                    >
                      <option value="">Cualquiera</option>
                      <option value="wifi">Wi-Fi</option>
                      <option value="cable">Cable</option>
                      <option value="both">Wi-Fi + Cable</option>
                      <option value="no">No</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            <div className="filters-modal-footer">
              <button 
                className="btn btn-outline"
                onClick={clearAllFilters}
              >
                Limpiar
              </button>
              <button 
                className="btn btn-primary"
                onClick={() => setShowFilters(false)}
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="empty-state">
          <div className="spinner"></div>
          <p>Cargando anuncios...</p>
        </div>
      ) : listings.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📭</div>
          <h3>No hay anuncios</h3>
          <p>No se encontraron anuncios en esta categoría.</p>
        </div>
      ) : (
        <div className="listings-grid">
          {listings.map(listing => (
            <ListingCard
              key={listing.id}
              listing={listing}
              onClick={() => onListingClick(listing)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default ListingFeed;

