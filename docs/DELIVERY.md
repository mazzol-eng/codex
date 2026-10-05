# Entrega das Fases 0 a 3

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

As instruções reutilizáveis de instalação e inicialização foram salvas no rascunho de configuração do ambiente. Nenhuma configuração da nuvem foi publicada nem houve deploy. O código e a galeria foram enviados para a branch autorizada `codex/bothub-phase-2` no GitHub.

A Fase 2 foi autorizada pelo pedido “Continue”. A Fase 3 foi autorizada pelos pedidos seguintes para continuar.

## Canais, contatos e campanhas — Fase 3

- Adaptadores oficiais Meta Cloud API e Twilio atrás de portas, com implementações fake, assinaturas de webhook, normalização de mensagens, mídia/opções e recibos de status. Credenciais criptografadas e retornos seguros ao navegador.
- Conexão manual das contas existentes, teste de conexão, logs de eventos e modos de demonstração identificados. Nenhuma conta ou bot externo criado.
- CRM com cadastro/perfil, busca e filtros, tags, campos personalizados, segmentos salvos, histórico de consentimento, importação CSV mapeada/atômica e exportação protegida contra fórmulas de planilha.
- Templates WhatsApp de texto, marketing/utilidade, criação e sincronização de aprovação. Formatos avançados aparecem como futuros e são impedidos de enviar.
- Campanhas por segmento/tag, personalização segura, prévia de público/consentimento e custo SMS, agendamento no fuso da empresa, outbox idempotente, limites de taxa/backoff, cancelamento de próximos envios e relatório CSV.
- Revalidação de autorização, campanha e template no envio; janela WhatsApp verificada também no sender. Opt-out revoga campanhas naquele canal. Recibos não regridem de lido para entregue.
- Novas telas responsivas e seed fake idempotente. Galeria com capturas do aplicativo em execução, sem montagens e sem credenciais reais.

### Verificação da Fase 3

- Lint, typecheck e build de produção aprovados; instalação com lockfile congelado/cache offline também aprovada.
- **79 testes de unidade/integração** aprovados, com PostgreSQL real. Incluem contratos e assinaturas Meta/Twilio, segmentos GSM-7/UCS-2, importação atômica, autorização, chaves estrangeiras entre tenants, campanhas idempotentes, agendamento, cancelamento, opt-out e janela WhatsApp.
- **11 testes Playwright** aprovados, incluindo cadastro/importação/segmento, revisão SMS, processamento pelo worker, relatório CSV, layout mobile, template WhatsApp aprovado na demonstração, campanha e webhook Meta assinado/deduplicado.
- Os **três novos testes da Fase 3** também passaram no build de produção. Smoke confirma CSP com nonce sem unsafe-eval/inline em scripts, cookie secure/httpOnly/sameSite, login e novas telas sem erros de página.
- **53 manifests de arquivos do build** verificados: nenhum arquivo privado de .data, .env ou cache local incluído.
- Capturas reais feitas no aplicativo em execução com dados fictícios. Nenhuma conta real dos provedores foi utilizada; fixtures e transportes fake comprovam os contratos implementados.

### Limites e próximo passo

Públicos de até 1.000 contatos por campanha e CSV de até 1.000 linhas/200 KB. Contatos são separados por conexão. Aprovação é sincronizada manualmente. Templates de autenticação/mídia/botões e Embedded Signup ficam futuros. Estatísticas de respostas são aproximadas; entregas/leituras dependem de recibos do canal. Os planos e cobrança com limites mensais, equipe, API pública e analytics avançado são Fase 4.

Agendamento depende de worker ativo e banco disponível. A plataforma não foi hospedada publicamente, não tem conta Meta/Twilio real validada e não recebeu auditoria formal de acessibilidade/Lighthouse. Docker continua com a limitação de download de imagens observada anteriormente; PostgreSQL local real foi usado para validação.

### Revalidação da Fase 3 sem Docker

- Corrigida a retomada do PostgreSQL após interrupções que deixam processos Linux encerrados e locks de sockets. O banco local usa TCP em loopback; processos ativos e erros de permissão continuam impedindo limpeza indevida, e os dados são preservados.
- Seed idempotente, lint, typecheck e build aprovados. **88 testes de unidade/integração** passaram, incluindo nove novos casos da verificação de processos.
- Os **três testes Playwright da Fase 3** passaram novamente em desenvolvimento: CRM/importação/segmento/campanha SMS/worker/CSV/mobile, template e campanha WhatsApp na demonstração, e desafio/assinatura/deduplicação Meta.
- A suíte completa de 11 testes de navegador e os testes em produção descritos acima pertencem à validação anterior; nesta revalidação foram executados os três fluxos da Fase 3. Nenhuma credencial real, conta externa ou hospedagem pública foi utilizada.
