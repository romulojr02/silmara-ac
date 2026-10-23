import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Check,
  Layers,
  Lock,
  Package,
  Palette,
  Pencil,
  Plus,
  Tags,
  Trash2,
} from 'lucide-react';
import { api } from '../api';
import { useApp } from '../app-context';
import type { ProductType } from '../types';
import { brl, cx, num, percent } from '../format';
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  FieldGroup,
  IconButton,
  InlineAlert,
  Input,
  Modal,
  PageHead,
  Skeleton,
  useToast,
} from '../components/Ui';

const COLOR_PRESETS = [
  '#b23b63',
  '#8f6aa8',
  '#c97b8e',
  '#c08a5a',
  '#7d8fb3',
  '#c7a33f',
  '#a35d77',
  '#6f9c8c',
  '#b05a5a',
  '#6f6f9e',
  '#d291a8',
  '#a58a6f',
];

function TypeEditor({
  type,
  onClose,
}: {
  type: ProductType | null;
  onClose: () => void;
}) {
  const { notifyChange } = useApp();
  const { toast } = useToast();
  const [name, setName] = useState(type?.name ?? '');
  const [color, setColor] = useState(type?.color ?? COLOR_PRESETS[0]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (name.trim().length < 2) {
      setError('Dê um nome com pelo menos 2 caracteres.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = { name: name.trim(), color };
      if (type) {
        await api.patch(`/api/types/${type.id}`, payload);
        toast('Tipo atualizado.');
      } else {
        await api.post('/api/types', payload);
        toast('Tipo criado. Já pode ser usado nos produtos.');
      }
      notifyChange();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar o tipo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      eyebrow="Organização"
      title={type ? 'Editar tipo' : 'Novo tipo'}
      subtitle={
        type
          ? 'O nome e a cor aparecem em toda a aplicação.'
          : 'Crie uma categoria para agrupar produtos parecidos.'
      }
      onSubmit={handleSubmit}
      dismissible={!saving}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving} icon={<Check size={16} />}>
            {type ? 'Salvar alterações' : 'Criar tipo'}
          </Button>
        </>
      }
    >
      {error ? <InlineAlert tone="danger">{error}</InlineAlert> : null}
      <Field label="Nome do tipo">
        <Input
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            if (error) setError(null);
          }}
          placeholder="Ex.: Padaria, Hortifruti, Bebidas…"
          maxLength={40}
          autoFocus
          data-autofocus
        />
      </Field>
      <FieldGroup label="Cor de identificação" hint="Ajuda a reconhecer o tipo em gráficos e listas.">
        <div className="color-swatches" role="group" aria-label="Cores disponíveis">
          {COLOR_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              className={cx('color-swatch', color === preset && 'is-active')}
              style={{ background: preset }}
              onClick={() => setColor(preset)}
              aria-label={`Usar a cor ${preset}`}
              aria-pressed={color === preset}
            >
              {color === preset ? <Check size={13} /> : null}
            </button>
          ))}
        </div>
        <label className="color-custom">
          <Palette size={15} />
          <span>Cor personalizada</span>
          <input
            type="color"
            value={color}
            onChange={(event) => setColor(event.target.value)}
            aria-label="Escolher uma cor personalizada"
          />
          <code>{color.toUpperCase()}</code>
        </label>
      </FieldGroup>
      <div className="type-preview">
        <span className="type-preview-label">Prévia</span>
        <span className="type-preview-chip" style={{ color }}>
          <i style={{ background: color }} />
          {name.trim() || 'Nome do tipo'}
        </span>
      </div>
    </Modal>
  );
}

