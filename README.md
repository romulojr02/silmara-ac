# Controles da Silmara

Controle de estoque simples, seguro e em português brasileiro. Uma única conta de administradora, planilha de produtos com validade, movimentações de entrada e saída e métricas para entender o que saiu e o que precisa de atenção.

## Recursos

- **Painel** com valor em estoque, entradas e saídas do período, radar de atenção e leitura do dia.
- **Produtos** com tipo, unidade, preço, estoque inicial, estoque mínimo, validade e código gerado automaticamente.
- **Movimentações** de entrada e saída com data, hora, responsável/destino, valor e histórico completo.
- **Métricas** com comparativo entre períodos, saídas por tipo, produtos e destinos mais movimentados, ritmo semanal por horário e saúde do estoque.
- **Tipos de produto** com cor de identificação e proteção contra exclusão de categorias em uso.
- **Ajustes** com perfil, troca de senha, chave de recuperação, backup JSON, planilha CSV, dados de exemplo e limpeza da base.
- Interface responsiva para computador e celular, com abas e navegação inferior no mobile.

## Arquitetura

- **Interface:** React 18 + TypeScript + Vite.
- **API:** Express 4 no mesmo domínio, em `/api`.
- **Banco:** Postgres do Supabase via pooler de transações (`pg`).
- **Publicação:** frontend estático na Vercel e API como função serverless (`api/[...path].mjs`).

O schema é criado automaticamente na primeira conexão. A conta da administradora e os tipos padrão são provisionados no primeiro acesso ou por variáveis de ambiente.

## Requisitos

- Node.js 24.
- Uma conexão Postgres (Supabase ou outro provedor compatível).

## Desenvolvimento

```bash
npm install
cp .env.example .env
```

Preencha `DATABASE_URL` no `.env` com a URL do pooler do Supabase. Depois:

```bash
npm run dev
```

Abra `http://127.0.0.1:5173`. A interface roda no Vite e encaminha `/api` para o servidor Express em `http://127.0.0.1:5174`.

Se ainda não houver uma conta, a tela de primeiro acesso permite criar a administradora e exibe a chave de recuperação uma única vez.

## Produção

```bash
npm install
npm run build
npm start
```

Abra `http://localhost:5174`. O servidor Express entrega a interface compilada em `dist/` e a API.

Variáveis de ambiente:

| Variável | Padrão | Uso |
| --- | --- | --- |
| `DATABASE_URL` | obrigatória | Conexão Postgres. No Supabase, use a aba **Transaction pooler** (porta `6543`). |
| `PORT` | `5174` | Porta do servidor local. |
| `TRUST_PROXY` | desligado | Use `1` atrás de proxy HTTPS/Vercel para cookies seguros e IP real. |
| `APP_TIMEZONE` | `America/Sao_Paulo` | Fuso usado para datas e horários. O padrão já é o horário do Brasil. |
| `SILMARA_ADMIN_NAME` | `Silmara` | Nome da administradora criada automaticamente quando não há conta. |
| `SILMARA_ADMIN_PASSWORD` | vazio | Cria a conta inicial sem passar pela tela de setup. Use apenas na primeira execução e não versione esse valor. |
| `APP_ORIGIN` | vazio | Origens extras permitidas para requisições, separadas por vírgula. |

Recomenda-se publicar atrás de HTTPS.

## Publicação na Vercel

1. Importe o repositório na Vercel (framework **Vite**).
2. Configure as variáveis `DATABASE_URL`, `TRUST_PROXY=1` e `TZ=America/Sao_Paulo` para Production e Preview.
3. Faça o deploy. O build gera `dist/` e a função `api/[...path].mjs` atende toda a API.

O arquivo `vercel.json` já define o build, a duração da função e os cabeçalhos de segurança. O `.env` não é enviado ao repositório nem à Vercel — os segredos ficam apenas nas variáveis de ambiente.

## Segurança

- Senha protegida com scrypt e sessões armazenadas apenas como hash SHA-256 no servidor.
- Cookie de sessão `HttpOnly`, `SameSite=Strict`, `Secure` sob HTTPS, com renovação deslizante de 7 dias e limite de sessões ativas.
- Bloqueio progressivo contra tentativas repetidas de login e de recuperação.
- Chave de recuperação armazenada como hash e exibida uma única vez; pode ser gerada em **Ajustes → Chave de recuperação**.
- Requisições de escrita exigem JSON, cabeçalho `x-requested-with: silmara-web` e origem permitida — proteção contra CSRF.
- Cabeçalhos de segurança e CSP restritiva; a aplicação não usa recursos externos.
- Estoque nunca fica negativo e não são aceitas movimentações com data futura.
- Trocar a senha ou recuperar o acesso encerra as outras sessões.

## Dados e backup

Os dados ficam no Postgres configurado em `DATABASE_URL`. Em **Ajustes** é possível baixar um backup JSON completo e exportar os produtos em CSV. O backup JSON é um retrato do momento; guarde-o em local seguro.

Para começar do zero sem apagar o acesso da administradora, use **Ajustes → Apagar todos os dados**. Os tipos padrão são recriados em seguida.

## Estrutura

```text
server/        API Express, autenticação, acesso ao Postgres e dados de exemplo
api/           Função serverless da Vercel que expõe a API
src/           Interface React + TypeScript
src/pages/     Painel, Produtos, Movimentações, Métricas, Tipos e Ajustes
src/components Componentes de interface, gráficos e modais
public/        Ícone da aplicação
dist/          Build de produção (gerado por npm run build)
```
