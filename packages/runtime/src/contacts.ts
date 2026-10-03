import { z } from 'zod';
import { db, AccessDenied } from '@bothub/db';
import { parseCsv, writeCsv } from '@bothub/core';
import { limitsFor } from '../../../config/plans';
import { access, ProductError } from './bots';
import type { Prisma } from '../../db/src/generated/client';
export const contactFiltersSchema = z
  .object({
    search: z.string().max(100).optional(),
    tag: z.string().max(40).optional(),
    channel: z.enum(['simulator', 'telegram', 'whatsapp', 'sms']).optional(),
    consent: z.boolean().optional(),
    marketingConsent: z.boolean().optional(),
  })
  .strict();
export type ContactFilters = z.infer<typeof contactFiltersSchema>;
export function contactWhere(
  workspaceId: string,
  filters: ContactFilters = {},
  connectionId?: string,
): Prisma.ContactWhereInput {
  return {
    workspaceId,
    ...(connectionId ? { connectionId } : {}),
    ...(filters.channel ? { channel: filters.channel } : {}),
    ...(filters.tag ? { tags: { has: filters.tag } } : {}),
    ...(filters.consent !== undefined ? { consent: filters.consent } : {}),
    ...(filters.marketingConsent !== undefined
      ? { marketingConsent: filters.marketingConsent }
      : {}),
    ...(filters.search
      ? {
          OR: [
            { name: { contains: filters.search, mode: 'insensitive' } },
            { email: { contains: filters.search, mode: 'insensitive' } },
            { phone: { contains: filters.search } },
          ],
        }
      : {}),
  };
}
const tags = z
  .array(z.string().trim().min(1).max(40))
  .max(20)
  .transform((v) => [...new Set(v)]);
const customKey = z
  .string()
  .regex(/^(?!__proto__$|constructor$|prototype$)[a-zA-Z][a-zA-Z0-9_]{0,39}$/);
const fields = z
  .record(customKey, z.union([z.string().max(500), z.number().finite(), z.boolean()]))
  .refine((v) => Object.keys(v).length <= 20);
export const contactInputSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    connectionId: z.string().min(1).max(80),
    externalContactId: z.string().trim().min(1).max(100),
    email: z.email().max(200).optional(),
    phone: z
      .string()
      .regex(/^\+[1-9]\d{6,14}$/)
      .optional(),
    tags: tags.default([]),
    fields: fields.default({}),
    consent: z.boolean().default(false),
    marketingConsent: z.boolean().default(false),
    source: z.string().trim().max(200).optional(),
  })
  .strict()
  .superRefine((v, c) => {
    if (v.marketingConsent && !v.consent)
      c.addIssue({ code: 'custom', message: 'Autorize a conversa antes da campanha.' });
    if ((v.consent || v.marketingConsent) && !v.source?.trim())
      c.addIssue({ code: 'custom', message: 'Informe a origem do consentimento.' });
  });
export const contactPatchSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    email: z.union([z.email().max(200), z.literal('')]).optional(),
    tags: tags.optional(),
    fields: fields.optional(),
    consent: z.boolean().optional(),
    marketingConsent: z.boolean().optional(),
    source: z.string().trim().max(200).optional(),
  })
  .strict()
  .superRefine((v, c) => {
    if ((v.consent === true || v.marketingConsent === true) && !v.source?.trim())
      c.addIssue({ code: 'custom', message: 'Informe a origem do consentimento.' });
  });
