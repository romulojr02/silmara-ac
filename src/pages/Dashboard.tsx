import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Award,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  MoveDownLeft,
  MoveUpRight,
  Package,
  Plus,
  Sparkles,
  TriangleAlert,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { api } from '../api';
import { useApp } from '../app-context';
import type { Analytics, Product, ProductStatus, Tone } from '../types';
import {
  brl,
  cx,
  dateFull,
  dateLong,
  delta as deltaInfo,
  firstName,
  greeting,
  num,
  productStatus,
  relativeTime,
  todayLong,
} from '../format';
import {
  Badge,
  Button,
  Card,
  CardHead,
  EmptyState,
  InlineAlert,
  PageHead,
  Segmented,
  Skeleton,
  useToast,
} from '../components/Ui';
import { AreaChart, DonutChart, Sparkline } from '../components/Charts';

const WEEKDAYS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function KpiCard({
  label,
  value,
  suffix,
  icon,
  caption,
  tone = 'brand',
  spark,
  delta,
  onClick,
}: {
  label: string;
  value: string;
  suffix?: string;
  icon: ReactNode;
  caption?: ReactNode;
  tone?: Tone | 'accent';
  spark?: ReactNode;
  delta?: { label: string; tone: Tone };
  onClick?: () => void;
}) {
  const Element = onClick ? 'button' : 'div';
  return (
    <Element className={cx('kpi-card', onClick && 'is-clickable')} onClick={onClick}>
      <div className="kpi-top">
        <span className="kpi-label">{label}</span>
        <span className={cx('kpi-icon', `kpi-icon-${tone}`)}>{icon}</span>
      </div>
      <div className="kpi-value-row">
        <div className="kpi-value">
          {value}
          {suffix ? <small>{suffix}</small> : null}
        </div>
        {spark ? <div className="kpi-spark">{spark}</div> : null}
      </div>
      <div className="kpi-bottom">
        {delta ? (
          <span className={cx('delta-chip', `delta-${delta.tone}`)}>
            {delta.tone === 'danger' ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
            {delta.label}
          </span>
        ) : null}
        {caption ? <span className="kpi-caption">{caption}</span> : null}
      </div>
    </Element>
  );
}

interface AlertEntry {
  product: Product;
  reasons: { label: string; tone: Tone }[];
  severity: number;
}

function buildAlerts(data: Analytics): AlertEntry[] {
  const map = new Map<number, AlertEntry>();
  const add = (product: Product, reason: { label: string; tone: Tone }, severity: number) => {
    const current = map.get(product.id) ?? { product, reasons: [], severity: 0 };
    current.reasons.push(reason);
    current.severity = Math.max(current.severity, severity);
    map.set(product.id, current);
  };
  for (const product of data.attention.expired) {
    add(product, { label: 'Vencido', tone: 'danger' }, 0);
  }
  for (const product of data.attention.expiring) {
    add(product, { label: 'Vencendo', tone: 'warning' }, 1);
  }
  for (const product of data.attention.lowStock) {
    add(
      product,
      {
        label: product.stock <= 0 ? 'Sem estoque' : 'Estoque baixo',
        tone: product.stock <= 0 ? 'danger' : 'warning',
      },
      2,
    );
  }
  return Array.from(map.values()).sort((a, b) => a.severity - b.severity);
}

function alertDetail(entry: AlertEntry): string {
  const { product } = entry;
  const pieces: string[] = [];
  if (entry.reasons.some((reason) => reason.label === 'Vencido' || reason.label === 'Vencendo')) {
    pieces.push(
      productStatus(product).key === 'expired'
        ? `vencido em ${dateLong(product.expiresOn!)}`
        : `validade em ${dateLong(product.expiresOn!)}`,
    );
  }
  pieces.push(`${num(product.stock)} ${product.unit} em estoque · mín. ${num(product.minStock)}`);
  return pieces.join(' · ');
}

export function Dashboard() {
  const { admin, navigate, openMovement, revision, notifyChange } = useApp();
  const { toast } = useToast();
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [demoBusy, setDemoBusy] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    api
      .get<Analytics>(`/api/analytics?days=${days}`)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Não foi possível carregar o painel.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, revision]);

  const alerts = useMemo(() => (data ? buildAlerts(data) : []), [data]);

  const insights = useMemo(() => {
    if (!data) return [];
    const points: { icon: ReactNode; text: ReactNode }[] = [];
    const top = data.topProducts[0];
    if (top) {
      points.push({
        icon: <Award size={17} />,
        text: (
          <>
            <strong>{top.name}</strong> liderou as saídas com {num(top.qty)} {top.unit}.
          </>
        ),
      });
    }
    const maxWeekday = Math.max(...data.weekdayTotals, 0);
    if (maxWeekday > 0) {
      const index = data.weekdayTotals.indexOf(maxWeekday);
      points.push({
        icon: <CalendarClock size={17} />,
        text: (
          <>
            <strong className="capitalize">{WEEKDAYS[index]}</strong> concentra o maior volume de saídas.
          </>
        ),
      });
    }
    points.push({
      icon: <CircleDollarSign size={17} />,
      text: (
        <>
          <strong>{brl(data.totals.saidaValue)}</strong> saíram em produtos no período.
        </>
      ),
    });
    return points;
  }, [data]);

  const loadDemo = async () => {
    setDemoBusy(true);
    try {
      await api.post('/api/demo');
      notifyChange();
      toast('Dados de exemplo carregados. Explore as abas!');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Não foi possível carregar o exemplo.', 'error');
    } finally {
      setDemoBusy(false);
    }
  };

  const periodLabel = days === 7 ? 'últimos 7 dias' : days === 30 ? 'últimos 30 dias' : 'últimos 90 dias';

  if (!data && loading) {
    return (
      <div className="page">
        <PageHead
          eyebrow={todayLong()}
          title={`${greeting()}, ${firstName(admin.name)}.`}
          subtitle="Preparando o seu painel…"
        />
        <div className="kpi-grid">
          {[0, 1, 2, 3].map((index) => (
            <div className="kpi-card" key={index}>
              <Skeleton className="skeleton-line-sm" />
              <Skeleton className="skeleton-number" />
              <Skeleton className="skeleton-line-md" />
            </div>
          ))}
        </div>
        <div className="dash-charts">
          <Card>
            <Skeleton className="skeleton-line-md" />
            <Skeleton className="skeleton-chart" />
          </Card>
          <Card>
            <Skeleton className="skeleton-line-md" />
            <Skeleton className="skeleton-chart" />
          </Card>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="page">
        <PageHead eyebrow="Painel" title="Algo não saiu como esperado." />
        <InlineAlert
          tone="danger"
          action={
            <Button size="sm" variant="secondary" onClick={load}>
              Tentar de novo
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
          eyebrow={todayLong()}
          title={`${greeting()}, ${firstName(admin.name)}.`}
          subtitle="Vamos colocar seu estoque em ordem."
        />
        <Card className="welcome-card">
          <div className="welcome-copy">
            <span className="eyebrow">Primeiros passos</span>
            <h2>Seu controle começa com o primeiro produto.</h2>
            <p>
              Cadastre o que você tem em mãos, registre entradas e saídas — e os seus controles
              transformam tudo em números claros. Se preferir explorar antes, carregue uma base de
              exemplo.
            </p>
            <div className="welcome-actions">
              <Button icon={<Plus size={16} />} onClick={() => navigate('produtos')}>
                Cadastrar primeiro produto
              </Button>
              <Button
                variant="secondary"
                loading={demoBusy}
                icon={<Sparkles size={16} />}
                onClick={loadDemo}
              >
                Explorar com dados de exemplo
              </Button>
            </div>
            <div className="welcome-steps">
              <div>
                <span>01</span>
                <strong>Cadastre produtos</strong>
                <small>Com tipo, preço, validade e estoque mínimo.</small>
              </div>
              <div>
                <span>02</span>
                <strong>Registre movimentos</strong>
                <small>Cada saída com data e hora.</small>
              </div>
              <div>
                <span>03</span>
                <strong>Acompanhe métricas</strong>
                <small>Veja o que sai, quando e para quem.</small>
              </div>
            </div>
          </div>
          <div className="welcome-art" aria-hidden="true">
            <div className="welcome-orbit orbit-one" />
            <div className="welcome-orbit orbit-two" />
            <div className="welcome-art-card">
              <span className="welcome-art-top">
                <Package size={16} /> Estoque
              </span>
              <strong>0</strong>
              <span className="welcome-art-label">produtos sob controle</span>
              <div className="welcome-art-bars">
                <span style={{ height: '38%' }} />
                <span style={{ height: '62%' }} />
                <span style={{ height: '45%' }} />
                <span style={{ height: '78%' }} />
                <span style={{ height: '58%' }} />
                <span style={{ height: '88%' }} />
              </div>
            </div>
          </div>
        </Card>
        <div className="welcome-security">
          <span>
            <CheckCircle2 size={15} /> Acesso único e protegido
          </span>
          <span>
            <CheckCircle2 size={15} /> Funciona no celular e no computador
          </span>
          <span>
            <CheckCircle2 size={15} /> Pronto em português, do seu jeito
          </span>
        </div>
      </div>
    );
  }

  const saidaDelta = deltaInfo(data.totals.saidaQty, data.totals.previous.saidaQty);
  const entradaDelta = deltaInfo(data.totals.entradaQty, data.totals.previous.entradaQty);
  const topTypeShare = data.byType.length
    ? Math.round((data.byType[0].qty / Math.max(data.totals.saidaQty, 1)) * 100)
    : 0;
  const alertCount = data.stock.attentionCount;

  return (
    <div className="page">
      <PageHead
        eyebrow={todayLong()}
        title={`${greeting()}, ${firstName(admin.name)}.`}
        subtitle="Aqui está o pulso do seu estoque."
        actions={
          <>
            <Segmented
              compact
              label="Período do painel"
              options={[
                { value: '7', label: '7d' },
                { value: '30', label: '30d' },
                { value: '90', label: '90d' },
              ]}
              value={String(days)}
              onChange={(value) => setDays(Number(value))}
            />
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

      {alertCount > 0 ? (
        <button type="button" className="attention-banner" onClick={() => navigate('produtos')}>
          <span className="attention-banner-icon">
            <TriangleAlert size={19} />
          </span>
          <span className="attention-banner-text">
            <strong>
              {alertCount} {alertCount === 1 ? 'produto pede' : 'produtos pedem'} atenção
            </strong>
            <small>
              {[
                data.stock.lowStockCount > 0
                  ? `${data.stock.lowStockCount} com estoque baixo`
                  : null,
                data.stock.expiringCount > 0
                  ? `${data.stock.expiringCount} com validade próxima`
                  : null,
                data.stock.expiredCount > 0
                  ? `${data.stock.expiredCount} ${data.stock.expiredCount === 1 ? 'vencido' : 'vencidos'}`
                  : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </small>
          </span>
          <span className="attention-banner-link">
            Revisar agora <ArrowRight size={15} />
          </span>
        </button>
      ) : (
        <div className="attention-banner attention-banner-ok">
          <span className="attention-banner-icon">
            <CheckCircle2 size={19} />
          </span>
          <span className="attention-banner-text">
            <strong>Estoque e validades em dia</strong>
            <small>Nenhum produto precisa de atenção nesse momento.</small>
          </span>
        </div>
      )}

      <section className="kpi-grid" aria-label="Indicadores do período">
        <KpiCard
          label="Valor em estoque"
          value={brl(data.stock.stockValue)}
          icon={<Wallet size={18} />}
          caption={`${num(data.stock.stockQty)} itens em ${data.stock.productCount} produtos`}
          tone="brand"
        />
        <KpiCard
          label={`Saídas · ${days}d`}
          value={num(data.totals.saidaQty)}
          suffix="un"
          icon={<MoveUpRight size={18} />}
          caption={`${brl(data.totals.saidaValue)} em valor`}
          delta={{ label: saidaDelta.label, tone: saidaDelta.tone }}
          spark={<Sparkline values={data.daily.map((point) => point.saidaQty)} color="#b23b63" />}
          tone="accent"
        />
        <KpiCard
          label={`Entradas · ${days}d`}
          value={num(data.totals.entradaQty)}
          suffix="un"
          icon={<MoveDownLeft size={18} />}
          caption={`${brl(data.totals.entradaValue)} em valor`}
          delta={{ label: entradaDelta.label, tone: entradaDelta.tone }}
          tone="success"
        />
        <KpiCard
          label="Precisa de atenção"
          value={String(alertCount)}
          icon={<TriangleAlert size={18} />}
          caption={
            alertCount > 0
              ? [
                  `${data.stock.lowStockCount} estoque baixo`,
                  `${data.stock.expiringCount} validade`,
                  data.stock.expiredCount > 0
                    ? `${data.stock.expiredCount} ${data.stock.expiredCount === 1 ? 'vencido' : 'vencidos'}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ')
              : 'Tudo em ordem por aqui'
          }
          tone={alertCount > 0 ? 'warning' : 'success'}
          onClick={() => navigate('produtos')}
        />
      </section>

      <section className="dash-charts">
        <Card className="chart-card">
          <CardHead
            title="Fluxo de saídas"
            subtitle={`Unidades que deixaram o estoque nos ${periodLabel}`}
            action={
              <Badge tone="neutral" className="chart-badge">
                Hoje · {num(data.totals.todaySaidaQty)} un
              </Badge>
            }
          />
          <div className="chart-summary">
            <div>
              <strong>{num(data.totals.saidaQty)}</strong>
              <span>unidades no total</span>
            </div>
            <div className="chart-summary-secondary">
              <span>
                média de <strong>{num(data.totals.saidaQty / Math.max(days, 1))}</strong> un/dia
              </span>
              <span className="dot-sep" />
              <span>
                <strong>{data.byType.length}</strong> tipos movimentados
              </span>
            </div>
          </div>
          <AreaChart
            data={data.daily.map((point) => ({
              label: point.date === data.period.to ? 'Hoje' : point.date.slice(8, 10),
              value: point.saidaQty,
              detail: dateFull(point.date),
            }))}
            height={236}
            color="#b23b63"
            formatValue={(value) => `${num(value)} un`}
            ariaLabel={`Saídas diárias nos ${periodLabel}`}
          />
        </Card>

        <Card className="donut-card">
          <CardHead
            title="Saídas por tipo"
            subtitle="Participação no volume do período"
          />
          {data.byType.length > 0 ? (
            <>
              <DonutChart
                segments={data.byType.map((type) => ({
                  label: type.name,
                  value: type.qty,
                  color: type.color,
                }))}
                centerLabel="unidades"
                unit="unidades"
                formatValue={(value) => num(value)}
              />
              <div className="donut-foot">
                <Sparkles size={14} />
                <span>
                  <strong>{data.byType[0].name}</strong> representa {topTypeShare}% das saídas
                </span>
              </div>
            </>
          ) : (
            <EmptyState
              compact
              icon={<MoveUpRight size={20} />}
              title="Sem saídas ainda"
              description="Quando você registrar saídas, a distribuição por tipo aparece aqui."
              action={
                <Button size="sm" variant="secondary" onClick={() => openMovement('saida')}>
                  Registrar saída
                </Button>
              }
            />
          )}
        </Card>
      </section>

      <section className="dash-lower">
        <Card className="radar-card">
          <CardHead
            title="Radar de atenção"
            subtitle="O que merece uma olhada"
            action={
              <button type="button" className="text-link" onClick={() => navigate('produtos')}>
                Ver produtos <ArrowRight size={14} />
              </button>
            }
          />
          {alerts.length === 0 ? (
            <EmptyState
              compact
              icon={<CheckCircle2 size={22} />}
              title="Tudo sob controle"
              description="Nenhum estoque baixo ou validade próxima por aqui."
            />
          ) : (
            <ul className="radar-list">
              {alerts.slice(0, 5).map((entry) => (
                <li key={entry.product.id} className="radar-item">
                  <span
                    className="radar-marker"
                    style={{ background: entry.product.typeColor }}
                    aria-hidden="true"
                  />
                  <div className="radar-info">
                    <div className="radar-name-row">
                      <strong>{entry.product.name}</strong>
                      {entry.reasons.slice(0, 1).map((reason) => (
                        <Badge key={reason.label} tone={reason.tone}>
                          {reason.label}
                        </Badge>
                      ))}
                    </div>
                    <small>{alertDetail(entry)}</small>
                  </div>
                  <button
                    type="button"
                    className="radar-action"
                    title="Registrar entrada"
                    aria-label={`Registrar entrada de ${entry.product.name}`}
                    onClick={() => openMovement('entrada', entry.product)}
                  >
                    <Plus size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {alerts.length > 5 ? (
            <button type="button" className="card-foot-link" onClick={() => navigate('produtos')}>
              + {alerts.length - 5} outros produtos
            </button>
          ) : null}
        </Card>

        <Card className="recent-card">
          <CardHead
            title="Últimas movimentações"
            subtitle="O movimento mais recente do estoque"
            action={
              <button type="button" className="text-link" onClick={() => navigate('movimentacoes')}>
                Ver todas <ArrowRight size={14} />
              </button>
            }
          />
          {data.recent.length === 0 ? (
            <EmptyState
              compact
              icon={<Clock3 size={20} />}
              title="Nenhuma movimentação"
              description="Suas entradas e saídas aparecem aqui em tempo real."
            />
          ) : (
            <ul className="recent-list">
              {data.recent.slice(0, 6).map((movement) => (
                <li key={movement.id} className="recent-item">
                  <span className={cx('recent-kind', `recent-${movement.kind}`)}>
                    {movement.kind === 'saida' ? (
                      <ArrowUpRight size={15} />
                    ) : (
                      <ArrowDownLeft size={15} />
                    )}
                  </span>
                  <div className="recent-main">
                    <strong>{movement.productName}</strong>
                    <small>
                      {movement.party || (movement.kind === 'saida' ? 'Sem destino' : 'Sem origem')}
                      <span className="dot-sep" />
                      {movement.typeName}
                    </small>
                  </div>
                  <div className="recent-meta">
                    <strong className={movement.kind === 'saida' ? 'out' : 'in'}>
                      {movement.kind === 'saida' ? '−' : '+'}
                      {num(movement.quantity)} {movement.unit}
                    </strong>
                    <small>{relativeTime(movement.date, movement.time)}</small>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      <section className="insight-band">
        <div className="insight-head">
          <span className="insight-kicker">
            <Sparkles size={14} /> Leitura do dia
          </span>
          <h2>
            {data.totals.saidaQty >= data.totals.previous.saidaQty
              ? 'O ritmo de saídas está em alta.'
              : 'O ritmo de saídas está mais calmo.'}
          </h2>
          <p>
            Uma leitura rápida dos últimos {days} dias para você decidir com clareza.
          </p>
        </div>
        <div className="insight-points">
          {insights.map((insight, index) => (
            <div className="insight-point" key={index}>
              <span className="insight-point-icon">{insight.icon}</span>
              <p>{insight.text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
