import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Download,
  History,
  Scale,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { api } from '../api';
import { useApp } from '../app-context';
import type { Kind, Movement } from '../types';
import {
  brl,
  cx,
  dateLong,
  downloadText,
  normalizeText,
  num,
  relativeDay,
  todayISO,
  toCsv,
} from '../format';
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  IconButton,
  InlineAlert,
  PageHead,
  Segmented,
  Skeleton,
  useToast,
} from '../components/Ui';

type Period = '7' | '30' | '90' | 'all';
type KindFilter = 'all' | Kind;

interface DayGroup {
  date: string;
  movements: Movement[];
  inQty: number;
  outQty: number;
}

function groupByDay(movements: Movement[]): DayGroup[] {
  const map = new Map<string, DayGroup>();
  for (const movement of movements) {
    const group = map.get(movement.date) ?? {
      date: movement.date,
      movements: [],
      inQty: 0,
      outQty: 0,
    };
    group.movements.push(movement);
    if (movement.kind === 'entrada') group.inQty += movement.quantity;
    else group.outQty += movement.quantity;
    map.set(movement.date, group);
  }
  return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
}

export function Movements() {
  const { revision, notifyChange, openMovement } = useApp();
  const { toast } = useToast();
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>('30');
  const [kind, setKind] = useState<KindFilter>('all');
  const [search, setSearch] = useState('');
  const [deleting, setDeleting] = useState<Movement | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    const days = period === 'all' ? 0 : period;
    api
      .get<{ movements: Movement[] }>(`/api/movements?days=${days}&limit=2000`)
      .then((result) => setMovements(result.movements))
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Não foi possível carregar as movimentações.'),
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, revision]);

  const totals = useMemo(
    () =>
      movements.reduce(
        (acc, movement) => {
          if (movement.kind === 'saida') {
            acc.saidaQty += movement.quantity;
            acc.saidaValue += movement.quantity * movement.unitPrice;
          } else {
            acc.entradaQty += movement.quantity;
            acc.entradaValue += movement.quantity * movement.unitPrice;
          }
          return acc;
        },
        { saidaQty: 0, saidaValue: 0, entradaQty: 0, entradaValue: 0 },
      ),
    [movements],
  );

  const filtered = useMemo(() => {
    const term = normalizeText(search.trim());
    return movements.filter((movement) => {
      if (kind !== 'all' && movement.kind !== kind) return false;
      if (!term) return true;
      return (
        normalizeText(movement.productName).includes(term) ||
        normalizeText(movement.productSku).includes(term) ||
        normalizeText(movement.party).includes(term) ||
        normalizeText(movement.typeName ?? '').includes(term) ||
        normalizeText(movement.notes).includes(term)
      );
    });
  }, [movements, kind, search]);

  const groups = useMemo(() => groupByDay(filtered), [filtered]);

  const periodLabel =
    period === 'all' ? 'todo o histórico' : `últimos ${period} dias`;

  const exportCsv = () => {
    const headers = [
      'Data',
      'Hora',
      'Tipo',
      'Produto',
      'Código',
      'Categoria',
      'Quantidade',
      'Unidade',
      'Valor unitário',
      'Total',
      'Cliente / fornecedor',
      'Observações',
    ];
    const rows = filtered.map((movement) => [
      movement.date,
      movement.time,
      movement.kind === 'saida' ? 'Saída' : 'Entrada',
      movement.productName,
      movement.productSku,
      movement.typeName ?? '',
      num(movement.quantity),
      movement.unit,
      movement.unitPrice.toFixed(2).replace('.', ','),
      (movement.quantity * movement.unitPrice).toFixed(2).replace('.', ','),
      movement.party,
      movement.notes,
    ]);
    downloadText(
      `controles-da-silmara-movimentacoes-${todayISO()}.csv`,
      toCsv(headers, rows),
      'text/csv;charset=utf-8',
    );
    toast(`${filtered.length} movimentações exportadas em CSV.`);
  };

  const balance = totals.entradaQty - totals.saidaQty;
  const isFiltering = kind !== 'all' || search.trim() !== '';

  return (
    <div className="page">
      <PageHead
        eyebrow="Histórico"
        title="Movimentações"
        subtitle="Cada entrada e saída, com data, hora e destino — sem perder o fio."
        actions={
          <>
            <Button
              variant="secondary"
              icon={<Download size={16} />}
              onClick={exportCsv}
              disabled={filtered.length === 0}
            >
              Exportar
            </Button>
            <Button
              variant="secondary"
              icon={<ArrowDownLeft size={16} />}
              onClick={() => openMovement('entrada')}
            >
              Entrada
            </Button>
            <Button icon={<ArrowUpRight size={16} />} onClick={() => openMovement('saida')}>
              Nova saída
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

      <section className="summary-strip" aria-label="Resumo do período">
        <div className="summary-block summary-out">
          <span className="summary-icon">
            <ArrowUpRight size={17} />
          </span>
          <div>
            <span className="summary-label">Saídas</span>
            <strong>{num(totals.saidaQty)}</strong>
            <small>{brl(totals.saidaValue)} em valor</small>
          </div>
        </div>
        <div className="summary-block summary-in">
          <span className="summary-icon">
            <ArrowDownLeft size={17} />
          </span>
          <div>
            <span className="summary-label">Entradas</span>
            <strong>{num(totals.entradaQty)}</strong>
            <small>{brl(totals.entradaValue)} em valor</small>
          </div>
        </div>
        <div className="summary-block">
          <span className="summary-icon">
            <Scale size={17} />
          </span>
          <div>
            <span className="summary-label">Saldo do período</span>
            <strong className={cx(balance < 0 ? 'is-negative' : balance > 0 && 'is-positive')}>
              {balance > 0 ? '+' : ''}
              {num(balance)}
            </strong>
            <small>entradas menos saídas</small>
          </div>
        </div>
        <div className="summary-block">
          <span className="summary-icon">
            <History size={17} />
          </span>
          <div>
            <span className="summary-label">Registros</span>
            <strong>{num(movements.length)}</strong>
            <small>{periodLabel}</small>
          </div>
        </div>
      </section>

      <Card className="movements-card">
        <div className="movements-toolbar">
          <div className="search-field">
            <Search size={16} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por produto, destino ou observação"
              aria-label="Buscar movimentações"
            />
            {search ? (
              <button type="button" onClick={() => setSearch('')} aria-label="Limpar busca">
                <X size={14} />
              </button>
            ) : null}
          </div>
          <div className="movements-controls">
            <Segmented
              compact
              label="Período das movimentações"
              options={[
                { value: '7', label: '7d' },
                { value: '30', label: '30d' },
                { value: '90', label: '90d' },
                { value: 'all', label: 'Tudo' },
              ]}
              value={period}
              onChange={setPeriod}
            />
            <Segmented
              compact
              label="Tipo de movimentação"
              options={[
                { value: 'all', label: 'Todas' },
                { value: 'saida', label: 'Saídas' },
                { value: 'entrada', label: 'Entradas' },
              ]}
              value={kind}
              onChange={setKind}
            />
          </div>
        </div>

        {loading ? (
          <div className="movement-loading">
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <Skeleton key={index} className="skeleton-row" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<History size={22} />}
            title={movements.length === 0 ? 'Nenhuma movimentação no período' : 'Nada encontrado'}
            description={
              movements.length === 0
                ? 'Registre a primeira entrada ou saída para começar a acompanhar seu estoque.'
                : 'Ajuste a busca, o tipo ou o período para encontrar o que procura.'
            }
            action={
              movements.length === 0 ? (
                <Button icon={<ArrowUpRight size={16} />} onClick={() => openMovement('saida')}>
                  Registrar saída
                </Button>
              ) : isFiltering ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setSearch('');
                    setKind('all');
                  }}
                >
                  Limpar filtros
                </Button>
              ) : null
            }
          />
        ) : (
          <div className="movement-groups">
            {groups.map((group) => (
              <section className="movement-day" key={group.date}>
                <header className="movement-day-head">
                  <div>
                    <strong>{relativeDay(group.date)}</strong>
                    <span>{dateLong(group.date)}</span>
                  </div>
                  <div className="movement-day-totals">
                    {group.outQty > 0 ? <span className="out">−{num(group.outQty)}</span> : null}
                    {group.inQty > 0 ? <span className="in">+{num(group.inQty)}</span> : null}
                    <small>
                      {group.movements.length}{' '}
                      {group.movements.length === 1 ? 'registro' : 'registros'}
                    </small>
                  </div>
                </header>
                <ul className="movement-list">
                  {group.movements.map((movement) => (
                    <li className="movement-row" key={movement.id}>
                      <span className={cx('movement-kind', `is-${movement.kind}`)}>
                        {movement.kind === 'saida' ? (
                          <ArrowUpRight size={16} />
                        ) : (
                          <ArrowDownLeft size={16} />
                        )}
                      </span>
                      <div className="movement-main">
                        <div className="movement-title">
                          <strong>{movement.productName}</strong>
                          <span className="type-label">
                            {movement.typeColor ? (
                              <i style={{ background: movement.typeColor }} />
                            ) : null}
                            {movement.typeName ?? 'Sem tipo'}
                          </span>
                        </div>
                        <small className="movement-sub">
                          <span className="mono">{movement.productSku}</span>
                          <span className="dot-sep" />
                          {movement.party || (movement.kind === 'saida' ? 'Sem destino' : 'Sem origem')}
                          {movement.notes ? (
                            <>
                              <span className="dot-sep" />
                              <span className="movement-note">{movement.notes}</span>
                            </>
                          ) : null}
                        </small>
                      </div>
                      <span className="movement-time">{movement.time}</span>
                      <div className="movement-value">
                        <strong className={movement.kind === 'saida' ? 'out' : 'in'}>
                          {movement.kind === 'saida' ? '−' : '+'}
                          {num(movement.quantity)} {movement.unit}
                        </strong>
                        <small>{brl(movement.quantity * movement.unitPrice)}</small>
                      </div>
                      <IconButton
                        label={`Excluir movimentação de ${movement.productName}`}
                        size="sm"
                        variant="ghost"
                        className="movement-delete"
                        onClick={() => setDeleting(movement)}
                      >
                        <Trash2 size={15} />
                      </IconButton>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}

        {!loading && filtered.length > 0 ? (
          <footer className="table-foot">
            <span>
              <strong>{filtered.length}</strong> de {movements.length} registros
            </span>
            <span className="table-foot-stats">
              <span>
                <strong>{brl(totals.saidaValue)}</strong> em saídas
              </span>
              <span className="dot-sep" />
              <span>
                <strong>{brl(totals.entradaValue)}</strong> em entradas
              </span>
            </span>
          </footer>
        ) : null}
      </Card>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Excluir movimentação?"
        description={
          deleting ? (
            <>
              A {deleting.kind === 'saida' ? 'saída' : 'entrada'} de{' '}
              <strong>
                {num(deleting.quantity)} {deleting.unit}
              </strong>{' '}
              de <strong>{deleting.productName}</strong>, registrada em{' '}
              {dateLong(deleting.date)} às {deleting.time}, será removida. O saldo do estoque será
              recalculado.
            </>
          ) : null
        }
        confirmLabel="Excluir registro"
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          await api.delete(`/api/movements/${deleting.id}`);
          notifyChange();
          toast('Movimentação excluída. O estoque foi recalculado.');
          setDeleting(null);
        }}
      />
    </div>
  );
}
