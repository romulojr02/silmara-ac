import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { cx, clamp, num } from '../format';

function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    setWidth(element.clientWidth);
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}

function smoothPath(points: Array<[number, number]>, smoothing = 0.16): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0][0]} ${points[0][1]}`;
  let path = `M ${points[0][0]} ${points[0][1]}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[index - 1] ?? points[index];
    const p1 = points[index];
    const p2 = points[index + 1];
    const p3 = points[index + 2] ?? p2;
    const cp1x = p1[0] + (p2[0] - p0[0]) * smoothing;
    const cp1y = p1[1] + (p2[1] - p0[1]) * smoothing;
    const cp2x = p2[0] - (p3[0] - p1[0]) * smoothing;
    const cp2y = p2[1] - (p3[1] - p1[1]) * smoothing;
    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2[0]} ${p2[1]}`;
  }
  return path;
}

function niceMax(value: number): number {
  if (value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  const fraction = value / power;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return nice * power;
}

function tickIndexes(length: number, count = 5): number[] {
  if (length <= 0) return [];
  if (length <= count) return Array.from({ length }, (_, i) => i);
  const indexes = new Set<number>();
  for (let i = 0; i < count; i += 1) {
    indexes.add(Math.round((i * (length - 1)) / (count - 1)));
  }
  return Array.from(indexes).sort((a, b) => a - b);
}

export interface AreaPoint {
  label: string;
  value: number;
  detail?: string;
}

export function AreaChart({
  data,
  height = 240,
  color = '#b23b63',
  formatValue = (value) => num(value),
  ariaLabel = 'Gráfico de linha',
}: {
  data: AreaPoint[];
  height?: number;
  color?: string;
  formatValue?: (value: number) => string;
  ariaLabel?: string;
}) {
  const { ref, width } = useElementWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const gradientId = `area-${id}`;

  const layout = { top: 16, right: 12, bottom: 28, left: 12 };
  const chartWidth = Math.max(width, 220);
  const innerWidth = chartWidth - layout.left - layout.right;
  const innerHeight = height - layout.top - layout.bottom;
  const max = niceMax(Math.max(...data.map((point) => point.value), 0));

  const points: Array<[number, number]> = data.map((point, index) => {
    const x =
      data.length <= 1
        ? layout.left + innerWidth / 2
        : layout.left + (index / (data.length - 1)) * innerWidth;
    const y = layout.top + (1 - point.value / max) * innerHeight;
    return [x, y];
  });

  const linePath = smoothPath(points);
  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1][0]} ${layout.top + innerHeight} L ${points[0][0]} ${
          layout.top + innerHeight
        } Z`
      : '';

  const ticks = tickIndexes(data.length);

  return (
    <div
      className="chart-frame"
      ref={ref}
      style={{ height }}
      onPointerMove={(event) => {
        if (data.length === 0) return;
        const rect = event.currentTarget.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const ratio = clamp((x - layout.left) / innerWidth, 0, 1);
        setHover(Math.round(ratio * (data.length - 1)));
      }}
      onPointerLeave={() => setHover(null)}
    >
      {data.length === 0 ? (
        <div className="chart-empty">Sem dados para exibir.</div>
      ) : (
        <svg
          width={chartWidth}
          height={height}
          role="img"
          aria-label={ariaLabel}
          className="chart-svg"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.22" />
              <stop offset="100%" stopColor={color} stopOpacity="0.01" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75, 1].map((ratio) => (
            <line
              key={ratio}
              x1={layout.left}
              x2={chartWidth - layout.right}
              y1={layout.top + innerHeight * ratio}
              y2={layout.top + innerHeight * ratio}
              className="chart-grid"
            />
          ))}
          <path d={areaPath} fill={`url(#${gradientId})`} />
          <path d={linePath} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" />
          {points.length > 0 ? (
            <circle
              cx={points[points.length - 1][0]}
              cy={points[points.length - 1][1]}
              r={4}
              fill={color}
              stroke="var(--surface)"
              strokeWidth={2.5}
            />
          ) : null}
          {hover !== null && points[hover] ? (
            <>
              <line
                x1={points[hover][0]}
                x2={points[hover][0]}
                y1={layout.top}
                y2={layout.top + innerHeight}
                className="chart-cursor"
              />
              <circle
                cx={points[hover][0]}
                cy={points[hover][1]}
                r={5}
                fill={color}
                stroke="var(--surface)"
                strokeWidth={2.5}
              />
            </>
          ) : null}
          {ticks.map((index) => {
            const point = points[index];
            if (!point) return null;
            const anchor =
              index === 0 ? 'start' : index === data.length - 1 ? 'end' : 'middle';
            return (
              <text
                key={index}
                x={point[0]}
                y={height - 8}
                textAnchor={anchor}
                className="chart-axis-label"
              >
                {data[index].label}
              </text>
            );
          })}
        </svg>
      )}
      {hover !== null && data[hover] ? (
        <div
          className="chart-tooltip"
          style={{ left: clamp(points[hover][0], 76, chartWidth - 76), top: 4 }}
        >
          <span className="chart-tooltip-label">{data[hover].detail ?? data[hover].label}</span>
          <strong>{formatValue(data[hover].value)}</strong>
        </div>
      ) : null}
    </div>
  );
}

