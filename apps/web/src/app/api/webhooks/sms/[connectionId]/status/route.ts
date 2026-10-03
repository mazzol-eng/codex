import { smsWebhook } from '@/lib/sms-webhook';
export async function POST(
  request: Request,
  { params }: { params: Promise<{ connectionId: string }> },
) {
  return smsWebhook(request, (await params).connectionId, true);
}
