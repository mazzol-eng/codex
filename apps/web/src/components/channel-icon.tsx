import { MessageCircle, Send, Smartphone, FlaskConical } from 'lucide-react';
export function ChannelIcon({ channel, size = 16 }: { channel: string; size?: number }) {
  const Icon =
    channel === 'whatsapp'
      ? MessageCircle
      : channel === 'telegram'
        ? Send
        : channel === 'sms'
          ? Smartphone
          : FlaskConical;
  return <Icon size={size} className={`channel-${channel}`} aria-hidden="true" />;
}
export function channelLabel(channel: string) {
  return (
    (
      { whatsapp: 'WhatsApp', telegram: 'Telegram', sms: 'SMS', simulator: 'Simulador' } as Record<
        string,
        string
      >
    )[channel] ?? channel
  );
}
