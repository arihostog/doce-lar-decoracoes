export const ORDER_STORAGE_KEY = 'doce-lar-orders';

export const orderStatuses = ['Novo', 'Em atendimento', 'Separado', 'Entregue', 'Cancelado'];

export function getProductPrice(product) {
  return product.promotionalPrice ?? product.price;
}

export function normalizeFulfillment(value) {
  if (value === 'Receber por entrega') {
    return 'Delivery';
  }

  if (value === 'Retirar na loja') {
    return 'Retirada na loja';
  }

  return value || 'Retirada na loja';
}

export function buildOrderMessage(order, settings) {
  const defaultMessage =
    cleanDefaultWhatsappMessage(settings.whatsappDefaultMessage);
  const fulfillment = normalizeFulfillment(order.fulfillment);
  const productLines = order.items
    .map(
      (item, index) =>
        `${index + 1}. ${item.name} - ${item.quantity} unidade(s) - ${formatCurrency(
          item.unitPrice,
        )} cada - ${formatCurrency(item.total)}`,
    )
    .join('\n');

  const deliverySection =
    fulfillment === 'Delivery'
      ? [
          'Endereço para delivery:',
          `Rua: ${order.deliveryAddress?.street || ''}`,
          `Número: ${order.deliveryAddress?.number || ''}`,
          `Bairro: ${order.deliveryAddress?.neighborhood || ''}`,
          `Cidade: ${order.deliveryAddress?.city || ''}`,
          order.deliveryAddress?.reference ? `Referência: ${order.deliveryAddress.reference}` : '',
        ].filter(Boolean)
      : ['Retirada:', 'Retirada na loja após confirmação do pedido pelo WhatsApp.'];

  const notesLine = order.notes ? [`Observações: ${order.notes}`] : [];

  return [
    defaultMessage,
    'Gostaria de fazer este pedido:',
    '',
    `Pedido: ${order.orderNumber}`,
    `Cliente: ${order.customerName}`,
    `Telefone: ${order.customerPhone}`,
    `Forma de entrega: ${fulfillment}`,
    ...deliverySection,
    '',
    'Produtos:',
    productLines,
    '',
    `Total: ${formatCurrency(order.total)}`,
    `Forma de pagamento escolhida: ${order.paymentMethod}`,
    ...notesLine,
    '',
    'Aguardo a confirmação da disponibilidade e do prazo para retirada ou entrega.',
  ].join('\n');
}

export function buildOrderWhatsappLink(order, settings) {
  return `https://wa.me/${settings.whatsappNumber}?text=${encodeURIComponent(
    buildOrderMessage(order, settings),
  )}`;
}

export function createOrderFromCheckout({ cart, checkout, total }) {
  const createdAt = new Date().toISOString();
  const orderNumber = generateOrderNumber(createdAt);

  return {
    id: crypto.randomUUID(),
    orderNumber,
    customerName: checkout.customerName || '',
    customerPhone: checkout.customerPhone || '',
    fulfillment: normalizeFulfillment(checkout.fulfillment),
    address: buildAddressLine(checkout.deliveryAddress),
    deliveryAddress: {
      street: checkout.deliveryAddress?.street || '',
      number: checkout.deliveryAddress?.number || '',
      neighborhood: checkout.deliveryAddress?.neighborhood || '',
      city: checkout.deliveryAddress?.city || '',
      reference: checkout.deliveryAddress?.reference || '',
    },
    paymentMethod: checkout.paymentMethod,
    notes: checkout.notes || '',
    total,
    status: 'Novo',
    createdAt,
    items: cart.map((item) => {
      const unitPrice = getProductPrice(item);
      return {
        id: item.id,
        sku: item.sku || '',
        name: item.name,
        quantity: item.quantity,
        unitPrice,
        total: unitPrice * item.quantity,
      };
    }),
  };
}

export function getStoredOrders() {
  if (typeof localStorage === 'undefined') {
    return [];
  }

  try {
    const storedOrders = localStorage.getItem(ORDER_STORAGE_KEY);
    if (!storedOrders) {
      return [];
    }

    const parsedOrders = JSON.parse(storedOrders);
    return Array.isArray(parsedOrders) ? parsedOrders.map(normalizeOrder) : [];
  } catch {
    return [];
  }
}

export function saveStoredOrders(orders) {
  const normalizedOrders = orders.map(normalizeOrder);
  localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(normalizedOrders));
  window.dispatchEvent(new CustomEvent('doce-lar-orders-updated', { detail: normalizedOrders }));
  return normalizedOrders;
}

export function addStoredOrder(order) {
  return saveStoredOrders([normalizeOrder(order), ...getStoredOrders()]);
}

export function updateStoredOrderStatus(orderId, status) {
  return saveStoredOrders(
    getStoredOrders().map((order) => (order.id === orderId ? { ...order, status } : order)),
  );
}

function normalizeOrder(order) {
  return {
    ...order,
    fulfillment: normalizeFulfillment(order.fulfillment),
    status: orderStatuses.includes(order.status) ? order.status : 'Novo',
    total: Number(order.total) || 0,
    deliveryAddress: {
      street: order.deliveryAddress?.street || '',
      number: order.deliveryAddress?.number || '',
      neighborhood: order.deliveryAddress?.neighborhood || '',
      city: order.deliveryAddress?.city || '',
      reference: order.deliveryAddress?.reference || '',
    },
    items: Array.isArray(order.items) ? order.items : [],
  };
}

function cleanDefaultWhatsappMessage(value) {
  const fallback = 'Olá! Vim pelo aplicativo da Doce Lar Decorações e Variedades.';
  const message = value?.trim() || fallback;

  return message
    .replace(/\s*e gostaria de fazer um pedido\.?$/i, '.')
    .replace(/Gostaria de fazer este pedido:?$/i, '')
    .trim();
}

function buildAddressLine(deliveryAddress = {}) {
  return [
    deliveryAddress.street,
    deliveryAddress.number,
    deliveryAddress.neighborhood,
    deliveryAddress.city,
    deliveryAddress.reference,
  ]
    .filter(Boolean)
    .join(', ');
}

function generateOrderNumber(createdAt) {
  const date = new Date(createdAt);
  const stamp = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
    String(date.getHours()).padStart(2, '0'),
    String(date.getMinutes()).padStart(2, '0'),
    String(date.getSeconds()).padStart(2, '0'),
  ].join('');

  return `DL-${stamp}`;
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value) || 0);
}
