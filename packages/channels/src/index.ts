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
  contactName?: string;
  callbackQueryId?: string;
}
export interface OutboundMessage {
  type: 'text' | 'media' | 'buttons' | 'list';
  text: string;
  choices?: { id: string; label: string }[];
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'audio' | 'document';
  templateName?: string;
  templateLanguage?: string;
  templateParameters?: string[];
  purpose?: 'optout_confirmation';
}
export interface ChannelCapabilities {
  buttons: boolean;
  lists: boolean;
  media: boolean;
  readReceipts: boolean;
}
export interface ChannelAdapter {
  readonly channel: Channel;
  readonly capabilities: ChannelCapabilities;
  validateCredentials(credentials: Record<string, string>): Promise<boolean>;
  verifyWebhook(body: string, headers: Record<string, string>): boolean;
  normalize(body: unknown, connectionId: string): InboundEvent[];
  send(
    contactId: string,
    message: OutboundMessage,
  ): Promise<{ externalId: string; status: 'sent' | 'failed' }>;
  acknowledge?(event: InboundEvent): Promise<void>;
  interpretStatus(payload: unknown): 'sent' | 'delivered' | 'read' | 'failed' | undefined;
  normalizeStatuses?(payload: unknown): ChannelStatus[];
}
export interface ChannelStatus {
  externalMessageId: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
}
export function measureSms(text: string) {
  const basic = new Set(
    Array.from(
      '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà',
    ),
  );
  const extended = new Set(Array.from('\f^{}\\[~]|€'));
  const characters = Array.from(text);
  const gsm = characters.every((char) => basic.has(char) || extended.has(char));
  const units = gsm
    ? characters.reduce((n, char) => n + (extended.has(char) ? 2 : 1), 0)
    : text.length;
  const single = gsm ? 160 : 70;
  return {
    encoding: gsm ? ('GSM-7' as const) : ('UCS-2' as const),
    characters: characters.length,
    units,
    segments: units === 0 ? 0 : units <= single ? 1 : Math.ceil(units / (gsm ? 153 : 67)),
  };
}
export function degradeMessage(channel: Channel, message: OutboundMessage): OutboundMessage {
  const choices = message.choices ?? [];
  if (channel === 'sms' && (message.type === 'buttons' || message.type === 'list'))
    return {
      type: 'text',
      text: `${message.text}\n${choices.map((c, i) => `${i + 1}. ${c.label}`).join('\n')}\nResponda ${choices.map((_, i) => i + 1).join(', ')}.`,
    };
  if (channel === 'whatsapp' && choices.length > 3)
    return { ...message, type: 'list', choices: choices.slice(0, 10) };
  return message;
}
