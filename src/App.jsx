import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BadgePercent,
  Check,
  ChevronLeft,
  HeartHandshake,
  Home,
  Landmark,
  Minus,
  PackageSearch,
  Plus,
  Search,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Trash2,
  Truck,
  X,
} from 'lucide-react';
import { categories } from './data/products.js';
import AdminPanel from './admin/AdminPanel.jsx';
import { PLACEHOLDER_IMAGE } from './lib/media.js';
import {
  buildOrderMessage,
  buildOrderWhatsappLink,
  createOrderFromCheckout,
  getProductPrice,
  normalizeFulfillment,
} from './lib/orderStore.js';
import { getStoredProducts } from './lib/productStore.js';
import { getStoredStoreSettings } from './lib/storeSettings.js';
import {
  createOrder,
  getStoreSettings,
  listProducts,
} from './lib/supabaseStore.js';

const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const paymentMethods = [
  'Pix',
  'Cartão de crédito',
  'Cartão de débito',
  'Dinheiro',
  'Retirada na loja',
  'Combinar pelo WhatsApp',
];

function isVideoEmbed(url) {
  return url?.includes('youtube.com') || url?.includes('youtu.be') || url?.includes('vimeo.com');
}

function validateCheckout(checkout) {
  const fulfillment = normalizeFulfillment(checkout.fulfillment);

  if (!checkout.customerName?.trim()) {
    return 'Informe seu nome para continuar com o pedido.';
  }

  if (!checkout.customerPhone?.trim()) {
    return 'Informe seu telefone para continuar com o pedido.';
  }

  if (fulfillment === 'Delivery') {
    const requiredAddressFields = [
      checkout.deliveryAddress?.street,
      checkout.deliveryAddress?.number,
      checkout.deliveryAddress?.neighborhood,
      checkout.deliveryAddress?.city,
    ];

    if (requiredAddressFields.some((field) => !field?.trim())) {
      return 'Informe rua, número, bairro e cidade para continuar com o delivery.';
    }
  }

  return '';
}

