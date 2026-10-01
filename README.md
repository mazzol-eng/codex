# BotHub

Plataforma de chatbots em pt-BR. Entrega inicial: Fases 0 e 1.

## Rodar localmente

Requisitos: Node >=22.12, pnpm 11.19, Docker com Compose.

```sh
pnpm install
cp .env.example .env
docker compose up -d --wait
pnpm db:generate
pnpm db:seed
pnpm dev
```

Abra o app na porta 3000. O seed oferece `demo@bothub.local` / `BotHubDemo2026!`.
Credenciais são apenas de demonstração local. Novos cadastros não herdam dados do demo.
O seed é idempotente e não exclui dados de usuários. O dashboard demo tem rótulo de exemplo.
Nenhuma credencial externa é necessária; Google/e-mail reais são opcionais.
A primeira instalação e o download inicial de imagens exigem rede; execução local depois disso não.

## Validar

`pnpm lint && pnpm typecheck && pnpm test` (PostgreSQL local precisa estar iniciado para os testes de integração). `pnpm build` gera o site.
`pnpm test:e2e` valida fluxos críticos com PostgreSQL. Em Linux, Chromium já vem empacotado nas dependências. Em macOS/Windows, execute `pnpm exec playwright install chromium` uma vez antes dos testes.

## Escopo

Fundação, landing, preços, recursos, termos/privacidade provisórios, login/cadastro,
recuperação de senha, criação de workspace, shell e dashboard do seed.
Bots/editor/canais/Inbox/campanhas e demais módulos aparecem como “Em breve”.
Fase 2 depende de aprovação. Não há conexão ou envio real de mensagens nesta entrega.

## Produção

Não exponha as credenciais de demo ou os defaults do Compose. Configure `AUTH_SECRET`, URL HTTPS,
PostgreSQL privado, e-mail real e backup. Habilite Google somente com OAuth configurado.
Termos/privacidade são placeholders e exigem revisão jurídica antes da publicação.
Leia `docs/ARCHITECTURE.md`, `docs/DECISIONS.md` e `AGENTS.md`.

## Alternativa sem Docker

Se o download de imagens estiver bloqueado, execute `pnpm services:local` em outro terminal. Esse comando inicia PostgreSQL 17 local, com persistência em `.data/postgres`, sem downloads em runtime. Depois rode `pnpm db:seed && pnpm dev`. Redis ainda não é necessário na Fase 1. Não execute o PostgreSQL local e o Compose na mesma porta ao mesmo tempo.

## Recuperação de senha em desenvolvimento

O adaptador fake grava o último e-mail em `.data/last-email.json`, com acesso restrito. O link é de uso único e expira. Nenhum e-mail ou token é impresso nos logs. Com `EMAIL_MODE=real`, configure o endpoint HTTPS, remetente e chave pela variável de ambiente.

## Internacionalização

next-intl está preparado com dicionários pt-BR e inglês para navegação e autenticação. A interface atual é pt-BR; seleção de idioma e tradução completa ficam para a etapa de configurações.

## Segurança nesta entrega

Senhas argon2id, sessões persistentes com cookies httpOnly/sameSite, CSRF por origem, limitação de login, identificadores de recuperação com hash, OAuth tokens criptografados pelo Better Auth e CSP com nonce por página. Limitação de login em memória serve a uma instância; produção com múltiplas instâncias precisa armazenamento compartilhado na Fase 5. RLS ainda não está habilitado.
