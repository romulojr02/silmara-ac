import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  ArrowUpDown,
  Download,
  PackagePlus,
  Pencil,
  Plus,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { api } from '../api';
import { useApp } from '../app-context';
import type { Product, ProductStatusKey, ProductType } from '../types';
import {
  brl,
  cx,
  dateLong,
  dateShort,
  downloadText,
  expiryLabel,
  normalizeText,
  num,
  productStatus,
  todayISO,
  toCsv,
} from '../format';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  IconButton,
  InlineAlert,
  PageHead,
  Select,
  Skeleton,
  useToast,
} from '../components/Ui';
import { ProductDrawer } from '../components/ProductDrawer';

type SortKey = 'name' | 'stock' | 'value' | 'expiry';
type StatusFilter = 'all' | ProductStatusKey;

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Todos os status' },
  { value: 'ok', label: 'Em dia' },
  { value: 'low', label: 'Estoque baixo' },
  { value: 'out', label: 'Sem estoque' },
  { value: 'expiring', label: 'Validade próxima' },
  { value: 'expired', label: 'Vencidos' },
];

function sortProducts(products: Product[], sort: { key: SortKey; dir: 'asc' | 'desc' }): Product[] {
  const factor = sort.dir === 'asc' ? 1 : -1;
  return [...products].sort((a, b) => {
    if (sort.key === 'name') return a.name.localeCompare(b.name, 'pt-BR') * factor;
    if (sort.key === 'stock') return (a.stock - b.stock) * factor;
    if (sort.key === 'value') return (a.stock * a.price - b.stock * b.price) * factor;
    if (sort.key === 'expiry') {
      if (!a.expiresOn && !b.expiresOn) return 0;
      if (!a.expiresOn) return 1;
      if (!b.expiresOn) return -1;
      return a.expiresOn.localeCompare(b.expiresOn) * factor;
    }
    return 0;
  });
}

