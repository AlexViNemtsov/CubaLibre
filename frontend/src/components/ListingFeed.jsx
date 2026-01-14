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

function ListingFeed({ category, city, neighborhood, onListingClick, initData }) {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
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

  useEffect(() => {
    loadListings();
  }, [category, city, neighborhood]);

  const loadListings = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        category,
        city: city === 'all' ? '' : city,
        status: 'active',
        limit: '50'
      });

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
      const data = await response.json();
      
      // Сортируем: сначала район, потом город, потом страна
      const sorted = data.listings.sort((a, b) => {
        if (a.scope === 'NEIGHBORHOOD' && b.scope !== 'NEIGHBORHOOD') return -1;
        if (a.scope !== 'NEIGHBORHOOD' && b.scope === 'NEIGHBORHOOD') return 1;
        if (a.scope === 'CITY' && b.scope === 'COUNTRY') return -1;
        if (a.scope === 'COUNTRY' && b.scope === 'CITY') return 1;
        return 0;
      });

      setListings(sorted);
    } catch (error) {
      console.error('Error loading listings:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery || Object.values(filters).some(v => v !== '')) {
        loadListings();
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, filters]);

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="listing-feed">
      <div className="feed-filters">
        <input
          type="text"
          className="search-input"
          placeholder="🔍 Buscar..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        
        <div className="price-filters">
          <input
            type="number"
            className="price-input"
            placeholder="Precio desde"
            value={filters.minPrice}
            onChange={(e) => setFilters({ ...filters, minPrice: e.target.value })}
          />
          <input
            type="number"
            className="price-input"
            placeholder="Precio hasta"
            value={filters.maxPrice}
            onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value })}
          />
        </div>

        {/* Фильтры для квартир */}
        {category === 'rent' && (
          <>
            <button 
              className="filter-toggle-btn"
              onClick={() => setShowFilters(!showFilters)}
            >
              {showFilters ? '▼' : '▶'} Filtros de apartamento
            </button>
            
            {showFilters && (
              <div className="apartment-filters">
                <div className="filter-row">
                  <label>Cantidad de habitaciones:</label>
                  <select
                    className="filter-select"
                    value={filters.rooms}
                    onChange={(e) => setFilters({ ...filters, rooms: e.target.value })}
                  >
                    <option value="">(seleccionar)</option>
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="4">4</option>
                    <option value="5+">5+</option>
                  </select>
                </div>

                <div className="filter-row">
                  <label>Área total:</label>
                  <input
                    type="number"
                    className="filter-input"
                    placeholder="m²"
                    value={filters.totalArea}
                    onChange={(e) => setFilters({ ...filters, totalArea: e.target.value })}
                  />
                </div>

                <div className="filter-row">
                  <label>Área habitable:</label>
                  <input
                    type="number"
                    className="filter-input"
                    placeholder="m²"
                    value={filters.livingArea}
                    onChange={(e) => setFilters({ ...filters, livingArea: e.target.value })}
                  />
                </div>

                <div className="filter-row">
                  <label>Piso:</label>
                  <input
                    type="number"
                    className="filter-input-small"
                    placeholder=""
                    value={filters.floor}
                    onChange={(e) => setFilters({ ...filters, floor: e.target.value })}
                  />
                  <span className="filter-separator">de</span>
                  <input
                    type="number"
                    className="filter-input-small"
                    placeholder=""
                    value={filters.floorFrom}
                    onChange={(e) => setFilters({ ...filters, floorFrom: e.target.value })}
                  />
                </div>

                <div className="filter-row">
                  <label>Remodelación:</label>
                  <select
                    className="filter-select"
                    value={filters.renovation}
                    onChange={(e) => setFilters({ ...filters, renovation: e.target.value })}
                  >
                    <option value="">(seleccionar)</option>
                    <option value="cosmetic">Cosmética</option>
                    <option value="euro">Euro</option>
                    <option value="designer">Diseñador</option>
                    <option value="none">Sin remodelación</option>
                  </select>
                </div>

                <div className="filter-row">
                  <label>Muebles:</label>
                  <select
                    className="filter-select"
                    value={filters.furniture}
                    onChange={(e) => setFilters({ ...filters, furniture: e.target.value })}
                  >
                    <option value="">(seleccionar)</option>
                    <option value="yes">Sí</option>
                    <option value="no">No</option>
                    <option value="partial">Parcial</option>
                  </select>
                </div>

                <div className="filter-row">
                  <label>Electrodomésticos:</label>
                  <select
                    className="filter-select"
                    value={filters.appliances}
                    onChange={(e) => setFilters({ ...filters, appliances: e.target.value })}
                  >
                    <option value="">(seleccionar)</option>
                    <option value="yes">Sí</option>
                    <option value="no">No</option>
                    <option value="partial">Parcial</option>
                  </select>
                </div>

                <div className="filter-row">
                  <label>Internet y TV:</label>
                  <select
                    className="filter-select"
                    value={filters.internet}
                    onChange={(e) => setFilters({ ...filters, internet: e.target.value })}
                  >
                    <option value="">(seleccionar)</option>
                    <option value="wifi">Wi-Fi</option>
                    <option value="cable">Cable</option>
                    <option value="both">Wi-Fi + Cable</option>
                    <option value="no">No</option>
                  </select>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {listings.length === 0 ? (
        <div className="empty-state">
          <p>No hay anuncios en esta categoría</p>
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

