import { transaction, nowIso, todayStr, addDays, setMeta } from './db.mjs';

function mulberry32(seed) {
  let value = seed;
  return function random() {
    value |= 0;
    value = (value + 0x6d2b79f5) | 0;
    let t = Math.imul(value ^ (value >>> 15), 1 | value);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TYPES = [
  { name: 'Alimentos', color: '#b23b63' },
  { name: 'Bebidas', color: '#8f6aa8' },
  { name: 'Limpeza', color: '#c97b8e' },
  { name: 'Higiene', color: '#7d8fb3' },
  { name: 'Congelados', color: '#6f9c8c' },
];

const PRODUCTS = [
  { name: 'Café Torrado 500g', sku: 'CAF-1042', type: 'Alimentos', unit: 'un', price: 24.9, initial: 80, min: 12, expires: 180, weight: 9 },
  { name: 'Leite Integral 1L', sku: 'LEI-2031', type: 'Alimentos', unit: 'un', price: 4.79, initial: 96, min: 24, expires: 45, weight: 10 },
  { name: 'Pão de Forma 500g', sku: 'PAO-3107', type: 'Alimentos', unit: 'un', price: 8.49, initial: 40, min: 10, expires: 10, weight: 6 },
  { name: 'Queijo Minas 300g', sku: 'QUE-4482', type: 'Alimentos', unit: 'un', price: 18.9, initial: 26, min: 8, expires: 21, weight: 4 },
  { name: 'Presunto Fatiado 200g', sku: 'PRE-5120', type: 'Alimentos', unit: 'un', price: 12.5, initial: 22, min: 10, expires: 6, weight: 5, target: 3 },
  { name: 'Refrigerante Cola 2L', sku: 'REF-6033', type: 'Bebidas', unit: 'un', price: 9.99, initial: 72, min: 18, expires: 240, weight: 8 },
  { name: 'Suco de Laranja 1L', sku: 'SUC-7041', type: 'Bebidas', unit: 'un', price: 7.49, initial: 48, min: 12, expires: 30, weight: 5 },
  { name: 'Água Mineral 500ml', sku: 'AGU-8019', type: 'Bebidas', unit: 'un', price: 2.5, initial: 160, min: 48, expires: 300, weight: 10 },
  { name: 'Detergente Neutro 500ml', sku: 'DET-9052', type: 'Limpeza', unit: 'un', price: 3.29, initial: 50, min: 12, expires: 400, weight: 3 },
  { name: 'Sabão em Pó 1kg', sku: 'SAB-1146', type: 'Limpeza', unit: 'un', price: 14.9, initial: 30, min: 8, expires: 500, weight: 2 },
  { name: 'Papel Higiênico 4 rolos', sku: 'PAP-2088', type: 'Higiene', unit: 'un', price: 11.9, initial: 44, min: 12, expires: 600, weight: 4 },
  { name: 'Iogurte Natural 170g', sku: 'IOG-3174', type: 'Congelados', unit: 'un', price: 3.49, initial: 30, min: 10, expires: 4, weight: 5, target: 2 },
  { name: 'Batata Congelada 1kg', sku: 'BAT-4109', type: 'Congelados', unit: 'un', price: 16.9, initial: 24, min: 8, expires: 90, weight: 4 },
  { name: 'Sorvete de Creme 1L', sku: 'SOR-5502', type: 'Congelados', unit: 'un', price: 22.9, initial: 18, min: 6, expires: -2, weight: 2 },
];

const SAIDA_PARTIES = [
  'Mercado Bom Preço',
  'Café da Esquina',
  'Restaurante Manjericão',
  'Padaria Vila Nova',
  'Empório Central',
  'Cliente balcão',
  'Feira do Bairro',
];

const ENTRADA_PARTIES = [
  'Distribuidora Aurora',
  'Atacadão Sul',
  'Cooperativa Campo Bom',
  'Fornecedor direto',
];

const SAIDA_NOTES = [
  '',
  '',
  '',
  'Pedido do dia',
  'Reposição de vitrine',
  'Encomenda semanal',
  '',
  'Entrega programada',
];

const ENTRADA_NOTES = ['Compra mensal', 'Reposição de estoque', 'Pedido de reposição', ''];

export async function loadDemo() {
  const random = mulberry32(20261023);
  const randInt = (min, max) => Math.floor(random() * (max - min + 1)) + min;
  const pick = (list) => list[Math.floor(random() * list.length)];
  const round2 = (value) => Math.round(value * 100) / 100;
  const pad = (value) => String(value).padStart(2, '0');

  const today = todayStr();
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 74);
  const startDate = todayStr(start);
  const stamp = nowIso();

  await transaction(async (client) => {
    const typeIds = new Map();
    for (const type of TYPES) {
      const existing = await client.query('SELECT id FROM types WHERE LOWER(name) = LOWER($1)', [
        type.name,
      ]);
      if (existing.rows[0]) {
        typeIds.set(type.name, Number(existing.rows[0].id));
        continue;
      }
      const result = await client.query(
        'INSERT INTO types (name, color, created_at) VALUES ($1, $2, $3) RETURNING id',
        [type.name, type.color, stamp],
      );
      typeIds.set(type.name, Number(result.rows[0].id));
    }

    const productIds = [];
    for (const item of PRODUCTS) {
      const expiresOn = addDays(today, item.expires);
      const notesByType = {
        Alimentos: 'Produto perecível. Conferir validade na entrada.',
        Bebidas: 'Armazenar em local seco e ventilado.',
        Limpeza: 'Manter fora do alcance de crianças.',
        Higiene: 'Conferir integridade da embalagem.',
        Congelados: 'Manter sob refrigeração adequada.',
      };
      const result = await client.query(
        `
        INSERT INTO products
          (name, sku, type_id, unit, price, initial_stock, min_stock, expires_on, notes, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id
      `,
        [
          item.name,
          item.sku,
          typeIds.get(item.type),
          item.unit,
          item.price,
          item.initial,
          item.min,
          expiresOn,
          notesByType[item.type] ?? '',
          stamp,
          stamp,
        ],
      );
      productIds.push(Number(result.rows[0].id));
    }

    const stocks = PRODUCTS.map((product) => product.initial);

    const addMovement = async (index, kind, quantity, date, time) => {
      const product = PRODUCTS[index];
      const party = kind === 'saida' ? pick(SAIDA_PARTIES) : pick(ENTRADA_PARTIES);
      const notes = kind === 'saida' ? pick(SAIDA_NOTES) : pick(ENTRADA_NOTES);
      const price =
        kind === 'entrada'
          ? round2(product.price * (0.82 + random() * 0.08))
          : round2(product.price * (0.98 + random() * 0.04));
      await client.query(
        `
        INSERT INTO movements (product_id, kind, quantity, unit_price, date, time, party, notes, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `,
        [productIds[index], kind, quantity, price, date, time, party, notes, stamp],
      );
      stocks[index] += kind === 'entrada' ? quantity : -quantity;
    };

    const weightedPick = () => {
      const total = PRODUCTS.reduce((sum, product) => sum + product.weight, 0);
      let ticket = random() * total;
      for (let index = 0; index < PRODUCTS.length; index += 1) {
        ticket -= PRODUCTS[index].weight;
        if (ticket <= 0) return index;
      }
      return PRODUCTS.length - 1;
    };

    const todayTime = () => {
      const minutesNow = now.getHours() * 60 + now.getMinutes();
      const minutesAgo = Math.min(Math.max(1, minutesNow - 1), randInt(2, 260));
      const moment = new Date(now.getTime() - minutesAgo * 60000);
      return `${pad(moment.getHours())}:${pad(moment.getMinutes())}`;
    };

    const dayCount = 75;
    for (let dayOffset = 0; dayOffset < dayCount; dayOffset += 1) {
      const date = addDays(startDate, dayOffset);
      const [, , day] = date.split('-').map(Number);
      const weekday = new Date(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, day).getDay();
      const isToday = date === today;

      if (weekday !== 0 && (weekday !== 6 || random() > 0.4)) {
        const base = weekday === 5 ? randInt(3, 6) : randInt(2, 4);
        const count = isToday ? randInt(2, 4) : base;
        for (let n = 0; n < count; n += 1) {
          let index = weightedPick();
          let guard = 0;
          while (stocks[index] < 2 && guard < 20) {
            index = weightedPick();
            guard += 1;
          }
          if (stocks[index] < 2) continue;
          const maxQty = Math.min(6, Math.max(1, Math.floor(stocks[index])));
          const quantity = randInt(1, Math.max(1, Math.min(maxQty, weekday === 5 ? 5 : 3)));
          if (isToday) {
            await addMovement(index, 'saida', quantity, date, todayTime());
          } else {
            const hours = [8, 9, 9, 10, 10, 11, 12, 13, 14, 14, 15, 16, 17, 18];
            const hour = pick(hours);
            await addMovement(index, 'saida', quantity, date, `${pad(hour)}:${pad(randInt(0, 59))}`);
          }
        }
      }

      if (weekday === 2 || weekday === 5) {
        const entries = randInt(1, 2);
        for (let n = 0; n < entries; n += 1) {
          const index = weightedPick();
          if (PRODUCTS[index].target !== undefined) continue;
          const quantity = randInt(10, 32);
          if (isToday) {
            await addMovement(index, 'entrada', quantity, date, todayTime());
          } else {
            const hour = randInt(8, 17);
            await addMovement(index, 'entrada', quantity, date, `${pad(hour)}:${pad(randInt(0, 59))}`);
          }
        }
      }
    }

    for (const [index, product] of PRODUCTS.entries()) {
      if (product.target === undefined) continue;
      if (stocks[index] <= 0) {
        await addMovement(
          index,
          'entrada',
          randInt(3, 6),
          addDays(today, -randInt(1, 3)),
          `${pad(randInt(9, 17))}:${pad(randInt(0, 59))}`,
        );
      }
    }

    await setMeta('demo', '1', client);
    await setMeta('demo_seeded_at', stamp, client);
  });

  return {
    types: TYPES.length,
    products: PRODUCTS.length,
  };
}
