# Entrega das Fases 0 e 1

## Implementado

- Monorepo pnpm, PostgreSQL/Prisma com migrations e seed idempotente, contratos de canais e filas, worker inicial, CI e documentação.
- Marca centralizada, temas claro/escuro, fontes locais, landing responsiva, preços, recursos e páginas legais provisórias.
- Cadastro, login com argon2id, recuperação de senha com adaptador fake, suporte opcional a Google e TOTP no backend.
- Onboarding com criação de workspace, autorização por associação, shell responsivo, busca de navegação e dashboard consultando dados reais do seed.
- Segredos locais privados, criptografia AES-256-GCM, logs com redação de dados sensíveis e CSP com nonce.

## Verificação realizada

- Lint, typecheck e build de produção aprovados.
- 19 testes de unidade/integração aprovados, incluindo isolamento entre workspaces, chaves estrangeiras, validação, criptografia e filas.
- 5 testes Playwright aprovados: site/tema, cadastro/onboarding, dashboard demo/mobile, recuperação de senha e navegação mobile.
- Smoke de produção aprovado: landing, tema, CSP, login demo, cookie seguro, dashboard e saúde do PostgreSQL, sem erros de página.
- PostgreSQL local validado com seed e persistência após reinício. Configuração do Compose validada.

## Limitações conhecidas

O download das imagens Docker foi bloqueado por limites/política dos registries deste ambiente; a inicialização completa via Compose ainda precisa ser verificada em uma máquina com acesso às imagens. O fallback local utiliza PostgreSQL real e está documentado no README.

Google e entrega real de e-mail não foram testados com credenciais externas. Tradução completa para inglês, gestão de TOTP na interface, auditoria formal de acessibilidade/performance, rate limiting distribuído e RLS ficam registrados para etapas posteriores. Lighthouse não foi medido.

Conexões e métricas do workspace demo são exemplos identificados na interface. Novos workspaces começam vazios. Não há executor de fluxos, envio real de mensagens, editor ou Inbox nesta entrega; esses módulos aguardam a Fase 2.

## Ambiente na nuvem

As instruções reutilizáveis de instalação e inicialização foram salvas no rascunho de configuração do ambiente. Nenhuma configuração foi publicada nem houve deploy ou push remoto.

A Fase 2 aguarda aprovação do usuário.
