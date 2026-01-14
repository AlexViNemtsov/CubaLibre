// Утилита для работы с Telegram Web App API
// Использует встроенный window.Telegram.WebApp

let WebApp = null;

// Инициализация Telegram Web App
export function initTelegramWebApp() {
  if (typeof window !== 'undefined' && window.Telegram && window.Telegram.WebApp) {
    WebApp = window.Telegram.WebApp;
    WebApp.ready();
    WebApp.expand();
    return true;
  }
  return false;
}

// Получить initData для аутентификации
export function getInitData() {
  if (WebApp && WebApp.initData) {
    return WebApp.initData;
  }
  return '';
}

// Получить данные пользователя
export function getUser() {
  if (WebApp && WebApp.initDataUnsafe && WebApp.initDataUnsafe.user) {
    return WebApp.initDataUnsafe.user;
  }
  return null;
}

// Проверить цветовую схему
export function isDarkMode() {
  if (WebApp && WebApp.colorScheme) {
    return WebApp.colorScheme === 'dark';
  }
  return false;
}

// Показать alert
export function showAlert(message) {
  if (WebApp && WebApp.showAlert) {
    WebApp.showAlert(message);
  } else {
    alert(message);
  }
}

// Показать confirm
export function showConfirm(message, callback) {
  if (WebApp && WebApp.showConfirm) {
    WebApp.showConfirm(message, callback);
  } else {
    const result = confirm(message);
    if (callback) callback(result);
  }
}

export default {
  init: initTelegramWebApp,
  getInitData,
  getUser,
  isDarkMode,
  showAlert,
  showConfirm,
  get WebApp() {
    return WebApp;
  }
};




