import type { FlowGraph } from '@bothub/flow-engine';
export type Version = { id: string; number: number; createdAt: string };
export type Connection = {
  id: string;
  name: string;
  channel: string;
  status: string;
  botId: string | null;
  mode: string;
  externalAccountId?: string | null;
  settings?: { smsPriceCents?: number };
  createdAt: string;
};
export type BotRecord = {
  id: string;
  name: string;
  description: string;
  status: string;
  draft: FlowGraph;
  draftRevision: number;
  settings: Record<string, string>;
  versions: Version[];
  connections: Connection[];
  createdAt: string;
  conversations: number;
  completionRate: number;
};
export type ConversationRecord = {
  id: string;
  mode: string;
  status: string;
  channel: string;
  unread: number;
  assignedUserId: string | null;
  updatedAt: string;
  lastInboundAt: string | null;
  connection: { id: string; name: string } | null;
  contact: {
    id: string;
    name: string;
    channel: string;
    consent: boolean;
    tags: string[];
    consentSource?: string | null;
    consentAt?: string | null;
  };
  messages: MessageRecord[];
  runs?: { id: string; trace: { nodeId: string; status: string }[]; errors: string[] }[];
};
export type MessageRecord = {
  id?: string;
  direction: string;
  status?: string;
  content: {
    text?: string;
    type?: string;
    mediaUrl?: string;
    choices?: { id: string; label: string }[];
  };
  createdAt: string;
};
