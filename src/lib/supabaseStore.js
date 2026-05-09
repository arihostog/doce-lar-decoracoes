import { categories as defaultCategories } from '../data/products.js';
import { getSupabaseConfig, isSupabaseConfigured, supabase } from './supabaseClient.js';
import {
  getStoredProducts,
  normalizeProduct,
  PRODUCT_STORAGE_KEY,
  saveStoredProducts,
} from './productStore.js';
import {
  addStoredOrder,
  getStoredOrders,
  ORDER_STORAGE_KEY,
  saveStoredOrders,
  updateStoredOrderStatus,
} from './orderStore.js';
import {
  getStoredStoreSettings,
  normalizeStoreSettings,
  saveStoredStoreSettings,
  STORE_SETTINGS_KEY,
} from './storeSettings.js';
import { getVideoType } from './media.js';

const FAILED_FETCH_HELP =
  'Não foi possível conectar ao Supabase. Verifique internet, URL, chave anon, bloqueio do navegador, extensão/adblock ou instabilidade do Supabase.';

let lastSupabaseError = null;
let lastConnectionTest = null;

function setSupabaseError(error) {
  lastSupabaseError = normalizeSupabaseError(error);
  return lastSupabaseError;
}

function clearSupabaseError() {
  lastSupabaseError = null;
}

function normalizeSupabaseError(error) {
  const message = error?.message || String(error || '');

  return {
    name: error?.name || '',
    message,
    stack: error?.stack || '',
    details: error?.details || '',
    hint: error?.hint || '',
    code: error?.code || '',
    friendlyMessage: message.includes('Failed to fetch') ? FAILED_FETCH_HELP : '',
  };
}

export function getSupabaseDiagnostics() {
  const config = getSupabaseConfig();
  return {
    url: config.url,
    finalUrl: config.finalUrl,
    anonKey: config.anonKeyPreview,
    anonKeyLength: config.anonKeyLength,
    anonKeyStart: config.anonKeyStart,
    anonKeyEnd: config.anonKeyEnd,
    isConfigured: config.isConfigured,
    mode: config.isConfigured && !lastSupabaseError ? 'supabase' : 'localStorage',
    lastError: lastSupabaseError,
    connectionTest: lastConnectionTest,
  };
}

function canUseSupabase() {
  return isSupabaseConfigured() && supabase;
}

export async function testSupabaseConnection() {
  if (!canUseSupabase()) {
    const error = new Error('Supabase nao configurado. Confira VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');
    setSupabaseError(error);
    lastConnectionTest = {
      ok: false,
      table: 'categories',
      result: null,
      error: lastSupabaseError,
      checkedAt: new Date().toISOString(),
    };
    return lastConnectionTest;
  }

  try {
    const { data, error, status, statusText } = await supabase
      .from('categories')
      .select('*')
      .limit(1);

    if (error) {
      throw error;
    }

    clearSupabaseError();
    lastConnectionTest = {
      ok: true,
      table: 'categories',
      status,
      statusText,
      result: data,
      error: null,
      checkedAt: new Date().toISOString(),
    };
    return lastConnectionTest;
  } catch (error) {
    setSupabaseError(error);
    lastConnectionTest = {
      ok: false,
      table: 'categories',
      result: null,
      error: lastSupabaseError,
      checkedAt: new Date().toISOString(),
    };
    return lastConnectionTest;
  }
}

function normalizeCategory(row) {
  return row?.name || row?.title || row?.label || row?.category || '';
}

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || ''),
  );
}

function productFromSupabase(row) {
  const videoUrl = row.video_url ?? row.videoUrl ?? row.video?.url ?? '';

  return normalizeProduct({
    id: row.id,
    sku: row.code ?? row.sku,
    name: row.name,
    category: row.category || row.category_name || row.categories?.name,
    categoryId: row.category_id ?? row.categoryId,
    cost: row.cost_price ?? row.cost,
    price: row.price ?? row.sale_price,
    promotionalPrice: row.promotional_price ?? row.promotionalPrice ?? row.salePrice,
    shortDescription: row.short_description ?? row.shortDescription,
    fullDescription: row.description ?? row.full_description ?? row.fullDescription,
    stock: row.stock,
    mainPhoto: row.main_image ?? row.image ?? row.imageUrl ?? row.main_photo ?? row.mainPhoto,
    gallery: row.gallery,
    video: videoUrl ? { type: getVideoType(videoUrl), url: videoUrl } : row.video,
    internalNotes: row.internal_notes ?? row.internalNotes,
    featured: row.is_featured ?? row.featured,
    promotion: row.is_promotion ?? row.promotion,
    novelty: row.is_new ?? row.isNew ?? row.novelty,
    status: row.active === false ? 'inactive' : row.status,
    createdAt: row.created_at ?? row.createdAt,
    updatedAt: row.updated_at ?? row.updatedAt,
  });
}

