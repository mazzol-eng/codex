import { describe, it, expect } from 'vitest';
import {
  runFlow,
  initialState,
  blankGraph,
  botTemplates,
  validateGraph,
  validAnswer,
  template,
  type FlowGraph,
} from './index';
import type { InboundEvent } from '@bothub/channels';
const event = (text = 'oi', channel: InboundEvent['channel'] = 'simulator'): InboundEvent => ({
  channel,
  connectionId: 'c1',
  externalContactId: 'x1',
  externalMessageId: 'm1',
  type: 'text',
  text,
  timestamp: '2026-10-01T12:00:00Z',
});
const lead = botTemplates.find((t) => t.id === 'leads')!.graph;
describe('pure flow execution', () => {
  it('validates every importable template', () => {
    for (const t of botTemplates) expect(validateGraph(t.graph), t.id).toEqual([]);
  });
  it('starts first message and prioritizes commands', () => {
    const g = blankGraph();
    g.triggers.push({
      type: 'keyword',
      value: 'help',
      match: 'contains',
      priority: 20,
      nodeId: 'end',
    });
    const r = runFlow(g, initialState(), event('help'));
    expect(r.actions).toHaveLength(0);
    expect(r.state.ended).toBe(true);
  });
  it('supports exact, contains and safe regex triggers', () => {
    for (const match of ['exact', 'contains', 'regex'] as const) {
      const g = blankGraph();
      g.triggers = [
        {
          type: 'keyword',
          value: match === 'regex' ? '^oi$' : 'oi',
          match,
          priority: 0,
          nodeId: 'welcome',
        },
      ];
      expect(runFlow(g, initialState(), event('oi')).actions).toHaveLength(1);
      expect(runFlow(g, initialState(), event('other')).actions).toHaveLength(0);
    }
  });
  it('validates a question, retries, saves a variable and continues', () => {
    const a = runFlow(lead, initialState(), event());
    expect(a.state.waiting?.nodeId).toBe('ask');
    const b = runFlow(lead, a.state, event('invalid'));
    expect(b.state.waiting?.attempts).toBe(1);
    const c = runFlow(lead, b.state, event('maria@example.com'));
    expect(c.state.variables.email).toBe('maria@example.com');
    expect(c.state.ended).toBe(true);
    expect(c.actions[0]).toMatchObject({
      message: { text: expect.stringContaining('maria@example.com') },
    });
  });
  it('uses max attempts and timeout routes', () => {
    let s = runFlow(lead, initialState(), event()).state;
    for (let i = 0; i < 3; i++) s = runFlow(lead, s, event('bad')).state;
    expect(s.ended).toBe(true);
    const a = runFlow(lead, initialState(), event());
    const b = runFlow(lead, a.state, event('valid@email.com'), {
      now: Date.parse(event().timestamp) + 86400001,
    });
    expect(b.state.variables.email).toBeUndefined();
    expect(b.state.ended).toBe(true);
  });
  it('evaluates conditions and performs tag/variable actions', () => {
    const g: FlowGraph = {
      ...blankGraph(),
      nodes: [
        {
          id: 'welcome',
          type: 'condition',
          data: { variable: 'score', operator: 'greater', value: '5' },
        },
        { id: 'yes', type: 'action', data: { action: 'add_tag', value: 'lead' } },
        { id: 'end', type: 'end', data: {} },
      ],
      edges: [
        { source: 'welcome', target: 'yes', handle: 'true' },
        { source: 'welcome', target: 'end', handle: 'false' },
        { source: 'yes', target: 'end' },
      ],
    };
    expect(
      runFlow(g, { ...initialState(), variables: { score: '9' } }, event()).state.tags,
    ).toEqual(['lead']);
  });
  it('waits without network or timers and resumes at the due time', () => {
    const g = blankGraph();
    g.nodes[0] = { id: 'welcome', type: 'wait', data: { seconds: 10 } };
    const a = runFlow(g, initialState(), event());
    expect(a.actions).toEqual([{ type: 'wait', seconds: 10 }]);
    expect(
      runFlow(g, a.state, event(), { now: Date.parse(event().timestamp) + 5000 }).state.waiting,
    ).toBeDefined();
    expect(
      runFlow(g, a.state, event(), { now: Date.parse(event().timestamp) + 10000 }).state.ended,
    ).toBe(true);
  });
  it('stops loops at 100 steps', () => {
    const g = blankGraph();
    g.edges = [{ source: 'welcome', target: 'welcome' }];
    const a = runFlow(g, initialState(), event());
    expect(a.trace).toHaveLength(100);
    expect(a.errors).toContain('step_limit');
  });
  it('transfers to a human and suppresses bot responses', () => {
    const g = blankGraph();
    g.nodes[0] = { id: 'welcome', type: 'handoff', data: { text: 'Equipe a caminho.' } };
    const a = runFlow(g, initialState(), event());
    expect(a.state.mode).toBe('human');
    expect(runFlow(g, a.state, event('mais')).actions).toHaveLength(0);
  });
  it.each(['PARAR', 'SAIR', 'STOP', 'CANCELAR'])('honors opt-out %s even in human mode', (word) => {
    const a = runFlow(lead, { ...initialState(), mode: 'human' }, event(word));
    expect(a.state.optedOut).toBe(true);
    expect(a.actions).toContainEqual({ type: 'consent', value: false });
    expect(runFlow(lead, a.state, event()).actions).toHaveLength(0);
  });
  it('blocks WhatsApp messages outside the 24h window', () => {
    const a = runFlow(blankGraph(), initialState(), event('oi', 'whatsapp'), {
      lastInboundAt: Date.parse(event().timestamp) - 86400001,
    });
    expect(a.actions).toHaveLength(0);
    expect(a.errors).toContain('whatsapp_window_expired');
  });
  it('maps SMS numbered replies to choice ids', () => {
    const faq = botTemplates[0]!.graph;
    const a = runFlow(faq, initialState(), event('oi', 'sms'));
    const b = runFlow(faq, a.state, event('1', 'sms'));
    expect(b.state.variables.assunto).toBe('hours');
    expect(b.actions[0]).toMatchObject({ message: { text: expect.stringContaining('segunda') } });
  });
  it('detects orphan nodes, missing variables and invalid regex', () => {
    const g = blankGraph();
    g.nodes.push({ id: 'orphan', type: 'message', data: { text: '{{vars.missing}}' } });
    g.triggers[0]!.match = 'regex';
    g.triggers[0]!.value = '(a+)+';
    expect(validateGraph(g).length).toBeGreaterThan(2);
  });
  it('renders variables without eval/prototype lookup', () => {
    expect(
      template('{{vars.constructor}} {{contact.first_name}}', initialState(), {
        first_name: 'Ana',
      }),
    ).toBe(' Ana');
  });
  it('validates Brazilian input types', () => {
    expect(validAnswer('529.982.247-25', 'cpf')).toBe(true);
    expect(validAnswer('11.222.333/0001-81', 'cnpj')).toBe(true);
    expect(validAnswer('31/02/2026', 'date')).toBe(false);
    expect(validAnswer('+5511999999999', 'phone')).toBe(true);
  });
});
