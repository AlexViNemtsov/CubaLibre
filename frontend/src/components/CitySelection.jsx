import { useState, useEffect } from 'react';
import './CitySelection.css';

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

function CitySelection({ onSelect }) {
  const [cities, setCities] = useState([]);
  const [neighborhoods, setNeighborhoods] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/cities`)
      .then(res => {
        if (!res.ok) throw new Error('Network response was not ok');
        return res.json();
      })
      .then(data => {
        setCities(data.cities || []);
        setNeighborhoods(data.neighborhoods || {});
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching cities:', err);
        // Устанавливаем дефолтные значения при ошибке
        setCities([
          { id: 'la-habana', name: 'Habana', default: true },
          { id: 'all', name: 'Toda Cuba' }
        ]);
        setNeighborhoods({});
        setLoading(false);
      });
  }, []);

  const handleCityClick = (cityId) => {
    if (cityId === 'all') {
      onSelect('all');
    } else {
      // Для La Habana показываем выбор района
      const cityNeighborhoods = neighborhoods[cityId] || [];
      if (cityNeighborhoods.length > 0) {
        // Можно добавить выбор района, но для MVP просто выбираем город
        onSelect(cityId);
      } else {
        onSelect(cityId);
      }
    }
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="city-selection">
      <div className="city-selection-header">
        <h1>🏙️ Selecciona la ciudad</h1>
        <p>¿Dónde buscas anuncios?</p>
      </div>
      
      <div className="city-list">
        {cities.map(city => (
          <button
            key={city.id}
            className="city-card"
            onClick={() => handleCityClick(city.id)}
          >
            <div className="city-name">{city.name}</div>
            {city.default && <span className="city-badge">Por defecto</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

export default CitySelection;

