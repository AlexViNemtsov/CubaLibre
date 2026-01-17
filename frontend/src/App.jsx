import { useEffect, useState } from 'react';
import { initTelegramWebApp, getInitData, isDarkMode } from './utils/telegram';
import CitySelection from './components/CitySelection';
import CategoryTabs from './components/CategoryTabs';
import ListingFeed from './components/ListingFeed';
import ListingDetail from './components/ListingDetail';
import CreateListing from './components/CreateListing';
import MyListings from './components/MyListings';
import PropertyTypeModal from './components/PropertyTypeModal';
import Toast from './components/Toast';
import SubscriptionGate from './components/SubscriptionGate';
import { getUser } from './utils/telegram';
import './App.css';

function App() {
  const [currentScreen, setCurrentScreen] = useState('home'); // Начинаем с главной страницы (категории)
  const [selectedCity, setSelectedCity] = useState('la-habana');
  const [selectedNeighborhood, setSelectedNeighborhood] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('rent');
  const [propertyTransactionType, setPropertyTransactionType] = useState('rent'); // 'rent' или 'sale'
  const [selectedListing, setSelectedListing] = useState(null);
  const [initData, setInitData] = useState(null);
  const [feedRefreshKey, setFeedRefreshKey] = useState(0);
  const [myListingsRefreshKey, setMyListingsRefreshKey] = useState(0);
  const [showCityModal, setShowCityModal] = useState(false);
  const [showPropertyTypeModal, setShowPropertyTypeModal] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    try {
      // Инициализация Telegram Web App
      initTelegramWebApp();
      
      // Получаем initData для аутентификации
      const data = getInitData();
      setInitData(data);
      
      // Настройка темы
      if (isDarkMode()) {
        document.body.classList.add('dark');
      }
    } catch (error) {
      console.error('Error initializing app:', error);
      // Продолжаем работу даже если Telegram Web App не доступен
    }
  }, []);

  const handleCitySelect = (city, neighborhood = null) => {
    setSelectedCity(city);
    setSelectedNeighborhood(neighborhood);
    setShowCityModal(false);
    // Обновляем список объявлений при смене города
    if (currentScreen === 'feed') {
      setFeedRefreshKey(prev => prev + 1);
    }
  };

  const handleCategorySelect = (category) => {
    // Если выбрана категория недвижимости, показываем модальное окно выбора типа
    if (category === 'rent') {
      setShowPropertyTypeModal(true);
    } else {
      setSelectedCategory(category);
      setCurrentScreen('feed');
    }
  };

  const handlePropertyTypeSelect = (transactionType) => {
    setShowPropertyTypeModal(false);
    
    // Если выбрано "Сдать" или "Продать", сразу открываем форму создания
    if (transactionType === 'rent_create') {
      setPropertyTransactionType('rent');
      setSelectedCategory('rent');
      setCurrentScreen('create');
    } else if (transactionType === 'sale_create') {
      setPropertyTransactionType('sale');
      setSelectedCategory('rent');
      setCurrentScreen('create');
    } else {
      // Если выбрано "Арендовать" или "Купить", переходим в feed
      setPropertyTransactionType(transactionType);
      setSelectedCategory('rent');
      setCurrentScreen('feed');
    }
  };

  const handleListingClick = (listing) => {
    setSelectedListing(listing);
    setCurrentScreen('detail');
    // Прокрутка вверх при переходе к деталям объявления
    window.scrollTo(0, 0);
  };

  const handleBack = () => {
    if (currentScreen === 'detail') {
      setCurrentScreen('feed');
      setSelectedListing(null);
    } else if (currentScreen === 'feed') {
      setCurrentScreen('home'); // Возвращаемся на главную (категории)
    } else if (currentScreen === 'create' || currentScreen === 'edit') {
      setCurrentScreen('feed');
      setSelectedListing(null);
    } else if (currentScreen === 'my-listings') {
      setCurrentScreen('home'); // Возвращаемся на главную
    }
  };

  // Получаем название города для отображения
  const getCityName = () => {
    const cityNames = {
      'la-habana': 'Habana',
      'santiago-de-cuba': 'Santiago',
      'camaguey': 'Camagüey',
      'holguin': 'Holguín',
      'santa-clara': 'Santa Clara',
      'guantanamo': 'Guantánamo',
      'bayamo': 'Bayamo',
      'pinar-del-rio': 'Pinar del Río',
      'cienfuegos': 'Cienfuegos',
      'matanzas': 'Matanzas',
      'las-tunas': 'Las Tunas',
      'sancti-spiritus': 'Sancti Spíritus',
      'ciiego-de-avila': 'Ciego de Ávila',
      'villa-clara': 'Villa Clara',
      'artemisa': 'Artemisa',
      'mayabeque': 'Mayabeque',
      'isla-de-la-juventud': 'Isla de la Juventud',
      'all': 'Toda Cuba'
    };
    return cityNames[selectedCity] || selectedCity;
  };

  const handleCreateListing = () => {
    setCurrentScreen('create');
  };

  const handleListingCreated = (isEditing = false) => {
    setCurrentScreen('feed');
    setSelectedListing(null);
    // Принудительно обновляем список объявлений
    setFeedRefreshKey(prev => prev + 1);
    setMyListingsRefreshKey(prev => prev + 1);
    // Показываем toast-уведомление
    setToast({
      message: isEditing ? 'Anuncio actualizado exitosamente' : 'Anuncio publicado exitosamente',
      type: 'success'
    });
  };

  const handleEditListing = (listing) => {
    setSelectedListing(listing);
    setCurrentScreen('edit');
  };

  const handleDeleteListing = () => {
    setSelectedListing(null);
    // Если мы в "Мои объявления", остаемся там, иначе возвращаемся в feed
    if (currentScreen === 'my-listings') {
      // Остаемся в "Мои объявления"
    } else {
      setCurrentScreen('feed');
    }
    // Принудительно обновляем список объявлений
    setFeedRefreshKey(prev => prev + 1);
    setMyListingsRefreshKey(prev => prev + 1);
  };

  const handleProfileClick = () => {
    setCurrentScreen('my-listings');
  };

  // Получаем данные пользователя для отображения
  const currentUser = getUser();
  const getUserInitials = () => {
    if (currentUser && currentUser.first_name) {
      return currentUser.first_name.charAt(0).toUpperCase();
    }
    return '👤';
  };

  return (
    <SubscriptionGate>
    <div className="app">
      {/* Главная страница - категории (как на Avito) */}
      {currentScreen === 'home' && (
        <div className="home-screen">
          <div className="header">
            <div className="logo-container">
              <img src="/images/logo.png" alt="Cuba Clasificados" className="app-logo" onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'block';
              }} />
              <h1 className="logo-text" style={{display: 'none'}}>Cuba Clasificados®</h1>
            </div>
            <div className="header-actions">
              <button 
                className="btn-city-selector"
                onClick={() => setShowCityModal(true)}
              >
                📍 {getCityName()}
              </button>
              <button 
                className="btn-profile"
                onClick={handleProfileClick}
                title="Mis anuncios"
              >
                {getUserInitials()}
              </button>
            </div>
          </div>
          <div className="home-content">
            <div className="categories-header-text">
              <h2>Cuba Clasificados</h2>
              <p>Plataforma gratuita para publicar y buscar anuncios</p>
            </div>
            <div className="categories-section">
              <div className="section-label">Selecciona una categoría</div>
              <CategoryTabs 
                selected={selectedCategory} 
                onSelect={handleCategorySelect}
              />
            </div>
          </div>
        </div>
      )}
      
      {currentScreen === 'feed' && (
        <div className="feed-screen">
          <div className="header">
            <button className="btn-back" onClick={handleBack}>←</button>
            <div className="logo-container">
              <img src="/images/logo.png" alt="Cuba Clasificados" className="app-logo-small" onError={(e) => {
                e.target.style.display = 'none';
              }} />
            </div>
            <h1>
              {selectedCategory === 'rent' && propertyTransactionType === 'sale' && '🏠 Comprar Inmuebles'}
              {selectedCategory === 'rent' && propertyTransactionType === 'rent' && '🏠 Alquiler'}
              {selectedCategory === 'rent' && !propertyTransactionType && '🏠 Inmuebles'}
              {selectedCategory === 'items' && '👕 Artículos'}
              {selectedCategory === 'services' && '🛠 Servicios'}
            </h1>
            <div className="header-actions">
              <button 
                className="btn-city-selector"
                onClick={() => setShowCityModal(true)}
              >
                📍 {getCityName()}
              </button>
              <button 
                className="btn-profile"
                onClick={handleProfileClick}
                title="Mis anuncios"
              >
                {getUserInitials()}
              </button>
              <button className="btn-add" onClick={handleCreateListing}>+</button>
            </div>
          </div>
          <ListingFeed
            key={feedRefreshKey}
            category={selectedCategory}
            city={selectedCity}
            neighborhood={selectedNeighborhood}
            onListingClick={handleListingClick}
            initData={initData}
            propertyTransactionType={selectedCategory === 'rent' ? propertyTransactionType : null}
          />
        </div>
      )}
      
      {currentScreen === 'detail' && selectedListing && (
        <ListingDetail
          listing={selectedListing}
          onBack={handleBack}
          onEdit={handleEditListing}
          onDelete={handleDeleteListing}
          onSuccess={(message) => setToast({ message, type: 'success' })}
        />
      )}
      
      {currentScreen === 'create' && (
        <CreateListing
          category={selectedCategory}
          city={selectedCity}
          neighborhood={selectedNeighborhood}
          onBack={handleBack}
          onCreated={() => handleListingCreated(false)}
          initData={initData}
          propertyTransactionType={selectedCategory === 'rent' ? propertyTransactionType : 'rent'}
        />
      )}

      {currentScreen === 'edit' && selectedListing && (
        <CreateListing
          category={selectedListing.category}
          city={selectedListing.city}
          neighborhood={selectedListing.neighborhood}
          onBack={handleBack}
          onCreated={() => handleListingCreated(true)}
          initData={initData}
          editingListing={selectedListing}
        />
      )}

      {/* Toast уведомления */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Footer с Privacy Policy */}
      <footer style={{
        padding: '16px',
        textAlign: 'center',
        fontSize: '12px',
        color: '#999',
        borderTop: '1px solid rgba(0,0,0,0.05)',
        marginTop: 'auto'
      }}>
        <a 
          href="/privacy-policy.html" 
          target="_blank"
          style={{
            color: '#667eea',
            textDecoration: 'none'
          }}
        >
          Política de Privacidad
        </a>
      </footer>

      {currentScreen === 'my-listings' && (
        <MyListings
          onListingClick={handleListingClick}
          initData={initData}
          onBack={handleBack}
          refreshKey={myListingsRefreshKey}
        />
      )}

      {/* Модальное окно выбора города */}
      {showCityModal && (
        <div className="city-modal-overlay" onClick={() => setShowCityModal(false)}>
          <div className="city-modal" onClick={(e) => e.stopPropagation()}>
            <div className="city-modal-header">
              <h2>Selecciona una ciudad</h2>
              <button className="close-modal-btn" onClick={() => setShowCityModal(false)}>×</button>
            </div>
            <div className="city-modal-content">
              <CitySelection onSelect={handleCitySelect} />
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно выбора типа недвижимости (аренда/покупка) */}
      {showPropertyTypeModal && (
        <PropertyTypeModal
          onSelect={handlePropertyTypeSelect}
          onClose={() => setShowPropertyTypeModal(false)}
        />
      )}
    </div>
    </SubscriptionGate>
  );
}

export default App;

