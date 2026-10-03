export type ContactFilters = {
  search?: string;
  tag?: string;
  channel?: 'whatsapp' | 'telegram' | 'sms' | 'simulator';
  consent?: boolean;
  marketingConsent?: boolean;
};
export type ContactRecord = {
  id: string;
  name: string;
  channel: string;
  connectionId: string | null;
  externalContactId: string | null;
  email: string | null;
  phone: string | null;
  tags: string[];
  fields: Record<string, string | number | boolean>;
  consent: boolean;
  marketingConsent: boolean;
  consentSource: string | null;
  marketingSource: string | null;
  createdAt: string;
  connection: { name: string; mode: string } | null;
  consentRecords?: {
    id: string;
    scope: string;
    granted: boolean;
    source: string;
    createdAt: string;
  }[];
  conversations?: {
    id: string;
    messages: { id: string; direction: string; content: { text?: string }; createdAt: string }[];
  }[];
};
export type ContactPage = {
  items: ContactRecord[];
  total: number;
  page: number;
  summary: { all: number; subscribed: number; optedOut: number; limit: number };
};
export type SegmentRecord = { id: string; name: string; filters: ContactFilters; count: number };
export type WhatsAppTemplateRecord = {
  id: string;
  connectionId: string;
  name: string;
  language: string;
  category: string;
  body: string;
  status: string;
  supported: boolean;
  connection: { name: string; mode: string };
};
export type CampaignStats = {
  total: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  skipped: number;
  pending: number;
};
export type CampaignRecord = {
  id: string;
  name: string;
  connectionId: string;
  status: string;
  content: { text: string; type: string };
  connection: { name: string; channel: string; mode: string };
  stats: CampaignStats;
  estimatedCostCents: number;
  scheduledAt: string | null;
  createdAt: string;
  replies?: number;
  recipients?: {
    id: string;
    status: string;
    reason: string | null;
    segments: number;
    contact: { name: string; channel: string };
    message: { status: string; lastError: string | null } | null;
  }[];
};
export type CampaignPreview = {
  total: number;
  eligible: number;
  blocked: number;
  segments: number;
  estimatedCostCents: number;
  digest: string;
  mode: string;
  channel: string;
  samples: { name: string; message: { text: string }; segments: number }[];
};
