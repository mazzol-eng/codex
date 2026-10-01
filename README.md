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

`pnpm lint && pnpm typecheck && pnpm test`. `pnpm build` gera o site.
`pnpm exec playwright install chromium && pnpm test:e2e` valida fluxos críticos com PostgreSQL.

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
