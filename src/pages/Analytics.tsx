import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  CircleDollarSign,
  Flame,
  PackageSearch,
  Sparkles,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  Wallet,
} from 'lucide-react';
import { api } from '../api';
import { useApp } from '../app-context';
import type { Analytics as AnalyticsData, Tone } from '../types';
import {
  brl,
  cx,
  dateFull,
  dateShort,
  delta as deltaInfo,
  num,
  percent,
  relativeTime,
  weekdayShort,
} from '../format';
import {
  Button,
  Card,
  CardHead,
  EmptyState,
  InlineAlert,
  PageHead,
  Segmented,
  Skeleton,
} from '../components/Ui';
import { FlowChart, Heatmap, RankBars, StackedBar } from '../components/Charts';

type Period = '7' | '30' | '90' | '365';

const WEEKDAYS = [
  'domingo',
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
];
const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const BUCKETS_SHORT = ['00–06', '06–12', '12–18', '18–24'];
const BUCKETS_LONG = ['madrugada', 'manhã', 'tarde', 'noite'];

function MetricCard({
  label,
  value,
  suffix,
  icon,
  tone,
  caption,
  delta,
}: {
  label: string;
  value: string;
  suffix?: string;
  icon: ReactNode;
  tone: Tone | 'accent';
  caption?: ReactNode;
  delta?: { label: string; tone: Tone };
}) {
  return (
    <article className={cx('metric-card', `metric-${tone}`)}>
      <div className="metric-card-top">
        <span>{label}</span>
        <span className={cx('metric-icon', `metric-icon-${tone}`)}>{icon}</span>
      </div>
      <strong className="metric-value">
        {value}
        {suffix ? <small>{suffix}</small> : null}
      </strong>
      <div className="metric-card-foot">
        {delta ? (
          <span className={cx('delta-chip', `delta-${delta.tone}`)}>
            {delta.tone === 'danger' ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
            {delta.label}
          </span>
        ) : null}
        {caption ? <span className="metric-caption">{caption}</span> : null}
      </div>
    </article>
  );
}

export function Analytics() {
  const { revision, navigate, openMovement } = useApp();
  const [period, setPeriod] = useState<Period>('30');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    api
      .get<AnalyticsData>(`/api/analytics?days=${period}`)
      .then(setData)
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Não foi possível carregar as métricas.'),
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, revision]);

  const topWeekday = useMemo(() => {
    if (!data) return null;
    const max = Math.max(...data.weekdayTotals);
    if (max <= 0) return null;
    return data.weekdayTotals.indexOf(max);
  }, [data]);

  const topBucket = useMemo(() => {
    if (!data) return null;
    const max = Math.max(...data.bucketTotals);
    if (max <= 0) return null;
    return data.bucketTotals.indexOf(max);
  }, [data]);

  if (loading && !data) {
    return (
      <div className="page">
        <PageHead
          eyebrow="Inteligência do estoque"
          title="Métricas"
          subtitle="Preparando a leitura do seu estoque…"
        />
        <div className="metrics-kpis">
          {[0, 1, 2, 3].map((index) => (
            <div className="metric-card" key={index}>
              <Skeleton className="skeleton-line-sm" />
              <Skeleton className="skeleton-number" />
              <Skeleton className="skeleton-line-md" />
            </div>
          ))}
        </div>
        <Card>
          <Skeleton className="skeleton-line-md" />
          <Skeleton className="skeleton-chart" />
        </Card>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="page">
        <PageHead eyebrow="Inteligência do estoque" title="Métricas" />
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
      </div>
    );
  }

  if (!data) return null;

  if (data.stock.productCount === 0) {
    return (
      <div className="page">
        <PageHead
          eyebrow="Inteligência do estoque"
          title="Métricas"
          subtitle="Assim que houver produtos e movimentações, os números aparecem aqui."
        />
        <Card>
          <EmptyState
            icon={<PackageSearch size={24} />}
            title="Ainda não há o que medir"
            description="Cadastre produtos e registre entradas e saídas. Os controles montam automaticamente os comparativos, o ritmo semanal e os produtos que mais saem."
            action={
              <Button icon={<ArrowRight size={16} />} onClick={() => navigate('produtos')}>
                Ir para produtos
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  const saidaDelta = deltaInfo(data.totals.saidaQty, data.totals.previous.saidaQty);
  const entradaDelta = deltaInfo(data.totals.entradaQty, data.totals.previous.entradaQty);
  const valueDelta = deltaInfo(data.totals.saidaValue, data.totals.previous.saidaValue);
  const turnover = data.stock.stockQty > 0 ? (data.totals.saidaQty / data.stock.stockQty) * 100 : 0;
  const topProduct = data.topProducts[0] ?? null;
  const topProductShare = topProduct ? percent(topProduct.qty, data.totals.saidaQty) : 0;
  const net = data.totals.entradaQty - data.totals.saidaQty;
  const periodLabel =
    period === '7'
      ? 'últimos 7 dias'
      : period === '30'
        ? 'últimos 30 dias'
        : period === '90'
          ? 'últimos 90 dias'
          : 'últimos 12 meses';

  const chartLabel = (date: string, isLast: boolean) => {
    if (isLast) return 'Hoje';
    if (period === '7') return weekdayShort(date);
    return `${date.slice(8, 10)}/${date.slice(5, 7)}`;
  };

  return (
    <div className="page">
      <PageHead
        eyebrow="Inteligência do estoque"
        title="Métricas"
        subtitle={`Uma leitura profunda do que aconteceu nos ${periodLabel}.`}
        actions={
          <Segmented
            compact
            label="Período das métricas"
            options={[
              { value: '7', label: '7d' },
              { value: '30', label: '30d' },
              { value: '90', label: '90d' },
              { value: '365', label: '1 ano' },
            ]}
            value={period}
            onChange={setPeriod}
          />
        }
      />

      {error ? <InlineAlert tone="warning">{error}</InlineAlert> : null}

      <section className="metrics-kpis" aria-label="Indicadores do período">
        <MetricCard
          label="Saídas"
          value={num(data.totals.saidaQty)}
          suffix="un"
          icon={<ArrowUpRight size={18} />}
          tone="accent"
          caption={`${data.totals.movements} registros no total`}
          delta={{ label: saidaDelta.label, tone: saidaDelta.tone }}
        />
        <MetricCard
          label="Entradas"
          value={num(data.totals.entradaQty)}
          suffix="un"
          icon={<ArrowDownLeft size={18} />}
          tone="success"
          caption={`${brl(data.totals.entradaValue)} em reposição`}
          delta={{ label: entradaDelta.label, tone: entradaDelta.tone }}
        />
        <MetricCard
          label="Valor de saída"
          value={brl(data.totals.saidaValue)}
          icon={<CircleDollarSign size={18} />}
          tone="brand"
          caption={
            data.totals.saidaQty > 0
              ? `${brl(data.totals.saidaValue / data.totals.saidaQty)} por item em média`
              : 'Nenhuma saída registrada'
          }
          delta={{ label: valueDelta.label, tone: valueDelta.tone }}
        />
        <MetricCard
          label="Saídas de hoje"
          value={num(data.totals.todaySaidaQty)}
          suffix="un"
          icon={<Flame size={18} />}
          tone="warning"
          caption={`${brl(data.totals.todaySaidaValue)} · ${data.totals.todayMovements} movimentações`}
        />
      </section>

      <section className="metrics-main">
        <Card className="metrics-flow-card">
          <CardHead
            title="Entradas e saídas"
            subtitle="O vaivém do estoque, dia após dia"
            action={
              <div className="chart-legend-inline">
                <span>
                  <i className="legend-in" /> Entradas
                </span>
                <span>
                  <i className="legend-out" /> Saídas
                </span>
              </div>
            }
          />
          <FlowChart
            labels={data.daily.map((point, index) =>
              chartLabel(point.date, index === data.daily.length - 1),
            )}
            details={data.daily.map((point) => dateFull(point.date))}
            entradas={data.daily.map((point) => point.entradaQty)}
            saidas={data.daily.map((point) => point.saidaQty)}
            height={290}
            formatValue={(value) => `${num(value)} un`}
          />
          <div className="flow-foot">
            <div>
              <span className="flow-dot in" />
              <span>
                <small>Entradas no período</small>
                <strong>
                  {num(data.totals.entradaQty)} <em>un</em>
                </strong>
              </span>
            </div>
            <div>
              <span className="flow-dot out" />
              <span>
                <small>Saídas no período</small>
                <strong>
                  {num(data.totals.saidaQty)} <em>un</em>
                </strong>
              </span>
            </div>
            <div className={cx('flow-balance', net < 0 && 'is-negative')}>
              <small>Saldo</small>
              <strong>
                {net > 0 ? '+' : ''}
                {num(net)} <em>un</em>
              </strong>
            </div>
          </div>
        </Card>

        <Card className="metrics-health-card">
          <CardHead title="Saúde do estoque" subtitle="Uma visão do que está em casa" />
          <div className="health-value">
            <span className="health-value-icon">
              <Wallet size={19} />
            </span>
            <div>
              <span>Valor em estoque</span>
              <strong>{brl(data.stock.stockValue)}</strong>
              <small>
                {num(data.stock.stockQty)} itens em {data.stock.productCount} produtos
              </small>
            </div>
          </div>
          <ul className="health-list">
            <li>
              <span>
                <i className="health-dot warning" /> Estoque baixo
              </span>
              <strong>{data.stock.lowStockCount}</strong>
            </li>
            <li>
              <span>
                <i className="health-dot accent" /> Validade próxima
              </span>
              <strong>{data.stock.expiringCount}</strong>
            </li>
            <li>
              <span>
                <i className="health-dot danger" /> Sem estoque
              </span>
              <strong>{data.stock.outOfStockCount}</strong>
            </li>
            <li>
              <span>
                <i className="health-dot muted" /> Vencidos
              </span>
              <strong>{data.stock.expiredCount}</strong>
            </li>
          </ul>
          <div className="turn-meter">
            <div className="turn-head">
              <span>Giro no período</span>
              <strong>{Math.round(turnover)}%</strong>
            </div>
            <div className="turn-track">
              <span style={{ width: `${Math.min(100, Math.max(2, turnover))}%` }} />
            </div>
            <small>das unidades atuais passaram por saídas.</small>
          </div>
          {data.stock.attentionCount > 0 ? (
            <button type="button" className="health-alert" onClick={() => navigate('produtos')}>
              <TriangleAlert size={15} />
              <span>
                {data.stock.attentionCount}{' '}
                {data.stock.attentionCount === 1 ? 'produto pede' : 'produtos pedem'} atenção
              </span>
              <ArrowRight size={14} />
            </button>
          ) : null}
        </Card>
      </section>

      <section className="metrics-secondary">
        <Card className="metrics-heat-card">
          <CardHead
            title="Ritmo semanal"
            subtitle="Quando as saídas acontecem, por faixa horária"
          />
          {data.totals.saidaQty > 0 ? (
            <>
              <Heatmap
                cells={data.heatmap}
                weekdays={WEEKDAYS_SHORT}
                buckets={BUCKETS_SHORT}
              />
              <div className="heat-insights">
                {topWeekday !== null ? (
                  <span>
                    <CalendarClock size={15} />
                    <span>
                      <strong className="capitalize">{WEEKDAYS[topWeekday]}</strong> concentra o
                      maior volume da semana.
                    </span>
                  </span>
                ) : null}
                {topBucket !== null ? (
                  <span>
                    <Flame size={15} />
                    <span>
                      A <strong>{BUCKETS_LONG[topBucket]}</strong> é a faixa mais movimentada.
                    </span>
                  </span>
                ) : null}
              </div>
            </>
          ) : (
            <EmptyState
              compact
              icon={<CalendarClock size={20} />}
              title="Sem saídas no período"
              description="Registre saídas para revelar os dias e horários de maior movimento."
              action={
                <Button size="sm" variant="secondary" onClick={() => openMovement('saida')}>
                  Registrar saída
                </Button>
              }
            />
          )}
        </Card>

        <Card className="metrics-stock-card">
          <CardHead title="Composição do estoque" subtitle="Onde está o valor parado" />
          {data.byTypeStock.length > 0 ? (
            <>
              <StackedBar
                segments={data.byTypeStock.map((type) => ({
                  label: type.name,
                  value: type.value,
                  color: type.color,
                }))}
                formatValue={(value) => brl(value)}
              />
              <ul className="type-stock-list">
                {data.byTypeStock.map((type) => (
                  <li key={type.id}>
                    <span className="type-label">
                      <i style={{ background: type.color }} />
                      {type.name}
                    </span>
                    <span className="type-stock-qty">
                      {num(type.qty)} un · {type.products}{' '}
                      {type.products === 1 ? 'produto' : 'produtos'}
                    </span>
                    <strong>{brl(type.value)}</strong>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <EmptyState
              compact
              icon={<Wallet size={20} />}
              title="Sem estoque para distribuir"
              description="Adicione produtos e entradas para enxergar a composição por tipo."
            />
          )}
        </Card>
      </section>

      <section className="metrics-rank">
        <Card>
          <CardHead title="Produtos que mais saem" subtitle="Líderes em volume de saídas" />
          <RankBars
            items={data.topProducts.map((product) => ({
              name: product.name,
              meta: `${product.typeName} · ${brl(product.value)}`,
              value: product.qty,
              color: product.typeColor,
            }))}
            formatValue={(value) => num(value)}
            empty="Nenhuma saída registrada neste período."
          />
        </Card>

        <Card>
          <CardHead title="Destinos frequentes" subtitle="Quem mais recebeu seus produtos" />
          {data.topParties.length > 0 ? (
            <RankBars
              items={data.topParties.map((party) => ({
                name: party.party,
                meta: `${party.count} ${party.count === 1 ? 'saída' : 'saídas'}`,
                value: party.qty,
                color: 'var(--accent)',
              }))}
              formatValue={(value) => `${num(value)} un`}
            />
          ) : (
            <EmptyState
              compact
              icon={<ArrowUpRight size={20} />}
              title="Sem destinos registrados"
              description="Preencha o cliente ou destino nas saídas para identificar os mais frequentes."
            />
          )}
        </Card>

        <Card className="idle-card">
          <CardHead
            title="Produtos parados"
            subtitle="Sem saídas nesse período"
            action={
              <button type="button" className="text-link" onClick={() => navigate('produtos')}>
                Ver planilha <ArrowRight size={14} />
              </button>
            }
          />
          {data.idleProducts.length > 0 ? (
            <ul className="idle-list">
              {data.idleProducts.slice(0, 5).map((product) => (
                <li key={product.id}>
                  <span
                    className="product-avatar product-avatar-sm"
                    style={{
                      background: `color-mix(in srgb, ${product.typeColor} 15%, var(--surface))`,
                      color: product.typeColor,
                    }}
                  >
                    {product.name.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="idle-main">
                    <strong>{product.name}</strong>
                    <small>
                      {num(product.stock)} {product.unit} ·{' '}
                      {product.lastSale
                        ? `última saída em ${dateShort(product.lastSale.slice(0, 10))}`
                        : 'nunca saiu'}
                    </small>
                  </div>
                  <strong className="idle-value">{brl(product.stock * product.price)}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              compact
              icon={<Sparkles size={20} />}
              title="Todo o estoque girou"
              description="Nenhum produto ficou sem saída neste período. Bom sinal."
            />
          )}
        </Card>
      </section>

      <section className="insight-band">
        <div className="insight-head">
          <span className="insight-kicker">
            <Sparkles size={14} /> Leitura do período
          </span>
          <h2>
            {saidaDelta.tone === 'success'
              ? 'O estoque está girando mais.'
              : saidaDelta.tone === 'danger'
                ? 'O ritmo de saídas desacelerou.'
                : 'O ritmo de saídas está estável.'}
          </h2>
          <p>
            Comparação com os {data.period.days} dias anteriores, de {dateShort(data.period.prevFrom)}{' '}
            a {dateShort(data.period.prevTo)}.
          </p>
        </div>
        <div className="insight-points">
          <div className="insight-point">
            <span className="insight-point-icon">
              <TrendingUp size={17} />
            </span>
            <p>
              <strong>{saidaDelta.label}</strong> em unidades, com {brl(data.totals.saidaValue)} em
              valor de saída.
            </p>
          </div>
          {topProduct ? (
            <div className="insight-point">
              <span className="insight-point-icon">
                <CircleDollarSign size={17} />
              </span>
              <p>
                <strong>{topProduct.name}</strong> responde por{' '}
                {Math.round(topProductShare)}% das unidades que saíram.
              </p>
            </div>
          ) : null}
          {topWeekday !== null && topBucket !== null ? (
            <div className="insight-point">
              <span className="insight-point-icon">
                <Flame size={17} />
              </span>
              <p>
                O pico acontece <strong className="capitalize">{WEEKDAYS[topWeekday]}</strong>, pela{' '}
                <strong>{BUCKETS_LONG[topBucket]}</strong>.
              </p>
            </div>
          ) : null}
          <div className="insight-point">
            <span className="insight-point-icon">
              <PackageSearch size={17} />
            </span>
            <p>
              <strong>{data.idleProducts.length}</strong>{' '}
              {data.idleProducts.length === 1 ? 'produto ficou' : 'produtos ficaram'} sem saída no
              período.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