export function FlowChart({
  labels,
  details,
  entradas,
  saidas,
  height = 270,
  formatValue = (value) => num(value),
  entradaColor = '#b23b63',
  saidaColor = '#8f6aa8',
}: {
  labels: string[];
  details?: string[];
  entradas: number[];
  saidas: number[];
  height?: number;
  formatValue?: (value: number) => string;
  entradaColor?: string;
  saidaColor?: string;
}) {
  const { ref, width } = useElementWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const gradientId = `flow-${id}`;
  const layout = { top: 18, right: 12, bottom: 28, left: 12 };
  const chartWidth = Math.max(width, 220);
  const innerWidth = chartWidth - layout.left - layout.right;
  const innerHeight = height - layout.top - layout.bottom;
  const count = labels.length;
  const max = niceMax(Math.max(...entradas, ...saidas, 0));

  const pointsFor = (values: number[]) =>
    values.map((value, index) => {
      const x =
        count <= 1 ? layout.left + innerWidth / 2 : layout.left + (index / (count - 1)) * innerWidth;
      const y = layout.top + (1 - value / max) * innerHeight;
      return [x, y] as [number, number];
    });

  const entradaPoints = pointsFor(entradas);
  const saidaPoints = pointsFor(saidas);
  const entradaPath = smoothPath(entradaPoints);
  const saidaPath = smoothPath(saidaPoints);
  const areaBase = layout.top + innerHeight;
  const areaPath =
    saidaPoints.length > 0
      ? `${saidaPath} L ${saidaPoints[saidaPoints.length - 1][0]} ${areaBase} L ${saidaPoints[0][0]} ${areaBase} Z`
      : '';
  const ticks = tickIndexes(count);

  return (
    <div
      className="chart-frame"
      ref={ref}
      style={{ height }}
      onPointerMove={(event) => {
        if (!count) return;
        const rect = event.currentTarget.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const ratio = clamp((x - layout.left) / innerWidth, 0, 1);
        setHover(Math.round(ratio * (count - 1)));
      }}
      onPointerLeave={() => setHover(null)}
    >
      {count === 0 ? (
        <div className="chart-empty">Sem dados para exibir.</div>
      ) : (
        <svg width={chartWidth} height={height} className="chart-svg" role="img" aria-label="Entradas e saídas ao longo do tempo">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={saidaColor} stopOpacity="0.16" />
              <stop offset="100%" stopColor={saidaColor} stopOpacity="0.01" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75, 1].map((ratio) => (
            <line
              key={ratio}
              x1={layout.left}
              x2={chartWidth - layout.right}
              y1={layout.top + innerHeight * ratio}
              y2={layout.top + innerHeight * ratio}
              className="chart-grid"
            />
          ))}
          <path d={areaPath} fill={`url(#${gradientId})`} />
          <path
            d={entradaPath}
            fill="none"
            stroke={entradaColor}
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeDasharray="1 0"
            opacity={0.85}
          />
          <path d={saidaPath} fill="none" stroke={saidaColor} strokeWidth={2.5} strokeLinecap="round" />
          {hover !== null && saidaPoints[hover] ? (
            <>
              <line
                x1={saidaPoints[hover][0]}
                x2={saidaPoints[hover][0]}
                y1={layout.top}
                y2={areaBase}
                className="chart-cursor"
              />
              <circle
                cx={saidaPoints[hover][0]}
                cy={saidaPoints[hover][1]}
                r={4.5}
                fill={saidaColor}
                stroke="var(--surface)"
                strokeWidth={2.5}
              />
              <circle
                cx={entradaPoints[hover][0]}
                cy={entradaPoints[hover][1]}
                r={4}
                fill={entradaColor}
                stroke="var(--surface)"
                strokeWidth={2.5}
              />
            </>
          ) : null}
          {ticks.map((index) => {
            const point = saidaPoints[index];
            if (!point) return null;
            const anchor = index === 0 ? 'start' : index === count - 1 ? 'end' : 'middle';
            return (
              <text
                key={index}
                x={point[0]}
                y={height - 8}
                textAnchor={anchor}
                className="chart-axis-label"
              >
                {labels[index]}
              </text>
            );
          })}
        </svg>
      )}
      {hover !== null ? (
        <div
          className="chart-tooltip chart-tooltip-wide"
          style={{ left: clamp(saidaPoints[hover]?.[0] ?? 0, 96, chartWidth - 96), top: 2 }}
        >
          <span className="chart-tooltip-label">{details?.[hover] ?? labels[hover]}</span>
          <span className="tooltip-row">
            <i style={{ background: saidaColor }} /> Saídas <strong>{formatValue(saidas[hover] ?? 0)}</strong>
          </span>
          <span className="tooltip-row">
            <i style={{ background: entradaColor }} /> Entradas{' '}
            <strong>{formatValue(entradas[hover] ?? 0)}</strong>
          </span>
        </div>
      ) : null}
    </div>
  );
}

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

