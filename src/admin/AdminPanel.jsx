import { useEffect, useMemo, useState } from 'react';
import {
  BadgePercent,
  Boxes,
  Copy,
  Download,
  Edit3,
  Eraser,
  Eye,
  EyeOff,
  ImagePlus,
  LayoutDashboard,
  LogOut,
  PackagePlus,
  Plus,
  Send,
  RotateCcw,
  Save,
  Search,
  Star,
  Store,
  Trash2,
  X,
} from 'lucide-react';
import { categories } from '../data/products.js';
import {
  PLACEHOLDER_IMAGE,
  getMediaStorageDiagnostics,
  getMediaStorageMode,
  getVideoType,
  isValidImageSource,
  isValidVideoSource,
  uploadMediaForStorage,
} from '../lib/media.js';
import { getStoredProducts, resetStoredProducts } from '../lib/productStore.js';
import {
  buildOrderWhatsappLink,
  getStoredOrders,
  orderStatuses,
  updateStoredOrderStatus,
} from '../lib/orderStore.js';
import {
  getStoredStoreSettings,
  normalizeWhatsappNumber,
} from '../lib/storeSettings.js';
import {
  deleteProduct as deleteSupabaseProduct,
  getStoreSettings,
  getSupabaseDiagnostics,
  listOrders,
  listProducts,
  migrateLocalDataToSupabase,
  saveProduct,
  saveProducts,
  saveStoreSettings,
  testSupabaseConnection,
  updateOrderStatus,
} from '../lib/supabaseStore.js';

const ADMIN_AUTH_KEY = 'doce-lar-admin-auth';
const emptyProduct = {
  id: '',
  sku: '',
  name: '',
  category: 'Decoração',
  cost: '',
  price: '',
  promotionalPrice: '',
  shortDescription: '',
  fullDescription: '',
  stock: '',
  mainPhoto: '',
  gallery: '',
  videoUrl: '',
  internalNotes: '',
  featured: false,
  promotion: false,
  novelty: false,
  status: 'active',
};

const productCategories = categories.filter((category) => category !== 'Todos');

function formatMoney(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value) || 0);
}

function calculateProfit(product) {
  const salePrice =
    product.promotionalPrice === '' || product.promotionalPrice === null || product.promotionalPrice === undefined
      ? Number(product.price) || 0
      : Number(product.promotionalPrice) || 0;
  const cost = Number(product.cost) || 0;
  return salePrice - cost;
}

function calculateProfitMargin(product) {
  const salePrice =
    product.promotionalPrice === '' || product.promotionalPrice === null || product.promotionalPrice === undefined
      ? Number(product.price) || 0
      : Number(product.promotionalPrice) || 0;
  if (!salePrice) {
    return 0;
  }

  return (calculateProfit(product) / salePrice) * 100;
}

function productToForm(product) {
  return {
    id: product.id,
    sku: product.sku || '',
    name: product.name,
    category: product.category,
    cost: String(product.cost ?? ''),
    price: String(product.price ?? ''),
    promotionalPrice: product.promotionalPrice ? String(product.promotionalPrice) : '',
    shortDescription: product.shortDescription,
    fullDescription: product.fullDescription,
    stock: String(product.stock ?? ''),
    mainPhoto: product.mainPhoto,
    gallery: product.gallery?.join('\n') || '',
    videoUrl: product.video?.url || '',
    internalNotes: product.internalNotes || '',
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
    featured: Boolean(product.featured),
    promotion: Boolean(product.promotion),
    novelty: Boolean(product.novelty),
    status: product.status,
  };
}