function SortHeader({
  label,
  sortKey,
  current,
  onSort,
  align,
}: {
  label: string;
  sortKey: SortKey;
  current: { key: SortKey; dir: 'asc' | 'desc' };
  onSort: (key: SortKey) => void;
  align?: 'right';
}) {
  const active = current.key === sortKey;
  const Icon = !active ? ArrowUpDown : current.dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th aria-sort={active ? (current.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        className={cx('sort-button', align === 'right' && 'is-right', active && 'is-active')}
        onClick={() => onSort(sortKey)}
      >
        {label}
        <Icon size={13} />
      </button>
    </th>
  );
}

function StockBar({ product }: { product: Product }) {
  const status = productStatus(product);
  const target = Math.max(product.minStock * 2, 1);
  const width = Math.min(100, Math.max(3, (product.stock / target) * 100));
  return (
    <span className="stock-cell">
      <span className="stock-cell-main">
        <strong>{num(product.stock)}</strong>
        <span>{product.unit}</span>
      </span>
      <span className={cx('stock-bar', `stock-bar-${status.tone}`)}>
        <span style={{ width: `${width}%` }} />
      </span>
    </span>
  );
}

export function Products() {
  const { revision, notifyChange, openMovement } = useApp();
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [types, setTypes] = useState<ProductType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<number | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({
    key: 'name',
    dir: 'asc',
  });
  const [drawer, setDrawer] = useState<{ product: Product | null } | null>(null);
  const [demoBusy, setDemoBusy] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.get<{ products: Product[] }>('/api/products'),
      api.get<{ types: ProductType[] }>('/api/types'),
    ])
      .then(([productsResult, typesResult]) => {
        setProducts(productsResult.products);
        setTypes(typesResult.types);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Não foi possível carregar.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revision]);

  const totalValue = useMemo(
    () => products.reduce((sum, product) => sum + Math.max(product.stock, 0) * product.price, 0),
    [products],
  );
  const totalStock = useMemo(
    () => products.reduce((sum, product) => sum + Math.max(product.stock, 0), 0),
    [products],
  );

  const typeCounts = useMemo(() => {
    const map = new Map<number, number>();
    for (const product of products) map.set(product.typeId, (map.get(product.typeId) ?? 0) + 1);
    return map;
  }, [products]);

  const filtered = useMemo(() => {
    const term = normalizeText(search.trim());
    const filteredList = products.filter((product) => {
      if (typeFilter !== 'all' && product.typeId !== typeFilter) return false;
      if (statusFilter !== 'all' && productStatus(product).key !== statusFilter) return false;
      if (!term) return true;
      return (
        normalizeText(product.name).includes(term) ||
        normalizeText(product.sku).includes(term) ||
        normalizeText(product.typeName).includes(term)
      );
    });
    return sortProducts(filteredList, sort);
  }, [products, search, typeFilter, statusFilter, sort]);

  const toggleSort = (key: SortKey) => {
    setSort((current) =>
      current.key === key
        ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === 'name' ? 'asc' : 'desc' },
    );
  };

  const clearFilters = () => {
    setSearch('');
    setTypeFilter('all');
    setStatusFilter('all');
  };

  const exportCsv = () => {
    const headers = [
      'Produto',
      'Código',
      'Tipo',
      'Unidade',
      'Estoque atual',
      'Estoque mínimo',
      'Preço unitário',
      'Valor em estoque',
      'Validade',
      'Status',
    ];
    const rows = filtered.map((product) => [
      product.name,
      product.sku,
      product.typeName,
      product.unit,
      num(product.stock),
      num(product.minStock),
      product.price.toFixed(2).replace('.', ','),
      (Math.max(product.stock, 0) * product.price).toFixed(2).replace('.', ','),
      product.expiresOn ? dateLong(product.expiresOn) : '',
      productStatus(product).label,
    ]);
    downloadText(
      `controles-da-silmara-produtos-${todayISO()}.csv`,
      toCsv(headers, rows),
      'text/csv;charset=utf-8',
    );
    toast(`${filtered.length} produtos exportados em CSV.`);
  };

  const loadDemo = async () => {
    setDemoBusy(true);
    try {
      await api.post('/api/demo');
      notifyChange();
      toast('Dados de exemplo carregados.');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Não foi possível carregar o exemplo.', 'error');
    } finally {
      setDemoBusy(false);
    }
  };

  const isFiltering = search.trim() !== '' || typeFilter !== 'all' || statusFilter !== 'all';

  return (
    <div className="page">
      <PageHead
        eyebrow="Sua planilha"
        title="Produtos"
        subtitle="Tudo o que entra, sai e fica — organizado em um só lugar."
        actions={
          <>
            <Button
              variant="secondary"
              icon={<Download size={16} />}
              onClick={exportCsv}
              disabled={products.length === 0}
            >
              Exportar
            </Button>
            <Button icon={<Plus size={16} />} onClick={() => setDrawer({ product: null })}>
              Novo produto
            </Button>
          </>
        }
      />

      {error ? (
        <InlineAlert
          tone="danger"
          action={
            <Button size="sm" variant="secondary" onClick={load}>
              Tentar novamente
            </Button>
          }
        >
          {error}
        </InlineAlert>
      ) : null}

      {products.length === 0 && !loading ? (
        <Card className="products-empty-card">
          <EmptyState
            icon={<PackagePlus size={24} />}
            title="Sua planilha está pronta para o primeiro item"
            description="Adicione um produto com tipo, preço e validade. O estoque e os alertas passam a funcionar automaticamente."
            action={
              <>
                <Button icon={<Plus size={16} />} onClick={() => setDrawer({ product: null })}>
                  Adicionar produto
                </Button>
                <Button
                  variant="secondary"
                  icon={<Sparkles size={16} />}
                  loading={demoBusy}
                  onClick={loadDemo}
                >
                  Usar dados de exemplo
                </Button>
              </>
            }
          />
        </Card>
      ) : (
        <Card className="products-card">
          <div className="products-toolbar">
            <div className="search-field">
              <Search size={16} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por nome, código ou tipo"
                aria-label="Buscar produtos"
              />
              {search ? (
                <button type="button" onClick={() => setSearch('')} aria-label="Limpar busca">
                  <X size={14} />
                </button>
              ) : null}
            </div>
            <div className="toolbar-right">
              <Select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                aria-label="Filtrar por status"
                className="status-select"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="type-chips" role="group" aria-label="Filtrar por tipo">
            <button
              type="button"
              className={cx('type-chip', typeFilter === 'all' && 'is-active')}
              onClick={() => setTypeFilter('all')}
            >
              Todos
              <span>{products.length}</span>
            </button>
            {types.map((type) => (
              <button
                key={type.id}
                type="button"
                className={cx('type-chip', typeFilter === type.id && 'is-active')}
                onClick={() => setTypeFilter(type.id)}
              >
                <i style={{ background: type.color }} />
                {type.name}
                <span>{typeCounts.get(type.id) ?? 0}</span>
              </button>
            ))}
          </div>

          {loading ? (
            <div className="table-loading">
              {[0, 1, 2, 3, 4].map((index) => (
                <Skeleton key={index} className="skeleton-row" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              compact
              icon={<Search size={20} />}
              title="Nenhum produto encontrado"
              description={
                isFiltering
                  ? 'Ajuste os filtros ou a busca para encontrar o que procura.'
                  : 'Adicione produtos para começar.'
              }
              action={
                isFiltering ? (
                  <Button size="sm" variant="secondary" onClick={clearFilters}>
                    Limpar filtros
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => setDrawer({ product: null })}>
                    Adicionar produto
                  </Button>
                )
              }
            />
          ) : (
            <>
              <div className="table-wrap">
                <table className="data-table products-table">
                  <thead>
                    <tr>
                      <SortHeader label="Produto" sortKey="name" current={sort} onSort={toggleSort} />
                      <th>Tipo</th>
                      <SortHeader label="Estoque" sortKey="stock" current={sort} onSort={toggleSort} />
                      <SortHeader
                        label="Valor unit."
                        sortKey="value"
                        current={sort}
                        onSort={toggleSort}
                        align="right"
                      />
                      <SortHeader
                        label="Validade"
                        sortKey="expiry"
                        current={sort}
                        onSort={toggleSort}
                      />
                      <th>Status</th>
                      <th className="th-actions">
                        <span className="sr-only">Ações</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((product) => {
                      const status = productStatus(product);
                      return (
                        <tr
                          key={product.id}
                          className="product-row"
                          onClick={() => setDrawer({ product })}
                        >
                          <td>
                            <div className="product-cell">
                              <span
                                className="product-avatar"
                                style={{
                                  background: `color-mix(in srgb, ${product.typeColor} 15%, var(--surface))`,
                                  color: product.typeColor,
                                }}
                              >
                                {product.name.slice(0, 1).toUpperCase()}
                              </span>
                              <span className="product-name">
                                <strong>{product.name}</strong>
                                <small className="mono">{product.sku}</small>
                              </span>
                            </div>
                          </td>
                          <td>
                            <span className="type-label">
                              <i style={{ background: product.typeColor }} />
                              {product.typeName}
                            </span>
                          </td>
                          <td>
                            <StockBar product={product} />
                          </td>
                          <td className="cell-right">
                            <span className="cell-value">{brl(product.price)}</span>
                            <small className="cell-sub">/ {product.unit}</small>
                          </td>
                          <td>
                            {product.expiresOn ? (
                              <span className="expiry-cell">
                                <span>{dateShort(product.expiresOn)}</span>
                                {status.key === 'expiring' || status.key === 'expired' ? (
                                  <small className={cx(status.key === 'expired' && 'is-expired')}>
                                    {expiryLabel(product.expiresOn)}
                                  </small>
                                ) : null}
                              </span>
                            ) : (
                              <span className="muted-cell">Sem validade</span>
                            )}
                          </td>
                          <td>
                            <Badge tone={status.tone} dot>
                              {status.label}
                            </Badge>
                          </td>
                          <td>
                            <div
                              className="row-actions"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <IconButton
                                label="Registrar movimentação"
                                size="sm"
                                variant="outline"
                                onClick={() => openMovement('saida', product)}
                              >
                                <ArrowLeftRight size={14} />
                              </IconButton>
                              <IconButton
                                label="Editar produto"
                                size="sm"
                                variant="ghost"
                                onClick={() => setDrawer({ product })}
                              >
                                <Pencil size={14} />
                              </IconButton>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="product-cards">
                {filtered.map((product) => {
                  const status = productStatus(product);
                  return (
                    <article key={product.id} className="product-card">
                      <div className="product-card-head">
                        <div className="product-cell">
                          <span
                            className="product-avatar"
                            style={{
                              background: `color-mix(in srgb, ${product.typeColor} 15%, var(--surface))`,
                              color: product.typeColor,
                            }}
                          >
                            {product.name.slice(0, 1).toUpperCase()}
                          </span>
                          <span className="product-name">
                            <strong>{product.name}</strong>
                            <small>
                              {product.sku} · {product.typeName}
                            </small>
                          </span>
                        </div>
                        <Badge tone={status.tone} dot>
                          {status.label}
                        </Badge>
                      </div>
                      <div className="product-card-stats">
                        <div>
                          <span>Estoque</span>
                          <strong>
                            {num(product.stock)} <small>{product.unit}</small>
                          </strong>
                        </div>
                        <div>
                          <span>Preço</span>
                          <strong>{brl(product.price)}</strong>
                        </div>
                        <div>
                          <span>Validade</span>
                          <strong>{product.expiresOn ? dateShort(product.expiresOn) : '—'}</strong>
                        </div>
                      </div>
                      {(status.key === 'expiring' || status.key === 'expired') && product.expiresOn ? (
                        <p className="product-card-note">{expiryLabel(product.expiresOn)}</p>
                      ) : null}
                      <div className="product-card-actions">
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={<ArrowLeftRight size={14} />}
                          onClick={() => openMovement('saida', product)}
                        >
                          Movimentar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={<Pencil size={14} />}
                          onClick={() => setDrawer({ product })}
                        >
                          Editar
                        </Button>
                      </div>
                    </article>
                  );
                })}
              </div>

              <footer className="table-foot">
                <span>
                  <strong>{filtered.length}</strong> de {products.length} produtos
                </span>
                <span className="table-foot-stats">
                  <span>
                    <strong>{num(totalStock)}</strong> itens em estoque
                  </span>
                  <span className="dot-sep" />
                  <span>
                    <strong>{brl(totalValue)}</strong> em valor
                  </span>
                </span>
              </footer>
            </>
          )}
        </Card>
      )}

      {drawer ? (
        <ProductDrawer product={drawer.product} types={types} onClose={() => setDrawer(null)} />
      ) : null}
    </div>
  );
}
