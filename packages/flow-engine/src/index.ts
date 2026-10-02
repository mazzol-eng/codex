import { z } from 'zod';
import type { Channel, InboundEvent, OutboundMessage } from '@bothub/channels';
export const nodeTypes = [
  'message',
  'question',
  'buttons',
  'list',
  'condition',
  'wait',
  'action',
  'handoff',
  'end',
] as const;
const choiceSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,24}$/),
  label: z.string().min(1).max(80),
});
export const nodeDataSchema = z
  .object({
    label: z.string().max(100).optional(),
    text: z.string().max(4000).optional(),
    variable: z
      .string()
      .regex(/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/)
      .optional(),
    validation: z
      .enum(['text', 'number', 'email', 'phone', 'cpf', 'cnpj', 'date', 'choice'])
      .optional(),
    choices: z.array(choiceSchema).max(10).optional(),
    errorText: z.string().max(300).optional(),
    maxAttempts: z.number().int().min(1).max(10).optional(),
    timeoutSeconds: z.number().int().min(1).max(604800).optional(),
    operator: z.enum(['equals', 'contains', 'greater', 'exists']).optional(),
    value: z.string().max(500).optional(),
    field: z.enum(['variable', 'tag', 'channel', 'contact']).optional(),
    seconds: z.number().int().min(1).max(604800).optional(),
    action: z.enum(['set_variable', 'add_tag', 'remove_tag']).optional(),
    mediaType: z.enum(['image', 'video', 'audio', 'document']).optional(),
    mediaUrl: z
      .string()
      .url()
      .max(2000)
      .refine((value) => value.startsWith('https://'), 'Use uma URL HTTPS.')
      .optional(),
  })
  .strict();
export const graphSchema = z
  .object({
    nodes: z
      .array(
        z.object({
          id: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),
          type: z.enum(nodeTypes),
          data: nodeDataSchema,
          position: z
            .object({
              x: z.number().min(-100000).max(100000),
              y: z.number().min(-100000).max(100000),
            })
            .optional(),
        }),
      )
      .min(1)
      .max(100),
    edges: z
      .array(
        z.object({
          source: z.string().max(64),
          target: z.string().max(64),
          handle: z.string().max(64).optional(),
        }),
      )
      .max(300),
    triggers: z
      .array(
        z.object({
          type: z.enum([
            'first_message',
            'keyword',
            'command',
            'button',
            'schedule',
            'webhook',
            'tag',
          ]),
          value: z.string().max(200).optional(),
          match: z.enum(['exact', 'contains', 'regex']).optional(),
          priority: z.number().int().min(0).max(100).default(0),
          nodeId: z.string().max(64),
        }),
      )
      .min(1)
      .max(20),
  })
  .strict();
export type FlowGraph = z.infer<typeof graphSchema>;
export type FlowNode = FlowGraph['nodes'][number];
export type SessionState = {
  variables: Record<string, string>;
  tags: string[];
  currentNodeId?: string;
  waiting?: {
    nodeId: string;
    attempts: number;
    expiresAt?: number;
    kind: 'answer' | 'delay';
    resumeNodeId?: string;
  };
  mode: 'bot' | 'human';
  optedOut: boolean;
  started: boolean;
  ended: boolean;
};
export type EngineAction =
  | { type: 'send'; message: OutboundMessage }
  | { type: 'wait'; seconds: number }
  | { type: 'handoff' }
  | { type: 'consent'; value: boolean };