function productToSupabase(product) {
  const normalized = normalizeProduct(product);
  const salePrice = normalized.promotionalPrice ?? normalized.price;
  const profitMargin = salePrice ? ((salePrice - normalized.cost) / salePrice) * 100 : 0;
  const videoUrl = product.videoUrl || normalized.video?.url || '';
  const code = product.code || normalized.sku || (!isUuid(normalized.id) ? normalized.id : '');

  const payload = {
    name: normalized.name,
    category_id: product.categoryId || product.category_id || null,
    category: normalized.category,
    short_description: normalized.shortDescription,
    description: normalized.fullDescription,
    price: normalized.price,
    promotional_price: normalized.promotionalPrice,
    cost_price: normalized.cost,
    profit_margin: Number(profitMargin.toFixed(2)),
    stock: normalized.stock,
    main_image: product.image || product.imageUrl || normalized.mainPhoto,
    gallery: Array.isArray(normalized.gallery) ? normalized.gallery : [],
    video_url: videoUrl,
    is_featured: normalized.featured,
    is_promotion: normalized.promotion,
    is_new: product.new ?? product.isNew ?? normalized.novelty,
    active: normalized.status === 'active',
    internal_notes: normalized.internalNotes,
    created_at: normalized.createdAt,
    updated_at: normalized.updatedAt,
  };

  if (isUuid(normalized.id)) {
    payload.id = normalized.id;
  }

  if (code) {
    payload.code = code;
  }

  return payload;
}

function orderFromSupabase(row) {
  const deliveryAddressText = row.delivery_address ?? row.address ?? '';

  return {
    id: row.id,
    orderNumber: row.order_number ?? row.orderNumber,
    customerName: row.customer_name ?? row.customerName,
    customerPhone: row.customer_phone ?? row.customerPhone,
    fulfillment: row.delivery_type ?? row.fulfillment,
    address: deliveryAddressText,
    deliveryAddress: row.deliveryAddress ?? parseDeliveryAddressText(deliveryAddressText),
    paymentMethod: row.payment_method ?? row.paymentMethod,
    notes: row.observations ?? row.notes,
    total: Number(row.total) || 0,
    status: normalizeOrderStatus(row.status),
    createdAt: row.created_at ?? row.createdAt,
    updatedAt: row.updated_at ?? row.updatedAt,
    items: Array.isArray(row.items) ? row.items : [],
    whatsappMessage: row.whatsapp_message ?? row.whatsappMessage ?? '',
  };
}

function orderToSupabase(order) {
  const deliveryAddress = buildDeliveryAddressText(order);

  return {
    id: order.id,
    order_number: order.orderNumber,
    customer_name: order.customerName,
    customer_phone: order.customerPhone,
    delivery_type: order.fulfillment,
    delivery_address: deliveryAddress,
    payment_method: order.paymentMethod,
    observations: order.notes,
    total: order.total,
    status: normalizeOrderStatusForSupabase(order.status),
    created_at: order.createdAt,
    updated_at: new Date().toISOString(),
    items: order.items,
    whatsapp_message: order.whatsappMessage || '',
  };
}

function buildDeliveryAddressText(order) {
  if (order.fulfillment !== 'Receber por entrega') {
    return 'Retirada na loja após confirmação do pedido pelo WhatsApp.';
  }

  return (
    order.address ||
    [
      order.deliveryAddress?.street,
      order.deliveryAddress?.number,
      order.deliveryAddress?.neighborhood,
      order.deliveryAddress?.city,
      order.deliveryAddress?.reference,
    ]
      .filter(Boolean)
      .join(', ')
  );
}

function parseDeliveryAddressText(value) {
  return {
    street: value || '',
    number: '',
    neighborhood: '',
    city: '',
    reference: '',
  };
}

function normalizeOrderStatus(status) {
  const value = String(status || '').toLowerCase();
  const statusMap = {
    novo: 'Novo',
    'em atendimento': 'Em atendimento',
    separado: 'Separado',
    entregue: 'Entregue',
    cancelado: 'Cancelado',
  };

  return statusMap[value] || status || 'Novo';
}

function normalizeOrderStatusForSupabase(status) {
  const value = normalizeOrderStatus(status);
  return value === 'Novo' ? 'novo' : value;
}

