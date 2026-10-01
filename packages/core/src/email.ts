export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}
export interface EmailPort {
  send(message: EmailMessage): Promise<void>;
}
export class FakeEmail implements EmailPort {
  readonly messages: EmailMessage[] = [];
  async send(message: EmailMessage) {
    this.messages.push(message);
  }
}
export class HttpEmail implements EmailPort {
  constructor(
    private endpoint: string,
    private apiKey: string,
    private from: string,
  ) {}
  async send(message: EmailMessage) {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: this.from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error('Email delivery failed');
  }
}
