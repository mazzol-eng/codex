// Execution will be implemented in Phase 2. No database or network dependencies.
export type FlowNode = {
  id: string;
  type: 'message' | 'question' | 'condition' | 'wait' | 'handoff' | 'end';
  data: Record<string, unknown>;
};
export type FlowGraph = {
  nodes: FlowNode[];
  edges: { source: string; target: string; handle?: string }[];
};
