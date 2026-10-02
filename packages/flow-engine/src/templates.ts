import type { FlowGraph } from './index';
export type BotTemplate = {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  graph: FlowGraph;
};
function graph(
  prompt: string,
  variable: string,
  reply: string,
  validation: 'text' | 'email' | 'number' = 'text',
): FlowGraph {
  return {
    triggers: [
      { type: 'first_message', priority: 0, nodeId: 'welcome' },
      { type: 'command', value: '/start', priority: 10, nodeId: 'welcome' },
      { type: 'keyword', value: 'oi', match: 'exact', priority: 5, nodeId: 'welcome' },
    ],
    nodes: [
      {
        id: 'welcome',
        type: 'message',
        data: { label: 'Boas-vindas', text: 'Olá, {{contact.first_name}}! Que bom ter você aqui.' },
        position: { x: 250, y: 0 },
      },
      {
        id: 'ask',
        type: 'question',
        data: {
          label: 'Conhecer o cliente',
          text: prompt,
          variable,
          validation,
          maxAttempts: 3,
          timeoutSeconds: 86400,
        },
        position: { x: 250, y: 150 },
      },
      {
        id: 'reply',
        type: 'message',
        data: { label: 'Resposta', text: reply },
        position: { x: 250, y: 300 },
      },
      { id: 'end', type: 'end', data: { label: 'Concluir' }, position: { x: 250, y: 450 } },
    ],
    edges: [
      { source: 'welcome', target: 'ask' },
      { source: 'ask', target: 'reply' },
      { source: 'ask', target: 'end', handle: 'error' },
      { source: 'ask', target: 'end', handle: 'timeout' },
      { source: 'reply', target: 'end' },
    ],
  };
}
const faq: FlowGraph = {
  triggers: [
    { type: 'first_message', priority: 0, nodeId: 'menu' },
    { type: 'command', value: '/start', priority: 10, nodeId: 'menu' },
  ],
  nodes: [
    {
      id: 'menu',
      type: 'buttons',
      data: {
        label: 'Menu inicial',
        text: 'Olá! Como podemos ajudar você hoje?',
        variable: 'assunto',
        choices: [
          { id: 'hours', label: 'Horário de atendimento' },
          { id: 'address', label: 'Onde estamos' },
          { id: 'human', label: 'Falar com a equipe' },
        ],
      },
      position: { x: 300, y: 0 },
    },
    {
      id: 'hours',
      type: 'message',
      data: { label: 'Nossos horários', text: 'Atendemos de segunda a sexta, das 9h às 18h. 😊' },
      position: { x: 0, y: 180 },
    },
    {
      id: 'address',
      type: 'message',
      data: {
        label: 'Nosso endereço',
        text: 'Estamos na Rua Exemplo, 123. Atualize este endereço antes de conectar um canal.',
      },
      position: { x: 300, y: 180 },
    },
    {
      id: 'human',
      type: 'handoff',
      data: {
        label: 'Atendimento humano',
        text: 'Vou chamar nossa equipe. Você pode enviar os detalhes por aqui.',
      },
      position: { x: 600, y: 180 },
    },
    { id: 'end', type: 'end', data: { label: 'Concluir' }, position: { x: 150, y: 360 } },
  ],
  edges: [
    { source: 'menu', target: 'hours', handle: 'hours' },
    { source: 'menu', target: 'address', handle: 'address' },
    { source: 'menu', target: 'human', handle: 'human' },
    { source: 'menu', target: 'end', handle: 'error' },
    { source: 'hours', target: 'end' },
    { source: 'address', target: 'end' },
  ],
};
export const botTemplates: BotTemplate[] = [
  {
    id: 'faq',
    name: 'Atendimento e FAQ',
    description: 'Um menu simples para tirar dúvidas e conversar com sua equipe.',
    category: 'Atendimento',
    icon: 'messages',
    graph: faq,
  },
  {
    id: 'leads',
    name: 'Captação de leads',
    description: 'Receba o e-mail de quem quer conhecer seu negócio.',
    category: 'Marketing',
    icon: 'sparkles',
    graph: graph(
      'Qual é seu e-mail?',
      'email',
      'Obrigado! Nossa equipe vai entrar em contato pelo e-mail {{vars.email}}.',
      'email',
    ),
  },
  {
    id: 'booking',
    name: 'Agendamento',
    description: 'Colete a preferência de horário para confirmar com a equipe.',
    category: 'Serviços',
    icon: 'calendar',
    graph: graph(
      'Qual dia e horário você prefere?',
      'horario',
      'Recebemos sua preferência: {{vars.horario}}. A equipe confirmará a disponibilidade.',
    ),
  },
  {
    id: 'order',
    name: 'Status de pedido',
    description: 'Receba o número do pedido para consulta pela equipe.',
    category: 'Vendas',
    icon: 'package',
    graph: graph(
      'Qual é o número do seu pedido?',
      'pedido',
      'Recebemos o pedido {{vars.pedido}}. A equipe irá consultar o status.',
    ),
  },
  {
    id: 'nps',
    name: 'Pesquisa de satisfação',
    description: 'Ouça seus clientes com uma pesquisa curta.',
    category: 'Marketing',
    icon: 'star',
    graph: graph(
      'De 0 a 10, como foi sua experiência?',
      'nota',
      'Obrigado pela sua avaliação: {{vars.nota}}. Sua opinião nos ajuda a melhorar.',
      'number',
    ),
  },
  {
    id: 'delivery',
    name: 'Cardápio e pedidos',
    description: 'Colete o pedido; personalize o texto com o seu cardápio.',
    category: 'Vendas',
    icon: 'utensils',
    graph: graph(
      'O que você gostaria de pedir?',
      'pedido',
      'Anotamos: {{vars.pedido}}. A equipe confirmará os itens e o valor.',
    ),
  },
  {
    id: 'payment',
    name: 'Lembrete de pagamento',
    description: 'Atenda dúvidas de pagamento quando o cliente iniciar a conversa.',
    category: 'Vendas',
    icon: 'wallet',
    graph: graph(
      'Qual pagamento você gostaria de consultar?',
      'pagamento',
      'Recebemos sua consulta sobre {{vars.pagamento}}. A equipe enviará os detalhes por este canal.',
    ),
  },
  {
    id: 'support',
    name: 'Triagem de suporte',
    description: 'Entenda o problema e transfira para uma pessoa.',
    category: 'Atendimento',
    icon: 'headphones',
    graph: {
      ...graph(
        'Conte um pouco sobre o que aconteceu.',
        'problema',
        'Entendi: {{vars.problema}}. Vou chamar alguém da equipe.',
      ),
      nodes: [
        ...graph('Conte um pouco sobre o que aconteceu.', 'problema', '').nodes.filter(
          (n) => n.id !== 'reply' && n.id !== 'end',
        ),
        {
          id: 'reply',
          type: 'handoff',
          data: {
            label: 'Chamar equipe',
            text: 'Entendi: {{vars.problema}}. Vou chamar alguém da equipe.',
          },
          position: { x: 250, y: 300 },
        },
        { id: 'end', type: 'end', data: { label: 'Concluir' }, position: { x: 600, y: 300 } },
      ],
    },
  },
];
export function blankGraph(): FlowGraph {
  return {
    nodes: [
      {
        id: 'welcome',
        type: 'message',
        data: { label: 'Boas-vindas', text: 'Olá! Como posso ajudar você?' },
        position: { x: 200, y: 0 },
      },
      { id: 'end', type: 'end', data: { label: 'Concluir' }, position: { x: 200, y: 170 } },
    ],
    edges: [{ source: 'welcome', target: 'end' }],
    triggers: [
      { type: 'first_message', nodeId: 'welcome', priority: 0 },
      { type: 'command', value: '/start', nodeId: 'welcome', priority: 10 },
    ],
  };
}