function App() {
  if (window.location.pathname === '/admin') {
    return <AdminPanel />;
  }

  const [products, setProducts] = useState(() => getStoredProducts());
  const [settings, setSettings] = useState(() => getStoredStoreSettings());
  const [cart, setCart] = useState([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Todos');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedPhoto, setSelectedPhoto] = useState('');
  const [detailQuantity, setDetailQuantity] = useState(1);
  const [checkout, setCheckout] = useState({
    customerName: settings.defaultCustomerName,
    customerPhone: settings.defaultCustomerPhone,
    fulfillment: 'Retirada na loja',
    paymentMethod: 'Combinar pelo WhatsApp',
    deliveryAddress: {
      street: '',
      number: '',
      neighborhood: '',
      city: '',
      reference: '',
    },
    notes: '',
  });

  useEffect(() => {
    let isMounted = true;

    async function loadProducts() {
      const nextProducts = await listProducts({ activeOnly: true });
      if (isMounted) {
        setProducts(nextProducts);
      }
    }

    loadProducts();

    function syncProducts(event) {
      setProducts(event.detail || getStoredProducts());
    }

    function syncProductsFromStorage(event) {
      if (!event.key || event.key === 'doce-lar-products') {
        setProducts(getStoredProducts());
      }
    }

    window.addEventListener('doce-lar-products-updated', syncProducts);
    window.addEventListener('storage', syncProductsFromStorage);
    return () => {
      window.removeEventListener('doce-lar-products-updated', syncProducts);
      window.removeEventListener('storage', syncProductsFromStorage);
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadSettings() {
      const nextSettings = await getStoreSettings();
      if (isMounted) {
        setSettings(nextSettings);
      }
    }

    loadSettings();

    function syncSettings(event) {
      setSettings(event.detail || getStoredStoreSettings());
    }

    function syncSettingsFromStorage(event) {
      if (!event.key || event.key === 'doce-lar-store-settings') {
        setSettings(getStoredStoreSettings());
      }
    }

    window.addEventListener('doce-lar-store-settings-updated', syncSettings);
    window.addEventListener('storage', syncSettingsFromStorage);
    return () => {
      window.removeEventListener('doce-lar-store-settings-updated', syncSettings);
      window.removeEventListener('storage', syncSettingsFromStorage);
      isMounted = false;
    };
  }, []);

  const activeProducts = useMemo(
    () => products.filter((product) => product.status === 'active'),
    [products],
  );

  const filteredProducts = useMemo(() => {
    return activeProducts.filter((product) => {
      const search = `${product.name} ${product.category} ${product.shortDescription}`.toLowerCase();
      const matchesQuery = search.includes(query.toLowerCase());
      const matchesCategory =
        category === 'Todos' ||
        product.category === category ||
        (category === 'Promoções' && product.promotion) ||
        (category === 'Novidades' && product.novelty);

      return matchesQuery && matchesCategory;
    });
  }, [category, query]);

  const featuredProducts = activeProducts.filter((product) => product.featured).slice(0, 6);
  const promotionProducts = activeProducts.filter((product) => product.promotion).slice(0, 4);
  const noveltyProducts = activeProducts.filter((product) => product.novelty).slice(0, 4);
  const cartTotal = cart.reduce(
    (total, item) => total + getProductPrice(item) * item.quantity,
    0,
  );
  const itemCount = cart.reduce((total, item) => total + item.quantity, 0);

  function openProduct(product) {
    setSelectedProduct(product);
    setSelectedPhoto(product.mainPhoto);
    setDetailQuantity(1);
  }

  function addToCart(product, quantity = 1) {
    setCart((currentCart) => {
      const currentItem = currentCart.find((item) => item.id === product.id);
      const availableQuantity = product.stock;

      if (!currentItem) {
        return [...currentCart, { ...product, quantity: Math.min(quantity, availableQuantity) }];
      }

      return currentCart.map((item) =>
        item.id === product.id
          ? { ...item, quantity: Math.min(item.quantity + quantity, availableQuantity) }
          : item,
      );
    });
  }

  function updateQuantity(productId, change) {
    setCart((currentCart) =>
      currentCart
        .map((item) =>
          item.id === productId
            ? { ...item, quantity: Math.min(item.stock, Math.max(0, item.quantity + change)) }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  }

  function removeFromCart(productId) {
    setCart((currentCart) => currentCart.filter((item) => item.id !== productId));
  }

  function buySingleProduct(product) {
    const singleCart = [{ ...product, quantity: detailQuantity }];
    const total = getProductPrice(product) * detailQuantity;
    const order = createOrderFromCheckout({ cart: singleCart, checkout, total });
    return buildOrderWhatsappLink(order, settings);
  }

  async function handleCheckoutClick() {
    if (cart.length === 0) {
      return;
    }

    const checkoutError = validateCheckout(checkout);
    if (checkoutError) {
      window.alert(checkoutError);
      return;
    }

    const order = createOrderFromCheckout({ cart, checkout, total: cartTotal });
    order.whatsappMessage = buildOrderMessage(order, settings);
    await createOrder(order);
    window.open(buildOrderWhatsappLink(order, settings), '_blank', 'noreferrer');
  }

  return (
    <div className="min-h-screen bg-cream text-cocoa">
      <header className="sticky top-0 z-40 border-b border-cocoa/10 bg-cream/95 backdrop-blur">
        <nav className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <a href="#inicio" className="flex min-w-0 items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-rose text-white shadow-soft">
              <Home size={21} />
            </span>
            <span className="min-w-0">
              <strong className="block truncate text-sm leading-tight sm:text-lg">{settings.name}</strong>
              <span className="block truncate text-xs text-cocoa/65">
                {settings.instagram}
              </span>
            </span>
          </a>

          <div className="hidden items-center gap-6 text-sm font-semibold text-cocoa/75 lg:flex">
            <a href="#destaques" className="hover:text-rose">
              Destaques
            </a>
            <a href="#promocoes" className="hover:text-rose">
              Promoções
            </a>
            <a href="#novidades" className="hover:text-rose">
              Novidades
            </a>
            <a href="#catalogo" className="hover:text-rose">
              Catálogo
            </a>
          </div>

          <a
            href="#carrinho"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-cocoa px-4 text-sm font-bold text-white shadow-soft"
          >
            <ShoppingCart size={18} />
            <span>{itemCount}</span>
          </a>
        </nav>
      </header>

      <main>
        <section id="inicio" className="overflow-hidden bg-linen">
          <div className="mx-auto grid min-h-[560px] max-w-7xl items-center gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[0.88fr_1.12fr] lg:px-8 lg:py-14">
            <div className="max-w-2xl">
              <p className="inline-flex items-center gap-2 rounded-full bg-white/88 px-4 py-2 text-sm font-bold text-rose shadow-soft">
                <Sparkles size={16} />
                Casa bonita, prática e cheia de carinho
              </p>
              <h1 className="mt-5 text-4xl font-black leading-tight text-cocoa sm:text-5xl lg:text-6xl">
                {settings.name}
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-8 text-cocoa/78">
                {settings.subtitle}
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href="#catalogo"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-rose px-6 py-3 font-bold text-white shadow-soft transition hover:bg-cocoa"
                >
                  Ver produtos
                  <ArrowRight size={18} />
                </a>
                <a
                  href="#promocoes"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-cocoa/20 bg-white/80 px-6 py-3 font-bold text-cocoa backdrop-blur transition hover:border-gold hover:text-rose"
                >
                  Promoções da semana
                </a>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-[1.1fr_0.9fr]">
              <div className="relative overflow-hidden rounded-lg bg-white shadow-soft">
                <img
                  className="h-full min-h-[360px] w-full object-cover"
                  src="https://images.unsplash.com/photo-1772453609632-2f4aa857f56e?auto=format&fit=crop&w=1400&q=80"
                  alt="Louças, bowls, utensílios e decoração de cozinha"
                />
                <div className="absolute bottom-4 left-4 right-4 rounded-lg bg-white/90 p-4 shadow-soft backdrop-blur">
                  <strong className="block text-lg">{settings.bannerText}</strong>
                  <span className="text-sm text-cocoa/68">Decoração, cozinha, organização e presentes.</span>
                </div>
              </div>

              <div className="grid gap-4">
                <div className="overflow-hidden rounded-lg bg-white shadow-soft">
                  <img
                    className="h-44 w-full object-cover sm:h-full"
                    src="https://images.unsplash.com/photo-1758187248411-0851bc2285ec?auto=format&fit=crop&w=900&q=80"
                    alt="Vasos e jarros decorativos"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <img
                    className="h-36 w-full rounded-lg object-cover shadow-soft"
                    src="https://images.unsplash.com/photo-1559837957-bab8edc53c85?auto=format&fit=crop&w=700&q=80"
                    alt="Potes de vidro para cozinha"
                  />
                  <img
                    className="h-36 w-full rounded-lg object-cover shadow-soft"
                    src="https://images.unsplash.com/photo-1625552187571-7ee60ac43d2b?auto=format&fit=crop&w=700&q=80"
                    alt="Presente decorado"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-cocoa/10 bg-cream py-6">
          <div className="mx-auto grid max-w-7xl gap-3 px-4 sm:grid-cols-3 sm:px-6 lg:px-8">
            {[
              ['Produtos avulsos', 'Decoração, cozinha e variedades'],
              ['Pedido fácil', 'Carrinho com envio direto ao WhatsApp'],
              ['Compra combinada', 'Retirada ou entrega a combinar'],
            ].map(([title, text]) => (
              <div key={title} className="flex items-center gap-3 rounded-lg bg-white p-4 shadow-sm">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-gold/20 text-gold">
                  <Check size={19} />
                </span>
                <span>
                  <strong className="block">{title}</strong>
                  <small className="text-cocoa/62">{text}</small>
                </span>
              </div>
            ))}
          </div>
        </section>

        <ProductSection
          id="destaques"
          eyebrow="Destaques"
          title="Queridinhos da loja"
          products={featuredProducts}
          onOpenProduct={openProduct}
          onAddToCart={addToCart}
        />

        <ProductSection
          id="promocoes"
          eyebrow="Promoções"
          title="Ofertas para aproveitar"
          products={promotionProducts}
          onOpenProduct={openProduct}
          onAddToCart={addToCart}
          muted
        />

        <ProductSection
          id="novidades"
          eyebrow="Novidades"
          title="Acabaram de chegar"
          products={noveltyProducts}
          onOpenProduct={openProduct}
          onAddToCart={addToCart}
        />

        <section id="catalogo" className="bg-white py-12 sm:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionHeading eyebrow="Catálogo" title="Todos os produtos" />

            <div className="mt-7 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
              <label className="relative block">
                <Search
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-cocoa/45"
                  size={19}
                />
                <input
                  className="h-12 w-full rounded-full border border-cocoa/15 bg-cream pl-12 pr-4 outline-none ring-rose/20 transition focus:border-rose focus:ring-4"
                  type="search"
                  placeholder="Buscar por produto, categoria ou descricao"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
              <span className="text-sm font-semibold text-cocoa/62">
                {filteredProducts.length} produto(s) encontrado(s)
              </span>
            </div>

            <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
              {categories.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCategory(item)}
                  className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition ${
                    category === item
                      ? 'bg-cocoa text-white'
                      : 'bg-cream text-cocoa hover:bg-blush'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>

            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onOpenProduct={openProduct}
                  onAddToCart={addToCart}
                />
              ))}
            </div>
          </div>
        </section>

        <section id="carrinho" className="bg-cream py-12 sm:py-16">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[1fr_420px] lg:px-8">
            <div>
              <SectionHeading eyebrow="Carrinho" title="Seu pedido" />
              <div className="mt-6 space-y-4">
                {cart.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-cocoa/25 bg-white p-8 text-center shadow-sm">
                    <PackageSearch className="mx-auto text-rose" size={40} />
                    <p className="mt-3 text-lg font-bold">Seu carrinho está vazio</p>
                    <p className="mt-1 text-cocoa/65">
                      Escolha produtos no catálogo para montar seu pedido.
                    </p>
                  </div>
                ) : (
                  cart.map((item) => (
                    <CartItem
                      key={item.id}
                      item={item}
                      onIncrement={() => updateQuantity(item.id, 1)}
                      onDecrement={() => updateQuantity(item.id, -1)}
                      onRemove={() => removeFromCart(item.id)}
                    />
                  ))
                )}
              </div>
            </div>

            <aside className="h-fit rounded-lg bg-white p-5 shadow-soft lg:sticky lg:top-24">
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-blush text-rose">
                  <HeartHandshake size={22} />
                </span>
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.18em] text-gold">
                    WhatsApp
                  </p>
                  <h3 className="text-xl font-black">Finalizar pedido</h3>
                </div>
              </div>

              <CheckoutForm checkout={checkout} setCheckout={setCheckout} />

              <div className="mt-4 rounded-lg border border-gold/25 bg-gold/10 p-3 text-sm font-semibold leading-6 text-cocoa/75">
                O pagamento será confirmado pelo atendimento da loja via WhatsApp.
              </div>

              <div className="my-5 space-y-2 border-y border-cocoa/10 py-4">
                <div className="flex justify-between text-cocoa/70">
                  <span>Itens</span>
                  <span>{itemCount}</span>
                </div>
                <div className="flex justify-between text-lg font-black">
                  <span>Total</span>
                  <span>{currency.format(cartTotal)}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCheckoutClick}
                className={`inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 font-bold transition ${
                  cart.length === 0
                    ? 'cursor-not-allowed bg-cocoa/10 text-cocoa/35'
                    : 'bg-rose text-white hover:bg-cocoa'
                }`}
                disabled={cart.length === 0}
              >
                Enviar pedido no WhatsApp
                <ArrowRight size={18} />
              </button>
            </aside>
          </div>
        </section>
      </main>

      <footer className="bg-cocoa px-4 py-8 text-center text-sm text-white/70">
        {settings.name} - {settings.address} - {settings.openingHours}
      </footer>

      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          selectedPhoto={selectedPhoto}
          setSelectedPhoto={setSelectedPhoto}
          quantity={detailQuantity}
          setQuantity={setDetailQuantity}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={() => addToCart(selectedProduct, detailQuantity)}
          whatsappLink={buySingleProduct(selectedProduct)}
        />
      )}
    </div>
  );
}

