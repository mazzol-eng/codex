export type Channel = 'simulator' | 'telegram' | 'whatsapp' | 'sms';
export interface InboundEvent {
  channel: Channel;
  connectionId: string;
  externalContactId: string;
  externalMessageId: string;
  type: 'text' | 'button_reply' | 'list_reply' | 'media' | 'location';
  text?: string;
  payload?: unknown;
  timestamp: string;
}
export interface OutboundMessage {
  type: 'text' | 'media' | 'buttons' | 'list';
  text: string;
  choices?: { id: string; label: string }[];
}
export interface ChannelAdapter {
  readonly channel: Channel;
  readonly capabilities: {
    buttons: boolean;
    lists: boolean;
    media: boolean;
    readReceipts: boolean;
  };
  validateCredentials(credentials: Record<string, string>): Promise<boolean>;
  verifyWebhook(body: string, headers: Record<string, string>): boolean;
  normalize(body: unknown, connectionId: string): InboundEvent[];
  send(
    contactId: string,
    message: OutboundMessage,
  ): Promise<{ externalId: string; status: 'sent' | 'failed' }>;
}
// Real channel adapters and simulator arrive in Phase 2/3.
