import { createHash } from 'node:crypto';
import { z } from 'zod';
import { db } from '@bothub/db';
import { WhatsAppAdapter, type WhatsAppCredentials } from '@bothub/channels/adapters';
import { adapterFor, type AdapterTransports } from './connections';
import { access, ProductError } from './bots';
export function templateVariables(body: string) {
  const ids = [...new Set([...body.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1])))].sort(
    (a, b) => a - b,
  );
  if (
    ids.length > 10 ||
    ids.some((id, i) => id !== i + 1) ||
    body.replace(/\{\{\d+\}\}/g, '').includes('{{')
  )
    throw new ProductError('Use variáveis sequenciais como {{1}}, {{2}} e até dez valores.');
  return ids.length;
}
export function templateFingerprint(t: { name: string; language: string; body: string }) {
  return createHash('sha256').update(`${t.name}\0${t.language}\0${t.body}`).digest('hex');
}
export const whatsappTemplateSchema = z
  .object({
    connectionId: z.string().min(1).max(80),
    name: z.string().regex(/^[a-z][a-z0-9_]{1,100}$/),
    language: z.enum(['pt_BR', 'en_US', 'es']),
    category: z.enum(['MARKETING', 'UTILITY']),
    body: z.string().trim().min(1).max(1024),
    examples: z.array(z.string().min(1).max(100)).max(10).default([]),
  })
  .strict();
export async function listWhatsAppTemplates(
  userId: string,
  workspaceId: string,
  connectionId?: string,
) {
  await access(userId, workspaceId);
  return db.whatsAppTemplate.findMany({
    where: { workspaceId, ...(connectionId ? { connectionId } : {}) },
    include: { connection: { select: { name: true, mode: true } } },
    orderBy: { updatedAt: 'desc' },
  });
}
async function connectionForTemplate(
  userId: string,
  workspaceId: string,
  id: string,
  transport?: AdapterTransports,
) {
  await access(userId, workspaceId, true);
  const c = await db.connection.findFirst({
    where: { workspaceId, id, channel: 'whatsapp', status: { in: ['connected', 'pending'] } },
  });
  if (!c) throw new ProductError('Escolha uma conexão WhatsApp desta empresa.');
  return { connection: c, adapter: adapterFor(c, transport) as WhatsAppAdapter };
}
export async function createWhatsAppTemplate(
  userId: string,
  workspaceId: string,
  value: z.input<typeof whatsappTemplateSchema>,
  transport?: AdapterTransports,
) {
  const input = whatsappTemplateSchema.parse(value);
  const { connection, adapter } = await connectionForTemplate(
    userId,
    workspaceId,
    input.connectionId,
    transport,
  );
  const n = templateVariables(input.body);
  if (n !== input.examples.length) throw new ProductError('Informe um exemplo para cada variável.');
  if (
    await db.whatsAppTemplate.findFirst({
      where: {
        workspaceId,
        connectionId: connection.id,
        name: input.name,
        language: input.language,
      },
    })
  )
    throw new ProductError('Esse nome e idioma já existem. Use outro nome.', 409);
  const result = z
    .object({ id: z.union([z.string(), z.number()]), status: z.string().optional() })
    .parse(
      await adapter.transport.request(
        'POST',
        `${adapter.credentials.wabaId}/message_templates`,
        adapter.credentials,
        {
          name: input.name,
          language: input.language,
          category: input.category,
          components: [
            {
              type: 'BODY',
              text: input.body,
              ...(n ? { example: { body_text: [input.examples] } } : {}),
            },
          ],
        },
      ),
    );
  const saved = await db.whatsAppTemplate.create({
    data: {
      workspaceId,
      connectionId: connection.id,
      externalId: String(result.id),
      name: input.name,
      language: input.language,
      category: input.category,
      body: input.body,
      status: connection.mode === 'fake' ? 'APPROVED' : 'PENDING',
    },
  });
  await db.auditLog.create({
    data: { workspaceId, actorId: userId, action: 'whatsapp_template.submitted' },
  });
  return saved;
}
const metaResponse = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      language: z.string(),
      category: z.string(),
      status: z.string(),
      components: z.array(
        z.object({ type: z.string(), text: z.string().optional(), format: z.string().optional() }),
      ),
    }),
  ),
  paging: z
    .object({
      next: z.string().optional(),
      cursors: z.object({ after: z.string().optional() }).optional(),
    })
    .optional(),
});
export async function syncWhatsAppTemplates(
  userId: string,
  workspaceId: string,
  id: string,
  transport?: AdapterTransports,
) {
  const { connection, adapter } = await connectionForTemplate(userId, workspaceId, id, transport);
  if (connection.mode === 'fake' && !transport)
    return {
      synced: await db.whatsAppTemplate.count({ where: { workspaceId, connectionId: id } }),
      demo: true,
    };
  let after: string | undefined;
  let synced = 0;
  for (let page = 0; page < 5; page++) {
    const result = metaResponse.parse(
      await adapter.transport.request(
        'GET',
        `${(adapter.credentials as WhatsAppCredentials).wabaId}/message_templates?limit=100${after ? `&after=${encodeURIComponent(after)}` : ''}`,
        adapter.credentials,
      ),
    );
    for (const t of result.data) {
      const body = t.components.find((c) => c.type === 'BODY')?.text ?? '';
      let supported =
        t.category !== 'AUTHENTICATION' &&
        !!body &&
        t.components.every(
          (c) => ['BODY', 'FOOTER'].includes(c.type) && (!c.format || c.format === 'TEXT'),
        );
      try {
        templateVariables(body);
      } catch {
        supported = false;
      }
      const data = { externalId: t.id, category: t.category, body, status: t.status, supported };
      await db.whatsAppTemplate.upsert({
        where: {
          workspaceId_connectionId_name_language: {
            workspaceId,
            connectionId: id,
            name: t.name,
            language: t.language,
          },
        },
        create: { workspaceId, connectionId: id, name: t.name, language: t.language, ...data },
        update: data,
      });
      synced++;
    }
    after = result.paging?.next ? result.paging.cursors?.after : undefined;
    if (!after) break;
  }
  await db.auditLog.create({
    data: { workspaceId, actorId: userId, action: 'whatsapp_templates.synced' },
  });
  return { synced, demo: false };
}
