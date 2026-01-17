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

// Компонент выбора города - передеплой после отключения кеширования
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
    console.log('City clicked:', cityId);
    if (!onSelect) {
      console.error('onSelect callback is not provided');
      return;
    }
    
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
        <h1>Cuba Clasificados - plataforma gratuita única para Cuba</h1>
      </div>
      
      <div className="city-list">
        {cities.map((city, index) => {
          // Определяем градиент для каждого города
          const gradients = [
            'gradient-blue',
            'gradient-red',
            'gradient-gold',
            'gradient-green',
            'gradient-purple',
            'gradient-orange',
            'gradient-teal',
            'gradient-pink'
          ];
          const gradientClass = city.id === 'all' 
            ? 'gradient-special' 
            : gradients[index % gradients.length];
          
          // Уникальные иконки для каждого города
          const cityIcons = {
            'all': '🇨🇺',
            'la-habana': '🏛️',
            'santiago-de-cuba': '⛰️',
            'camaguey': '🏰',
            'holguin': '🌴',
            'santa-clara': '🎭',
            'guantanamo': '🌊',
            'bayamo': '🎺',
            'cienfuegos': '⚓',
            'pinar-del-rio': '🌾',
            'matanzas': '🌉',
            'las-tunas': '🌵',
            'sancti-spiritus': '⛪',
            'ciiego-de-avila': '🌺',
            'villa-clara': '🏖️',
            'artemisa': '🌻',
            'mayabeque': '🌿',
            'isla-de-la-juventud': '🏝️'
          };
          
          return (
            <button
              key={city.id}
              type="button"
              className={`city-card ${gradientClass}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Button clicked for city:', city.id);
                handleCityClick(city.id);
              }}
            >
              <div className="city-icon">
                {cityIcons[city.id] || '🏙️'}
              </div>
              <div className="city-name">{city.name}</div>
              {city.default && <span className="city-badge">⭐ Por defecto</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default CitySelection;