export function Types() {
  const { revision, notifyChange } = useApp();
  const { toast } = useToast();
  const [types, setTypes] = useState<ProductType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ type: ProductType | null } | null>(null);
  const [deleting, setDeleting] = useState<ProductType | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    api
      .get<{ types: ProductType[] }>('/api/types')
      .then((result) => setTypes(result.types))
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Não foi possível carregar os tipos.'),
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revision]);

  const summary = useMemo(
    () =>
      types.reduce(
        (acc, type) => {
          acc.products += type.productCount;
          acc.stock += type.stockTotal;
          acc.value += type.stockValue;
          return acc;
        },
        { products: 0, stock: 0, value: 0 },
      ),
    [types],
  );

  const totalValue = Math.max(summary.value, 1);
  const maxValue = Math.max(...types.map((type) => type.stockValue), 1);

  return (
    <div className="page">
      <PageHead
        eyebrow="Organização"
        title="Tipos de produto"
        subtitle="Categorias deixam a planilha mais clara e as métricas mais reveladoras."
        actions={
          <Button icon={<Plus size={16} />} onClick={() => setEditor({ type: null })}>
            Novo tipo
          </Button>
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

      {types.length === 0 && !loading ? (
        <Card>
          <EmptyState
            icon={<Tags size={24} />}
            title="Nenhum tipo por aqui"
            description="Os tipos agrupam seus produtos. Crie o primeiro para liberar o cadastro de itens."
            action={
              <Button icon={<Plus size={16} />} onClick={() => setEditor({ type: null })}>
                Criar primeiro tipo
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <section className="summary-strip" aria-label="Resumo dos tipos">
            <div className="summary-block">
              <span className="summary-icon">
                <Tags size={17} />
              </span>
              <div>
                <span className="summary-label">Tipos cadastrados</span>
                <strong>{types.length}</strong>
                <small>categorias ativas</small>
              </div>
            </div>
            <div className="summary-block">
              <span className="summary-icon">
                <Package size={17} />
              </span>
              <div>
                <span className="summary-label">Produtos classificados</span>
                <strong>{num(summary.products)}</strong>
                <small>{num(summary.stock)} itens em estoque</small>
              </div>
            </div>
            <div className="summary-block">
              <span className="summary-icon">
                <Layers size={17} />
              </span>
              <div>
                <span className="summary-label">Valor distribuído</span>
                <strong>{brl(summary.value)}</strong>
                <small>entre todos os tipos</small>
              </div>
            </div>
          </section>

          {loading ? (
            <div className="type-grid">
              {[0, 1, 2, 3, 4, 5].map((index) => (
                <div className="type-card" key={index}>
                  <Skeleton className="skeleton-line-md" />
                  <Skeleton className="skeleton-number" />
                  <Skeleton className="skeleton-line-sm" />
                </div>
              ))}
            </div>
          ) : (
            <div className="type-grid">
              {types.map((type) => {
                const share = percent(type.stockValue, totalValue);
                const used = type.productCount > 0;
                return (
                  <article
                    key={type.id}
                    className="type-card"
                    style={{ ['--type-color' as string]: type.color }}
                  >
                    <div className="type-card-head">
                      <span className="type-marker" style={{ background: type.color }}>
                        <Tags size={17} />
                      </span>
                      <div className="type-card-name">
                        <strong>{type.name}</strong>
                        <small>
                          {type.productCount}{' '}
                          {type.productCount === 1 ? 'produto vinculado' : 'produtos vinculados'}
                        </small>
                      </div>
                      <div className="type-card-actions">
                        <IconButton
                          label={`Editar ${type.name}`}
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditor({ type })}
                        >
                          <Pencil size={14} />
                        </IconButton>
                        <IconButton
                          label={
                            used
                              ? `${type.name} está em uso e não pode ser excluído`
                              : `Excluir ${type.name}`
                          }
                          size="sm"
                          variant="ghost"
                          disabled={used}
                          onClick={() => setDeleting(type)}
                        >
                          {used ? <Lock size={14} /> : <Trash2 size={14} />}
                        </IconButton>
                      </div>
                    </div>
                    <div className="type-card-stats">
                      <div>
                        <span>Em estoque</span>
                        <strong>
                          {num(type.stockTotal)} <small>un</small>
                        </strong>
                      </div>
                      <div>
                        <span>Valor</span>
                        <strong>{brl(type.stockValue)}</strong>
                      </div>
                    </div>
                    <div className="type-card-foot">
                      <div className="type-card-bar">
                        <span
                          style={{
                            width: `${Math.max(3, (type.stockValue / maxValue) * 100)}%`,
                            background: type.color,
                          }}
                        />
                      </div>
                      <span>{Math.round(share)}% do valor total</span>
                    </div>
                  </article>
                );
              })}

              <button
                type="button"
                className="type-card type-card-new"
                onClick={() => setEditor({ type: null })}
              >
                <span className="type-new-icon">
                  <Plus size={20} />
                </span>
                <strong>Criar novo tipo</strong>
                <small>Agrupe produtos por categoria</small>
              </button>
            </div>
          )}
        </>
      )}

      {editor ? <TypeEditor type={editor.type} onClose={() => setEditor(null)} /> : null}

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Excluir tipo?"
        description={
          deleting ? (
            <>
              O tipo <strong>{deleting.name}</strong> será removido. Ele não possui produtos
              vinculados, então nada mais será afetado.
            </>
          ) : null
        }
        confirmLabel="Excluir tipo"
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          await api.delete(`/api/types/${deleting.id}`);
          notifyChange();
          toast('Tipo excluído.');
          setDeleting(null);
        }}
      />
    </div>
  );
}
