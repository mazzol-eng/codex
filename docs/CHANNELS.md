# Canais

## Simulador

Não precisa de conta nem credencial. O botão **Testar** no editor roda o motor puro sobre o rascunho, mostra variáveis e destaca o caminho. A prévia permite comparar Telegram, WhatsApp e SMS; isso não envia mensagens reais.

Para testar a cadeia persistente: publique um bot, vá a **Canais → Adicionar simulador**, escolha o bot e use **Testar conversa**. Acompanhe as mensagens na **Caixa de entrada**. O comando `pnpm dev` precisa manter web e worker ativos.

## Seu Telegram existente

1. No Telegram, abra o @BotFather e use `/mybots` para consultar o bot que você já possui e o token da API. Não é necessário criar outro bot.
2. Configure `ENCRYPTION_KEY` (32 bytes em hexadecimal) e `PUBLIC_WEBHOOK_URL` com a URL pública HTTPS desta instalação. Em desenvolvimento, a chave é gerada em `.data/encryption-key`, com permissões privadas. Preserve esse arquivo; perdê-lo impede a leitura dos tokens já criptografados.
3. No painel, publique o fluxo e vá a **Canais → Conectar Telegram**. Escolha o bot interno do BotHub, dê um nome à conexão e cole o token na tela.
4. O adaptador valida `getMe`, criptografa o token e registra `setWebhook` com um `secret_token` independente. O endpoint é `/api/webhooks/telegram/:connectionId`.
5. O Telegram oferece um único webhook por bot. Conectar ao BotHub substitui o destino anterior de recebimento; organize essa migração caso seu bot já tenha outro serviço conectado.
6. Envie `/start` para seu bot existente no Telegram. O webhook valida `X-Telegram-Bot-Api-Secret-Token`, persiste o evento e responde sem aguardar a execução do fluxo. A Inbox mostra a conversa e o worker envia as respostas.

Sem URL pública HTTPS, o token pode ser validado, mas a conexão permanece **Aguardando verificação**. Após configurar a URL, use **Testar conexão** para registrar o webhook. O token nunca é devolvido ao front e não aparece nos logs. A tela exibe somente metadados dos dez últimos eventos.

Teclados inline usam IDs curtos (`c:<id>`, abaixo de 64 bytes); callbacks são confirmados no worker. Imagens, vídeos, áudios e documentos usam a Bot API oficial. Status disponível: enviado/falhou; Telegram não oferece recibos gerais de entrega/leitura para bots.

### Rede na nuvem

A execução local e os testes não precisam de rede. Para usar Telegram real, a instalação precisa alcançar `api.telegram.org` via HTTPS e ser acessível publicamente pelo Telegram. O transporte respeita o proxy e a confiança TLS do ambiente. O domínio foi incluído no rascunho de configuração para revisão; isso não aplica a permissão ao runtime atual. Revise os ajustes do ambiente quando for conectar seu bot.

## WhatsApp existente — API oficial da Meta

Não usamos WhatsApp Web e não criamos outro bot, número ou conta Business.

1. No Meta Business, use seu WABA e número já cadastrados na WhatsApp Business Platform. O número precisa estar disponível para a Cloud API. O acesso deve pertencer à sua empresa.
2. No app Meta existente, consulte o **App Secret** em configurações básicas. Crie/consulte um System User no Business e conceda acesso à conta WhatsApp. Gere um token com `whatsapp_business_messaging` e `whatsapp_business_management`. Consulte **phone_number_id** e **WABA ID** em WhatsApp → Configuração da API. Não cole nenhum segredo em chat ou commit.
3. Configure `ENCRYPTION_KEY` e `PUBLIC_WEBHOOK_URL` com a base pública HTTPS da instalação, sem caminho. A versão Graph padrão é `v23.0`, configurável por `META_GRAPH_VERSION` ou pelo adaptador; escolha uma versão suportada pelo seu app.
4. Publique o fluxo no BotHub. Em **Canais → Conectar WhatsApp**, escolha **Minha conta existente**, informe os IDs, token, um verify token forte escolhido por você e App Secret. O servidor valida o número, associa o app ao WABA por `subscribed_apps` e criptografa as credenciais. O modo **Demonstração** dispensa esses dados e nunca chama a Meta.
5. No app Meta → WhatsApp → Webhooks, configure a callback URL `https://SUA-BASE/api/webhooks/whatsapp` e o mesmo verify token. Assine o campo `messages`. O desafio `hub.challenge` só é respondido após verificar o token; a conexão então aparece como conectada. O Embedded Signup não está habilitado nesta etapa.
6. Os POSTs validam `X-Hub-Signature-256` com App Secret antes de gravar qualquer evento. `phone_number_id` encaminha o evento para a conexão e o workspace corretos. Texto, botões/listas, mídia, localização e recibos são normalizados; o worker responde de forma assíncrona.
7. Na tela **Templates do WhatsApp**, crie um texto de **Marketing** ou **Utilidade** em pt-BR. Use variáveis sequenciais `{{1}}`, `{{2}}` e exemplos para análise. Clique **Sincronizar status** para consultar a aprovação da Meta. Não existe aprovação manual no BotHub. No modo demo, a aprovação é explicitamente simulada.
8. Campanhas exigem template **Aprovado**, compatível e vinculado à conexão selecionada, além de autorização do contato. Templates complexos com mídia/cabeçalho/botões e autenticação podem aparecer na sincronização como **Envio em breve**; não são enviados nesta versão. Use texto com instrução clara de descadastro.