function formToProduct(form) {
  const gallery = form.gallery
    .split('\n')
    .map((url) => url.trim())
    .filter(Boolean);

  return {
    id: form.id || crypto.randomUUID(),
    sku: form.sku.trim(),
    name: form.name.trim(),
    category: form.category,
    cost: Number(form.cost) || 0,
    price: Number(form.price) || 0,
    promotionalPrice: form.promotionalPrice ? Number(form.promotionalPrice) : null,
    shortDescription: form.shortDescription.trim(),
    fullDescription: form.fullDescription.trim(),
    stock: Number(form.stock) || 0,
    mainPhoto: form.mainPhoto.trim(),
    gallery: gallery.length > 0 ? gallery : [form.mainPhoto.trim()].filter(Boolean),
    video: form.videoUrl.trim() ? { type: getVideoType(form.videoUrl.trim()), url: form.videoUrl.trim() } : null,
    internalNotes: form.internalNotes.trim(),
    featured: form.featured,
    promotion: form.promotion,
    novelty: form.novelty,
    status: form.status,
    createdAt: form.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export default function AdminPanel() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => localStorage.getItem(ADMIN_AUTH_KEY) === 'true',
  );
  const [login, setLogin] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [products, setProducts] = useState(() => getStoredProducts());
  const [orders, setOrders] = useState(() => getStoredOrders());
  const [settings, setSettings] = useState(() => getStoredStoreSettings());
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Todas');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyProduct);
  const [successMessage, setSuccessMessage] = useState('');
  const [supabaseDiagnostics, setSupabaseDiagnostics] = useState(() => getSupabaseDiagnostics());
  const [migrationMessage, setMigrationMessage] = useState('');
  const mediaDiagnostics = getMediaStorageDiagnostics();

  const stats = useMemo(
    () => [
      {
        label: 'Total de produtos',
        value: products.length,
        icon: Boxes,
      },
      {
        label: 'Produtos ativos',
        value: products.filter((product) => product.status === 'active').length,
        icon: Eye,
      },
      {
        label: 'Em promoção',
        value: products.filter((product) => product.promotion).length,
        icon: BadgePercent,
      },
      {
        label: 'Em destaque',
        value: products.filter((product) => product.featured).length,
        icon: Star,
      },
      {
        label: 'Estoque baixo',
        value: products.filter((product) => product.stock <= 5).length,
        icon: LayoutDashboard,
      },
      {
        label: 'Pedidos novos',
        value: orders.filter((order) => order.status === 'Novo').length,
        icon: Send,
      },
    ],
    [orders, products],
  );

  const filteredProducts = useMemo(() => {
    const query = search.toLowerCase();
    return products
      .filter((product) => {
        const matchesSearch = `${product.sku} ${product.name} ${product.category} ${product.shortDescription}`
          .toLowerCase()
          .includes(query);
        const matchesCategory = categoryFilter === 'Todas' || product.category === categoryFilter;
        const matchesStatus =
          statusFilter === 'Todos' ||
          (statusFilter === 'Ativo' && product.status === 'active') ||
          (statusFilter === 'Inativo' && product.status === 'inactive') ||
          (statusFilter === 'Promoção' && product.promotion) ||
          (statusFilter === 'Destaque' && product.featured) ||
          (statusFilter === 'Novidade' && product.novelty) ||
          (statusFilter === 'Estoque baixo' && product.stock <= 5);

        return matchesSearch && matchesCategory && matchesStatus;
      })
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }, [categoryFilter, products, search, statusFilter]);

  useEffect(() => {
    let isMounted = true;

    async function loadAdminData() {
      const [nextProducts, nextOrders, nextSettings] = await Promise.all([
        listProducts(),
        listOrders(),
        getStoreSettings(),
      ]);
      await testSupabaseConnection();

      if (isMounted) {
        setProducts(nextProducts);
        setOrders(nextOrders);
        setSettings(nextSettings);
        setSupabaseDiagnostics(getSupabaseDiagnostics());
      }
    }

    loadAdminData();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    function syncOrders(event) {
      setOrders(event.detail || getStoredOrders());
    }

    function syncOrdersFromStorage(event) {
      if (!event.key || event.key === 'doce-lar-orders') {
        setOrders(getStoredOrders());
      }
    }

    window.addEventListener('doce-lar-orders-updated', syncOrders);
    window.addEventListener('storage', syncOrdersFromStorage);
    return () => {
      window.removeEventListener('doce-lar-orders-updated', syncOrders);
      window.removeEventListener('storage', syncOrdersFromStorage);
    };
  }, []);

  function handleLogin(event) {
    event.preventDefault();
    if (login.username === 'admin' && login.password === 'admin123') {
      localStorage.setItem(ADMIN_AUTH_KEY, 'true');
      setIsAuthenticated(true);
      setLoginError('');
      return;
    }

    setLoginError('Usuário ou senha inválidos.');
  }

  function handleLogout() {
    localStorage.removeItem(ADMIN_AUTH_KEY);
    setIsAuthenticated(false);
  }

  function openNewProductForm() {
    setEditingId(null);
    setForm(emptyProduct);
    setIsFormOpen(true);
    setSuccessMessage('');
  }

  function openEditProductForm(product) {
    setEditingId(product.id);
    setForm(productToForm(product));
    setIsFormOpen(true);
    setSuccessMessage('');
  }

  function closeForm() {
    setEditingId(null);
    setForm(emptyProduct);
    setIsFormOpen(false);
  }

  async function refreshAdminData() {
    const [nextProducts, nextOrders, nextSettings] = await Promise.all([
      listProducts(),
      listOrders(),
      getStoreSettings(),
    ]);
    setProducts(nextProducts);
    setOrders(nextOrders);
    setSettings(nextSettings);
    setSupabaseDiagnostics(getSupabaseDiagnostics());
  }

  async function handleOrderStatusChange(orderId, status) {
    setOrders(await updateOrderStatus(orderId, status));
    setSupabaseDiagnostics(getSupabaseDiagnostics());
  }

  function clearProductForm() {
    setForm(editingId ? { ...emptyProduct, id: editingId } : emptyProduct);
  }

  async function handleSaveProduct(event) {
    event.preventDefault();
    const gallery = form.gallery
      .split('\n')
      .map((url) => url.trim())
      .filter(Boolean);

    if (form.mainPhoto.trim() && !isValidImageSource(form.mainPhoto)) {
      window.alert('A URL da foto principal não parece válida.');
      return;
    }

    if (gallery.some((url) => !isValidImageSource(url))) {
      window.alert('Uma ou mais URLs da galeria não parecem válidas.');
      return;
    }

    if (form.videoUrl.trim() && !isValidVideoSource(form.videoUrl)) {
      window.alert('A URL do vídeo não parece válida.');
      return;
    }

    const product = formToProduct(form);
    setProducts(await saveProduct(product));
    setSupabaseDiagnostics(getSupabaseDiagnostics());
    setSuccessMessage(editingId ? 'Produto editado com sucesso.' : 'Produto salvo com sucesso.');
    closeForm();
  }

  async function deleteProduct(productId) {
    if (!window.confirm('Deseja excluir este produto?')) {
      return;
    }

    setProducts(await deleteSupabaseProduct(productId));
    setSupabaseDiagnostics(getSupabaseDiagnostics());
  }

  async function toggleProductStatus(productId) {
    const product = products.find((item) => item.id === productId);
    if (!product) {
      return;
    }

    setProducts(await saveProduct({
      ...product,
      status: product.status === 'active' ? 'inactive' : 'active',
      updatedAt: new Date().toISOString(),
    }));
    setSupabaseDiagnostics(getSupabaseDiagnostics());
  }

  async function duplicateProduct(product) {
    const copy = {
      ...product,
      id: crypto.randomUUID(),
      sku: product.sku ? `${product.sku}-COPIA` : '',
      name: `${product.name} (cópia)`,
      status: 'inactive',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setProducts(await saveProduct(copy));
    setSupabaseDiagnostics(getSupabaseDiagnostics());
    setSuccessMessage('Produto duplicado com sucesso.');
  }

  function exportProductsCsv() {
    const headers = [
      'SKU',
      'Produto',
      'Categoria',
      'Custo',
      'Preco de venda',
      'Preco promocional',
      'Lucro',
      'Margem %',
      'Estoque',
      'Status',
      'Promocao',
      'Destaque',
      'Novidade',
      'Observacoes internas',
    ];
    const rows = filteredProducts.map((product) => [
      product.sku,
      product.name,
      product.category,
      product.cost,
      product.price,
      product.promotionalPrice ?? '',
      calculateProfit(product).toFixed(2),
      calculateProfitMargin(product).toFixed(2),
      product.stock,
      product.status === 'active' ? 'Ativo' : 'Inativo',
      product.promotion ? 'Sim' : 'Nao',
      product.featured ? 'Sim' : 'Nao',
      product.novelty ? 'Sim' : 'Nao',
      product.internalNotes,
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(';'))
      .join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'produtos-doce-lar.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  async function resetProducts() {
    if (!window.confirm('Deseja restaurar os produtos de exemplo?')) {
      return;
    }

    const localProducts = resetStoredProducts();
    setProducts(await saveProducts(localProducts));
    setSupabaseDiagnostics(getSupabaseDiagnostics());
    closeForm();
  }

  function updateSetting(field, value) {
    setSettings((current) => ({
      ...current,
      [field]: field === 'whatsappNumber' ? normalizeWhatsappNumber(value) : value,
    }));
    setSettingsSaved(false);
  }

  async function handleSaveSettings(event) {
    event.preventDefault();
    setSettings(await saveStoreSettings(settings));
    setSupabaseDiagnostics(getSupabaseDiagnostics());
    setSettingsSaved(true);
  }

  async function handleMigration() {
    setMigrationMessage('Migrando dados locais para Supabase...');
    try {
      const result = await migrateLocalDataToSupabase();
      await refreshAdminData();
      setMigrationMessage(
        [
          `Migração concluída.`,
          `Produtos migrados: ${result.products}.`,
          `Produtos ignorados por já existirem: ${result.skippedProducts}.`,
          `Pedidos migrados: ${result.orders}.`,
          `Pedidos ignorados: ${result.skippedOrders}.`,
          `Categorias migradas: ${result.categories}.`,
          `Categorias ignoradas: ${result.skippedCategories}.`,
          `Configurações migradas: ${result.settings}.`,
        ].join(' '),
      );
    } catch (error) {
      setSupabaseDiagnostics(getSupabaseDiagnostics());
      setMigrationMessage(`Erro ao migrar: ${error.message}`);
    }
  }

  async function handleTestSupabaseConnection() {
    setMigrationMessage('Testando conexão com Supabase...');
    const result = await testSupabaseConnection();
    setSupabaseDiagnostics(getSupabaseDiagnostics());
    setMigrationMessage(
      result.ok
        ? 'Conexão Supabase OK. Teste em categories retornou com sucesso.'
        : `Falha no teste Supabase: ${result.error?.friendlyMessage || result.error?.message || 'erro desconhecido'}`,
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="grid min-h-screen place-items-center bg-cream px-4 py-10 text-cocoa">
        <form onSubmit={handleLogin} className="w-full max-w-md rounded-lg bg-white p-6 shadow-soft">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-blush text-rose">
            <LayoutDashboard size={26} />
          </span>
          <h1 className="mt-5 text-3xl font-black">Painel administrativo</h1>
          <p className="mt-2 text-sm leading-6 text-cocoa/65">
            Entre para cadastrar, editar e organizar os produtos da loja.
          </p>

          <div className="mt-6 space-y-3">
            <input
              className="h-12 w-full rounded-lg border border-cocoa/12 bg-cream px-4 outline-none focus:border-rose"
              placeholder="Usuário"
              value={login.username}
              onChange={(event) => setLogin((current) => ({ ...current, username: event.target.value }))}
            />
            <input
              className="h-12 w-full rounded-lg border border-cocoa/12 bg-cream px-4 outline-none focus:border-rose"
              placeholder="Senha"
              type="password"
              value={login.password}
              onChange={(event) => setLogin((current) => ({ ...current, password: event.target.value }))}
            />
          </div>

          {loginError && <p className="mt-3 text-sm font-bold text-rose">{loginError}</p>}

          <button
            type="submit"
            className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-full bg-cocoa font-bold text-white transition hover:bg-rose"
          >
            Entrar
          </button>

          <a href="/" className="mt-4 inline-flex w-full justify-center text-sm font-bold text-rose">
            Voltar para loja
          </a>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-cream text-cocoa">
      <header className="border-b border-cocoa/10 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-gold">Admin</p>
            <h1 className="mt-1 text-3xl font-black">Doce Lar Decorações e Variedades</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href="/"
              className="inline-flex h-11 items-center justify-center rounded-full border border-cocoa/15 px-4 text-sm font-bold hover:border-rose hover:text-rose"
            >
              Ver loja
            </a>
            <button
              type="button"
              onClick={resetProducts}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-cocoa/15 px-4 text-sm font-bold hover:border-rose hover:text-rose"
            >
              <RotateCcw size={16} />
              Restaurar exemplos
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-cocoa px-4 text-sm font-bold text-white hover:bg-rose"
            >
              <LogOut size={16} />
              Sair do painel
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <article key={stat.label} className="rounded-lg bg-white p-4 shadow-sm">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-blush text-rose">
                  <Icon size={20} />
                </span>
                <strong className="mt-4 block text-3xl font-black">{stat.value}</strong>
                <p className="mt-1 text-sm font-semibold text-cocoa/62">{stat.label}</p>
              </article>
            );
          })}
        </section>

        <section id="configuracoes" className="mt-8 rounded-lg bg-white p-4 shadow-soft sm:p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-blush text-rose">
              <Store size={22} />
            </span>
            <div>
              <p className="text-sm font-black uppercase tracking-[0.16em] text-gold">
                Configurações
              </p>
              <h2 className="mt-1 text-2xl font-black">Configurações da Loja</h2>
              <p className="mt-1 text-sm leading-6 text-cocoa/62">
                Essas informações aparecem na vitrine e no WhatsApp de finalização.
              </p>
            </div>
          </div>

          <StoreSettingsForm
            settings={settings}
            settingsSaved={settingsSaved}
            onChange={updateSetting}
            onSubmit={handleSaveSettings}
          />
        </section>

        <SupabaseDiagnostics
          diagnostics={supabaseDiagnostics}
          migrationMessage={migrationMessage}
          onMigrate={handleMigration}
          onTestConnection={handleTestSupabaseConnection}
        />

        <CloudinaryDiagnostics diagnostics={mediaDiagnostics} />

        <section className="mt-8 rounded-lg bg-white p-4 shadow-soft sm:p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.16em] text-gold">Pedidos</p>
              <h2 className="mt-1 text-2xl font-black">Pedidos recebidos pelo WhatsApp</h2>
              <p className="mt-1 text-sm text-cocoa/62">
                Os pedidos são salvos no navegador antes de abrir o WhatsApp.
              </p>
            </div>
            <span className="rounded-full bg-blush px-4 py-2 text-sm font-black text-rose">
              {orders.length} pedido(s)
            </span>
          </div>

          <div className="mt-5 space-y-4">
            {orders.length === 0 ? (
              <div className="rounded-lg border border-dashed border-cocoa/20 bg-cream p-8 text-center">
                <Send className="mx-auto text-rose" size={34} />
                <p className="mt-3 font-black">Nenhum pedido salvo ainda</p>
                <p className="mt-1 text-sm text-cocoa/62">
                  Finalize uma compra pela loja para registrar o primeiro pedido.
                </p>
              </div>
            ) : (
              orders.map((order) => (
                <article key={order.id} className="rounded-lg bg-cream p-4">
                  <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <strong className="text-lg">{order.orderNumber}</strong>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-cocoa/70">
                          {new Date(order.createdAt).toLocaleString('pt-BR')}
                        </span>
                      </div>
                      <div className="mt-3 grid gap-2 text-sm text-cocoa/75 md:grid-cols-2">
                        <span><strong>Cliente:</strong> {order.customerName || '-'}</span>
                        <span><strong>Telefone:</strong> {order.customerPhone || '-'}</span>
                        <span><strong>Forma de entrega:</strong> {order.fulfillment}</span>
                        <span><strong>Pagamento:</strong> {order.paymentMethod}</span>
                        <span className="md:col-span-2">
                          <strong>Endereço/retirada:</strong>{' '}
                          {order.fulfillment === 'Receber por entrega'
                            ? [
                                order.deliveryAddress?.street,
                                order.deliveryAddress?.number,
                                order.deliveryAddress?.neighborhood,
                                order.deliveryAddress?.city,
                                order.deliveryAddress?.reference,
                              ]
                                .filter(Boolean)
                                .join(', ')
                            : 'Retirada na loja após confirmação do pedido pelo WhatsApp.'}
                        </span>
                        <span className="md:col-span-2"><strong>Observações:</strong> {order.notes || '-'}</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 lg:min-w-64">
                      <label className="admin-field">
                        <span className="mb-2 block text-sm font-black text-cocoa/75">Status do pedido</span>
                        <select
                          value={order.status}
                          onChange={(event) => handleOrderStatusChange(order.id, event.target.value)}
                        >
                          {orderStatuses.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </label>
                      <a
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-rose px-4 text-sm font-bold text-white hover:bg-cocoa"
                        href={buildOrderWhatsappLink(order, settings)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Send size={16} />
                        Reenviar WhatsApp
                      </a>
                    </div>
                  </div>

                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[560px] text-left text-sm">
                      <thead className="text-xs uppercase tracking-[0.14em] text-cocoa/50">
                        <tr>
                          <th className="py-2">Produto</th>
                          <th className="py-2">Qtd.</th>
                          <th className="py-2">Unitário</th>
                          <th className="py-2">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {order.items.map((item) => (
                          <tr key={`${order.id}-${item.id}-${item.name}`} className="border-t border-cocoa/10">
                            <td className="py-2 font-semibold">{item.name}</td>
                            <td className="py-2">{item.quantity}</td>
                            <td className="py-2">{formatMoney(item.unitPrice)}</td>
                            <td className="py-2 font-black">{formatMoney(item.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 flex justify-end border-t border-cocoa/10 pt-3">
                    <strong>Total: {formatMoney(order.total)}</strong>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="mt-8 rounded-lg bg-white p-4 shadow-soft sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.16em] text-gold">Produtos</p>
              <h2 className="mt-1 text-2xl font-black">Lista de produtos cadastrados</h2>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <label className="relative block">
                <Search
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-cocoa/45"
                  size={18}
                />
                <input
                  className="h-11 w-full rounded-full border border-cocoa/15 bg-cream pl-11 pr-4 outline-none focus:border-rose sm:w-72"
                  placeholder="Buscar produto"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
              <button
                type="button"
                onClick={exportProductsCsv}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-cocoa/15 px-5 text-sm font-bold hover:border-rose hover:text-rose"
              >
                <Download size={17} />
                Exportar CSV/Excel
              </button>
              <button
                type="button"
                onClick={openNewProductForm}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-rose px-5 text-sm font-bold text-white hover:bg-cocoa"
              >
                <Plus size={18} />
                Novo produto
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="admin-field">
              <span className="mb-2 block text-sm font-black text-cocoa/75">Filtrar por categoria</span>
              <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                <option value="Todas">Todas</option>
                {productCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
            <label className="admin-field">
              <span className="mb-2 block text-sm font-black text-cocoa/75">Filtrar por status</span>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                {['Todos', 'Ativo', 'Inativo', 'Promoção', 'Destaque', 'Novidade', 'Estoque baixo'].map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {successMessage && (
            <div className="mt-4 rounded-lg border border-gold/25 bg-gold/10 p-3 text-sm font-bold text-cocoa">
              {successMessage}
            </div>
          )}

          {isFormOpen && (
            <ProductForm
              form={form}
              setForm={setForm}
              editingId={editingId}
              onClear={clearProductForm}
              onCancel={closeForm}
              onSubmit={handleSaveProduct}
            />
          )}

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[1180px] border-separate border-spacing-y-3 text-left">
              <thead className="text-xs uppercase tracking-[0.14em] text-cocoa/50">
                <tr>
                  <th className="px-3">Produto</th>
                  <th className="px-3">SKU</th>
                  <th className="px-3">Categoria</th>
                  <th className="px-3">Custo</th>
                  <th className="px-3">Venda</th>
                  <th className="px-3">Lucro</th>
                  <th className="px-3">Margem</th>
                  <th className="px-3">Estoque</th>
                  <th className="px-3">Status</th>
                  <th className="px-3">Selos</th>
                  <th className="px-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => (
                  <tr key={product.id} className="rounded-lg bg-cream">
                    <td className="rounded-l-lg px-3 py-3">
                      <div className="flex items-center gap-3">
                        <img
                          className="h-14 w-14 rounded-md object-cover"
                          src={product.mainPhoto || PLACEHOLDER_IMAGE}
                          alt={product.name}
                          onError={(event) => {
                            event.currentTarget.src = PLACEHOLDER_IMAGE;
                          }}
                        />
                        <div>
                          <strong className="block">{product.name}</strong>
                          <small className="line-clamp-1 text-cocoa/60">{product.shortDescription}</small>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-sm font-semibold text-cocoa/65">{product.sku || '-'}</td>
                    <td className="px-3 py-3 text-sm font-semibold text-cocoa/70">{product.category}</td>
                    <td className="px-3 py-3 text-sm font-black">
                      {formatMoney(product.cost)}
                    </td>
                    <td className="px-3 py-3 text-sm font-black">
                      {formatMoney(product.promotionalPrice ?? product.price)}
                    </td>
                    <td className="px-3 py-3 text-sm font-black text-rose">
                      {formatMoney(calculateProfit(product))}
                    </td>
                    <td className="px-3 py-3 text-sm font-black">
                      {calculateProfitMargin(product).toFixed(1)}%
                    </td>
                    <td className="px-3 py-3">
                      <span className={`rounded-full px-3 py-1 text-xs font-black ${
                        product.stock <= 5 ? 'bg-rose text-white' : 'bg-white text-cocoa'
                      }`}
                      >
                        {product.stock}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`rounded-full px-3 py-1 text-xs font-black ${
                        product.status === 'active' ? 'bg-gold/20 text-cocoa' : 'bg-cocoa/10 text-cocoa/55'
                      }`}
                      >
                        {product.status === 'active' ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs font-bold text-cocoa/62">
                      {[product.featured && 'Destaque', product.promotion && 'Promoção', product.novelty && 'Novidade']
                        .filter(Boolean)
                        .join(', ') || 'Sem selo'}
                    </td>
                    <td className="rounded-r-lg px-3 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEditProductForm(product)}
                          className="inline-flex h-9 items-center gap-2 rounded-full bg-white px-3 text-xs font-black hover:text-rose"
                        >
                          <Edit3 size={15} />
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleProductStatus(product.id)}
                          className="inline-flex h-9 items-center gap-2 rounded-full bg-white px-3 text-xs font-black hover:text-rose"
                        >
                          {product.status === 'active' ? <EyeOff size={15} /> : <Eye size={15} />}
                          {product.status === 'active' ? 'Inativar' : 'Ativar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => duplicateProduct(product)}
                          className="inline-flex h-9 items-center gap-2 rounded-full bg-white px-3 text-xs font-black hover:text-rose"
                        >
                          <Copy size={15} />
                          Duplicar
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteProduct(product.id)}
                          className="inline-flex h-9 items-center gap-2 rounded-full bg-white px-3 text-xs font-black text-rose hover:bg-rose hover:text-white"
                        >
                          <Trash2 size={15} />
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredProducts.length === 0 && (
              <div className="rounded-lg border border-dashed border-cocoa/20 bg-cream p-8 text-center">
                <PackagePlus className="mx-auto text-rose" size={36} />
                <p className="mt-3 font-black">Nenhum produto encontrado</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function buildUploadStatus(label, uploadResult) {
  if (uploadResult.storage === 'cloudinary') {
    return `${label} enviado para Cloudinary.`;
  }

  if (uploadResult.error) {
    return `${label} salvo em Base64 como fallback local. Erro real do Cloudinary: ${uploadResult.error.message}`;
  }

  return `${label} salvo localmente em Base64.`;
}

function buildGalleryUploadStatus(uploadResults) {
  const cloudinaryCount = uploadResults.filter((result) => result.storage === 'cloudinary').length;
  const localCount = uploadResults.length - cloudinaryCount;
  const firstError = uploadResults.find((result) => result.error)?.error;

  if (localCount === 0) {
    return `${cloudinaryCount} imagem(ns) enviada(s) para Cloudinary.`;
  }

  return `${localCount} imagem(ns) salva(s) em Base64 como fallback local. Erro real do Cloudinary: ${
    firstError?.message || 'Cloudinary indisponivel.'
  }`;
}

function ProductForm({ form, setForm, editingId, onClear, onCancel, onSubmit }) {
  const [uploadStatus, setUploadStatus] = useState('');
  const mediaStorageMode = getMediaStorageMode();
  const mediaDiagnostics = getMediaStorageDiagnostics();

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function appendGalleryUrl(url) {
    setForm((current) => ({
      ...current,
      gallery: [current.gallery, url].filter(Boolean).join(current.gallery ? '\n' : ''),
    }));
  }

  async function handleMainImageUpload(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setUploadStatus('Enviando foto principal...');
    try {
      const uploadResult = await uploadMediaForStorage(file, {
        fallbackOnError: true,
        returnDetails: true,
      });
      updateField('mainPhoto', uploadResult.url);
      setUploadStatus(buildUploadStatus('Foto principal', uploadResult));
    } catch (error) {
      setUploadStatus(`Erro no upload da foto principal: ${error.message}`);
      window.alert(error.message);
    } finally {
      event.target.value = '';
    }
  }

  async function handleGalleryUpload(event) {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) {
      return;
    }

    setUploadStatus('Enviando imagens da galeria...');
    try {
      const uploadResults = await Promise.all(
        files.map((file) =>
          uploadMediaForStorage(file, {
            fallbackOnError: true,
            returnDetails: true,
          }),
        ),
      );
      setForm((current) => ({
        ...current,
        gallery: [current.gallery, ...uploadResults.map((result) => result.url)]
          .filter(Boolean)
          .join(current.gallery ? '\n' : ''),
      }));
      setUploadStatus(buildGalleryUploadStatus(uploadResults));
    } catch (error) {
      setUploadStatus(`Erro no upload da galeria: ${error.message}`);
      window.alert(error.message);
    } finally {
      event.target.value = '';
    }
  }

  async function handleVideoUpload(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setUploadStatus('Enviando video...');
    try {
      const uploadResult = await uploadMediaForStorage(file, {
        fallbackOnError: true,
        returnDetails: true,
      });
      updateField('videoUrl', uploadResult.url);
      setUploadStatus(buildUploadStatus('Video', uploadResult));
    } catch (error) {
      setUploadStatus(`Erro no upload do video: ${error.message}`);
      window.alert(error.message);
    } finally {
      event.target.value = '';
    }
  }

  const galleryPreview = form.gallery
    .split('\n')
    .map((url) => url.trim())
    .filter(Boolean);
  const formProfit = calculateProfit(form);
  const formMargin = calculateProfitMargin(form);

  return (
    <form onSubmit={onSubmit} className="mt-5 rounded-lg border border-cocoa/10 bg-linen p-3 sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-xl font-black">{editingId ? 'Editar produto' : 'Novo produto'}</h3>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClear}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-white px-4 text-sm font-bold text-cocoa hover:text-rose"
          >
            <Eraser size={16} />
            Limpar formulário
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="grid h-10 w-10 place-items-center rounded-full bg-white text-cocoa hover:text-rose"
            aria-label="Fechar formulário"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      <CloudinaryDiagnostics diagnostics={mediaDiagnostics} />

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <AdminField label="Código/SKU do produto">
          <input value={form.sku} onChange={(event) => updateField('sku', event.target.value)} />
        </AdminField>
        <AdminField label="Nome do produto">
          <input value={form.name} onChange={(event) => updateField('name', event.target.value)} required />
        </AdminField>
        <AdminField label="Categoria">
          <select value={form.category} onChange={(event) => updateField('category', event.target.value)}>
            {productCategories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </AdminField>
        <AdminField label="Custo do produto">
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.cost}
            onChange={(event) => updateField('cost', event.target.value)}
          />
        </AdminField>
        <AdminField label="Preço de venda">
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.price}
            onChange={(event) => updateField('price', event.target.value)}
            required
          />
        </AdminField>
        <div className="grid gap-3 rounded-lg bg-white p-4 sm:grid-cols-2 lg:col-span-2">
          <div>
            <span className="text-sm font-black text-cocoa/65">Lucro automático</span>
            <strong className="mt-1 block text-2xl font-black text-rose">{formatMoney(formProfit)}</strong>
          </div>
          <div>
            <span className="text-sm font-black text-cocoa/65">Margem de lucro</span>
            <strong className="mt-1 block text-2xl font-black text-cocoa">{formMargin.toFixed(1)}%</strong>
          </div>
        </div>
        <AdminField label="Preço promocional">
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.promotionalPrice}
            onChange={(event) => updateField('promotionalPrice', event.target.value)}
          />
        </AdminField>
        <AdminField label="Quantidade em estoque">
          <input
            type="number"
            min="0"
            step="1"
            value={form.stock}
            onChange={(event) => updateField('stock', event.target.value)}
            required
          />
        </AdminField>
        <AdminField label="Status">
          <select value={form.status} onChange={(event) => updateField('status', event.target.value)}>
            <option value="active">Ativo</option>
            <option value="inactive">Inativo</option>
          </select>
        </AdminField>
        <AdminField label="Foto principal, URL da imagem">
          <input
            value={form.mainPhoto}
            onChange={(event) => updateField('mainPhoto', event.target.value)}
            aria-invalid={form.mainPhoto ? !isValidImageSource(form.mainPhoto) : false}
          />
          {form.mainPhoto && !isValidImageSource(form.mainPhoto) && (
            <small className="mt-2 block font-bold text-rose">Informe uma URL http/https, caminho local ou imagem Base64.</small>
          )}
        </AdminField>
        <AdminField label="Vídeo do produto, URL">
          <input
            value={form.videoUrl}
            onChange={(event) => updateField('videoUrl', event.target.value)}
            aria-invalid={form.videoUrl ? !isValidVideoSource(form.videoUrl) : false}
          />
          {form.videoUrl && !isValidVideoSource(form.videoUrl) && (
            <small className="mt-2 block font-bold text-rose">Informe uma URL http/https, caminho local ou vídeo Base64.</small>
          )}
        </AdminField>
        <AdminField label="Descrição curta">
          <textarea value={form.shortDescription} onChange={(event) => updateField('shortDescription', event.target.value)} rows={3} />
        </AdminField>
        <AdminField label="Descrição completa">
          <textarea value={form.fullDescription} onChange={(event) => updateField('fullDescription', event.target.value)} rows={3} />
        </AdminField>
        <AdminField label="Observações internas, apenas no painel" className="lg:col-span-2">
          <textarea value={form.internalNotes} onChange={(event) => updateField('internalNotes', event.target.value)} rows={3} />
        </AdminField>
        <AdminField label="Galeria de fotos, uma URL por linha" className="lg:col-span-2">
          <textarea value={form.gallery} onChange={(event) => updateField('gallery', event.target.value)} rows={4} />
          {galleryPreview.some((url) => !isValidImageSource(url)) && (
            <small className="mt-2 block font-bold text-rose">Uma ou mais imagens da galeria parecem inválidas.</small>
          )}
        </AdminField>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[320px_1fr]">
        <MediaPreview
          title="Prévia da foto principal"
          src={form.mainPhoto}
          onUpload={handleMainImageUpload}
          storageMode={mediaStorageMode}
        />
        <div className="rounded-lg bg-white p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <strong className="block">Galeria de fotos</strong>
              <small className="text-cocoa/60">
                Use URLs ou selecione várias imagens para {mediaStorageMode === 'cloudinary' ? 'enviar ao Cloudinary' : 'teste local'}.
              </small>
            </div>
            <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-full bg-cocoa px-4 text-sm font-bold text-white hover:bg-rose">
              <ImagePlus size={17} />
              Selecionar imagens
              <input className="hidden" type="file" accept="image/*" multiple onChange={handleGalleryUpload} />
            </label>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {(galleryPreview.length > 0 ? galleryPreview : [form.mainPhoto]).filter(Boolean).map((url) => (
              <img
                key={url}
                className="aspect-square rounded-md bg-cream object-cover"
                src={isValidImageSource(url) ? url : PLACEHOLDER_IMAGE}
                alt="Prévia da galeria"
                onError={(event) => {
                  event.currentTarget.src = PLACEHOLDER_IMAGE;
                }}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => appendGalleryUrl(form.mainPhoto)}
            disabled={!form.mainPhoto}
            className="mt-4 inline-flex h-10 items-center justify-center rounded-full border border-cocoa/15 px-4 text-sm font-bold hover:border-rose hover:text-rose disabled:cursor-not-allowed disabled:opacity-40"
          >
            Usar foto principal na galeria
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-lg bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <strong className="block">Vídeo do produto</strong>
            <small className="text-cocoa/60">Use uma URL de vídeo ou selecione um arquivo para teste local.</small>
          </div>
          <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-full bg-cocoa px-4 text-sm font-bold text-white hover:bg-rose">
            <ImagePlus size={17} />
            Selecionar vídeo
            <input className="hidden" type="file" accept="video/*" onChange={handleVideoUpload} />
          </label>
        </div>
        {form.videoUrl && isValidVideoSource(form.videoUrl) ? (
          <video className="mt-4 aspect-video max-h-72 w-full rounded-md bg-cocoa object-contain" src={form.videoUrl} controls />
        ) : (
          <div className="mt-4 rounded-md border border-dashed border-cocoa/20 bg-cream p-5 text-sm font-semibold text-cocoa/60">
            Nenhum vídeo válido selecionado.
          </div>
        )}
      </div>

      {uploadStatus && (
        <p className="mt-4 rounded-lg bg-white px-4 py-3 text-sm font-bold text-cocoa/70">
          {uploadStatus}
        </p>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ToggleField checked={form.featured} label="Produto em destaque" onChange={(value) => updateField('featured', value)} />
        <ToggleField checked={form.promotion} label="Produto em promoção" onChange={(value) => updateField('promotion', value)} />
        <ToggleField checked={form.novelty} label="Produto novidade" onChange={(value) => updateField('novelty', value)} />
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-11 items-center justify-center rounded-full border border-cocoa/15 px-5 font-bold hover:border-rose hover:text-rose"
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-cocoa px-5 font-bold text-white hover:bg-rose"
        >
          <Save size={18} />
          Salvar produto
        </button>
      </div>
    </form>
  );
}

function StoreSettingsForm({ settings, settingsSaved, onChange, onSubmit }) {
  return (
    <form onSubmit={onSubmit} className="mt-5 grid gap-4 lg:grid-cols-2">
      <AdminField label="Nome da loja">
        <input
          value={settings.name}
          onChange={(event) => onChange('name', event.target.value)}
        />
      </AdminField>
      <AdminField label="Instagram">
        <input
          value={settings.instagram}
          onChange={(event) => onChange('instagram', event.target.value)}
          placeholder="@sualoja"
        />
      </AdminField>
      <AdminField label="Subtítulo da loja" className="lg:col-span-2">
        <textarea
          value={settings.subtitle}
          onChange={(event) => onChange('subtitle', event.target.value)}
          rows={3}
        />
      </AdminField>
      <AdminField label="Número do WhatsApp da loja">
        <input
          value={settings.whatsappNumber}
          onChange={(event) => onChange('whatsappNumber', event.target.value)}
          placeholder="5598988887777"
        />
        <small className="mt-2 block text-cocoa/60">
          Exemplo: 5598988887777. Sem espaços, sem parênteses e sem traços.
        </small>
      </AdminField>
      <AdminField label="Horário de funcionamento">
        <input
          value={settings.openingHours}
          onChange={(event) => onChange('openingHours', event.target.value)}
        />
      </AdminField>
      <AdminField label="Endereço" className="lg:col-span-2">
        <input
          value={settings.address}
          onChange={(event) => onChange('address', event.target.value)}
        />
      </AdminField>
      <AdminField label="Mensagem padrão do WhatsApp" className="lg:col-span-2">
        <textarea
          value={settings.whatsappDefaultMessage}
          onChange={(event) => onChange('whatsappDefaultMessage', event.target.value)}
          rows={3}
        />
      </AdminField>
      <AdminField label="Texto do banner principal" className="lg:col-span-2">
        <input
          value={settings.bannerText}
          onChange={(event) => onChange('bannerText', event.target.value)}
        />
      </AdminField>

      <div className="flex flex-col gap-3 lg:col-span-2 sm:flex-row sm:items-center sm:justify-end">
        {settingsSaved && (
          <span className="text-sm font-bold text-rose">Configurações salvas.</span>
        )}
        <button
          type="submit"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-cocoa px-5 font-bold text-white hover:bg-rose"
        >
          <Save size={18} />
          Salvar configurações
        </button>
      </div>
    </form>
  );
}

function CloudinaryDiagnostics({ diagnostics }) {
  return (
    <section className="mt-5 rounded-lg border border-cocoa/10 bg-white p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <strong className="block">Diagnóstico de upload</strong>
          <small className="text-cocoa/60">
            Confere as variáveis carregadas pelo Vite para o envio de fotos e vídeos.
          </small>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-black ${
          diagnostics.mode === 'cloudinary' ? 'bg-gold/20 text-cocoa' : 'bg-cocoa/10 text-cocoa/60'
        }`}
        >
          {diagnostics.mode === 'cloudinary' ? 'Usando Cloudinary' : 'Fallback local Base64'}
        </span>
      </div>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
        <div className="rounded-md bg-cream p-3">
          <dt className="font-black text-cocoa/60">Cloud name carregado</dt>
          <dd className="mt-1 break-all font-bold">{diagnostics.cloudName || 'Nao configurado'}</dd>
        </div>
        <div className="rounded-md bg-cream p-3">
          <dt className="font-black text-cocoa/60">Upload preset carregado</dt>
          <dd className="mt-1 break-all font-bold">{diagnostics.uploadPreset || 'Nao configurado'}</dd>
        </div>
        <div className="rounded-md bg-cream p-3">
          <dt className="font-black text-cocoa/60">Folder carregado</dt>
          <dd className="mt-1 break-all font-bold">{diagnostics.folder || 'Sem folder'}</dd>
        </div>
      </dl>
    </section>
  );
}

function SupabaseDiagnostics({ diagnostics, migrationMessage, onMigrate, onTestConnection }) {
  const lastError = diagnostics.lastError;
  const connectionTest = diagnostics.connectionTest;

  return (
    <section className="mt-8 rounded-lg border border-cocoa/10 bg-white p-4 shadow-soft sm:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.16em] text-gold">Banco de dados</p>
          <h2 className="mt-1 text-2xl font-black">Diagnóstico Supabase</h2>
          <p className="mt-1 text-sm leading-6 text-cocoa/62">
            Mostra se o painel está usando o Supabase como banco principal ou o fallback localStorage.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onTestConnection}
            className="inline-flex h-11 items-center justify-center rounded-full border border-cocoa/15 px-5 text-sm font-bold hover:border-rose hover:text-rose"
          >
            Testar conexão Supabase
          </button>
          <button
            type="button"
            onClick={onMigrate}
            className="inline-flex h-11 items-center justify-center rounded-full bg-cocoa px-5 text-sm font-bold text-white hover:bg-rose"
          >
            Migrar dados locais para Supabase
          </button>
        </div>
      </div>

      <dl className="mt-4 grid gap-3 text-sm lg:grid-cols-4">
        <div className="rounded-md bg-cream p-3">
          <dt className="font-black text-cocoa/60">URL final usada pelo cliente</dt>
          <dd className="mt-1 break-all font-bold">{diagnostics.finalUrl || 'Não configurada'}</dd>
        </div>
        <div className="rounded-md bg-cream p-3">
          <dt className="font-black text-cocoa/60">Tamanho da anon key</dt>
          <dd className="mt-1 break-all font-bold">{diagnostics.anonKeyLength || 0} caracteres</dd>
        </div>
        <div className="rounded-md bg-cream p-3">
          <dt className="font-black text-cocoa/60">Primeiros 8 caracteres</dt>
          <dd className="mt-1 break-all font-bold">{diagnostics.anonKeyStart || '-'}</dd>
        </div>
        <div className="rounded-md bg-cream p-3">
          <dt className="font-black text-cocoa/60">Últimos 6 caracteres</dt>
          <dd className="mt-1 break-all font-bold">{diagnostics.anonKeyEnd || '-'}</dd>
        </div>
        <div className="rounded-md bg-cream p-3">
          <dt className="font-black text-cocoa/60">Supabase URL carregada</dt>
          <dd className="mt-1 break-all font-bold">{diagnostics.url || 'Não configurada'}</dd>
        </div>
        <div className="rounded-md bg-cream p-3">
          <dt className="font-black text-cocoa/60">Anon key carregada</dt>
          <dd className="mt-1 break-all font-bold">{diagnostics.anonKey || 'Não configurada'}</dd>
        </div>
        <div className="rounded-md bg-cream p-3">
          <dt className="font-black text-cocoa/60">Modo</dt>
          <dd className="mt-1 font-bold">
            {diagnostics.mode === 'supabase' ? 'Usando Supabase' : 'Fallback localStorage'}
          </dd>
        </div>
        <div className="rounded-md bg-cream p-3">
          <dt className="font-black text-cocoa/60">Último erro</dt>
          <dd className="mt-1 break-all font-bold">{lastError?.message || 'Nenhum erro registrado'}</dd>
        </div>
        <div className="rounded-md bg-cream p-3">
          <dt className="font-black text-cocoa/60">Resultado do teste categories</dt>
          <dd className="mt-1 break-all font-bold">
            {connectionTest
              ? connectionTest.ok
                ? `OK (${connectionTest.result?.length || 0} registro(s))`
                : 'Falhou'
              : 'Ainda não testado'}
          </dd>
        </div>
      </dl>

      {connectionTest && (
        <pre className="mt-4 max-h-52 overflow-auto rounded-lg bg-cocoa p-4 text-xs font-semibold text-white">
          {JSON.stringify(connectionTest, null, 2)}
        </pre>
      )}

      {lastError?.friendlyMessage && (
        <p className="mt-4 rounded-lg border border-rose/25 bg-blush px-4 py-3 text-sm font-black text-rose">
          {lastError.friendlyMessage}
        </p>
      )}

      {lastError && (
        <dl className="mt-4 grid gap-2 rounded-lg bg-cream p-4 text-sm md:grid-cols-2">
          <div><dt className="font-black">name</dt><dd className="break-all">{lastError.name || '-'}</dd></div>
          <div><dt className="font-black">message</dt><dd className="break-all">{lastError.message || '-'}</dd></div>
          <div><dt className="font-black">code</dt><dd className="break-all">{lastError.code || '-'}</dd></div>
          <div><dt className="font-black">hint</dt><dd className="break-all">{lastError.hint || '-'}</dd></div>
          <div className="md:col-span-2"><dt className="font-black">details</dt><dd className="break-all">{lastError.details || '-'}</dd></div>
          <div className="md:col-span-2"><dt className="font-black">stack</dt><dd className="whitespace-pre-wrap break-all">{lastError.stack || '-'}</dd></div>
        </dl>
      )}

      {migrationMessage && (
        <p className="mt-4 rounded-lg bg-linen px-4 py-3 text-sm font-bold text-cocoa/75">
          {migrationMessage}
        </p>
      )}
    </section>
  );
}

function AdminField({ label, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-2 block text-sm font-black text-cocoa/75">{label}</span>
      <div className="admin-field">{children}</div>
    </label>
  );
}

function MediaPreview({ title, src, onUpload, storageMode }) {
  return (
    <div className="rounded-lg bg-white p-4">
      <strong className="block">{title}</strong>
      <div className="mt-3 overflow-hidden rounded-md bg-cream">
        <img
          className="aspect-[4/3] w-full object-cover"
          src={isValidImageSource(src) ? src : PLACEHOLDER_IMAGE}
          alt={title}
          onError={(event) => {
            event.currentTarget.src = PLACEHOLDER_IMAGE;
          }}
        />
      </div>
      <label className="mt-3 inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-cocoa px-4 text-sm font-bold text-white hover:bg-rose">
        <ImagePlus size={17} />
        Selecionar imagem
        <input className="hidden" type="file" accept="image/*" onChange={onUpload} />
      </label>
      <small className="mt-2 block text-cocoa/55">
        Nesta versão local, o arquivo é salvo como Base64 no localStorage.
      </small>
    </div>
  );
}

function ToggleField({ checked, label, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-black transition ${
        checked ? 'bg-rose text-white' : 'bg-white text-cocoa/65 hover:text-rose'
      }`}
    >
      {label}: {checked ? 'sim' : 'não'}
    </button>
  );
}