function settingsFromSupabase(row) {
  return normalizeStoreSettings({
    name: row.name,
    subtitle: row.subtitle,
    whatsappNumber: row.whatsapp_number ?? row.whatsappNumber,
    instagram: row.instagram,
    address: row.address,
    openingHours: row.opening_hours ?? row.openingHours,
    whatsappDefaultMessage: row.whatsapp_default_message ?? row.whatsappDefaultMessage,
    bannerText: row.banner_text ?? row.bannerText,
    defaultCustomerName: row.default_customer_name ?? row.defaultCustomerName,
    defaultCustomerPhone: row.default_customer_phone ?? row.defaultCustomerPhone,
  });
}

function settingsToSupabase(settings) {
  const normalized = normalizeStoreSettings(settings);
  return {
    id: 'default',
    name: normalized.name,
    subtitle: normalized.subtitle,
    whatsapp_number: normalized.whatsappNumber,
    instagram: normalized.instagram,
    address: normalized.address,
    opening_hours: normalized.openingHours,
    whatsapp_default_message: normalized.whatsappDefaultMessage,
    banner_text: normalized.bannerText,
    default_customer_name: normalized.defaultCustomerName,
    default_customer_phone: normalized.defaultCustomerPhone,
    updated_at: new Date().toISOString(),
  };
}

async function runWithFallback(operation, fallback) {
  if (!canUseSupabase()) {
    return fallback();
  }

  try {
    const result = await operation();
    clearSupabaseError();
    return result;
  } catch (error) {
    setSupabaseError(error);
    return fallback(error);
  }
}

export async function listCategories() {
  return runWithFallback(async () => {
    const { data, error } = await supabase.from('categories').select('*').order('name');
    if (error) throw error;
    const names = data.map(normalizeCategory).filter(Boolean);
    return names.length > 0 ? ['Todos', ...names.filter((name) => name !== 'Todos')] : defaultCategories;
  }, () => defaultCategories);
}

export async function createCategory(name) {
  return runWithFallback(async () => {
    const { error } = await supabase
      .from('categories')
      .upsert({ name, slug: slugify(name) }, { onConflict: 'slug' });
    if (error) throw error;
    return listCategories();
  }, () => defaultCategories);
}

export async function updateCategory(id, name) {
  return runWithFallback(async () => {
    const { error } = await supabase.from('categories').update({ name }).eq('id', id);
    if (error) throw error;
    return listCategories();
  }, () => defaultCategories);
}

export async function deleteCategory(id) {
  return runWithFallback(async () => {
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (error) throw error;
    return listCategories();
  }, () => defaultCategories);
}

