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

## Requisitos

- Node.js 24 (o backend usa o módulo nativo `node:sqlite`).
- npm.

## Desenvolvimento

```bash
npm install
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
| `PORT` | `5174` | Porta do servidor. |
| `SILMARA_DATA_DIR` | `./data` | Diretório do banco SQLite. |
| `SILMARA_ADMIN_NAME` | `Silmara` | Nome da administradora criada no primeiro start. |
| `SILMARA_ADMIN_PASSWORD` | vazio | Cria a conta inicial sem passar pela tela de setup. Use apenas na primeira execução e não versione esse valor. |
| `TRUST_PROXY` | desligado | Use `1` atrás de um proxy reverso HTTPS para que cookies seguros e o IP real funcionem. |
| `APP_ORIGIN` | vazio | Origens extras permitidas para requisições, separadas por vírgula. |

Recomenda-se publicar atrás de HTTPS e manter o diretório `data/` em disco persistente.

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

O banco fica em `data/silmara.db` (ou em `SILMARA_DATA_DIR`). Em **Ajustes** é possível baixar um backup JSON completo e exportar os produtos em CSV. O backup JSON é um retrato do momento; guarde-o em local seguro.

Para começar do zero sem apagar o acesso da administradora, use **Ajustes → Apagar todos os dados**. Para uma instalação realmente nova, pare o servidor e remova o arquivo do banco.

## Publicação

O SQLite exige disco persistente. Por isso, a aplicação completa **não roda no Vercel como está**: funções serverless não mantêm o arquivo do banco entre execuções.

Dois caminhos seguros:

1. **Vercel + Supabase (recomendado):** migrar a camada de dados do Express para o Postgres do Supabase e publicar a API como função serverless na Vercel. O modelo relacional de produtos, tipos e movimentações combina com SQL e com as métricas já existentes.
2. **Vercel para o frontend + API em um host com disco persistente:** publicar o Express e o SQLite no Render, Railway ou Fly.io, mantendo a Vercel apenas para a interface, com proxy de `/api` para esse servidor.

Firebase/Firestore também funciona, mas exigiria remodelar os dados e as agregações que hoje são SQL — por isso o Supabase é a opção mais direta para este projeto.

## Estrutura

```text
server/        API Express, autenticação, banco SQLite e dados de exemplo
src/           Interface React + TypeScript
src/pages/     Painel, Produtos, Movimentações, Métricas, Tipos e Ajustes
src/components Componentes de interface, gráficos e modais
public/        Ícone da aplicação
data/          Banco local (criado em tempo de execução)
dist/          Build de produção (gerado por npm run build)
```
