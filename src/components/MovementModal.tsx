import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  PackageSearch,
  Search,
} from 'lucide-react';
import { api } from '../api';
import { useApp } from '../app-context';
import type { Kind, Product } from '../types';
import {
  brl,
  cx,
  dateShort,
  nowTime,
  num,
  parseAmountInput,
  todayISO,
} from '../format';
import {
  Button,
  CurrencyInput,
  Field,
  FieldGroup,
  InlineAlert,
  Input,
  Modal,
  Skeleton,
  Textarea,
  useToast,
} from './Ui';

function ProductPicker({
  products,
  value,
  onChange,
  disabled,
}: {
  products: Product[];
  value: number | null;
  onChange: (product: Product) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const selected = products.find((product) => product.id === value) ?? null;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKey);
    window.setTimeout(() => searchRef.current?.focus(), 30);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const filtered = products.filter((product) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return (
      product.name.toLowerCase().includes(term) ||
      product.sku.toLowerCase().includes(term) ||
      product.typeName.toLowerCase().includes(term)
    );
  });

  return (
    <div className="product-picker" ref={rootRef}>
      <button
        type="button"
        className={cx('picker-trigger', open && 'is-open', selected && 'has-value')}
        onClick={() => {
          setOpen((valueOpen) => !valueOpen);
          setSearch('');
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
      >
        {selected ? (
          <>
            <span className="type-dot" style={{ background: selected.typeColor }} />
            <span className="picker-selected">
              <strong>{selected.name}</strong>
              <small>
                {selected.sku} · {selected.typeName}
              </small>
            </span>
            <span className="picker-stock">
              {num(selected.stock)} {selected.unit}
            </span>
          </>
        ) : (
          <>
            <PackageSearch size={18} className="picker-placeholder-icon" />
            <span className="picker-placeholder">Selecione um produto</span>
          </>
        )}
        <ChevronDown size={16} className="picker-chevron" />
      </button>

      {open ? (
        <div className="picker-popover">
          <div className="picker-search">
            <Search size={15} />
            <input
              ref={searchRef}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nome, código ou tipo"
              aria-label="Buscar produto"
            />
          </div>
          <div className="picker-list" role="listbox" aria-label="Produtos">
            {filtered.length === 0 ? (
              <p className="picker-empty">Nenhum produto encontrado.</p>
            ) : (
              filtered.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  role="option"
                  aria-selected={product.id === value}
                  className={cx('picker-option', product.id === value && 'is-selected')}
                  onClick={() => {
                    onChange(product);
                    setOpen(false);
                  }}
                >
                  <span className="type-dot" style={{ background: product.typeColor }} />
                  <span className="picker-option-main">
                    <strong>{product.name}</strong>
                    <small>
                      {product.sku} · {product.typeName}
                    </small>
                  </span>
                  <span className={cx('picker-option-stock', product.stock <= 0 && 'is-out')}>
                    {num(product.stock)} {product.unit}
                  </span>
                  {product.id === value ? <Check size={15} className="picker-check" /> : null}
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function MovementModal({
  initialKind,
  initialProduct,
  onClose,
}: {
  initialKind: Kind;
  initialProduct?: Product;
  onClose: () => void;
}) {
  const { notifyChange, navigate } = useApp();
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [kind, setKind] = useState<Kind>(initialKind);
  const [productId, setProductId] = useState<number | null>(initialProduct?.id ?? null);
  const [quantity, setQuantity] = useState('');
  const [unitPrice, setUnitPrice] = useState(initialProduct?.price ?? 0);
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState(nowTime());
  const [party, setParty] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadProducts = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await api.get<{ products: Product[] }>('/api/products');
      setProducts(result.products);
      setProductId((current) => {
        if (current && result.products.some((product) => product.id === current)) return current;
        if (initialProduct && result.products.some((product) => product.id === initialProduct.id)) {
          return initialProduct.id;
        }
        return result.products[0]?.id ?? null;
      });
      const product =
        result.products.find((item) => item.id === initialProduct?.id) ?? result.products[0];
      if (product && !initialProduct) {
        setUnitPrice((current) => (current === 0 ? product.price : current));
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Não foi possível carregar os produtos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const product = products.find((item) => item.id === productId) ?? null;
  const parsedQuantity = parseAmountInput(quantity);
  const stockAfter = product ? (kind === 'saida' ? product.stock - parsedQuantity : product.stock + parsedQuantity) : null;
  const insufficient = Boolean(product && kind === 'saida' && parsedQuantity > product.stock);
  const total = parsedQuantity > 0 ? parsedQuantity * unitPrice : 0;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!product) {
      setError('Selecione um produto.');
      return;
    }
    if (!quantity.trim() || !(parsedQuantity > 0)) {
      setError('Informe uma quantidade maior que zero.');
      return;
    }
    if (insufficient) {
      setError(`Estoque insuficiente. Disponível: ${num(product.stock)} ${product.unit}.`);
      return;
    }
    if (!date) {
      setError('Informe a data.');
      return;
    }
    if (!time) {
      setError('Informe o horário.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.post('/api/movements', {
        kind,
        productId: product.id,
        quantity: parsedQuantity,
        unitPrice,
        date,
        time,
        party: party.trim(),
        notes: notes.trim(),
      });
      notifyChange();
      toast(
        kind === 'saida'
          ? `Saída registrada: ${num(parsedQuantity)} ${product.unit} de ${product.name}.`
          : `Entrada registrada: ${num(parsedQuantity)} ${product.unit} de ${product.name}.`,
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível registrar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      eyebrow="Movimentação"
      title={kind === 'saida' ? 'Registrar saída' : 'Registrar entrada'}
      subtitle="Tudo é registrado com data e hora."
      onSubmit={handleSubmit}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            type="submit"
            loading={saving}
            disabled={loading || !product || insufficient}
            variant={kind === 'saida' ? 'primary' : 'primary'}
            icon={kind === 'saida' ? <ArrowUpRight size={16} /> : <ArrowDownLeft size={16} />}
          >
            {kind === 'saida' ? 'Registrar saída' : 'Registrar entrada'}
          </Button>
        </>
      }
    >
      <div className={cx('kind-switch', `kind-${kind}`)}>
        <button
          type="button"
          className={cx('kind-option', kind === 'saida' && 'is-active')}
          onClick={() => {
            setKind('saida');
            setParty('');
            setError(null);
          }}
        >
          <span className="kind-icon">
            <ArrowUpRight size={17} />
          </span>
          <span>
            <strong>Saída</strong>
            <small>Produto deixou o estoque</small>
          </span>
        </button>
        <button
          type="button"
          className={cx('kind-option', kind === 'entrada' && 'is-active')}
          onClick={() => {
            setKind('entrada');
            setParty('');
            setError(null);
          }}
        >
          <span className="kind-icon">
            <ArrowDownLeft size={17} />
          </span>
          <span>
            <strong>Entrada</strong>
            <small>Reposição no estoque</small>
          </span>
        </button>
      </div>

      {loadError ? (
        <InlineAlert
          tone="danger"
          action={
            <Button size="sm" variant="secondary" onClick={loadProducts}>
              Tentar novamente
            </Button>
          }
        >
          {loadError}
        </InlineAlert>
      ) : null}

      {!loading && products.length === 0 ? (
        <InlineAlert
          tone="warning"
          action={
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                onClose();
                navigate('produtos');
              }}
            >
              Ver produtos
            </Button>
          }
        >
          Cadastre um produto antes de registrar movimentações.
        </InlineAlert>
      ) : null}

      {error ? <InlineAlert tone="danger">{error}</InlineAlert> : null}

      {loading ? (
        <div className="modal-loading">
          <Skeleton className="skeleton-line-lg" />
          <Skeleton className="skeleton-block" />
        </div>
      ) : products.length > 0 ? (
        <>
          <Field label="Produto">
            <ProductPicker
              products={products}
              value={productId}
              onChange={(selected) => {
                setProductId(selected.id);
                setUnitPrice(selected.price);
                setError(null);
              }}
            />
          </Field>

          {product ? (
            <div className="product-context">
              <span className="type-dot" style={{ background: product.typeColor }} />
              <span>
                Estoque atual: <strong>{num(product.stock)} {product.unit}</strong>
              </span>
              <span className="dot-sep" />
              <span>Tipo: {product.typeName}</span>
              {product.expiresOn ? (
                <>
                  <span className="dot-sep" />
                  <span>Validade {dateShort(product.expiresOn)}</span>
                </>
              ) : null}
            </div>
          ) : null}

          <div className="form-row form-row-3">
            <Field label="Quantidade" className="qty-field">
              <span className="input-suffix-wrap">
                <Input
                  value={quantity}
                  onChange={(event) => {
                    setQuantity(event.target.value);
                    if (error) setError(null);
                  }}
                  inputMode="decimal"
                  placeholder="0"
                  autoFocus
                  aria-label="Quantidade"
                />
                <span>{product?.unit ?? 'un'}</span>
              </span>
            </Field>
            <Field label={kind === 'saida' ? 'Valor de saída' : 'Custo unitário'}>
              <CurrencyInput value={unitPrice} onValueChange={setUnitPrice} ariaLabel="Valor unitário" />
            </Field>
            <FieldGroup label="Total">
              <div className="total-readout">{brl(total)}</div>
            </FieldGroup>
          </div>

          <div className="form-row">
            <Field label="Data">
              <span className="input-icon-wrap">
                <CalendarDays size={16} />
                <Input
                  type="date"
                  value={date}
                  max={todayISO()}
                  onChange={(event) => setDate(event.target.value)}
                  aria-label="Data"
                />
              </span>
            </Field>
            <Field label="Hora">
              <span className="input-icon-wrap">
                <Clock3 size={16} />
                <Input
                  type="time"
                  value={time}
                  onChange={(event) => setTime(event.target.value)}
                  aria-label="Hora"
                />
              </span>
            </Field>
          </div>

          <div className="quick-now-row">
            <button
              type="button"
              className="inline-link"
              onClick={() => {
                setDate(todayISO());
                setTime(nowTime());
              }}
            >
              <Clock3 size={13} /> Usar agora
            </button>
          </div>

          <Field label={kind === 'saida' ? 'Cliente / destino' : 'Fornecedor / origem'} optional>
            <Input
              value={party}
              onChange={(event) => setParty(event.target.value)}
              placeholder={kind === 'saida' ? 'Para quem este produto está saindo?' : 'De onde este produto está chegando?'}
              maxLength={120}
            />
          </Field>

          <Field label="Observações" optional>
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Algo importante sobre esta movimentação?"
              rows={2}
              maxLength={400}
            />
          </Field>

          {product && parsedQuantity > 0 ? (
            <div className={cx('stock-preview', insufficient && 'is-danger')}>
              <span>Estoque após a movimentação</span>
              <strong>
                {num(Math.max(stockAfter ?? 0, 0))} {product.unit}
              </strong>
              {insufficient ? (
                <small>
                  Faltam {num(parsedQuantity - product.stock)} {product.unit} para completar esta saída.
                </small>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </Modal>
  );
}
