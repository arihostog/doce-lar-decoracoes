import { storeConfig } from '../config/store.js';

export const STORE_SETTINGS_KEY = 'doce-lar-store-settings';

export function getDefaultStoreSettings() {
  return {
    name: storeConfig.name,
    subtitle: storeConfig.subtitle,
    whatsappNumber: storeConfig.whatsappNumber,
    instagram: storeConfig.instagram,
    address: storeConfig.address,
    openingHours: storeConfig.openingHours,
    whatsappDefaultMessage: storeConfig.whatsappDefaultMessage,
    bannerText: storeConfig.bannerText,
    defaultCustomerName: storeConfig.defaultCustomerName,
    defaultCustomerPhone: storeConfig.defaultCustomerPhone,
  };
}

export function normalizeWhatsappNumber(value) {
  return String(value || '').replace(/\D/g, '');
}

export function normalizeStoreSettings(settings) {
  const defaults = getDefaultStoreSettings();

  return {
    ...defaults,
    ...settings,
    name: settings?.name || defaults.name,
    subtitle: settings?.subtitle || defaults.subtitle,
    whatsappNumber: normalizeWhatsappNumber(settings?.whatsappNumber || defaults.whatsappNumber),
    whatsappDefaultMessage:
      settings?.whatsappDefaultMessage || defaults.whatsappDefaultMessage,
    bannerText: settings?.bannerText || defaults.bannerText,
  };
}

export function getStoredStoreSettings() {
  const defaults = getDefaultStoreSettings();

  if (typeof localStorage === 'undefined') {
    return defaults;
  }

  try {
    const storedSettings = localStorage.getItem(STORE_SETTINGS_KEY);
    if (!storedSettings) {
      return defaults;
    }

    return normalizeStoreSettings(JSON.parse(storedSettings));
  } catch {
    return defaults;
  }
}

export function saveStoredStoreSettings(settings) {
  const normalizedSettings = normalizeStoreSettings(settings);
  localStorage.setItem(STORE_SETTINGS_KEY, JSON.stringify(normalizedSettings));
  window.dispatchEvent(
    new CustomEvent('doce-lar-store-settings-updated', { detail: normalizedSettings }),
  );
  return normalizedSettings;
}
