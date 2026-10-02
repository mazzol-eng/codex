# Fluxos na Fase 2

Cada bot tem um fluxo principal. Gatilhos apontam para um nó inicial e são avaliados por prioridade. Primeira mensagem, comando, palavra-chave e botão podem ser editados no painel; o contrato puro também aceita eventos de agendamento, webhook e tag para integrações futuras. Não há API pública para esses eventos ainda.

## Nós disponíveis

| Nó             | Comportamento                                                                                                        |
| -------------- | -------------------------------------------------------------------------------------------------------------------- |
| Mensagem       | Texto com variáveis ou mídia por URL HTTPS: imagem, vídeo, áudio e documento.                                        |
| Perguntar      | Bloqueia e salva a resposta. Validação: texto, número, e-mail, telefone E.164, CPF, CNPJ e data brasileira.          |
| Botões / Lista | Bloqueia e salva o ID da opção. Cada opção possui um caminho; SMS mapeia respostas numeradas de volta.               |
| Condição       | Compara variável, canal, tag ou campo do contato com igual, contém, maior ou preenchido. Conecte Sim e Não.          |
| Aguardar       | Pausa por segundos (até sete dias), persiste o vencimento e retoma no worker. O simulador permite avançar o relógio. |
| Ação           | Adiciona/remove tag ou define variável.                                                                              |
| Chamar equipe  | Pausa a automação e disponibiliza a conversa na Inbox.                                                               |
| Encerrar       | Finaliza a sessão; um novo gatilho pode iniciar outra execução.                                                      |

Variáveis usam `{{vars.pedido}}` e `{{contact.first_name}}`, sem eval nem acesso ao protótipo. Campos de contato disponíveis nesta fase: first_name. Tags usam o nome da tag no campo de variável e true/false como valor da condição.

Perguntas possuem texto de erro, tentativas máximas e timeout em segundos. O caminho `error` recebe erro/tentativas esgotadas; `timeout` recebe vencimento. Sem esses caminhos, a sessão termina com registro de erro. Nós automáticos têm limite de 100 passos por execução, mesmo que um grafo antigo contenha um ciclo.

## Editor

A paleta adiciona nós; os pontos conectam caminhos. Botões possuem um ponto por opção. O painel à direita edita propriedades; **Organizar** usa dagre. Minimap, zoom, arraste, undo/redo e atalhos Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z e Ctrl/Cmd+S estão disponíveis. Arestas respeitam movimento reduzido.

Autosave aguarda 900 ms após mudanças válidas de formato; campos temporariamente incompletos ficam pendentes. A publicação valida caminhos, nós órfãos, opções e variáveis declaradas. Conflito entre abas retorna erro e pede recarregar, preservando o rascunho já salvo. Histórico restaura uma versão no rascunho, sem modificar a publicação original.

O **simulador do editor** usa o rascunho e não persiste contatos. O **canal Simulador** usa a versão publicada, worker e banco; é apropriado para testar Inbox e atendimento humano.

## Políticas

PARAR, SAIR, STOP e CANCELAR descadastram o contato naquele canal, confirmam e impedem novos envios, inclusive mensagens já na fila. No WhatsApp, uma execução com última mensagem recebida há mais de 24h não pode emitir mensagens livres. Templates aprovados e conexão WhatsApp real pertencem à Fase 3.

HTTP com SSRF, IA, divisão A/B, localização de saída, campos avançados, assinatura/cancelamento de inscrição e mudança entre fluxos ainda não estão disponíveis.