export function DonutChart({
  segments,
  centerLabel = 'Total',
  formatValue = (value) => num(value),
  emptyLabel = 'Sem saídas no período',
  unit,
}: {
  segments: DonutSegment[];
  centerLabel?: string;
  formatValue?: (value: number) => string;
  emptyLabel?: string;
  unit?: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const radius = 66;
  const circumference = 2 * Math.PI * radius;
  const gap = segments.length > 1 ? 4 : 0;
  let offset = 0;

  const activeSegment = active !== null ? segments[active] : null;

  return (
    <div className="donut-layout">
      <div className="donut-figure">
        <svg viewBox="0 0 180 180" className="donut-svg" role="img" aria-label="Distribuição por tipo">
          <circle cx="90" cy="90" r={radius} fill="none" stroke="var(--surface-sunken)" strokeWidth="20" />
          {total > 0
            ? segments.map((segment, index) => {
                const fraction = segment.value / total;
                const length = fraction * circumference;
                const dash = Math.max(length - gap, 0.6);
                const element = (
                  <circle
                    key={segment.label}
                    cx="90"
                    cy="90"
                    r={radius}
                    fill="none"
                    stroke={segment.color}
                    strokeWidth={active === index ? 24 : 20}
                    strokeLinecap="round"
                    strokeDasharray={`${dash} ${circumference - dash}`}
                    strokeDashoffset={-offset}
                    transform="rotate(-90 90 90)"
                    className={cx('donut-segment', active !== null && active !== index && 'is-muted')}
                    onPointerEnter={() => setActive(index)}
                    onPointerLeave={() => setActive(null)}
                  />
                );
                offset += length;
                return element;
              })
            : null}
        </svg>
        <div className="donut-center">
          {total > 0 ? (
            <>
              <strong>{activeSegment ? formatValue(activeSegment.value) : formatValue(total)}</strong>
              <span>{activeSegment ? activeSegment.label : unit ? centerLabel : centerLabel}</span>
            </>
          ) : (
            <span className="donut-empty">{emptyLabel}</span>
          )}
        </div>
      </div>
      <div className="donut-legend">
        {total > 0 ? (
          segments.map((segment, index) => (
            <button
              key={segment.label}
              type="button"
              className={cx('legend-item', active === index && 'is-active')}
              onPointerEnter={() => setActive(index)}
              onPointerLeave={() => setActive(null)}
              onFocus={() => setActive(index)}
              onBlur={() => setActive(null)}
            >
              <span className="legend-dot" style={{ background: segment.color }} />
              <span className="legend-name">{segment.label}</span>
              <span className="legend-value">{Math.round((segment.value / total) * 100)}%</span>
            </button>
          ))
        ) : (
          <p className="legend-empty">Registre uma saída para ver a distribuição.</p>
        )}
      </div>
    </div>
  );
}

export function RankBars({
  items,
  formatValue = (value) => num(value),
  empty,
}: {
  items: { name: string; meta?: string; value: number; color?: string }[];
  formatValue?: (value: number) => string;
  empty?: ReactNode;
}) {
  if (items.length === 0) {
    return <div className="mini-empty">{empty ?? 'Sem dados no período.'}</div>;
  }
  const max = Math.max(...items.map((item) => item.value), 1);
  return (
    <div className="rank-list">
      {items.map((item, index) => (
        <div className="rank-item" key={`${item.name}-${index}`} style={{ ['--delay' as string]: `${index * 70}ms` }}>
          <div className="rank-item-top">
            <div className="rank-name">
              <span>{item.name}</span>
              {item.meta ? <small>{item.meta}</small> : null}
            </div>
            <strong>{formatValue(item.value)}</strong>
          </div>
          <div className="rank-track">
            <span
              className="rank-fill"
              style={{
                width: `${Math.max(3, (item.value / max) * 100)}%`,
                background: item.color ?? 'var(--brand)',
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function StackedBar({
  segments,
  formatValue = (value) => num(value),
}: {
  segments: { label: string; value: number; color: string }[];
  formatValue?: (value: number) => string;
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  if (total <= 0) return <div className="mini-empty">Sem estoque no momento.</div>;
  return (
    <div>
      <div className="stacked-bar">
        {segments.map((segment) => (
          <span
            key={segment.label}
            title={`${segment.label}: ${formatValue(segment.value)}`}
            style={{
              width: `${(segment.value / total) * 100}%`,
              background: segment.color,
            }}
          />
        ))}
      </div>
      <div className="stacked-legend">
        {segments.map((segment) => (
          <span key={segment.label}>
            <i style={{ background: segment.color }} />
            {segment.label}
            <small>{Math.round((segment.value / total) * 100)}%</small>
          </span>
        ))}
      </div>
    </div>
  );
}

export function Heatmap({
  cells,
  weekdays,
  buckets,
}: {
  cells: { weekday: number; bucket: number; qty: number; count: number }[];
  weekdays: string[];
  buckets: string[];
}) {
  const max = Math.max(...cells.map((cell) => cell.qty), 1);
  const order = [1, 2, 3, 4, 5, 6, 0];
  return (
    <div className="heatmap">
      <div className="heatmap-head">
        <span />
        {buckets.map((bucket) => (
          <span key={bucket} className="heatmap-bucket">
            {bucket}
          </span>
        ))}
      </div>
      {order.map((weekday) => (
        <div className="heatmap-row" key={weekday}>
          <span className="heatmap-weekday">{weekdays[weekday]}</span>
          {buckets.map((bucketName, bucket) => {
            const cell = cells.find((item) => item.weekday === weekday && item.bucket === bucket);
            const value = cell?.qty ?? 0;
            const intensity = value / max;
            const dark = intensity > 0.52;
            return (
              <span
                key={bucketName}
                className={cx('heatmap-cell', value === 0 && 'is-empty')}
                style={{
                  background:
                    value === 0
                      ? undefined
                      : `color-mix(in srgb, var(--brand) ${8 + intensity * 72}%, transparent)`,
                  color: dark ? '#fff9f7' : 'var(--ink-2)',
                }}
                title={`${weekdays[weekday]} · ${bucketName}: ${num(value)} un em ${cell?.count ?? 0} mov.`}
              >
                {value > 0 ? num(value) : ''}
              </span>
            );
          })}
        </div>
      ))}
      <div className="heatmap-legend">
        <span>Menos</span>
        <i style={{ background: 'color-mix(in srgb, var(--brand) 8%, transparent)' }} />
        <i style={{ background: 'color-mix(in srgb, var(--brand) 30%, transparent)' }} />
        <i style={{ background: 'color-mix(in srgb, var(--brand) 50%, transparent)' }} />
        <i style={{ background: 'color-mix(in srgb, var(--brand) 72%, transparent)' }} />
        <span>Mais</span>
      </div>
    </div>
  );
}

export function Sparkline({
  values,
  color = 'var(--brand)',
  width = 96,
  height = 32,
}: {
  values: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  if (values.length === 0) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const points: Array<[number, number]> = values.map((value, index) => [
    values.length === 1 ? width / 2 : (index / (values.length - 1)) * width,
    height - 3 - ((value - min) / range) * (height - 6),
  ]);
  const path = smoothPath(points);
  return (
    <svg width={width} height={height} className="sparkline" aria-hidden="true">
      <defs>
        <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={`${path} L ${points[points.length - 1][0]} ${height} L ${points[0][0]} ${height} Z`}
        fill={`url(#spark-${id})`}
      />
      <path d={path} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
