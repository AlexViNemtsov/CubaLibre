import { useState, useEffect } from 'react';
import ListingCard from './ListingCard';
import './MyListings.css';

// Определяем API URL
const getApiUrl = () => {
  if (import.meta.env.DEV) {
    return 'http://localhost:3000/api';
  }
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  return 'https://cubalibre.onrender.com/api';
};

const API_URL = getApiUrl();

function MyListings({ onListingClick, initData, onBack, refreshKey = 0 }) {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('active'); // active, sold, all
  const [statusCounts, setStatusCounts] = useState({ active: 0, sold: 0, total: 0 });
  const [error, setError] = useState(null);

  // Загружаем счетчики один раз при монтировании
  useEffect(() => {
    const loadCounts = async () => {
      try {
        const headers = {};
        if (initData) {
          headers['X-Telegram-Init-Data'] = initData;
        }

        const [activeRes, soldRes] = await Promise.all([
          fetch(`${API_URL}/listings?my=true&status=active&limit=100`, { headers }),
          fetch(`${API_URL}/listings?my=true&status=sold&limit=100`, { headers })
        ]);

        if (!activeRes.ok) {
          const errorText = await activeRes.text();
          console.error('Error loading active listings for counts:', activeRes.status, errorText);
          return;
        }
        if (!soldRes.ok) {
          const errorText = await soldRes.text();
          console.error('Error loading sold listings for counts:', soldRes.status, errorText);
          return;
        }

        const activeData = await activeRes.json();
        const soldData = await soldRes.json();

        setStatusCounts({
          active: activeData.listings?.length || 0,
          sold: soldData.listings?.length || 0,
          total: (activeData.listings?.length || 0) + (soldData.listings?.length || 0)
        });
      } catch (error) {
        console.error('Error loading counts:', error);
      }
    };

    loadCounts();
  }, [initData]);

  useEffect(() => {
    loadListings();
  }, [activeTab, refreshKey]);

  const loadListings = async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = {};
      if (initData) {
        headers['X-Telegram-Init-Data'] = initData;
      }

      let allListings = [];

      if (activeTab === 'all') {
        // Загружаем все статусы отдельными запросами
        const [activeRes, soldRes] = await Promise.all([
          fetch(`${API_URL}/listings?my=true&status=active&limit=100`, { headers }),
          fetch(`${API_URL}/listings?my=true&status=sold&limit=100`, { headers })
        ]);

        if (!activeRes.ok) {
          const errorText = await activeRes.text();
          console.error('Error loading active listings:', activeRes.status, errorText);
          throw new Error(`Failed to load active listings: ${activeRes.status} ${activeRes.statusText}`);
        }
        if (!soldRes.ok) {
          const errorText = await soldRes.text();
          console.error('Error loading sold listings:', soldRes.status, errorText);
          throw new Error(`Failed to load sold listings: ${soldRes.status} ${soldRes.statusText}`);
        }

        const activeData = await activeRes.json();
        const soldData = await soldRes.json();

        // Объединяем и убираем дубликаты
        const allIds = new Set();
        [...(activeData.listings || []), ...(soldData.listings || [])].forEach(listing => {
          if (!allIds.has(listing.id)) {
            allIds.add(listing.id);
            allListings.push(listing);
          }
        });
      } else {
        // Загружаем только выбранный статус
        const params = new URLSearchParams({
          my: 'true',
          status: activeTab,
          limit: '100'
        });

        const response = await fetch(`${API_URL}/listings?${params}`, { headers });
        
        if (!response.ok) {
          // Если 401 (не авторизован) или 403 (нет доступа) - это нормально для пустого ЛК
          if (response.status === 401 || response.status === 403) {
            console.log('User not authenticated or no access, showing empty list');
            allListings = [];
          } else if (response.status === 500) {
            // Если 500 ошибка - возможно просто нет объявлений, показываем пустой список
            console.warn('Server error 500, showing empty list instead of error');
            allListings = [];
          } else {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`Failed to load listings: ${response.status} ${response.statusText}. ${errorData.message || ''}`);
          }
        } else {
          const data = await response.json();
          allListings = data.listings || [];
        }
      }
      
      // Сортируем по дате (новые сначала)
      const sorted = allListings.sort((a, b) => {
        const dateA = new Date(a.created_at || 0);
        const dateB = new Date(b.created_at || 0);
        return dateB - dateA;
      });

      setListings(sorted);
    } catch (error) {
      console.error('Error loading my listings:', error);
      console.error('Error details:', error.message);
      setError(error.message || 'Error al cargar tus anuncios');
    } finally {
      setLoading(false);
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
    <div className="my-listings">
      <div className="my-listings-header">
        <button className="btn-back" onClick={onBack}>←</button>
        <div className="logo-container">
          <img src="/images/logo.png" alt="Cuba Clasificados" className="app-logo-small" onError={(e) => {
            e.target.style.display = 'none';
          }} />
        </div>
        <h1>Mis anuncios</h1>
      </div>

      <div className="listings-tabs">
        <button 
          className={`tab-btn ${activeTab === 'active' ? 'active' : ''}`}
          onClick={() => setActiveTab('active')}
        >
          Activos ({statusCounts.active})
        </button>
        <button 
          className={`tab-btn ${activeTab === 'sold' ? 'active' : ''}`}
          onClick={() => setActiveTab('sold')}
        >
          Vendidos ({statusCounts.sold})
        </button>
        <button 
          className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          Todos ({statusCounts.total})
        </button>
      </div>

      {error ? (
        <div className="empty-state">
          <div className="empty-icon">⚠️</div>
          <h3>Error al cargar anuncios</h3>
          <p>{error}</p>
          <button 
            className="retry-btn"
            onClick={() => loadListings()}
            style={{
              marginTop: '16px',
              padding: '10px 20px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            Reintentar
          </button>
        </div>
      ) : listings.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📭</div>
          <h3>No tienes anuncios</h3>
          <p>
            {activeTab === 'active' && 'Aún no has publicado ningún anuncio activo'}
            {activeTab === 'sold' && 'No tienes anuncios vendidos'}
            {activeTab === 'all' && 'Aún no has publicado ningún anuncio'}
          </p>
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

      {/* Footer с Privacy Policy внизу страницы */}
      <footer style={{
        padding: '16px',
        textAlign: 'center',
        fontSize: '12px',
        color: 'rgba(255, 255, 255, 0.8)',
        marginTop: '40px',
        position: 'relative',
        zIndex: 10
      }}>
        <a 
          href="/privacy-policy.html" 
          target="_blank"
          style={{
            color: 'rgba(255, 255, 255, 0.9)',
            textDecoration: 'none'
          }}
        >
          Política de Privacidad
        </a>
      </footer>
    </div>
  );
}

export default MyListings;