Mensagens comuns só podem ser enviadas dentro de 24 horas da última mensagem do cliente. Fora disso, campanhas usam templates aprovados; não há bypass na Inbox ou no worker. Até três opções viram botões; quatro a dez viram lista. A fila checa novamente autorização e aprovação antes de enviar. PARAR/SAIR/STOP/CANCELAR revogam autorização neste canal.

Conectar um webhook ou associar um app ao WABA altera a configuração que atende sua conta hoje. Faça a migração com o responsável pelo serviço atual. Os adaptadores foram testados com fakes/fixtures, sem um token Meta real nem alteração da sua conta.

## SMS — Twilio

1. Na sua conta Twilio existente, consulte **Account SID** e **Auth Token** no Console. Escolha um número habilitado para SMS ou um **Messaging Service SID** com remetente configurado; não é necessário cadastrar outra conta.
2. Configure `PUBLIC_WEBHOOK_URL` com a mesma base pública HTTPS usada pelo provedor. Em **Canais → Conectar SMS**, selecione sua conta existente e preencha SID, token e número em E.164, ou Messaging Service. Defina o preço estimado **por segmento** em reais, conforme o contrato com seu provedor.
3. O adaptador valida a conta. **Testar conexão** configura a URL de entrada no número existente ou Messaging Service. Os caminhos são `/api/webhooks/sms/:connectionId` e `/api/webhooks/sms/:connectionId/status`. O callback de status também é informado em cada envio.
4. A assinatura `X-Twilio-Signature` é validada contra a URL pública canônica e os parâmetros de formulário, com Auth Token. Proxy reverso deve preservar query string e servir os mesmos caminhos; o servidor não confia em um Host/Forwarded recebido para reconstruir a URL assinada.
5. O worker envia com limitação de taxa e backoff. Recibos atualizam enviado/entregue/falhou; SMS não oferece leitura geral. Botões viram opções numeradas e o motor reconhece respostas 1, 2, 3. Mídia em respostas de bot vira link de texto; campanhas SMS desta etapa usam texto.
6. **Campanhas** apresenta GSM-7 ou UCS-2, caracteres e segmentos. GSM-7 admite 160 unidades em uma mensagem ou 153 por parte concatenada; UCS-2, 70 ou 67. Caracteres de extensão GSM-7 contam duas unidades; emojis podem usar duas unidades UTF-16. A prévia estima custo sobre todas as mensagens personalizadas autorizadas, inclusive a instrução PARAR.

A estimativa não consulta câmbio, impostos ou tarifação real. O provedor cobra conforme seu contrato. O modo **Demonstração** simula mensagens sem credenciais, cobrança ou chamadas à Twilio. SmsProvider permite adicionar outro provedor mantendo os contratos do produto.

## Rede, credenciais e testes

Telegram precisa alcançar `api.telegram.org`; WhatsApp, `graph.facebook.com`; Twilio, `api.twilio.com` e `messaging.twilio.com`. São destinos HTTPS fixos e o transporte preserva proxy e confiança TLS do ambiente. A lista foi preparada no rascunho da nuvem para revisão, sem aplicar essa mudança ao runtime atual. Canais também precisam alcançar os webhooks públicos da sua instalação.

Use `.env.example` para a configuração. Credenciais são fornecidas na tela e armazenadas em AES-256-GCM; nunca devolvidas ao front ou registradas nos logs. Tokens de verificação da Meta são localizados por hash. Não envie segredos em chat ou capturas. TelegramTransport, WhatsAppTransport e SmsProvider têm versões reais e fake. Testes usam payloads assinados e fakes, sem chamadas aos provedores. Nenhuma conexão real foi validada com sua conta neste ambiente.
