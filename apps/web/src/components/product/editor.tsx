'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  applyNodeChanges,
  applyEdgeChanges,
  type Node,
  type Edge,
  type NodeProps,
  type Connection as FlowConnection,
  type NodeChange,
  type EdgeChange,
  BackgroundVariant,
} from '@xyflow/react';
import dagre from '@dagrejs/dagre';
import '@xyflow/react/dist/style.css';
import {
  graphSchema,
  validateGraph,
  type FlowGraph,
  type FlowNode,
  type EngineResult,
  nodeTypes,
} from '@bothub/flow-engine';
import {
  MessageSquare,
  HelpCircle,
  GitBranch,
  Clock,
  UserRound,
  Flag,
  MousePointerClick,
  List,
  Zap,
  Plus,
  ArrowLeft,
  Undo2,
  Redo2,
  Workflow,
  FlaskConical,
  Upload,
  History,
  Check,
  AlertCircle,
  Trash2,
  ChevronDown,
  Save,
  LockKeyhole,
  X,
  Play,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ProductDialog } from './shared';
import { Simulator } from './simulator';
import { ProductClientError, productRequest, workspaceUrl } from '@/lib/product-client';
import type { BotRecord } from './types';
const descriptions: Record<
  FlowNode['type'],
  { label: string; icon: typeof MessageSquare; className: string }
> = {
  message: { label: 'Mensagem', icon: MessageSquare, className: 'node-message' },
  question: { label: 'Perguntar', icon: HelpCircle, className: 'node-question' },
  buttons: { label: 'Botões', icon: MousePointerClick, className: 'node-buttons' },
  list: { label: 'Lista', icon: List, className: 'node-buttons' },
  condition: { label: 'Condição', icon: GitBranch, className: 'node-condition' },
  wait: { label: 'Aguardar', icon: Clock, className: 'node-wait' },
  action: { label: 'Ação', icon: Zap, className: 'node-action' },
  handoff: { label: 'Chamar equipe', icon: UserRound, className: 'node-handoff' },
  end: { label: 'Encerrar', icon: Flag, className: 'node-end' },
};
type CanvasNode = Node<
  { flow: FlowNode; traversed: boolean; issue: boolean; start: boolean },
  'flow'
