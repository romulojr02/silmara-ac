import { useState, type FormEvent } from 'react';
import { Archive, Package, Sparkles, Trash2 } from 'lucide-react';
import { api } from '../api';
import { useApp } from '../app-context';
import type { Product, ProductType } from '../types';
import {
  brl,
  cx,
  dateShort,
  parseAmountInput,
  productStatus,
} from '../format';
import {
  Badge,
  Button,
  ConfirmDialog,
  CurrencyInput,
  Field,
  InlineAlert,
  Input,
  Modal,
  Select,
  Textarea,
  useToast,
} from './Ui';

const UNITS = [
  ['un', 'Unidade (un)'],
  ['kg', 'Quilograma (kg)'],
  ['g', 'Grama (g)'],
  ['L', 'Litro (L)'],
  ['ml', 'Mililitro (ml)'],
  ['cx', 'Caixa (cx)'],
  ['pct', 'Pacote (pct)'],
  ['fardo', 'Fardo'],
  ['dz', 'Dúzia (dz)'],
];

export function ProductDrawer({
  product,
  types,
  onClose,
}: {
  product: Product | null;
  types: ProductType[];
  onClose: () => void;
}) {
  const { notifyChange } = useApp();
  const { toast } = useToast();
  const editing = Boolean(product);
  const [name, setName] = useState(product?.name ?? '');
  const [sku, setSku] = useState(product?.sku ?? '');
  const [typeId, setTypeId] = useState<number | ''>(
    product?.typeId ?? types[0]?.id ?? '',
  );
  const [unit, setUnit] = useState(product?.unit ?? 'un');
  const [price, setPrice] = useState(product?.price ?? 0);
  const [initialStock, setInitialStock] = useState(
    product ? String(product.initialStock).replace('.', ',') : '',
  );
  const [minStock, setMinStock] = useState(
    product ? String(product.minStock).replace('.', ',') : '',
  );
  const [expiresOn, setExpiresOn] = useState(product?.expiresOn ?? '');
  const [notes, setNotes] = useState(product?.notes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const status = product ? productStatus(product) : null;
  const parsedInitial = parseAmountInput(initialStock);
  const parsedMin = parseAmountInput(minStock);
  const previewStock = product
    ? product.stock - product.initialStock + parsedInitial
    : parsedInitial;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (name.trim().length < 2) {
      setError('Informe o nome do produto.');
      return;
    }
    if (!typeId) {
      setError('Selecione um tipo de produto.');
      return;
    }
    if (parsedInitial < 0 || parsedMin < 0) {
      setError('Os valores de estoque não podem ser negativos.');
      return;
    }
    if (!editing && previewStock < 0) {
      setError('O saldo ficaria negativo.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        sku: sku.trim(),
        typeId,
        unit,
        price,
        initialStock: parsedInitial,
        minStock: parsedMin,
        expiresOn: expiresOn || null,
        notes: notes.trim(),
      };
      if (editing && product) {
        await api.patch(`/api/products/${product.id}`, payload);
        toast('Produto atualizado.');
      } else {
        await api.post('/api/products', payload);
        toast('Produto adicionado à sua planilha.');
      }
      notifyChange();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar o produto.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Modal
        open
        onClose={onClose}
        variant="drawer"
        size="lg"
        eyebrow="Planilha de produtos"
        title={editing ? 'Editar produto' : 'Novo produto'}
        subtitle={
          editing
            ? `${product?.sku} · atualizado em ${dateShort(product?.updatedAt.slice(0, 10) ?? null)}`
            : 'Preencha os detalhes para começar a controlar.'
        }
        onSubmit={handleSubmit}
        footer={
          <div className="drawer-footer">
            {editing ? (
              <Button
                variant="ghost"
                className="danger-text"
                icon={<Trash2 size={16} />}
                onClick={() => setConfirmDelete(true)}
                disabled={saving}
              >
                Excluir
              </Button>
            ) : (
              <span />
            )}
            <div className="drawer-footer-actions">
              <Button variant="ghost" onClick={onClose} disabled={saving}>
                Cancelar
              </Button>
              <Button type="submit" loading={saving} icon={<Package size={16} />}>
                {editing ? 'Salvar alterações' : 'Adicionar produto'}
              </Button>
            </div>
          </div>
        }
      >
        {error ? <InlineAlert tone="danger">{error}</InlineAlert> : null}

        {types.length === 0 ? (
          <InlineAlert tone="warning">
            Crie um tipo de produto na aba Tipos antes de cadastrar seu primeiro item.
          </InlineAlert>
        ) : null}

        {product ? (
          <div className={cx('edit-stock-card', status && `tone-${status.tone}`)}>
            <div className="edit-stock-main">
              <span className="edit-stock-label">Estoque atual</span>
              <strong>
                {product.stock.toLocaleString('pt-BR')} {product.unit}
              </strong>
              <small>
                {brl(product.stock * product.price)} em valor · mínimo {product.minStock} {product.unit}
              </small>
            </div>
            {status ? (
              <Badge tone={status.tone} dot>
                {status.label}
              </Badge>
            ) : null}
          </div>
        ) : null}

        <div className="drawer-section">
          <span className="section-label">
            <Sparkles size={12} /> Informações principais
          </span>
          <Field label="Nome do produto">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex.: Café Torrado 500g"
              maxLength={90}
              autoFocus
            />
          </Field>
          <div className="form-row">
            <Field label="Tipo de produto">
              <Select
                value={typeId}
                onChange={(event) => setTypeId(Number(event.target.value))}
                disabled={types.length === 0}
              >
                <option value="" disabled>
                  Selecione
                </option>
                {types.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Código / SKU" optional hint="Em branco, geramos automaticamente.">
              <Input
                value={sku}
                onChange={(event) => setSku(event.target.value.toUpperCase())}
                placeholder="Gerado automaticamente"
                className="input-mono"
                maxLength={24}
              />
            </Field>
          </div>
          <div className="form-row">
            <Field label="Unidade de medida">
              <Select value={unit} onChange={(event) => setUnit(event.target.value)}>
                {UNITS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Preço unitário">
              <CurrencyInput value={price} onValueChange={setPrice} ariaLabel="Preço unitário" />
            </Field>
          </div>
        </div>

        <div className="drawer-section">
          <span className="section-label">
            <Archive size={12} /> Estoque e validade
          </span>
          <div className="form-row">
            <Field
              label="Estoque inicial"
              hint={
                editing
                  ? 'Mudar este valor ajusta o saldo atual. Prefira movimentações para alterar o estoque.'
                  : 'Quantidade disponível ao cadastrar.'
              }
            >
              <span className="input-suffix-wrap">
                <Input
                  value={initialStock}
                  onChange={(event) => setInitialStock(event.target.value)}
                  inputMode="decimal"
                  placeholder="0"
                />
                <span>{unit}</span>
              </span>
            </Field>
            <Field label="Estoque mínimo" hint="Usado para gerar alertas de reposição.">
              <span className="input-suffix-wrap">
                <Input
                  value={minStock}
                  onChange={(event) => setMinStock(event.target.value)}
                  inputMode="decimal"
                  placeholder="0"
                />
                <span>{unit}</span>
              </span>
            </Field>
          </div>
          <Field label="Data de validade" optional>
            <Input
              type="date"
              value={expiresOn}
              onChange={(event) => setExpiresOn(event.target.value)}
            />
          </Field>
          {editing && parsedInitial !== product?.initialStock ? (
            <p className="drawer-note">
              Novo saldo estimado após salvar:{' '}
              <strong>
                {previewStock.toLocaleString('pt-BR')} {unit}
              </strong>
            </p>
          ) : null}
        </div>

        <div className="drawer-section">
          <span className="section-label">
            <Archive size={12} /> Extras
          </span>
          <Field label="Observações" optional>
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              maxLength={400}
              placeholder="Alguma informação útil sobre este produto?"
            />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        title="Excluir produto?"
        description={
          <>
            <strong>{product?.name}</strong> e todas as suas movimentações serão removidos
            definitivamente. Essa ação não pode ser desfeita.
          </>
        }
        confirmLabel="Excluir produto"
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          if (!product) return;
          const result = await api.delete<{ movementsDeleted: number }>(
            `/api/products/${product.id}`,
          );
          notifyChange();
          toast(
            result.movementsDeleted > 0
              ? `Produto e ${result.movementsDeleted} movimentações excluídos.`
              : 'Produto excluído.',
          );
          onClose();
        }}
      />
    </>
  );
}
