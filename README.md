# BotHub

Plataforma de chatbots em pt-BR. Fases 0 a 3: site, autenticação, dashboard, editor visual, simulador, Inbox, canais oficiais, contatos e campanhas.

## Rodar localmente

Requisitos: Node >=22.12, pnpm 11.19, Docker com Compose.

```sh
pnpm install
cp .env.example .env
docker compose up -d --wait
pnpm db:seed
pnpm dev
```

O painel usa a porta 3000. O seed oferece `demo@bothub.local` / `BotHubDemo2026!`, com templates e um canal Simulador pronto. Credenciais são apenas de demonstração local. Novos cadastros criam empresas vazias e isoladas.

O seed é idempotente e não exclui trabalho de usuários. Números e conversas do demo são identificados como exemplos. A instalação inicial exige rede; depois disso, desenvolvimento e testes não precisam de Internet nem de credenciais externas.

### Sem Docker

Em outro terminal, execute `pnpm services:local`. Esse comando inicia PostgreSQL 17 real em loopback e preserva `.data/postgres`. Depois rode `pnpm db:seed && pnpm dev`. Não execute esse PostgreSQL e o Compose na mesma porta.

O modo local padrão usa a outbox persistente do banco entre web e worker. Redis é opcional para esse caminho; para BullMQ e Redis pub/sub, inicie o Redis do Compose e configure `QUEUE_MODE=redis`.

## Sua primeira conversa

1. Crie sua empresa ou entre no demo.
2. Em **Templates**, importe um fluxo. Edite as mensagens e conecte os nós no editor.
3. Clique **Testar** para conversar no simulador do rascunho, sem canal real. Variáveis e caminho percorrido aparecem na tela.
4. Clique **Publicar**. Em **Canais**, adicione um **Simulador**, escolha o bot e envie `/start` pelo botão **Testar conversa**.
5. Abra a **Caixa de entrada** para acompanhar. Use **Assumir conversa**, responda, adicione notas internas ou devolva ao bot.

Para conectar **seu bot do Telegram existente**, configure uma URL pública HTTPS, cole o token no painel e siga [docs/CHANNELS.md](docs/CHANNELS.md). Não é necessário criar outro bot. WhatsApp Cloud API e SMS Twilio também reutilizam suas contas existentes. Escolha **Demonstração** para testar sem credenciais ou **Minha conta existente** para conectar de verdade.

Mantenha web **e worker** ativos; `pnpm dev` inicia os dois. Após modificar o schema e executar `pnpm db:generate`, reinicie os processos para atualizar instâncias do cliente Prisma.

## Contatos e campanhas

O demo inclui WhatsApp e SMS **fakes**, credenciais fictícias criptografadas, 12 contatos com tags, segmentos salvos e um template aprovado apenas na demonstração. Nenhum canal externo recebe esses envios.

1. Em **Contatos**, cadastre clientes ou importe CSV de até 1.000 linhas, mapeando nome, telefone/ID, e-mail e tags. Registre a origem da autorização; importações nunca reativam opt-outs existentes.
2. Filtre por canal, tag ou busca e salve um segmento. Abra o perfil para editar dados, campos personalizados e autorizações.
3. Em **Canais → Templates do WhatsApp**, crie textos de marketing/utilidade ou sincronize a aprovação da Meta. Templates com mídia, botões e autenticação ficam indicados como futuros.
4. Em **Campanhas**, escolha a conexão, o público e a mensagem. WhatsApp exige template aprovado. SMS mostra caracteres, segmentos e custo estimado do público personalizado.
5. Revise a prévia e confirme o envio, ou agende no fuso da empresa. O relatório apresenta enviadas, entregues, lidas, falhas, contatos protegidos e exportação CSV. Recibos dependem do canal.

O worker precisa permanecer ativo, inclusive para agendamentos. Hospedagens gratuitas que hibernam não garantem atendimento ou disparos na hora marcada. Os testes validam os adaptadores reais usando transportes fake e payloads assinados; nenhum provedor foi testado com credenciais reais neste ambiente.

## Validar

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

PostgreSQL deve estar iniciado para integração/e2e. Playwright inicia web e worker quando necessário. Em Linux, Chromium vem nas dependências; em macOS/Windows, execute `pnpm exec playwright install chromium` uma vez.

Pare o servidor de desenvolvimento antes de construir em `.next`, depois reinicie `pnpm dev`. Os testes exercitam isolamento entre empresas, engine, adaptadores com fixtures, publicação imutável, filas/envio, editor e atendimento humano. Telegram HTTP e Redis real dependem da infraestrutura indicada abaixo; testes padrão usam fakes/mode local.

## Segurança e configuração

Senhas argon2id, sessões persistentes com cookies httpOnly/sameSite, CSRF por origem, RBAC no servidor, limite de login, recuperação com identificadores em hash, OAuth criptografado e CSP com nonce. Credenciais de canal usam AES-256-GCM e nunca voltam ao front. Publicações são imutáveis; sessões mantêm a versão inicial. Opt-out impede novos envios e a fila revalida o consentimento.

Em desenvolvimento, `.data/auth-secret` e `.data/encryption-key` são gerados com permissões privadas. Preserve-os e nunca coloque esses arquivos em commits. Recuperação de senha fake grava `.data/last-email.json` sem imprimir tokens. E-mail/Google reais são opcionais.

Produção exige `AUTH_SECRET`, `ENCRYPTION_KEY`, URL HTTPS, banco/Redis privados, e-mail real e backup. Nunca exponha credenciais demo ou defaults do Compose. RLS e rate limiting distribuído do login ainda não estão habilitados; revisão formal de acessibilidade/performance e endurecimento são Fase 5. Termos/privacidade são provisórios e exigem revisão antes da publicação.

## Próximas fases

Fase 4: analytics avançado, equipe/convites, API pública, cobrança e IA opcional. Fase 5: segurança, performance, acessibilidade e revisão final. Recursos futuros aparecem como **Em breve**.

Leia [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/DECISIONS.md](docs/DECISIONS.md), [docs/FLOW_NODES.md](docs/FLOW_NODES.md), [docs/DELIVERY.md](docs/DELIVERY.md) e [AGENTS.md](AGENTS.md).