>;
function FlowCard({ data, selected }: NodeProps<CanvasNode>) {
  const { flow, traversed, issue, start } = data,
    descriptor = descriptions[flow.type],
    Icon = descriptor.icon;
  const handles =
    flow.type === 'condition'
      ? [
          { id: 'true', label: 'Sim' },
          { id: 'false', label: 'Não' },
        ]
      : flow.type === 'buttons' || flow.type === 'list'
        ? (flow.data.choices ?? [])
        : flow.type === 'end' || flow.type === 'handoff'
          ? []
          : [{ id: 'default', label: 'Continuar' }];
  return (
    <div
      className={`flow-node ${descriptor.className} ${selected ? 'selected' : ''} ${traversed ? 'traversed' : ''} ${issue ? 'has-issue' : ''}`}
    >
      <Handle type="target" position={Position.Top} />
      {start && (
        <span className="flow-start-label">
          <Play size={9} />
          Início
        </span>
      )}
      <div className="flow-node-heading">
        <Icon size={15} />
        <strong>{flow.data.label || descriptor.label}</strong>
        {issue && <AlertCircle size={13} />}
      </div>
      <div className="flow-node-body">
        <p>
          {flow.type === 'wait'
            ? `Aguardar ${flow.data.seconds ?? 60} segundos`
            : flow.type === 'condition'
              ? `${flow.data.variable ?? 'Variável'} ${flow.data.operator === 'equals' ? '=' : (flow.data.operator ?? '=')} ${flow.data.value ?? ''}`
              : flow.type === 'action'
                ? `${flow.data.action ?? 'Adicionar tag'}: ${flow.data.value ?? ''}`
                : flow.data.text?.slice(0, 100) || 'Personalize este passo'}
        </p>
        {flow.data.variable && <code>{`→ ${flow.data.variable}`}</code>}
        {handles.length > 1 && (
          <div className="node-choice-labels">
            {handles.map((h) => (
              <span key={h.id}>{h.label}</span>
            ))}
          </div>
        )}
      </div>
      {handles.map((h, i) => (
        <Handle
          key={h.id}
          type="source"
          id={h.id}
          position={Position.Bottom}
          style={{ left: `${(100 * (i + 1)) / (handles.length + 1)}%` }}
          title={h.label}
        />
      ))}
      {flow.type === 'question' && (
        <Handle
          type="source"
          id="timeout"
          position={Position.Left}
          title="Tempo esgotado"
          className="timeout-handle"
        />
      )}
      {['question', 'buttons', 'list'].includes(flow.type) && (
        <Handle
          type="source"
          id="error"
          position={Position.Right}
          title="Erro / tentativas esgotadas"
          className="error-handle"
        />
      )}
    </div>
  );
}
const nodeComponents = { flow: FlowCard };
function asNodes(
  graph: FlowGraph,
  trace: EngineResult['trace'],
  issues: ReturnType<typeof validateGraph>,
): CanvasNode[] {
  return graph.nodes.map((n, i) => ({
    id: n.id,
    type: 'flow',
    position: n.position ?? { x: 250, y: i * 160 },
    data: {
      flow: n,
      traversed: trace.some((t) => t.nodeId === n.id),
      issue: issues.some((t) => t.nodeId === n.id),
      start: graph.triggers.some((t) => t.nodeId === n.id),
    },
  }));
}
function asEdges(graph: FlowGraph): Edge[] {
  return graph.edges.map((e, i) => ({
    id: `edge-${e.source}-${e.target}-${e.handle ?? 'default'}-${i}`,
    source: e.source,
    target: e.target,
    sourceHandle: e.handle ?? 'default',
    animated: true,
    type: 'smoothstep',
    label:
      e.handle && e.handle !== 'default'
        ? e.handle === 'true'
          ? 'Sim'
          : e.handle === 'false'
            ? 'Não'
            : e.handle === 'error'
              ? 'Erro'
              : e.handle
        : undefined,
    style: { stroke: 'var(--primary)' },
    labelStyle: { fill: 'var(--muted)', fontSize: 10 },
    labelBgStyle: { fill: 'var(--surface)' },
  }));
}
export function FlowEditor({
  bot,
  workspaceId,
  canEdit,
}: {
  bot: BotRecord;
  workspaceId: string;
  canEdit: boolean;
}) {
  const router = useRouter(),
    [graph, setGraph] = useState<FlowGraph>(() => graphSchema.parse(bot.draft)),
    [selected, setSelected] = useState<string>(bot.draft.nodes[0]?.id ?? ''),
    [simulator, setSimulator] = useState(false),
    [trace, setTrace] = useState<EngineResult['trace']>([]),
    [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'dirty' | 'error'>('saved'),
    [versions, setVersions] = useState(false),
    [publishing, setPublishing] = useState(false),
    [showIssues, setShowIssues] = useState(false),
    [historyVersion, setHistoryVersion] = useState({ undo: 0, redo: 0 });
  const graphRef = useRef(graph),
    revision = useRef(bot.draftRevision),
    savedGraph = useRef(JSON.stringify(graph)),
    undo = useRef<FlowGraph[]>([]),
    redo = useRef<FlowGraph[]>([]),
    saving = useRef<Promise<void> | null>(null),
    blocked = useRef(false);
  const issues = validateGraph(graph),
    node = graph.nodes.find((n) => n.id === selected);
  const mutate = useCallback(
    (next: FlowGraph, remember = true) => {
      if (!canEdit) return;
      if (remember) {
        undo.current = [...undo.current.slice(-49), structuredClone(graphRef.current)];
        redo.current = [];
        setHistoryVersion({ undo: undo.current.length, redo: redo.current.length });
      }
      graphRef.current = next;
      setGraph(next);
      setSaveStatus('dirty');
    },
    [canEdit],
  );
  const save = useCallback(async () => {
    if (blocked.current) throw new Error('Recarregue o fluxo para continuar.');
    if (saving.current) await saving.current;
    const checked = graphSchema.safeParse(graphRef.current);
    if (!checked.success) {
      setSaveStatus('dirty');
      throw new Error('Revise os campos do nó antes de salvar.');
    }
    const snapshot = JSON.stringify(graphRef.current);
    if (snapshot === savedGraph.current) return;
    setSaveStatus('saving');
    const task = (async () => {
      try {
        const value = await productRequest<{ revision: number }>(
          workspaceUrl(`/api/bots/${bot.id}`, workspaceId),
          'PATCH',
          { action: 'save', graph: JSON.parse(snapshot), revision: revision.current },
        );
        revision.current = value.revision;
        savedGraph.current = snapshot;
        setSaveStatus(JSON.stringify(graphRef.current) === snapshot ? 'saved' : 'dirty');
      } catch (e) {
        blocked.current = e instanceof ProductClientError && e.status === 409;
        setSaveStatus('error');
        toast.error((e as Error).message);
        throw e;
      } finally {
        saving.current = null;
      }
    })();
    saving.current = task;
    await task;
  }, [bot.id, workspaceId]);
  useEffect(() => {
    if (!canEdit || JSON.stringify(graph) === savedGraph.current) return;
    const timer = setTimeout(() => {
      save().catch(() => {});
    }, 900);
    return () => clearTimeout(timer);
  }, [graph, canEdit, save]);
  useEffect(
    () => () => {
      if (canEdit) save().catch(() => {});
    },
    [save, canEdit],
  );
  function travel(direction: 'undo' | 'redo') {
    const from = direction === 'undo' ? undo : redo,
      to = direction === 'undo' ? redo : undo;
    const previous = from.current.pop();
    if (!previous) return;
    to.current.push(structuredClone(graphRef.current));
    mutate(previous, false);
    setHistoryVersion({ undo: undo.current.length, redo: redo.current.length });
  }
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input,textarea,select,[contenteditable]')) return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        travel(e.shiftKey ? 'redo' : 'undo');
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        save().catch(() => {});
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });
  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => {
      if (JSON.stringify(graphRef.current) !== savedGraph.current) e.preventDefault();
    };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, []);
  function updateData(fields: Partial<FlowNode['data']>) {
    mutate({
      ...graphRef.current,
      nodes: graphRef.current.nodes.map((n) =>
        n.id === selected ? { ...n, data: { ...n.data, ...fields } } : n,
      ),
    });
  }
  function addNode(type: FlowNode['type']) {
    const id = `n-${crypto.randomUUID().slice(0, 8)}`,
      newNode: FlowNode = {
        id,
        type,
        position: {
          x: graphRef.current.nodes.length % 2 ? 450 : 100,
          y: graphRef.current.nodes.length * 100,
        },
        data: {
          label: descriptions[type].label,
          ...(['message', 'question', 'buttons', 'list', 'handoff'].includes(type)
            ? {
                text:
                  type === 'handoff' ? 'Vou chamar nossa equipe.' : 'Escreva sua mensagem aqui.',
              }
            : {}),
          ...(['question', 'buttons', 'list'].includes(type)
            ? { variable: `resposta_${graphRef.current.nodes.length}`, validation: 'text' as const }
            : {}),
          ...(['buttons', 'list'].includes(type)
            ? {
                choices: [
                  { id: 'option1', label: 'Primeira opção' },
                  { id: 'option2', label: 'Segunda opção' },
                ],
              }
            : {}),
          ...(type === 'wait' ? { seconds: 60 } : {}),
          ...(type === 'condition'
            ? {
                field: 'variable' as const,
                variable: 'resposta',
                operator: 'equals' as const,
                value: '',
              }
            : {}),
          ...(type === 'action' ? { action: 'add_tag' as const, value: 'cliente' } : {}),
        },
      };
    mutate({ ...graphRef.current, nodes: [...graphRef.current.nodes, newNode] });
    setSelected(id);
  }
  function remove() {
    if (!node) return;
    mutate({
      ...graphRef.current,
      nodes: graphRef.current.nodes.filter((n) => n.id !== selected),
      edges: graphRef.current.edges.filter((e) => e.source !== selected && e.target !== selected),
      triggers: graphRef.current.triggers.filter((t) => t.nodeId !== selected),
    });
    setSelected('');
  }
  function layout() {
    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: 'TB', nodesep: 60, ranksep: 90 });
    g.setDefaultEdgeLabel(() => ({}));
    graph.nodes.forEach((n) => g.setNode(n.id, { width: 240, height: 130 }));
    graph.edges.forEach((e) => g.setEdge(e.source, e.target));
    dagre.layout(g);
    mutate({
      ...graph,
      nodes: graph.nodes.map((n) => ({
        ...n,
        position: { x: g.node(n.id).x - 120, y: g.node(n.id).y - 65 },
      })),
    });
  }
  async function publish() {
    setPublishing(true);
    try {
      await save();
      if (validateGraph(graphRef.current).length) {
        setShowIssues(true);
        return;
      }
      const result = await productRequest<{ number: number }>(
        workspaceUrl(`/api/bots/${bot.id}`, workspaceId),
        'PATCH',
        { action: 'publish', revision: revision.current },
      );
      toast.success(`Versão ${result.number} publicada. Seu bot está ativo.`);
      router.refresh();
    } catch (e) {
      if (saveStatus !== 'error') toast.error((e as Error).message);
    } finally {
      setPublishing(false);
    }
  }
  async function restore(id: string) {
    try {
      await save();
      const result = await productRequest<{ revision: number }>(
        workspaceUrl(`/api/bots/${bot.id}`, workspaceId),
        'PATCH',
        { action: 'restore', versionId: id, revision: revision.current },
      );
      const fresh = await productRequest<BotRecord>(
        workspaceUrl(`/api/bots/${bot.id}`, workspaceId),
      );
      revision.current = result.revision;
      savedGraph.current = JSON.stringify(fresh.draft);
      mutate(fresh.draft);
      setSaveStatus('saved');
      setVersions(false);
      toast.success('Versão restaurada no rascunho. Publique para ativar.');
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  const changeNodes = (changes: NodeChange<CanvasNode>[]) => {
    const relevant = changes.filter((c) => c.type === 'position' || c.type === 'remove');
    if (!relevant.length) return;
    const nodes = applyNodeChanges(relevant, asNodes(graphRef.current, [], []));
    mutate(
      {
        ...graphRef.current,
        nodes: nodes.map((n) => ({ ...n.data.flow, position: n.position })),
        edges: graphRef.current.edges.filter(
          (e) => nodes.some((n) => n.id === e.source) && nodes.some((n) => n.id === e.target),
        ),
      },
      !relevant.every((c) => c.type === 'position'),
    );
  };
  const changeEdges = (changes: EdgeChange[]) => {
    if (!changes.some((c) => c.type === 'remove')) return;
    const edges = applyEdgeChanges(changes, asEdges(graphRef.current));
    mutate({
      ...graphRef.current,
      edges: edges.map((e) => ({
        source: e.source,
        target: e.target,
        ...(e.sourceHandle && e.sourceHandle !== 'default' ? { handle: e.sourceHandle } : {}),
      })),
    });
  };
  const connect = (c: FlowConnection) => {
    const handle = c.sourceHandle === 'default' ? undefined : (c.sourceHandle ?? undefined);
    mutate({
      ...graphRef.current,
      edges: [
        ...graphRef.current.edges.filter(
          (e) => !(e.source === c.source && (e.handle ?? 'default') === (handle ?? 'default')),
        ),
        { source: c.source, target: c.target, handle },
      ],
    });
  };

  return (
    <div className="flow-editor">
      <header className="flow-editor-header">
        <div className="editor-title">
          <Link href={`/app/bots/${bot.id}`} aria-label="Voltar ao bot">
            <ArrowLeft size={18} />
          </Link>
          <span className="editor-bot-icon">
            <Workflow size={20} />
          </span>
          <div>
            <h1>{bot.name}</h1>
            <span>
              <i className={saveStatus === 'error' ? 'save-error' : ''} />
              {saveStatus === 'saved'
                ? 'Rascunho salvo'
                : saveStatus === 'saving'
                  ? 'Salvando...'
                  : saveStatus === 'error'
                    ? 'Erro ao salvar · tente novamente'
                    : 'Alterações pendentes'}
            </span>
          </div>
        </div>
        <div className="editor-header-actions">
          <button
            className="icon-control"
            title="Desfazer (Ctrl+Z)"
            aria-label="Desfazer"
            disabled={!canEdit || !historyVersion.undo}
            onClick={() => travel('undo')}
          >
            <Undo2 size={17} />
          </button>
          <button
            className="icon-control"
            title="Refazer (Ctrl+Shift+Z)"
            aria-label="Refazer"
            disabled={!canEdit || !historyVersion.redo}
            onClick={() => travel('redo')}
          >
            <Redo2 size={17} />
          </button>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Versões"
            title="Histórico de versões"
            onClick={() => setVersions(true)}
          >
            <History size={15} />
            <span>Versões</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setSimulator(!simulator)}>
            <FlaskConical size={15} />
            Testar
          </Button>
          <Button
            size="sm"
            disabled={!canEdit || publishing || saveStatus === 'error'}
            onClick={publish}
          >
            <Upload size={15} />
            {publishing ? 'Publicando...' : 'Publicar'}
          </Button>
        </div>
      </header>
      <div className="editor-subbar">
        <span>
          <GitBranch size={13} />
          Fluxo principal{' '}
          <Badge tone="neutral">
            {bot.versions[0] ? `v${bot.versions[0].number} publicada` : 'Não publicado'}
          </Badge>
        </span>
        <div>
          <button onClick={layout} disabled={!canEdit}>
            <Workflow size={14} />
            Organizar
          </button>
          <button
            onClick={() => setShowIssues(!showIssues)}
            className={issues.length ? 'validation-warning' : 'validation-ok'}
          >
            {issues.length ? <AlertCircle size={14} /> : <Check size={14} />}{' '}
            {issues.length ? `${issues.length} ajustes` : 'Fluxo validado'}
            <ChevronDown size={12} />
          </button>
        </div>
      </div>
      {showIssues && (
        <div className="editor-validation" role="status">
          {issues.length ? (
            issues.map((issue, i) => (
              <button
                key={i}
                onClick={() => {
                  if (issue.nodeId) setSelected(issue.nodeId);
                }}
              >
                <AlertCircle size={13} />
                {issue.message}
              </button>
            ))
          ) : (
            <span>
              <Check size={14} />
              Todos os caminhos estão prontos para publicar.
            </span>
          )}
        </div>
      )}
      <div className="editor-workspace">
        <aside className="flow-palette">
          <h2>Monte sua conversa</h2>
          <p>Adicione um passo e conecte os pontos.</p>
          <div>
            {nodeTypes.map((type) => {
              const entry = descriptions[type],
                Icon = entry.icon;
              return (
                <button
                  key={type}
                  disabled={!canEdit}
                  className={entry.className}
                  onClick={() => addNode(type)}
                >
                  <span>
                    <Icon size={16} />
                  </span>
                  {entry.label}
                  <Plus size={12} />
                </button>
              );
            })}
          </div>
          <div className="palette-upcoming">
            <LockKeyhole size={13} />
            <span>
              HTTP, IA e divisão A/B
              <br />
              Em breve
            </span>
          </div>
        </aside>
        <div className="flow-canvas" aria-label="Canvas do fluxo">
          <ReactFlow
            nodes={asNodes(graph, trace, issues).map((n) => ({
              ...n,
              selected: n.id === selected,
            }))}
            edges={asEdges(graph)}
            nodeTypes={nodeComponents}
            onNodesChange={changeNodes}
            onEdgesChange={changeEdges}
            onConnect={connect}
            onNodeClick={(_, n) => setSelected(n.id)}
            onNodeDragStart={() => {
              undo.current.push(structuredClone(graphRef.current));
              redo.current = [];
              setHistoryVersion({ undo: undo.current.length, redo: redo.current.length });
            }}
            ariaLabelConfig={{
              'controls.ariaLabel': 'Controles do fluxo',
              'controls.zoomIn.ariaLabel': 'Aumentar zoom',
              'controls.zoomOut.ariaLabel': 'Diminuir zoom',
              'controls.fitView.ariaLabel': 'Mostrar fluxo inteiro',
              'minimap.ariaLabel': 'Minimapa do fluxo',
              'node.a11yDescription.default':
                'Use as setas para mover o nó. Delete para excluir e Escape para sair.',
              'edge.a11yDescription.default': 'Pressione Delete para excluir esta ligação.',
            }}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            minZoom={0.25}
            maxZoom={1.5}
            nodesDraggable={canEdit}
            nodesConnectable={canEdit}
            elementsSelectable
            deleteKeyCode={canEdit ? ['Backspace', 'Delete'] : null}
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--border)" />
            <Controls showInteractive={false} />
            <MiniMap
              style={{ width: 115, height: 75 }}
              pannable
              zoomable
              nodeColor="var(--primary)"
              maskColor="transparent"
            />
          </ReactFlow>
          <div className="canvas-tip">
            Arraste para mover · Conecte os pontos para seguir a conversa
          </div>
        </div>
        {simulator ? (
          <Simulator graph={graph} onTrace={setTrace} onClose={() => setSimulator(false)} />
        ) : (
          <aside className="flow-properties">
            <div className="flow-panel-heading">
              <strong>{node ? 'Personalize este passo' : 'Seu fluxo'}</strong>
              {node && (
                <button
                  className="icon-control"
                  disabled={!canEdit}
                  onClick={remove}
                  aria-label="Excluir nó"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
            {node ? (
              <div className="product-form node-properties">
                <div className={`node-type-badge ${descriptions[node.type].className}`}>
                  {descriptions[node.type].label}
                </div>
                <label>
                  Nome do passo
                  <input
                    value={node.data.label ?? ''}
                    onChange={(e) => updateData({ label: e.target.value })}
                    maxLength={100}
                    disabled={!canEdit}
                  />
                </label>
                {['message', 'question', 'buttons', 'list', 'handoff'].includes(node.type) && (
                  <label>
                    Mensagem
                    <textarea
                      aria-label="Texto da mensagem"
                      value={node.data.text ?? ''}
                      onChange={(e) => updateData({ text: e.target.value })}
                      maxLength={4000}
                      rows={5}
                      disabled={!canEdit}
                    />
                    <span className="product-help">
                      {'Use {{contact.first_name}} ou {{vars.nome}} para personalizar.'}
                    </span>
                  </label>
                )}
                {node.type === 'message' && (
                  <>
                    <label>
                      Tipo de mensagem
                      <select
                        disabled={!canEdit}
                        value={node.data.mediaType ?? 'text'}
                        onChange={(e) =>
                          updateData(
                            e.target.value === 'text'
                              ? { mediaType: undefined, mediaUrl: undefined }
                              : {
                                  mediaType: e.target.value as 'image',
                                  mediaUrl: 'https://example.com/image.png',
                                },
                          )
                        }
                      >
                        <option value="text">Texto</option>
                        <option value="image">Imagem</option>
                        <option value="video">Vídeo</option>
                        <option value="audio">Áudio</option>
                        <option value="document">Documento</option>
                      </select>
                    </label>
                    {node.data.mediaType && (
                      <label>
                        Link público da mídia
                        <input
                          type="url"
                          value={node.data.mediaUrl ?? ''}
                          onChange={(e) => updateData({ mediaUrl: e.target.value })}
                          disabled={!canEdit}
                        />
                      </label>
                    )}
                  </>
                )}
                {['question', 'buttons', 'list', 'condition'].includes(node.type) && (
                  <label>
                    Salvar / consultar variável
                    <input
                      value={node.data.variable ?? ''}
                      onChange={(e) => updateData({ variable: e.target.value })}
                      maxLength={40}
                      disabled={!canEdit}
                      placeholder="Ex.: email"
                    />
                  </label>
                )}
                {node.type === 'question' && (
                  <>
                    <label>
                      Formato da resposta
                      <select
                        value={node.data.validation ?? 'text'}
                        onChange={(e) => updateData({ validation: e.target.value as 'text' })}
                        disabled={!canEdit}
                      >
                        {[
                          ['text', 'Texto'],
                          ['number', 'Número'],
                          ['email', 'E-mail'],
                          ['phone', 'Telefone (+55...)'],
                          ['cpf', 'CPF'],
                          ['cnpj', 'CNPJ'],
                          ['date', 'Data (dd/mm/aaaa)'],
                        ].map(([v, l]) => (
                          <option key={v} value={v}>
                            {l}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Mensagem se a resposta não for válida
                      <input
                        value={node.data.errorText ?? ''}
                        onChange={(e) => updateData({ errorText: e.target.value })}
                        maxLength={300}
                        disabled={!canEdit}
                        placeholder="Revise sua resposta e tente de novo."
                      />
                    </label>
                    <div className="property-pair">
                      <label>
                        Tentativas
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={node.data.maxAttempts ?? 3}
                          onChange={(e) => updateData({ maxAttempts: Number(e.target.value) || 3 })}
                          disabled={!canEdit}
                        />
                      </label>
                      <label>
                        Tempo limite (s)
                        <input
                          type="number"
                          min={1}
                          max={604800}
                          value={node.data.timeoutSeconds ?? 86400}
                          onChange={(e) =>
                            updateData({ timeoutSeconds: Number(e.target.value) || 86400 })
                          }
                          disabled={!canEdit}
                        />
                      </label>
                    </div>
                  </>
                )}
                {['buttons', 'list'].includes(node.type) && (
                  <>
                    <label>
                      Opções (uma por linha: id | rótulo)
                      <textarea
                        value={(node.data.choices ?? [])
                          .map((c) => `${c.id} | ${c.label}`)
                          .join('\n')}
                        onChange={(e) =>
                          updateData({
                            choices: e.target.value
                              .split('\n')
                              .filter(Boolean)
                              .slice(0, 10)
                              .map((line, i) => {
                                const [id, ...label] = line.split('|');
                                return {
                                  id: id?.trim() || `option${i + 1}`,
                                  label: label.join('|').trim() || 'Opção',
                                };
                              }),
                          })
                        }
                        rows={4}
                        disabled={!canEdit}
                      />
                    </label>
                    <p className="product-help">
                      Ligue cada opção ao próximo passo pelos pontos na parte inferior do nó. SMS
                      usa opções numeradas.
                    </p>
                  </>
                )}
                {node.type === 'condition' && (
                  <>
                    <label>
                      Comparar
                      <select
                        value={node.data.field ?? 'variable'}
                        onChange={(e) => updateData({ field: e.target.value as 'variable' })}
                        disabled={!canEdit}
                      >
                        <option value="variable">Variável</option>
                        <option value="channel">Canal</option>
                        <option value="tag">Tag (true / false)</option>
                        <option value="contact">Campo do contato</option>
                      </select>
                    </label>
                    <label>
                      Regra
                      <select
                        value={node.data.operator ?? 'equals'}
                        onChange={(e) => updateData({ operator: e.target.value as 'equals' })}
                        disabled={!canEdit}
                      >
                        <option value="equals">Igual a</option>
                        <option value="contains">Contém</option>
                        <option value="greater">Maior que</option>
                        <option value="exists">Está preenchido</option>
                      </select>
                    </label>
                    <label>
                      Valor
                      <input
                        value={node.data.value ?? ''}
                        onChange={(e) => updateData({ value: e.target.value })}
                        maxLength={500}
                        disabled={!canEdit}
                      />
                    </label>
                  </>
                )}
                {node.type === 'wait' && (
                  <label>
                    Aguardar por quantos segundos?
                    <input
                      type="number"
                      min={1}
                      max={604800}
                      value={node.data.seconds ?? 60}
                      onChange={(e) => updateData({ seconds: Number(e.target.value) || 60 })}
                      disabled={!canEdit}
                    />
                    <span className="product-help">60 segundos = 1 minuto · 86.400 = 1 dia.</span>
                  </label>
                )}
                {node.type === 'action' && (
                  <>
                    <label>
                      O que fazer?
                      <select
                        value={node.data.action ?? 'add_tag'}
                        onChange={(e) => updateData({ action: e.target.value as 'add_tag' })}
                        disabled={!canEdit}
                      >
                        <option value="add_tag">Adicionar tag</option>
                        <option value="remove_tag">Remover tag</option>
                        <option value="set_variable">Definir variável</option>
                      </select>
                    </label>
                    {node.data.action === 'set_variable' && (
                      <label>
                        Variável
                        <input
                          value={node.data.variable ?? ''}
                          onChange={(e) => updateData({ variable: e.target.value })}
                          disabled={!canEdit}
                        />
                      </label>
                    )}
                    <label>
                      Valor
                      <input
                        value={node.data.value ?? ''}
                        onChange={(e) => updateData({ value: e.target.value })}
                        maxLength={500}
                        disabled={!canEdit}
                      />
                    </label>
                  </>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!canEdit}
                  onClick={() => {
                    save().catch(() => {});
                  }}
                >
                  <Save size={14} />
                  Salvar agora
                </Button>
              </div>
            ) : (
              <p className="property-empty">Selecione um nó para editar suas mensagens.</p>
            )}
            <details className="flow-triggers">
              <summary>
                Como a conversa começa <ChevronDown size={13} />
              </summary>
              {graph.triggers.map((t, i) => (
                <div className="trigger-row" key={i}>
                  <select
                    aria-label={`Gatilho ${i + 1}`}
                    value={t.type}
                    disabled={!canEdit}
                    onChange={(e) =>
                      mutate({
                        ...graph,
                        triggers: graph.triggers.map((item, index) =>
                          index === i ? { ...item, type: e.target.value as 'keyword' } : item,
                        ),
                      })
                    }
                  >
                    <option value="first_message">Primeira mensagem</option>
                    <option value="command">Comando</option>
                    <option value="keyword">Palavra-chave</option>
                    <option value="button">Botão</option>
                  </select>
                  {t.type === 'keyword' && (
                    <select
                      aria-label={`Regra do gatilho ${i + 1}`}
                      value={t.match ?? 'exact'}
                      disabled={!canEdit}
                      onChange={(e) =>
                        mutate({
                          ...graph,
                          triggers: graph.triggers.map((item, index) =>
                            index === i ? { ...item, match: e.target.value as 'exact' } : item,
                          ),
                        })
                      }
                    >
                      <option value="exact">Palavra exata</option>
                      <option value="contains">Contém a palavra</option>
                      <option value="regex">Expressão segura</option>
                    </select>
                  )}
                  <label className="product-help">
                    Prioridade
                    <input
                      type="number"
                      min={0}
                      max={100}
                      aria-label={`Prioridade do gatilho ${i + 1}`}
                      value={t.priority}
                      disabled={!canEdit}
                      onChange={(e) =>
                        mutate({
                          ...graph,
                          triggers: graph.triggers.map((item, index) =>
                            index === i ? { ...item, priority: Number(e.target.value) } : item,
                          ),
                        })
                      }
                    />
                  </label>
                  {t.type !== 'first_message' && (
                    <input
                      aria-label={`Valor do gatilho ${i + 1}`}
                      value={t.value ?? ''}
                      onChange={(e) =>
                        mutate({
                          ...graph,
                          triggers: graph.triggers.map((item, index) =>
                            index === i ? { ...item, value: e.target.value } : item,
                          ),
                        })
                      }
                      disabled={!canEdit}
                    />
                  )}
                  <select
                    aria-label={`Nó inicial ${i + 1}`}
                    value={t.nodeId}
                    disabled={!canEdit}
                    onChange={(e) =>
                      mutate({
                        ...graph,
                        triggers: graph.triggers.map((item, index) =>
                          index === i ? { ...item, nodeId: e.target.value } : item,
                        ),
                      })
                    }
                  >
                    {graph.nodes.map((n) => (
                      <option value={n.id} key={n.id}>
                        {n.data.label ?? descriptions[n.type].label}
                      </option>
                    ))}
                  </select>
                  <button
                    className="trigger-remove"
                    disabled={!canEdit || graph.triggers.length === 1}
                    onClick={() =>
                      mutate({
                        ...graph,
                        triggers: graph.triggers.filter((_, index) => index !== i),
                      })
                    }
                  >
                    <Trash2 size={12} />
                    Remover gatilho
                  </button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                disabled={!canEdit || !graph.nodes.length || graph.triggers.length >= 20}
                onClick={() =>
                  mutate({
                    ...graph,
                    triggers: [
                      ...graph.triggers,
                      {
                        type: 'keyword',
                        value: 'oi',
                        match: 'exact',
                        priority: 0,
                        nodeId: graph.nodes[0]!.id,
                      },
                    ],
                  })
                }
              >
                <Plus size={12} />
                Adicionar gatilho
              </Button>
            </details>
          </aside>
        )}
      </div>
      <ProductDialog
        open={versions}
        onOpenChange={setVersions}
        title="Histórico de versões"
        description="Restaurar modifica o rascunho. Conversas em andamento mantêm a versão publicada que já usam."
      >
        {bot.versions.length ? (
          <div className="version-list">
            {bot.versions.map((v) => (
              <div key={v.id}>
                <span>
                  <strong>Versão {v.number}</strong>
                  <small>{new Date(v.createdAt).toLocaleString('pt-BR')}</small>
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!canEdit}
                  onClick={() => restore(v.id)}
                >
                  Restaurar rascunho
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="product-help">Publique seu fluxo para criar a primeira versão.</p>
        )}
        <Button variant="ghost" onClick={() => setVersions(false)}>
          <X size={14} />
          Fechar
        </Button>
      </ProductDialog>
    </div>
  );
}
