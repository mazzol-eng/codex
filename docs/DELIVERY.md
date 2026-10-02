# Entrega das Fases 0, 1 e 2

## Fundação e produto inicial — Fases 0 e 1

### Implementado

- Monorepo pnpm, PostgreSQL/Prisma com migrations e seed idempotente, contratos de canais e filas, worker inicial, CI e documentação.
- Marca centralizada, temas claro/escuro, fontes locais, landing responsiva, preços, recursos e páginas legais provisórias.
- Cadastro, login com argon2id, recuperação de senha com adaptador fake, suporte opcional a Google e TOTP no backend.
- Onboarding com criação de workspace, autorização por associação, shell responsivo, busca de navegação e dashboard consultando dados reais do seed.
- Segredos locais privados, criptografia AES-256-GCM, logs com redação de dados sensíveis e CSP com nonce.

### Verificação realizada

- Lint, typecheck e build de produção aprovados.
- 19 testes de unidade/integração aprovados, incluindo isolamento entre workspaces, chaves estrangeiras, validação, criptografia e filas.
- 5 testes Playwright aprovados: site/tema, cadastro/onboarding, dashboard demo/mobile, recuperação de senha e navegação mobile.
- Smoke de produção aprovado: landing, tema, CSP, login demo, cookie seguro, dashboard e saúde do PostgreSQL, sem erros de página.
- PostgreSQL local validado com seed e persistência após reinício. Configuração do Compose validada.

### Limitações conhecidas

O download das imagens Docker foi bloqueado por limites/política dos registries deste ambiente; a inicialização completa via Compose ainda precisa ser verificada em uma máquina com acesso às imagens. O fallback local utiliza PostgreSQL real e está documentado no README.

Google e entrega real de e-mail não foram testados com credenciais externas. Tradução completa para inglês, gestão de TOTP na interface, auditoria formal de acessibilidade/performance, rate limiting distribuído e RLS ficam registrados para etapas posteriores. Lighthouse não foi medido.

Conexões e métricas do workspace demo são exemplos identificados na interface. Novos workspaces começam vazios. O executor, editor e Inbox foram acrescentados na Fase 2 abaixo.

## Produto funcional — Fase 2

- Bots com criação do zero ou de oito templates, duplicação, pausa, arquivo, configurações e limites do plano.
- Motor puro com gatilhos, perguntas e validações brasileiras, condições, variáveis/tags, botões/listas, espera, transferência, opt-out, janela de 24h e proteção contra loops.
- Editor React Flow com propriedades, validação, autosave com revisão otimista, undo/redo, auto-layout e versões publicadas imutáveis. Simulador com variáveis, caminho percorrido e prévia das capacidades dos canais.
- Canal Simulador persistente e adaptador Telegram oficial para conectar um bot externo **já existente**, com token criptografado, secret de webhook, normalização, callbacks, mídia e envio. Nenhum bot ou conta externa foi criado.
- Worker com outbox durável, deduplicação, sessões fixadas na versão publicada, esperas persistentes, rate limit e retry. QueuePort oferece memória e BullMQ; eventos de Inbox usam SSE local ou Redis pub/sub.
- Inbox com filtros, assumir/devolver ao bot, mensagens humanas, respostas rápidas, notas internas, consentimento e execução do fluxo. Autorizações verificadas no servidor e operações isoladas por workspace.
- Documentação de conexão dos canais e dos nós, migrations e seed idempotente. Instruções reutilizáveis da nuvem atualizadas.

### Verificação da Fase 2

- Lint, typecheck e build de produção aprovados. As 37 listas de arquivos rastreados do build foram verificadas: não contêm dados privados locais, credenciais ou caches de desenvolvimento.
- 55 testes de unidade/integração aprovados, incluindo fixtures Telegram, degradação WhatsApp/SMS, motor, PostgreSQL, isolamento, versões imutáveis, criptografia, autorização, opt-out e recuperação de esperas.
- 8 testes Playwright aprovados: os cinco fluxos iniciais e três novos testes cobrindo template/editor/publicação/simulador/Inbox humana, mobile e webhook Telegram.
- Os três testes da Fase 2 também passaram no build de produção, incluindo publicação, simulação, transferência, resposta humana, nota interna, mobile e webhook. Smoke adicional confirma CSP com nonce, cookie secure/httpOnly/sameSite e dashboard sem erros de página. O Chromium empacotado usa renderização por software neste ambiente para evitar atrasos na revelação de páginas em streaming; a segurança do navegador permanece habilitada.
- Redis 8 real validado em teste isolado: pub/sub por workspace, IDs de jobs por workspace, deduplicação, delay e retry com backoff. O modo padrão de desenvolvimento continua sem exigir Redis.

### Escopo e limites da Fase 2

Um bot tem um fluxo principal nesta entrega. Nós HTTP/IA, divisão A/B, múltiplos fluxos, gatilhos externos/agendados e outros recursos avançados ficam indicados como futuros; não há execução desses recursos. As esperas do fluxo atual são funcionais.

O Telegram real foi implementado e testado com fixtures e transporte fake, sem usar token real nem registrar webhook externo. Conectar seu bot exige token na interface, URL pública HTTPS e acesso de rede ao Telegram. Trocar o webhook pode substituir o serviço que atende seu bot hoje. WhatsApp e SMS reais, campanhas e mini-CRM pertencem à Fase 3; a prévia atual não conecta esses serviços.

O envio externo não oferece garantia de exatamente uma entrega: uma interrupção após o aceite remoto pode ter resultado desconhecido. O worker registra esse estado sem repetir cegamente. RLS e rate limiting distribuído geral, auditoria formal e ensaio de escala ficam para endurecimento; o isolamento atual usa queries, autorização, chaves estrangeiras e testes. Filas e SSE em Redis são opcionais; o outbox PostgreSQL mantém a execução local entre web e worker.

## Ambiente na nuvem

As instruções reutilizáveis de instalação e inicialização foram salvas no rascunho de configuração do ambiente. Nenhuma configuração foi publicada nem houve deploy ou push remoto.

A Fase 2 foi autorizada pelo pedido “Continue”. A implementação termina nesta fase; a integração do WhatsApp já existente será parte da Fase 3.