function SectionHeading({ eyebrow, title }) {
  return (
    <div>
      <p className="text-sm font-black uppercase tracking-[0.18em] text-gold">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-black tracking-normal text-cocoa sm:text-4xl">{title}</h2>
    </div>
  );
}

function ProductSection({
  id,
  eyebrow,
  title,
  products: sectionProducts,
  onOpenProduct,
  onAddToCart,
  muted,
}) {
  return (
    <section id={id} className={`${muted ? 'bg-blush/45' : 'bg-cream'} py-12 sm:py-16`}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between gap-4">
          <SectionHeading eyebrow={eyebrow} title={title} />
          <a href="#catalogo" className="hidden items-center gap-2 font-bold text-rose sm:inline-flex">
            Ver tudo
            <ArrowRight size={18} />
          </a>
        </div>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {sectionProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onOpenProduct={onOpenProduct}
              onAddToCart={onAddToCart}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function ProductCard({ product, onOpenProduct, onAddToCart }) {
  const finalPrice = getProductPrice(product);

  return (
    <article className="overflow-hidden rounded-lg border border-cocoa/10 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-soft">
      <button type="button" className="block w-full text-left" onClick={() => onOpenProduct(product)}>
        <div className="relative aspect-[4/3] overflow-hidden bg-cream">
          <img
            className="h-full w-full object-cover"
            src={product.mainPhoto || PLACEHOLDER_IMAGE}
            alt={product.name}
            onError={(event) => {
              event.currentTarget.src = PLACEHOLDER_IMAGE;
            }}
          />
          <div className="absolute left-3 top-3 flex flex-wrap gap-2">
            {product.promotion && (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose px-3 py-1 text-xs font-black text-white">
                <BadgePercent size={13} />
                Oferta
              </span>
            )}
            {product.novelty && (
              <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-cocoa shadow">
                Novidade
              </span>
            )}
          </div>
        </div>
      </button>

      <div className="p-5">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-gold">{product.category}</p>
        <button type="button" className="mt-2 text-left" onClick={() => onOpenProduct(product)}>
          <h3 className="min-h-14 text-lg font-black leading-7 text-cocoa">{product.name}</h3>
        </button>
        <p className="mt-2 min-h-12 text-sm leading-6 text-cocoa/68">{product.shortDescription}</p>
        <Price product={product} className="mt-4" />
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="text-xs font-bold text-cocoa/55">Estoque: {product.stock}</span>
          <button
            type="button"
            onClick={() => onAddToCart(product)}
            disabled={product.stock === 0}
            className="inline-flex items-center gap-2 rounded-full bg-cocoa px-4 py-2 text-sm font-bold text-white transition hover:bg-rose disabled:cursor-not-allowed disabled:bg-cocoa/20"
          >
            <Plus size={16} />
            Adicionar
          </button>
        </div>
      </div>
    </article>
  );
}

function Price({ product, className = '' }) {
  return (
    <div className={`flex flex-wrap items-baseline gap-2 ${className}`}>
      <strong className="text-2xl font-black text-rose">
        {currency.format(getProductPrice(product))}
      </strong>
      {product.promotionalPrice && (
        <span className="text-sm font-semibold text-cocoa/45 line-through">
          {currency.format(product.price)}
        </span>
      )}
    </div>
  );
}

function CartItem({ item, onIncrement, onDecrement, onRemove }) {
  return (
    <div className="grid gap-4 rounded-lg border border-cocoa/10 bg-white p-4 shadow-sm sm:grid-cols-[88px_1fr_auto]">
      <img
        className="h-[88px] w-[88px] rounded-md object-cover"
        src={item.mainPhoto || PLACEHOLDER_IMAGE}
        alt={item.name}
        onError={(event) => {
          event.currentTarget.src = PLACEHOLDER_IMAGE;
        }}
      />
      <div>
        <h3 className="font-black">{item.name}</h3>
        <p className="mt-1 text-sm text-cocoa/60">{currency.format(getProductPrice(item))} cada</p>
        <div className="mt-3 inline-flex items-center rounded-full border border-cocoa/15 bg-cream">
          <button
            type="button"
            className="grid h-9 w-9 place-items-center hover:text-rose"
            onClick={onDecrement}
            aria-label="Diminuir quantidade"
          >
            <Minus size={16} />
          </button>
          <span className="w-10 text-center text-sm font-black">{item.quantity}</span>
          <button
            type="button"
            className="grid h-9 w-9 place-items-center hover:text-rose"
            onClick={onIncrement}
            aria-label="Aumentar quantidade"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
        <strong>{currency.format(getProductPrice(item) * item.quantity)}</strong>
        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-blush text-cocoa transition hover:bg-rose hover:text-white"
          onClick={onRemove}
          aria-label="Remover produto"
        >
          <Trash2 size={17} />
        </button>
      </div>
    </div>
  );
}

function CheckoutForm({ checkout, setCheckout }) {
  const fulfillment = normalizeFulfillment(checkout.fulfillment);

  function updateField(field, value) {
    setCheckout((current) => ({ ...current, [field]: value }));
  }

  function updateDeliveryAddress(field, value) {
    setCheckout((current) => ({
      ...current,
      deliveryAddress: {
        ...current.deliveryAddress,
        [field]: value,
      },
    }));
  }

  return (
    <div className="mt-5 space-y-3">
      <div className="rounded-lg border border-cocoa/10 bg-cream p-3">
        <p className="mb-3 text-sm font-black text-cocoa">Entrega</p>
        <div className="grid grid-cols-2 gap-2">
          {['Retirada na loja', 'Delivery'].map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => updateField('fulfillment', option)}
              className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-2 text-sm font-bold ${
                fulfillment === option ? 'bg-white text-rose shadow-sm' : 'text-cocoa/62'
              }`}
            >
              {option === 'Delivery' ? <Truck size={16} /> : <ShoppingBag size={16} />}
              {option}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-lg bg-cream p-1">
        <input
          className="h-11 rounded-lg border border-cocoa/12 bg-white px-4 text-sm outline-none focus:border-rose"
          placeholder="Nome"
          required
          value={checkout.customerName}
          onChange={(event) => updateField('customerName', event.target.value)}
        />
        <input
          className="h-11 rounded-lg border border-cocoa/12 bg-white px-4 text-sm outline-none focus:border-rose"
          placeholder="Telefone"
          required
          value={checkout.customerPhone}
          onChange={(event) => updateField('customerPhone', event.target.value)}
        />
      </div>

      {fulfillment === 'Delivery' ? (
        <div className="grid gap-2 rounded-lg border border-cocoa/10 bg-cream p-3 sm:grid-cols-2">
          <input
            className="h-11 rounded-lg border border-cocoa/12 bg-white px-4 text-sm outline-none focus:border-rose sm:col-span-2"
            placeholder="Rua"
            required
            value={checkout.deliveryAddress.street}
            onChange={(event) => updateDeliveryAddress('street', event.target.value)}
          />
          <input
            className="h-11 rounded-lg border border-cocoa/12 bg-white px-4 text-sm outline-none focus:border-rose"
            placeholder="Número"
            required
            value={checkout.deliveryAddress.number}
            onChange={(event) => updateDeliveryAddress('number', event.target.value)}
          />
          <input
            className="h-11 rounded-lg border border-cocoa/12 bg-white px-4 text-sm outline-none focus:border-rose"
            placeholder="Bairro"
            required
            value={checkout.deliveryAddress.neighborhood}
            onChange={(event) => updateDeliveryAddress('neighborhood', event.target.value)}
          />
          <input
            className="h-11 rounded-lg border border-cocoa/12 bg-white px-4 text-sm outline-none focus:border-rose"
            placeholder="Cidade"
            required
            value={checkout.deliveryAddress.city}
            onChange={(event) => updateDeliveryAddress('city', event.target.value)}
          />
          <input
            className="h-11 rounded-lg border border-cocoa/12 bg-white px-4 text-sm outline-none focus:border-rose"
            placeholder="Referência"
            value={checkout.deliveryAddress.reference}
            onChange={(event) => updateDeliveryAddress('reference', event.target.value)}
          />
        </div>
      ) : (
        <div className="rounded-lg border border-gold/25 bg-gold/10 p-3 text-sm font-semibold leading-6 text-cocoa/75">
          Seu pedido ficará reservado após confirmação pelo WhatsApp.
        </div>
      )}

      <div className="rounded-lg border border-cocoa/10 bg-cream p-3">
        <p className="mb-3 text-sm font-black text-cocoa">Forma de pagamento</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {paymentMethods.map((method) => (
            <button
              key={method}
              type="button"
              onClick={() => updateField('paymentMethod', method)}
              className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-3 text-sm font-bold transition ${
                checkout.paymentMethod === method
                  ? 'bg-white text-rose shadow-sm'
                  : 'bg-transparent text-cocoa/65 hover:bg-white/70'
              }`}
            >
              <Landmark size={16} />
              {method}
            </button>
          ))}
        </div>
      </div>
      <textarea
        className="min-h-24 w-full resize-none rounded-lg border border-cocoa/12 bg-cream px-4 py-3 text-sm outline-none focus:border-rose"
        placeholder="Observações do pedido"
        value={checkout.notes}
        onChange={(event) => updateField('notes', event.target.value)}
      />
    </div>
  );
}

