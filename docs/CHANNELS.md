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

## WhatsApp existente — Fase 3

Será usada somente a API oficial da Meta. A conexão reutilizará seu WABA e número Business com `phone_number_id`, WABA ID, token do System User e verify token; Embedded Signup poderá ser habilitado se houver app Meta configurado. A janela de 24h e a degradação de botões já têm testes no motor, mas o adaptador real, assinatura e templates aprovados ainda não estão implementados.

Não usamos bibliotecas de WhatsApp Web nem criamos outra conta externa.

## SMS — Fase 3

Twilio será o provedor padrão, atrás de SmsProvider. Credenciais e assinatura de webhook serão implementadas junto com os testes das fixtures do provedor. A prévia atual transforma botões em respostas numeradas; não há envio de SMS real.

## Credenciais e testes

Use `.env.example` para configuração da instalação. Não envie tokens em chat, commits ou prints. TelegramTransport possui implementação HTTP e fake; testes usam fixtures e o fake, sem chamar o Telegram. Uma chave inválida interrompe a conexão sem expor a credencial.