export type EngineResult = {
  state: SessionState;
  actions: EngineAction[];
  trace: { nodeId: string; status: 'ok' | 'error'; error?: string }[];
  errors: string[];
};
export function initialState(): SessionState {
  return { variables: {}, tags: [], mode: 'bot', optedOut: false, started: false, ended: false };
}
const blockedKeys = new Set(['__proto__', 'prototype', 'constructor']);
export function template(text: string, state: SessionState, contact: Record<string, string> = {}) {
  return text.replace(
    /\{\{\s*(vars|contact)\.([a-zA-Z0-9_]+)\s*\}\}/g,
    (_, scope: string, key: string) => {
      if (blockedKeys.has(key)) return '';
      const values = scope === 'vars' ? state.variables : contact;
      return Object.hasOwn(values, key) ? String(values[key] ?? '') : '';
    },
  );
}
function fiscal(value: string, size: number) {
  const digits = value.replace(/\D/g, '');
  if (digits.length !== size || /^(\d)\1+$/.test(digits)) return false;
  for (let stage = size - 2; stage < size; stage++) {
    let sum = 0;
    for (let i = 0; i < stage; i++) {
      const weight = size === 11 ? stage + 1 - i : ((stage - 1 - i) % 8) + 2;
      sum += Number(digits[i]) * weight;
    }
    const remainder = sum % 11;
    const check = size === 11 ? ((sum * 10) % 11) % 10 : remainder < 2 ? 0 : 11 - remainder;
    if (check !== Number(digits[stage])) return false;
  }
  return true;
}
export function validAnswer(
  value: string,
  validation: string = 'text',
  choices: { id: string; label: string }[] = [],
): boolean {
  if (!value.trim() || value.length > 2000) return false;
  switch (validation) {
    case 'number':
      return /^-?\d+(?:[.,]\d+)?$/.test(value.trim());
    case 'email':
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    case 'phone':
      return /^\+[1-9]\d{7,14}$/.test(value.replace(/[\s()-]/g, ''));
    case 'cpf':
      return fiscal(value, 11);
    case 'cnpj':
      return fiscal(value, 14);
    case 'date': {
      const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
      if (!m) return false;
      const d = new Date(`${m[3]}-${m[2]}-${m[1]}T12:00:00Z`);
      return (
        Number.isFinite(d.getTime()) &&
        d.getUTCDate() === Number(m[1]) &&
        d.getUTCMonth() + 1 === Number(m[2])
      );
    }
    case 'choice':
      return choices.some((c) => c.id === value || c.label.toLowerCase() === value.toLowerCase());
    default:
      return true;
  }
}
// Restrict regex to linear, bounded patterns. Repeating groups/backreferences/lookaround are rejected.
export function safePattern(pattern: string): boolean {
  return (
    pattern.length <= 200 &&
    !/[(){}|]|\\[1-9]/.test(pattern) &&
    (pattern.match(/[+*?]/g) ?? []).length <= 1
  );
}
function triggerMatches(
  t: FlowGraph['triggers'][number],
  event: InboundEvent,
  state: SessionState,
) {
  const text = (event.text ?? '').slice(0, 2000),
    value = t.value ?? '';
  switch (t.type) {
    case 'first_message':
      return !state.started;
    case 'command':
      return text.toLowerCase() === value.toLowerCase();
    case 'keyword':
      if (t.match === 'regex') {
        try {
          return safePattern(value) && new RegExp(value, 'iu').test(text);
        } catch {
          return false;
        }
      }
      return t.match === 'contains'
        ? text.toLowerCase().includes(value.toLowerCase())
        : text.toLowerCase() === value.toLowerCase();
    case 'button':
      return event.type === 'button_reply' && event.payload === value;
    case 'schedule':
    case 'webhook':
    case 'tag':
      return event.payload === `${t.type}:${value}`;
  }
}
export function validateGraph(graph: FlowGraph): { nodeId?: string; message: string }[] {
  const issues: { nodeId?: string; message: string }[] = [];
  const ids = new Set(graph.nodes.map((n) => n.id));
  if (ids.size !== graph.nodes.length)
    issues.push({ message: 'Há identificadores de nós repetidos.' });
  for (const e of graph.edges)
    if (!ids.has(e.source) || !ids.has(e.target))
      issues.push({ message: 'Há uma ligação com nó inexistente.' });
  for (const t of graph.triggers) {
    if (!ids.has(t.nodeId)) issues.push({ message: 'O início do fluxo não existe.' });
    if (
      t.match === 'regex' &&
      (!safePattern(t.value ?? '') ||
        !(() => {
          try {
            new RegExp(t.value ?? '', 'iu');
            return true;
          } catch {
            return false;
          }
        })())
    )
      issues.push({ message: 'A expressão de gatilho não é segura ou válida.' });
  }
  const reachable = new Set<string>();
  const visit = (id: string) => {
    if (reachable.has(id)) return;
    reachable.add(id);
    graph.edges.filter((e) => e.source === id).forEach((e) => visit(e.target));
  };
  graph.triggers.forEach((t) => visit(t.nodeId));
  const endings = new Set(
    graph.nodes.filter((n) => n.type === 'end' || n.type === 'handoff').map((n) => n.id),
  );
  let changed = true;
  while (changed) {
    changed = false;
    for (const e of graph.edges)
      if (endings.has(e.target) && !endings.has(e.source)) {
        endings.add(e.source);
        changed = true;
      }
  }
  const declared = new Set(
    graph.nodes
      .filter(
        (n) =>
          n.type === 'question' || n.type === 'buttons' || n.type === 'list' || n.type === 'action',
      )
      .map((n) => n.data.variable)
      .filter(Boolean),
  );
  for (const n of graph.nodes) {
    if (!reachable.has(n.id))
      issues.push({ nodeId: n.id, message: 'Nó sem caminho a partir do início.' });
    if (!endings.has(n.id))
      issues.push({ nodeId: n.id, message: 'Este caminho não chega ao fim.' });
    if (['message', 'question', 'buttons', 'list'].includes(n.type) && !n.data.text?.trim())
      issues.push({ nodeId: n.id, message: 'Escreva uma mensagem.' });
    if (
      ['question', 'buttons', 'list'].includes(n.type) &&
      (!n.data.variable || blockedKeys.has(n.data.variable))
    )
      issues.push({ nodeId: n.id, message: 'Escolha uma variável válida para a resposta.' });
    if (
      (n.type === 'buttons' || n.type === 'list') &&
      (!n.data.choices?.length ||
        new Set(n.data.choices.map((c) => c.id)).size !== n.data.choices.length)
    )
      issues.push({ nodeId: n.id, message: 'Adicione opções com IDs únicos.' });
    if (
      n.type === 'condition' &&
      !graph.edges.some((e) => e.source === n.id && e.handle === 'true')
    )
      issues.push({ nodeId: n.id, message: 'Conecte o caminho Sim.' });
    if (
      n.type === 'condition' &&
      !graph.edges.some((e) => e.source === n.id && e.handle === 'false')
    )
      issues.push({ nodeId: n.id, message: 'Conecte o caminho Não.' });
    for (const key of (n.data.text ?? '').matchAll(/\{\{\s*vars\.([a-zA-Z0-9_]+)\s*\}\}/g))
      if (!declared.has(key[1]))
        issues.push({ nodeId: n.id, message: `Variável ${key[1]} não foi definida.` });
  }
  return issues;
}
export function runFlow(
  graph: FlowGraph,
  previous: SessionState,
  event: InboundEvent,
  options: {
    now?: number;
    maxSteps?: number;
    contact?: Record<string, string>;
    lastInboundAt?: number;
  } = {},
): EngineResult {
  const state: SessionState = structuredClone(previous);
  const now = options.now ?? Date.parse(event.timestamp);
  const actions: EngineAction[] = [],
    trace: EngineResult['trace'] = [],
    errors: string[] = [];
  const result = () => ({ state, actions, trace, errors });
  const send = (message: OutboundMessage) => {
    if (
      event.channel === 'whatsapp' &&
      options.lastInboundAt !== undefined &&
      now - options.lastInboundAt > 86400000 &&
      !message.templateName
    ) {
      errors.push('whatsapp_window_expired');
      return;
    }
    actions.push({ type: 'send', message });
  };
  const text = (value: string) => template(value, state, options.contact);
  if (/^(PARAR|SAIR|STOP|CANCELAR)$/i.test(event.text?.trim() ?? '')) {
    state.optedOut = true;
    state.waiting = undefined;
    state.ended = true;
    actions.push({ type: 'consent', value: false });
    send({
      type: 'text',
      text: 'Você foi descadastrado neste canal. Não enviaremos novas mensagens.',
      purpose: 'optout_confirmation',
    });
    return result();
  }
  if (state.optedOut || state.mode === 'human') return result();
  const next = (id: string, handle?: string) =>
    graph.edges.find(
      (e) =>
        e.source === id && (handle ? e.handle === handle : !e.handle || e.handle === 'default'),
    )?.target;
  let cursor: string | undefined;
  if (state.waiting) {
    const waiting = state.waiting,
      node = graph.nodes.find((n) => n.id === waiting.nodeId);
    if (!node) {
      errors.push('waiting_node_missing');
      state.waiting = undefined;
      return result();
    }
    if (waiting.kind === 'delay') {
      if (now < (waiting.expiresAt ?? 0)) return result();
      cursor = waiting.resumeNodeId;
      state.waiting = undefined;
    } else if (waiting.expiresAt !== undefined && now >= waiting.expiresAt) {
      cursor = next(node.id, 'timeout') ?? next(node.id, 'error');
      state.waiting = undefined;
      if (!cursor) {
        state.ended = true;
        errors.push('answer_timeout');
        return result();
      }
    } else {
      let answer = String(event.payload ?? event.text ?? '').trim();
      const choices = node.data.choices ?? [];
      if (event.channel === 'sms' && /^\d+$/.test(answer))
        answer = choices[Number(answer) - 1]?.id ?? answer;
      const byLabel = choices.find((c) => c.label.toLowerCase() === answer.toLowerCase());
      if (byLabel) answer = byLabel.id;
      if (
        !validAnswer(
          answer,
          node.type === 'question'
            ? node.data.validation
            : node.type === 'buttons' || node.type === 'list'
              ? 'choice'
              : 'text',
          choices,
        )
      ) {
        waiting.attempts++;
        send({
          type: 'text',
          text:
            node.data.errorText ?? 'Não consegui entender. Revise sua resposta e tente de novo.',
        });
        if (waiting.attempts < (node.data.maxAttempts ?? 3)) return result();
        cursor = next(node.id, 'error');
        state.waiting = undefined;
        if (!cursor) {
          state.ended = true;
          errors.push('max_attempts');
          return result();
        }
      } else {
        if (node.data.variable && !blockedKeys.has(node.data.variable))
          state.variables[node.data.variable] = answer;
        cursor = next(node.id, choices.length ? answer : undefined) ?? next(node.id);
        state.waiting = undefined;
      }
    }
  } else {
    const trigger = [...graph.triggers]
      .sort((a, b) => b.priority - a.priority)
      .find((t) => triggerMatches(t, event, state));
    if (!trigger) return result();
    cursor = trigger.nodeId;
    state.started = true;
    state.ended = false;
  }
  for (let count = 0; cursor; count++) {
    if (count >= Math.min(options.maxSteps ?? 100, 100)) {
      errors.push('step_limit');
      state.ended = true;
      state.currentNodeId = undefined;
      break;
    }
    const node = graph.nodes.find((n) => n.id === cursor);
    if (!node) {
      errors.push('node_missing');
      state.ended = true;
      break;
    }
    state.currentNodeId = node.id;
    try {
      let target = next(node.id);
      switch (node.type) {
        case 'message':
          send({
            type: node.data.mediaUrl ? 'media' : 'text',
            text: text(node.data.text ?? ''),
            ...(node.data.mediaUrl
              ? { mediaUrl: node.data.mediaUrl, mediaType: node.data.mediaType ?? 'image' }
              : {}),
          });
          break;
        case 'question':
        case 'buttons':
        case 'list':
          send({
            type: node.type === 'question' ? 'text' : node.type,
            text: text(node.data.text ?? ''),
            choices: node.data.choices,
          });
          state.waiting = {
            nodeId: node.id,
            attempts: 0,
            kind: 'answer',
            ...(node.data.timeoutSeconds
              ? { expiresAt: now + node.data.timeoutSeconds * 1000 }
              : {}),
          };
          target = undefined;
          break;
        case 'condition': {
          const actual =
            node.data.field === 'channel'
              ? event.channel
              : node.data.field === 'tag'
                ? String(state.tags.includes(node.data.variable ?? node.data.value ?? ''))
                : node.data.field === 'contact'
                  ? options.contact?.[node.data.variable ?? '']
                  : state.variables[node.data.variable ?? ''];
          const wanted = text(node.data.value ?? '');
          const passed =
            node.data.operator === 'exists'
              ? !!actual
              : node.data.operator === 'contains'
                ? String(actual ?? '').includes(wanted)
                : node.data.operator === 'greater'
                  ? Number(actual) > Number(wanted)
                  : String(actual ?? '') === wanted;
          target = next(node.id, passed ? 'true' : 'false');
          break;
        }
        case 'action':
          if (
            node.data.action === 'set_variable' &&
            node.data.variable &&
            !blockedKeys.has(node.data.variable)
          )
            state.variables[node.data.variable] = text(node.data.value ?? '');
          else if (node.data.action === 'add_tag')
            state.tags = [...new Set([...state.tags, text(node.data.value ?? '')])];
          else if (node.data.action === 'remove_tag')
            state.tags = state.tags.filter((t) => t !== text(node.data.value ?? ''));
          break;
        case 'wait': {
          const seconds = node.data.seconds ?? 60;
          state.waiting = {
            nodeId: node.id,
            kind: 'delay',
            attempts: 0,
            expiresAt: now + seconds * 1000,
            resumeNodeId: target,
          };
          actions.push({ type: 'wait', seconds });
          target = undefined;
          break;
        }
        case 'handoff':
          state.mode = 'human';
          state.waiting = undefined;
          actions.push({ type: 'handoff' });
          if (node.data.text) send({ type: 'text', text: text(node.data.text) });
          target = undefined;
          break;
        case 'end':
          state.ended = true;
          state.currentNodeId = undefined;
          target = undefined;
          break;
      }
      trace.push({ nodeId: node.id, status: 'ok' });
      cursor = target;
    } catch {
      trace.push({ nodeId: node.id, status: 'error', error: 'node_execution_failed' });
      errors.push('node_execution_failed');
      cursor = next(node.id, 'error');
    }
  }
  if (!state.waiting && state.mode === 'bot' && !cursor) {
    state.ended = true;
    state.currentNodeId = undefined;
  }
  return result();
}
export type { Channel };
export { botTemplates, blankGraph } from './templates';
