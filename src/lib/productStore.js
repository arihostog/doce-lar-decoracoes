import { products as defaultProducts } from '../data/products.js';
import { getVideoType } from './media.js';

export const PRODUCT_STORAGE_KEY = 'doce-lar-products';

export function normalizeProduct(product) {
  const mainPhoto = product.mainPhoto || '';
  const now = new Date().toISOString();
  const createdAt = product.createdAt || now;

  return {
    ...product,
    id: product.id || crypto.randomUUID(),
    sku: product.sku || '',
    name: product.name || '',
    category: product.category || 'Variedades',
    cost: Number(product.cost) || 0,
    price: Number(product.price) || 0,
    promotionalPrice:
      product.promotionalPrice === '' || product.promotionalPrice === null
        ? null
        : Number(product.promotionalPrice) || null,
    shortDescription: product.shortDescription || '',
    fullDescription: product.fullDescription || '',
    stock: Number(product.stock) || 0,
    mainPhoto,
    gallery: Array.isArray(product.gallery) && product.gallery.length > 0 ? product.gallery : [mainPhoto].filter(Boolean),
    video: product.video?.url ? { type: product.video.type || getVideoType(product.video.url), url: product.video.url } : null,
    status: product.status === 'inactive' ? 'inactive' : 'active',
    featured: Boolean(product.featured),
    promotion: Boolean(product.promotion),
    novelty: Boolean(product.novelty),
    internalNotes: product.internalNotes || '',
    createdAt,
    updatedAt: product.updatedAt || createdAt,
  };
}

export function getStoredProducts() {
  const fallbackProducts = defaultProducts.map(normalizeProduct);

  if (typeof localStorage === 'undefined') {
    return fallbackProducts;
  }

  try {
    const storedProducts = localStorage.getItem(PRODUCT_STORAGE_KEY);
    if (!storedProducts) {
      return fallbackProducts;
    }

    const parsedProducts = JSON.parse(storedProducts);
    if (!Array.isArray(parsedProducts)) {
      return fallbackProducts;
    }

    return parsedProducts.map(normalizeProduct);
  } catch {
    return fallbackProducts;
  }
}

export function saveStoredProducts(products) {
  const normalizedProducts = products.map(normalizeProduct);
  localStorage.setItem(PRODUCT_STORAGE_KEY, JSON.stringify(normalizedProducts));
  window.dispatchEvent(new CustomEvent('doce-lar-products-updated', { detail: normalizedProducts }));
  return normalizedProducts;
}

export function resetStoredProducts() {
  localStorage.removeItem(PRODUCT_STORAGE_KEY);
  const products = defaultProducts.map(normalizeProduct);
  window.dispatchEvent(new CustomEvent('doce-lar-products-updated', { detail: products }));
  return products;
}