export async function listProducts({ activeOnly = false } = {}) {
  return runWithFallback(async () => {
    let query = supabase.from('products').select('*').order('created_at', { ascending: false });
    if (activeOnly) {
      query = query.eq('active', true);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data.map(productFromSupabase);
  }, () => {
    const products = getStoredProducts();
    return activeOnly ? products.filter((product) => product.status === 'active') : products;
  });
}

export async function saveProduct(product) {
  return runWithFallback(async () => {
    const { error } = await supabase.from('products').upsert(productToSupabase(product));
    if (error) throw error;
    return listProducts();
  }, () => {
    const normalized = normalizeProduct(product);
    const current = getStoredProducts();
    const exists = current.some((item) => item.id === normalized.id);
    return saveStoredProducts(
      exists
        ? current.map((item) => (item.id === normalized.id ? normalized : item))
        : [normalized, ...current],
    );
  });
}

export async function saveProducts(products) {
  return runWithFallback(async () => {
    const { error } = await supabase.from('products').upsert(products.map(productToSupabase));
    if (error) throw error;
    return listProducts();
  }, () => saveStoredProducts(products));
}

export async function deleteProduct(productId) {
  return runWithFallback(async () => {
    const { error } = await supabase.from('products').delete().eq('id', productId);
    if (error) throw error;
    return listProducts();
  }, () => saveStoredProducts(getStoredProducts().filter((product) => product.id !== productId)));
}

export async function listOrders() {
  return runWithFallback(async () => {
    const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data.map(orderFromSupabase);
  }, () => getStoredOrders());
}

export async function createOrder(order) {
  return runWithFallback(async () => {
    const { error } = await supabase.from('orders').insert(orderToSupabase(order));
    if (error) throw error;
    return order;
  }, () => addStoredOrder(order));
}

export async function updateOrderStatus(orderId, status) {
  return runWithFallback(async () => {
    const { error } = await supabase
      .from('orders')
      .update({ status: normalizeOrderStatusForSupabase(status), updated_at: new Date().toISOString() })
      .eq('id', orderId);
    if (error) throw error;
    return listOrders();
  }, () => updateStoredOrderStatus(orderId, status));
}

export async function getStoreSettings() {
  return runWithFallback(async () => {
    const { data, error } = await supabase.from('store_settings').select('*').limit(1).maybeSingle();
    if (error) throw error;
    return data ? settingsFromSupabase(data) : getStoredStoreSettings();
  }, () => getStoredStoreSettings());
}

export async function saveStoreSettings(settings) {
  return runWithFallback(async () => {
    const { error } = await supabase.from('store_settings').upsert(settingsToSupabase(settings));
    if (error) throw error;
    return getStoreSettings();
  }, () => saveStoredStoreSettings(settings));
}

export async function migrateLocalDataToSupabase() {
  if (!canUseSupabase()) {
    throw new Error('Supabase nao configurado. Confira VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');
  }

  try {
    const localProducts = getStoredProducts();
    const localOrders = getStoredOrders();
    const localSettings = getStoredStoreSettings();
    const localCategories = defaultCategories.filter((category) => category !== 'Todos');

    const { data: existingCategoryRows, error: categoryListError } = await supabase
      .from('categories')
      .select('*');
    if (categoryListError) throw categoryListError;

    const existingCategorySlugs = new Set(
      (existingCategoryRows || []).map((category) => category.slug || slugify(normalizeCategory(category))),
    );
    const categoriesToInsert = localCategories
      .map((name) => ({ name, slug: slugify(name) }))
      .filter((category) => category.slug && !existingCategorySlugs.has(category.slug));

    if (categoriesToInsert.length > 0) {
      const { error } = await supabase
        .from('categories')
        .upsert(categoriesToInsert, { onConflict: 'slug' });
      if (error) throw error;
    }

    const { data: existingProductRows, error: productListError } = await supabase
      .from('products')
      .select('*');
    if (productListError) throw productListError;

    const existingProductKeys = new Set(
      (existingProductRows || []).flatMap((product) =>
        [product.id, product.code, product.sku, product.name].filter(Boolean).map((value) => String(value).trim().toLowerCase()),
      ),
    );
    const productsToInsert = localProducts.filter((product) => {
      const productCode = product.code || product.sku || (!isUuid(product.id) ? product.id : '');
      const keys = [isUuid(product.id) ? product.id : '', productCode, product.name]
        .filter(Boolean)
        .map((value) => String(value).trim().toLowerCase());
      return keys.every((key) => !existingProductKeys.has(key));
    });

    if (productsToInsert.length > 0) {
      const { error } = await supabase.from('products').insert(productsToInsert.map(productToSupabase));
      if (error) throw error;
    }

    const { data: existingOrderRows, error: orderListError } = await supabase
      .from('orders')
      .select('order_number');
    if (orderListError) throw orderListError;

    const existingOrderNumbers = new Set(
      (existingOrderRows || []).map((order) => String(order.order_number || '').trim()).filter(Boolean),
    );
    const ordersToInsert = localOrders.filter(
      (order) => order.orderNumber && !existingOrderNumbers.has(String(order.orderNumber).trim()),
    );

    if (ordersToInsert.length > 0) {
      const { error } = await supabase.from('orders').insert(ordersToInsert.map(orderToSupabase));
      if (error) throw error;
    }

    const { data: existingSettingsRows, error: settingsListError } = await supabase
      .from('store_settings')
      .select('*')
      .limit(1);
    if (settingsListError) throw settingsListError;

    const existingSettings = existingSettingsRows?.[0];
    const settingsPayload = settingsToSupabase(localSettings);
    if (existingSettings?.id !== undefined && existingSettings?.id !== null) {
      const { error } = await supabase
        .from('store_settings')
        .update({ ...settingsPayload, id: existingSettings.id })
        .eq('id', existingSettings.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('store_settings').insert(settingsPayload);
      if (error) throw error;
    }

    clearSupabaseError();
    window.dispatchEvent(new CustomEvent('doce-lar-products-updated', { detail: await listProducts() }));
    window.dispatchEvent(new CustomEvent('doce-lar-orders-updated', { detail: await listOrders() }));
    window.dispatchEvent(new CustomEvent('doce-lar-store-settings-updated', { detail: await getStoreSettings() }));

    return {
      categories: categoriesToInsert.length,
      skippedCategories: localCategories.length - categoriesToInsert.length,
      products: productsToInsert.length,
      skippedProducts: localProducts.length - productsToInsert.length,
      orders: ordersToInsert.length,
      skippedOrders: localOrders.length - ordersToInsert.length,
      settings: 1,
    };
  } catch (error) {
    setSupabaseError(error);
    throw error;
  }
}

export function getLocalStorageKeys() {
  return {
    products: PRODUCT_STORAGE_KEY,
    orders: ORDER_STORAGE_KEY,
    settings: STORE_SETTINGS_KEY,
  };
}
