import { useEffect, useState } from 'react';
import { initTelegramWebApp, getInitData, isDarkMode } from './utils/telegram';
import CitySelection from './components/CitySelection';
import CategoryTabs from './components/CategoryTabs';
import ListingFeed from './components/ListingFeed';
import ListingDetail from './components/ListingDetail';
import CreateListing from './components/CreateListing';
import './App.css';

function App() {
  const [currentScreen, setCurrentScreen] = useState('city-selection');
  const [selectedCity, setSelectedCity] = useState('la-habana');
  const [selectedNeighborhood, setSelectedNeighborhood] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('rent');
  const [selectedListing, setSelectedListing] = useState(null);
  const [initData, setInitData] = useState(null);

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
    setCurrentScreen('categories');
  };

  const handleCategorySelect = (category) => {
    setSelectedCategory(category);
    setCurrentScreen('feed');
  };

  const handleListingClick = (listing) => {
    setSelectedListing(listing);
    setCurrentScreen('detail');
  };

  const handleBack = () => {
    if (currentScreen === 'detail') {
      setCurrentScreen('feed');
      setSelectedListing(null);
    } else if (currentScreen === 'feed') {
      setCurrentScreen('categories');
    } else if (currentScreen === 'categories') {
      setCurrentScreen('city-selection');
    } else if (currentScreen === 'create') {
      setCurrentScreen('feed');
    }
  };

  const handleCreateListing = () => {
    setCurrentScreen('create');
  };

  const handleListingCreated = () => {
    setCurrentScreen('feed');
  };

  return (
    <div className="app">
      {currentScreen === 'city-selection' && (
        <CitySelection onSelect={handleCitySelect} />
      )}
      
      {currentScreen === 'categories' && (
        <>
          <div className="header">
            <button className="btn-back" onClick={handleBack}>←</button>
            <h1>Cuba Clasificados</h1>
          </div>
          <CategoryTabs 
            selected={selectedCategory} 
            onSelect={handleCategorySelect}
          />
        </>
      )}
      
      {currentScreen === 'feed' && (
        <>
          <div className="header">
            <button className="btn-back" onClick={handleBack}>←</button>
            <h1>
              {selectedCategory === 'rent' && '🏠 Alquiler'}
              {selectedCategory === 'items' && '👕 Artículos'}
              {selectedCategory === 'services' && '🛠 Servicios'}
            </h1>
            <button className="btn-add" onClick={handleCreateListing}>+</button>
          </div>
          <ListingFeed
            category={selectedCategory}
            city={selectedCity}
            neighborhood={selectedNeighborhood}
            onListingClick={handleListingClick}
            initData={initData}
          />
        </>
      )}
      
      {currentScreen === 'detail' && selectedListing && (
        <ListingDetail
          listing={selectedListing}
          onBack={handleBack}
        />
      )}
      
      {currentScreen === 'create' && (
        <CreateListing
          category={selectedCategory}
          city={selectedCity}
          neighborhood={selectedNeighborhood}
          onBack={handleBack}
          onCreated={handleListingCreated}
          initData={initData}
        />
      )}
    </div>
  );
}

export default App;

