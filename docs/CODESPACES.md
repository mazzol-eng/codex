# Testar pelo celular no GitHub Codespaces

O Codespaces executa o projeto na nuvem. Você usa o navegador do celular; não precisa instalar Node, PostgreSQL ou Docker no aparelho. Esta configuração é de desenvolvimento e demonstração, com dados fictícios, e não constitui hospedagem permanente.

## Abrir a demonstração

1. Entre na sua conta GitHub e abra [Criar Codespace do BotHub](https://github.com/codespaces/new?repo=1400241689&ref=codex%2Fbothub-phase-2).
2. Confirme o repositório `mazzol-eng/codex`, a branch `codex/bothub-phase-2` e a configuração `.devcontainer/devcontainer.json`. Escolha a menor máquina compatível, com dois núcleos.
3. Confira a cota disponível e quem será responsável pela cobrança. Toque em **Create codespace**. Se não conseguir ver os controles, ative **Versão para computador** no navegador.
4. Aguarde a instalação. O projeto inicia o PostgreSQL local, aplica migrations/seed e inicia site e worker automaticamente. A primeira instalação precisa de Internet; não precisa de credenciais dos canais.
5. Na aba **Ports**, abra a porta **3000 — BotHub** em uma nova aba. O acesso fica privado por padrão: permaneça conectado à sua conta GitHub e mantenha essa visibilidade.
6. Abra `/login?demo=1` nesse endereço. Clique em **Preencher conta demo → Entrar**. Em **Templates**, escolha um bot e use **Testar** no editor. Contatos, WhatsApp/SMS fictícios e campanhas também estão disponíveis.

Se o link de criação não selecionar o projeto, abra [a branch preparada](https://github.com/mazzol-eng/codex/tree/codex/bothub-phase-2) e use **Code → Codespaces → Create codespace**.

## Retomar e diagnosticar

Ao retomar um Codespace parado, os serviços iniciam novamente. Os dados e as chaves ficam em `.data` dentro do workspace; não exclua essa pasta. Excluir o Codespace pode excluir esses dados. Faça exportação/backup antes de remover o ambiente.

O comando `pnpm demo:cloud` também inicia a demonstração manualmente. Ele evita dois supervisores, impede a inicialização sobre um servidor já usando a porta 3000 e utiliza somente o banco local de desenvolvimento. Redis não é necessário. Um erro de serviço encerra os processos que o supervisor iniciou, preservando serviços de banco já existentes.

Mensagens de inicialização ficam em `.data/cloud-demo.log`. Para diagnóstico, consulte o final desse arquivo sem compartilhar credenciais, tokens ou o conteúdo de `.data/auth-secret`, `.data/encryption-key` e e-mails de recuperação. Quando o log indicar que o BotHub está saudável, abra **Ports → BotHub**.

O login usa o endereço HTTPS do Codespace atual, aceita somente esse hostname adicional nos assets de desenvolvimento e utiliza cookies secure/httpOnly/sameSite. Não há permissão genérica para qualquer domínio `github.dev`.

### Tela branca na prévia

O BotHub impede que outras páginas o incorporem em um iframe. A opção **Open Preview / Simple Browser** dentro do editor pode ficar em branco por esse motivo. Abra o site em uma aba real do navegador:

1. Em **Ports**, use **Copy Address / Copiar endereço** na porta 3000.
2. Abra uma nova aba do Chrome ou Safari, cole o endereço copiado e permaneça conectado à sua conta GitHub. O site da porta deve ter um endereço HTTPS com `-3000.app.github.dev`.
3. Acrescente `/login?demo=1` ao endereço para entrar na demonstração.

O comando `pnpm demo:cloud`, quando executado no Codespaces, também mostra esse endereço para copiar. Se ainda ficar em branco na aba externa, abra `/health` no mesmo endereço. O resultado esperado é JSON com `status: "ok"` e `database: "ok"`. Se o resultado diferir, consulte o log de inicialização. Essa verificação separa um problema de inicialização de um problema de exibição; não confirma a causa de qualquer tela branca sem observar o endereço e o erro.

## Limites

- A disponibilidade, franquia gratuita, armazenamento e cobrança pertencem ao GitHub. Confira os valores mostrados na sua conta; não há promessa de gratuidade ilimitada. Pare o Codespace após testar e considere também o uso de armazenamento.
- Um Codespace pode suspender por inatividade ou falta de cota. Worker, respostas e agendamentos param junto com ele. Não o use para atendimento contínuo de clientes.
- A porta privada exige autenticação GitHub e não recebe webhooks públicos de Telegram, Meta ou Twilio. A configuração não conecta nem altera suas contas existentes. Use Simulador e conexões de demonstração.
- O acesso à API de Codespaces foi negado no ambiente de desenvolvimento usado para preparar essa configuração. Nenhum Codespace foi criado na conta do usuário. Os scripts e os fluxos são validados localmente; a criação e a inicialização reais no GitHub precisam ser verificadas após o clique acima.

Referências oficiais: [criar um Codespace](https://docs.github.com/en/codespaces/developing-in-a-codespace/creating-a-codespace-for-a-repository) e [portas encaminhadas](https://docs.github.com/en/codespaces/developing-in-a-codespace/forwarding-ports-in-your-codespace).

## Verificação realizada

A configuração foi conferida com o schema oficial de devcontainers. O script de instalação e o supervisor foram executados no ambiente de desenvolvimento, incluindo migrations/seed, verificação de saúde, prevenção de supervisores duplicados e uma conversa persistente respondida pelo worker fake. Lint, typecheck, formatação e build passaram. Os 98 testes de unidade/integração passaram, incluindo validação do hostname do Codespace e proteção contra origens arbitrárias.

Uma emulação local de encaminhamento HTTPS, com certificado de teste confiável e sem desabilitar a verificação TLS, validou login, cookie secure/httpOnly/sameSite, dashboard, contatos em tela de celular e rejeição de origem estrangeira. Essa emulação não acessa um Codespace real. A instalação da imagem completa não foi validada: o registro confirmou a versão `24-bookworm`, mas o download de camadas foi negado pela rede do ambiente. A criação na conta GitHub permanece pendente.