function ProductModal({
  product,
  selectedPhoto,
  setSelectedPhoto,
  quantity,
  setQuantity,
  onClose,
  onAddToCart,
  whatsappLink,
}) {
  const hasVideo = Boolean(product.video?.url);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-cocoa/70 p-3 sm:p-6">
      <div className="mx-auto max-w-6xl rounded-lg bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-cocoa/10 px-4 py-3 sm:px-6">
          <button
            type="button"
            className="inline-flex items-center gap-2 font-bold text-cocoa/70"
            onClick={onClose}
          >
            <ChevronLeft size={18} />
            Voltar
          </button>
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-full bg-cream text-cocoa hover:text-rose"
            onClick={onClose}
            aria-label="Fechar produto"
          >
            <X size={20} />
          </button>
        </div>

        <div className="grid gap-8 p-4 sm:p-6 lg:grid-cols-[1fr_0.9fr]">
          <div>
            <div className="overflow-hidden rounded-lg bg-cream">
              <img
                className="aspect-[4/3] w-full object-cover"
                src={selectedPhoto || product.mainPhoto || PLACEHOLDER_IMAGE}
                alt={product.name}
                onError={(event) => {
                  event.currentTarget.src = PLACEHOLDER_IMAGE;
                }}
              />
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-5">
              {product.gallery.map((photo) => (
                <button
                  key={photo}
                  type="button"
                  onClick={() => setSelectedPhoto(photo)}
                  className={`overflow-hidden rounded-md border-2 ${
                    selectedPhoto === photo ? 'border-rose' : 'border-transparent'
                  }`}
                >
                  <img
                    className="aspect-square w-full object-cover"
                    src={photo || PLACEHOLDER_IMAGE}
                    alt={product.name}
                    onError={(event) => {
                      event.currentTarget.src = PLACEHOLDER_IMAGE;
                    }}
                  />
                </button>
              ))}
            </div>

            {hasVideo && (
              <div className="mt-5 overflow-hidden rounded-lg bg-cocoa">
                {product.video.type === 'file' || !isVideoEmbed(product.video.url) ? (
                  <video className="aspect-video w-full" src={product.video.url} controls />
                ) : (
                  <iframe
                    className="aspect-video w-full"
                    src={product.video.url}
                    title={`Video do produto ${product.name}`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-gold">{product.category}</p>
            <h2 className="mt-2 text-3xl font-black leading-tight text-cocoa sm:text-4xl">{product.name}</h2>
            <Price product={product} className="mt-4" />
            <p className="mt-4 text-base leading-8 text-cocoa/72">{product.fullDescription}</p>

            <div className="mt-6 grid gap-3 rounded-lg bg-cream p-4 sm:grid-cols-2">
              <span>
                <strong className="block text-sm">Estoque</strong>
                <small className="text-cocoa/65">{product.stock} unidade(s)</small>
              </span>
              <span>
                <strong className="block text-sm">Status</strong>
                <small className="text-cocoa/65">Produto ativo para venda</small>
              </span>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <span className="font-bold">Quantidade</span>
              <div className="inline-flex items-center rounded-full border border-cocoa/15 bg-cream">
                <button
                  type="button"
                  className="grid h-10 w-10 place-items-center hover:text-rose"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  aria-label="Diminuir quantidade"
                >
                  <Minus size={16} />
                </button>
                <span className="w-12 text-center font-black">{quantity}</span>
                <button
                  type="button"
                  className="grid h-10 w-10 place-items-center hover:text-rose"
                  onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                  aria-label="Aumentar quantidade"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={onAddToCart}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-cocoa px-5 py-3 font-bold text-white transition hover:bg-rose"
              >
                <ShoppingCart size={18} />
                Adicionar ao carrinho
              </button>
              <a
                href={whatsappLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-rose px-5 py-3 font-bold text-white transition hover:bg-cocoa"
              >
                Comprar pelo WhatsApp
                <ArrowRight size={18} />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