export async function contactWriteAccess(userId: string, workspaceId: string) {
  const m = await access(userId, workspaceId);
  if (m.role === 'viewer') throw new AccessDenied();
  return m;
}
export async function listContacts(
  userId: string,
  workspaceId: string,
  filters: ContactFilters = {},
  page = 1,
) {
  await access(userId, workspaceId);
  const where = contactWhere(workspaceId, contactFiltersSchema.parse(filters));
  const [items, total, summary, workspace] = await Promise.all([
    db.contact.findMany({
      where,
      include: { connection: { select: { name: true, mode: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * 30,
      take: 30,
    }),
    db.contact.count({ where }),
    Promise.all([
      db.contact.count({ where: { workspaceId } }),
      db.contact.count({ where: { workspaceId, marketingConsent: true, consent: true } }),
      db.contact.count({ where: { workspaceId, consent: false } }),
    ]),
    db.workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: { plan: true } }),
  ]);
  return {
    items,
    total,
    page,
    summary: {
      all: summary[0],
      subscribed: summary[1],
      optedOut: summary[2],
      limit: limitsFor(workspace.plan).contacts,
    },
  };
}
export async function createContact(
  userId: string,
  workspaceId: string,
  value: z.input<typeof contactInputSchema>,
) {
  await contactWriteAccess(userId, workspaceId);
  const input = contactInputSchema.parse(value);
  const connection = await db.connection.findFirst({
    where: { workspaceId, id: input.connectionId },
  });
  if (!connection) throw new ProductError('Escolha um canal desta empresa.');
  let id = input.externalContactId.replace(/^'(\+)/, '$1');
  if (connection.channel === 'whatsapp') {
    if (!/^\+?[1-9]\d{6,14}$/.test(id))
      throw new ProductError('Use telefone no formato +5511999999999.');
    id = id.replace(/^\+/, '');
  } else if (connection.channel === 'sms' && !/^\+[1-9]\d{6,14}$/.test(id))
    throw new ProductError('Use telefone no formato +5511999999999.');
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${workspaceId},0))`;
    const workspace = await tx.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
    if ((await tx.contact.count({ where: { workspaceId } })) >= limitsFor(workspace.plan).contacts)
      throw new ProductError(
        'Limite de contatos atingido. Seus dados continuam salvos. Veja os planos.',
        409,
      );
    if (
      await tx.contact.findFirst({
        where: { workspaceId, connectionId: connection.id, externalContactId: id },
      })
    )
      throw new ProductError('Este contato já existe nesse canal.', 409);
    const contact = await tx.contact.create({
      data: {
        workspaceId,
        connectionId: connection.id,
        externalContactId: id,
        channel: connection.channel,
        name: input.name,
        email: input.email,
        phone: ['whatsapp', 'sms'].includes(connection.channel)
          ? `${id.startsWith('+') ? '' : '+'}${id}`
          : input.phone,
        tags: input.tags,
        fields: input.fields,
        consent: input.consent,
        consentSource: input.source,
        consentAt: new Date(),
        marketingConsent: input.marketingConsent,
        marketingSource: input.marketingConsent ? input.source : null,
        marketingAt: input.marketingConsent ? new Date() : null,
      },
    });
    await tx.consentRecord.createMany({
      data: [
        {
          workspaceId,
          contactId: contact.id,
          scope: 'conversation',
          granted: input.consent,
          source: input.source ?? 'cadastro manual sem autorização',
        },
        {
          workspaceId,
          contactId: contact.id,
          scope: 'marketing',
          granted: input.marketingConsent,
          source: input.source ?? 'cadastro manual sem autorização',
        },
      ],
    });
    await tx.auditLog.create({ data: { workspaceId, actorId: userId, action: 'contact.created' } });
    return contact;
  });
}
export async function getContact(userId: string, workspaceId: string, id: string) {
  await access(userId, workspaceId);
  const c = await db.contact.findFirst({
    where: { workspaceId, id },
    include: {
      connection: { select: { name: true, mode: true } },
      consentRecords: { orderBy: { createdAt: 'desc' }, take: 30 },
      conversations: {
        orderBy: { updatedAt: 'desc' },
        take: 10,
        include: {
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 20,
            select: { id: true, direction: true, content: true, createdAt: true, status: true },
          },
        },
      },
    },
  });
  if (!c) throw new ProductError('Contato não encontrado.', 404);
  return c;
}
export async function updateContact(
  userId: string,
  workspaceId: string,
  id: string,
  value: z.input<typeof contactPatchSchema>,
) {
  await contactWriteAccess(userId, workspaceId);
  const input = contactPatchSchema.parse(value);
  return db.$transaction(async (tx) => {
    const c = await tx.contact.findFirst({ where: { workspaceId, id } });
    if (!c) throw new ProductError('Contato não encontrado.', 404);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${workspaceId + ':' + c.connectionId + ':' + c.externalContactId},0))`;
    const fresh = await tx.contact.findFirstOrThrow({ where: { workspaceId, id } });
    const consent = input.consent ?? fresh.consent,
      marketing = consent ? (input.marketingConsent ?? fresh.marketingConsent) : false;
    if (input.marketingConsent === true && !consent)
      throw new ProductError('Primeiro autorize a conversa.');
    const now = new Date();
    for (const [scope, old, value] of [
      ['conversation', fresh.consent, consent],
      ['marketing', fresh.marketingConsent, marketing],
    ] as const)
      if (old !== value)
        await tx.consentRecord.create({
          data: {
            workspaceId,
            contactId: id,
            scope,
            granted: value,
            source: input.source ?? 'descadastro manual',
          },
        });
    const saved = await tx.contact.update({
      where: { workspaceId_id: { workspaceId, id } },
      data: {
        name: input.name,
        email: input.email === '' ? null : input.email,
        tags: input.tags,
        fields: input.fields,
        consent,
        marketingConsent: marketing,
        ...(consent !== fresh.consent
          ? { consentAt: now, consentSource: input.source ?? 'descadastro manual' }
          : {}),
        ...(marketing !== fresh.marketingConsent
          ? { marketingAt: now, marketingSource: input.source ?? 'descadastro manual' }
          : {}),
      },
    });
    await tx.auditLog.create({ data: { workspaceId, actorId: userId, action: 'contact.updated' } });
    return saved;
  });
}
export async function deleteContact(userId: string, workspaceId: string, id: string) {
  await access(userId, workspaceId, true);
  return db.$transaction(async (tx) => {
    const c = await tx.contact.findFirst({ where: { workspaceId, id } });
    if (!c) throw new ProductError('Contato não encontrado.', 404);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${workspaceId + ':' + c.connectionId + ':' + c.externalContactId},0))`;
    await tx.contact.deleteMany({ where: { workspaceId, id } });
    await tx.auditLog.create({ data: { workspaceId, actorId: userId, action: 'contact.deleted' } });
    return { deleted: true };
  });
}
export async function exportContacts(
  userId: string,
  workspaceId: string,
  filters: ContactFilters = {},
) {
  await access(userId, workspaceId);
  const contacts = await db.contact.findMany({
    where: contactWhere(workspaceId, filters),
    orderBy: { createdAt: 'desc' },
    take: 10000,
  });
  return writeCsv(
    [
      'nome',
      'canal',
      'telefone',
      'id_externo',
      'email',
      'tags',
      'conversa_permitida',
      'campanhas_permitidas',
      'origem',
      'data_consentimento',
    ],
    contacts.map((c) => [
      c.name,
      c.channel,
      c.phone,
      c.externalContactId,
      c.email,
      c.tags.join(';'),
      c.consent,
      c.marketingConsent,
      c.marketingSource ?? c.consentSource,
      c.marketingAt?.toISOString() ?? c.consentAt?.toISOString(),
    ]),
  );
}
export const csvImportSchema = z
  .object({
    connectionId: z.string().min(1),
    csv: z.string().max(200000),
    mapping: z
      .object({
        name: z.string().min(1),
        externalContactId: z.string().min(1),
        email: z.string().optional(),
        tags: z.string().optional(),
      })
      .strict(),
    consent: z.boolean().default(false),
    marketingConsent: z.boolean().default(false),
    source: z.string().trim().max(200).optional(),
  })
  .strict();
export async function importContacts(
  userId: string,
  workspaceId: string,
  value: z.input<typeof csvImportSchema>,
) {
  await access(userId, workspaceId, true);
  const input = csvImportSchema.parse(value);
  let parsed: ReturnType<typeof parseCsv>;
  try {
    parsed = parseCsv(input.csv);
  } catch (e) {
    throw new ProductError(e instanceof Error ? e.message : 'CSV inválido.');
  }
  const c = await db.connection.findFirst({ where: { workspaceId, id: input.connectionId } });
  if (!c) throw new ProductError('Escolha um canal desta empresa.');
  if (!Object.values(input.mapping).every((column) => parsed.headers.includes(column)))
    throw new ProductError('Confira o mapeamento das colunas.');
  const rows = parsed.rows.map((row, i) => {
    const name = row[input.mapping.name]?.trim() ?? '',
      email = input.mapping.email ? row[input.mapping.email]?.trim() : undefined;
    let externalContactId = (row[input.mapping.externalContactId]?.trim() ?? '').replace(
      /^'(\+)/,
      '$1',
    );
    if (c.channel === 'whatsapp') externalContactId = externalContactId.replace(/^\+/, '');
    if (
      ['sms', 'whatsapp'].includes(c.channel) &&
      !new RegExp(c.channel === 'sms' ? '^\\+[1-9]\\d{6,14}$' : '^[1-9]\\d{6,14}$').test(
        externalContactId,
      )
    )
      throw new ProductError(`Linha ${i + 2}: use telefone em E.164 (+5511999999999).`);
    try {
      return contactInputSchema.parse({
        connectionId: c.id,
        name,
        externalContactId,
        email: email || undefined,
        tags: input.mapping.tags
          ? (row[input.mapping.tags] ?? '')
              .split(';')
              .map((v) => v.trim())
              .filter(Boolean)
          : [],
        consent: input.consent,
        marketingConsent: input.marketingConsent,
        source: input.source,
      });
    } catch {
      throw new ProductError(`Linha ${i + 2}: revise o nome, e-mail e autorização.`);
    }
  });
  if (new Set(rows.map((r) => r.externalContactId)).size !== rows.length)
    throw new ProductError('Existem contatos repetidos no arquivo.');
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${workspaceId},0))`;
      const existing = await tx.contact.findMany({
        where: {
          workspaceId,
          connectionId: c.id,
          externalContactId: { in: rows.map((r) => r.externalContactId) },
        },
        select: { id: true, externalContactId: true, tags: true },
      });
      const byId = new Map(existing.map((v) => [v.externalContactId, v]));
      const workspace = await tx.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
      if (
        (await tx.contact.count({ where: { workspaceId } })) + rows.length - existing.length >
        limitsFor(workspace.plan).contacts
      )
        throw new ProductError(
          'O arquivo ultrapassa o limite de contatos. Nenhuma linha foi importada.',
          409,
        );
      let created = 0,
        updated = 0;
      for (const row of rows) {
        const old = byId.get(row.externalContactId);
        if (old) {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${workspaceId + ':' + c.id + ':' + row.externalContactId},0))`;
          const fresh = await tx.contact.findFirstOrThrow({
            where: { workspaceId, id: old.id },
            select: { tags: true },
          });
          await tx.contact.updateMany({
            where: { workspaceId, id: old.id },
            data: {
              name: row.name,
              email: row.email,
              tags: [...new Set([...fresh.tags, ...row.tags])].slice(0, 20),
            },
          });
          updated++;
        } else {
          const contact = await tx.contact.create({
            data: {
              workspaceId,
              connectionId: c.id,
              channel: c.channel,
              name: row.name,
              externalContactId: row.externalContactId,
              email: row.email,
              phone: ['sms', 'whatsapp'].includes(c.channel)
                ? `${row.externalContactId.startsWith('+') ? '' : '+'}${row.externalContactId}`
                : null,
              tags: row.tags,
              consent: row.consent,
              consentAt: new Date(),
              consentSource: row.source ?? 'importação CSV sem autorização',
              marketingConsent: row.marketingConsent,
              marketingSource: row.marketingConsent ? row.source : null,
              marketingAt: row.marketingConsent ? new Date() : null,
            },
          });
          await tx.consentRecord.createMany({
            data: [
              {
                workspaceId,
                contactId: contact.id,
                scope: 'conversation',
                granted: row.consent,
                source: row.source ?? 'importação CSV sem autorização',
              },
              {
                workspaceId,
                contactId: contact.id,
                scope: 'marketing',
                granted: row.marketingConsent,
                source: row.source ?? 'importação CSV sem autorização',
              },
            ],
          });
          created++;
        }
      }
      await tx.auditLog.create({
        data: { workspaceId, actorId: userId, action: 'contacts.imported' },
      });
      return { created, updated, rows: rows.length };
    },
    { timeout: 30000 },
  );
}
export async function listSegments(userId: string, workspaceId: string) {
  await access(userId, workspaceId);
  const segments = await db.segment.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'desc' },
  });
  return Promise.all(
    segments.map(async (s) => ({
      ...s,
      count: await db.contact.count({
        where: contactWhere(workspaceId, contactFiltersSchema.parse(s.filters)),
      }),
    })),
  );
}
export async function saveSegment(
  userId: string,
  workspaceId: string,
  name: string,
  filters: ContactFilters,
) {
  await access(userId, workspaceId, true);
  return db.segment.upsert({
    where: {
      workspaceId_name: { workspaceId, name: z.string().trim().min(2).max(80).parse(name) },
    },
    create: { workspaceId, name, filters: contactFiltersSchema.parse(filters) },
    update: { filters: contactFiltersSchema.parse(filters) },
  });
}
export async function deleteSegment(userId: string, workspaceId: string, id: string) {
  await access(userId, workspaceId, true);
  return db.segment.deleteMany({ where: { workspaceId, id } });
}
