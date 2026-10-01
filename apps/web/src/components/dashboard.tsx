'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import type { getDashboard } from '@bothub/db';
import { motion } from 'framer-motion';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts';
import {
  ArrowRight,
  ArrowUpRight,
  Bot,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  GitBranch,
  MessageCircle,
  MessagesSquare,
  MoreHorizontal,
  Plus,
  Send,
  Sparkles,
  Users,
  Zap,
  Plug,
  FlaskConical,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ChannelIcon, channelLabel } from './channel-icon';
import { formatNumber } from '@/lib/utils';
type DashboardData = Awaited<ReturnType<typeof getDashboard>>;
export function Dashboard({
  initialData,
  firstName,
}: {
  initialData: DashboardData;
  firstName: string;
}) {
  const [days, setDays] = useState(7);
  const [checklist, setChecklist] = useState(true);
  const {
    data = initialData,
    isFetching,
    isError,
    refetch,
  } = useQuery<DashboardData>({
    queryKey: ['dashboard', initialData.workspace.id, days],
    queryFn: async () => {
      const response = await fetch(
        `/api/dashboard?workspaceId=${initialData.workspace.id}&days=${days}`,
      );
      if (!response.ok) throw new Error('Dashboard unavailable');
      return response.json();
    },
    initialData: days === 7 ? initialData : undefined,
  });
  const { totals, workspace, bots, connections } = data;
  const channelTotal = data.channels.reduce((sum, c) => sum + c.total, 0);
  const isDemo = workspace.isDemo;
  const metrics = [
    {
      label: 'Conversas ativas',
      value: formatNumber(totals.activeConversations),
      icon: MessagesSquare,
      color: 'purple',
      detail: 'Em atendimento agora',
    },
    {
      label: 'Novos contatos',
      value: formatNumber(totals.newContacts),
      icon: Users,
      color: 'blue',
      detail: `Nos últimos ${days} dias`,
    },
    {
      label: 'Mensagens enviadas',
      value: formatNumber(totals.sent),
      icon: Send,
      color: 'green',
      detail: `${formatNumber(totals.received)} recebidas no período`,
    },
    {
      label: 'Conclusão dos fluxos',
      value: `${totals.completionRate}%`,
      icon: GitBranch,
      color: 'pink',
      detail: totals.started
        ? `${formatNumber(totals.completed)} fluxos concluídos`
        : 'Seus resultados aparecerão aqui',
    },
  ];
  const topBots = bots.slice(0, 3);
  return (
    <>
      <div className="dashboard-title">
        <div>
          <span className="dashboard-eyebrow">SEU NEGÓCIO EM MOVIMENTO</span>
          <h1>
            Olá, {firstName} <span className="greeting-wave">👋</span>
          </h1>
          <p>Que bom ter você por aqui. Vamos fazer boas conversas acontecerem?</p>
        </div>
        <div>
          <Button
            variant="outline"
            onClick={() => {
              setChecklist(true);
              document
                .getElementById('getting-started')
                ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }}
          >
            <Sparkles size={15} />
            Primeiros passos
          </Button>
          <Button asChild>
            <Link href="/app/bots">
              <Plus size={16} />
              Criar meu bot
            </Link>
          </Button>
        </div>
      </div>
      {isDemo && (
        <div className="demo-banner">
          <FlaskConical size={16} />
          <span>
            Você está no espaço de demonstração.{' '}
            <strong>Os números e bots abaixo são exemplos.</strong> Nenhum canal está conectado.
          </span>
          <Link href="/onboarding">
            Criar minha empresa <ArrowUpRight size={13} />
          </Link>
        </div>
      )}
      <section id="getting-started" className="onboarding-checklist card">
        <div className="checklist-header">
          <span className="checklist-icon">
            <Zap size={20} />
          </span>
          <div>
            <h2>
              Seu primeiro bot começa aqui <Badge tone="primary">0 de 4 passos</Badge>
            </h2>
            <p>Sua conta está pronta. A automação chega na Fase 2.</p>
          </div>
          <button
            className="checklist-toggle"
            aria-label={checklist ? 'Recolher primeiros passos' : 'Expandir primeiros passos'}
            aria-expanded={checklist}
            onClick={() => setChecklist(!checklist)}
          >
            <ChevronDown
              size={18}
              style={{ transform: checklist ? 'rotate(180deg)' : undefined }}
            />
          </button>
        </div>
        {checklist && (
          <div className="checklist-items">
            {[
              {
                icon: Plug,
                title: 'Conecte um canal',
                description: 'Esteja onde seu cliente está.',
                href: '/app/channels',
              },
              {
                icon: LayoutTemplateIcon,
                title: 'Escolha um template',
                description: 'Comece com uma boa ideia.',
                href: '/app/templates',
              },
              {
                icon: Bot,
                title: 'Publique seu bot',
                description: 'Dê vida à sua conversa.',
                href: '/app/bots',
              },
              {
                icon: MessageCircle,
                title: 'Envie uma mensagem',
                description: 'Teste e veja acontecer.',
                href: '/app/bots',
              },
            ].map((item, i) => (
              <Link href={item.href} key={item.title} className="checklist-item">
                <span className="checklist-number">{i + 1}</span>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.description}</p>
                  <span>Em breve</span>
                </div>
                <item.icon size={15} />
              </Link>
            ))}
          </div>
        )}
      </section>
      <div className="overview-section-title">
        <h2>Um olhar sobre o seu atendimento</h2>
        <label className="period-select">
          <CalendarDays size={14} />
          <span className="sr-only">Período do dashboard</span>
          <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
            <option value={7}>Últimos 7 dias</option>
            <option value={14}>Últimos 14 dias</option>
            <option value={30}>Últimos 30 dias</option>
          </select>
        </label>
      </div>
      {isError && (
        <div className="dashboard-error" role="alert">
          <AlertCircle size={16} />
          Não conseguimos atualizar os dados.
          <button onClick={() => refetch()}>
            <RefreshCw size={13} />
            Tentar novamente
          </button>
        </div>
      )}
      <div className={`metrics-grid ${isFetching ? 'refreshing' : ''}`}>
        {metrics.map((metric, i) => (
          <motion.article
            className="metric-card card"
            key={metric.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: i * 0.04 }}
          >
            <div className="metric-top">
              <span>{metric.label}</span>
              <span className={`metric-icon ${metric.color}`}>
                <metric.icon size={17} />
              </span>
            </div>
            <strong>{metric.value}</strong>
            <div className="metric-detail">
              {i === 3 ? <Check size={12} /> : <span className="metric-detail-dot" />}
              {metric.detail}
            </div>
          </motion.article>
        ))}
      </div>
      <div className="dashboard-chart-row">
        <section className="card messages-chart">
          <div className="card-heading">
            <div>
              <h2>Conversas que fazem acontecer</h2>
              <p>Mensagens enviadas e recebidas no período</p>
            </div>
            <span className="chart-live">
              <i />
              {isDemo ? 'Dados de exemplo' : 'Seu atendimento'}
            </span>
          </div>
          <div className="chart-legend">
            <span>
              <i className="sent-dot" />
              Enviadas
            </span>
            <span>
              <i className="received-dot" />
              Recebidas
            </span>
          </div>
          <div
            className="chart-container"
            role="img"
            aria-label={`Gráfico de mensagens: ${formatNumber(totals.sent)} enviadas e ${formatNumber(totals.received)} recebidas em ${days} dias.`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.series} margin={{ top: 10, right: 8, left: -22, bottom: 0 }}>
                <defs>
                  <linearGradient id="sent-gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.14} />
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 4" vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'var(--muted)', fontSize: 10 }}
                  tickMargin={12}
                  minTickGap={30}
                  tickFormatter={(value) =>
                    new Intl.DateTimeFormat('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      timeZone: 'UTC',
                    }).format(new Date(`${value}T12:00:00Z`))
                  }
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'var(--muted)', fontSize: 10 }}
                  tickMargin={8}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    fontSize: 11,
                    color: 'var(--foreground)',
                  }}
                  labelFormatter={(value) => String(value).split('-').reverse().join('/')}
                  formatter={(value, name) => [
                    formatNumber(Number(value)),
                    name === 'sent' ? 'Enviadas' : 'Recebidas',
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="sent"
                  stroke="var(--primary)"
                  strokeWidth={2.5}
                  fill="url(#sent-gradient)"
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="received"
                  stroke="var(--brand-telegram)"
                  strokeWidth={2}
                  fill="transparent"
                  strokeDasharray="4 4"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-summary">
            <span>
              <Clock3 size={14} /> Tempo médio de resposta
            </span>
            <strong>{totals.responseSeconds ? `${totals.responseSeconds}s` : '—'}</strong>
            <span className="summary-note">
              {isDemo
                ? 'Exemplo demonstrativo'
                : totals.received
                  ? 'No período selecionado'
                  : 'Aguardando suas primeiras conversas'}
            </span>
          </div>
        </section>
        <section className="card channels-card">
          <div className="card-heading">
            <div>
              <h2>Seus canais</h2>
              <p>Conversas, em cada lugar.</p>
            </div>
            <Button size="icon" variant="ghost" asChild>
              <Link href="/app/channels" aria-label="Ver canais">
                <MoreHorizontal size={18} />
              </Link>
            </Button>
          </div>
          <div className="channel-total">
            <strong>{formatNumber(channelTotal)}</strong>
            <span>mensagens no período</span>
          </div>
          <div className="channel-stack" aria-hidden="true">
            {data.channels.map((c) => (
              <span
                key={c.channel}
                style={{
                  width: channelTotal ? `${Math.max(0, (100 * c.total) / channelTotal)}%` : '33.3%',
                  background: `var(--brand-${c.channel})`,
                }}
              />
            ))}
          </div>
          <div className="channel-breakdown">
            {data.channels.map((c) => (
              <div key={c.channel}>
                <span>
                  <ChannelIcon channel={c.channel} />
                  {channelLabel(c.channel)}
                </span>
                <strong>{formatNumber(c.total)}</strong>
                <small>{channelTotal ? Math.round((100 * c.total) / channelTotal) : 0}%</small>
              </div>
            ))}
          </div>
          <Link href="/app/channels" className="channel-manage">
            Gerenciar meus canais <ArrowRight size={14} />
          </Link>
        </section>
      </div>
      <div className="dashboard-lower-row">
        <section className="card top-bots">
          <div className="card-heading">
            <div>
              <h2>
                Seus bots, em ação <span className="count-badge">{bots.length}</span>
              </h2>
              <p>
                {isDemo
                  ? 'Uma prévia do que você vai poder criar.'
                  : 'Seus assistentes vão morar aqui.'}
              </p>
            </div>
            <Link href="/app/bots">
              Ver todos <ChevronRight size={13} />
            </Link>
          </div>
          {topBots.length ? (
            <div className="bots-table">
              <div className="bot-table-header">
                <span>BOT</span>
                <span>STATUS</span>
                <span>CONVERSAS</span>
                <span />
              </div>
              {topBots.map((bot, i) => (
                <Link href="/app/bots" className="bot-table-row" key={bot.id}>
                  <div className="bot-name-cell">
                    <span className={`bot-icon bot-color-${i}`}>
                      <Bot size={20} />
                    </span>
                    <div>
                      <strong>{bot.name}</strong>
                      <span>
                        {bot.channels.map((c) => (
                          <span key={c}>
                            <ChannelIcon channel={c} size={11} />
                            {channelLabel(c)}
                          </span>
                        ))}
                      </span>
                    </div>
                  </div>
                  <Badge tone={bot.status === 'active' ? 'success' : 'neutral'}>
                    {bot.status === 'active' ? (
                      <>
                        <span className="status-dot" />
                        Exemplo ativo
                      </>
                    ) : (
                      'Rascunho'
                    )}
                  </Badge>
                  <strong className="bot-conversation-count">
                    {formatNumber(bot.conversations)}
                  </strong>
                  <ChevronRight size={14} />
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty-bots">
              <svg width="86" height="67" viewBox="0 0 86 67" aria-hidden="true">
                <rect
                  x="13"
                  y="12"
                  width="60"
                  height="45"
                  rx="13"
                  fill="var(--surface-muted)"
                  stroke="var(--border)"
                />
                <path
                  d="M32 43h22M43 12V5"
                  stroke="var(--primary)"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <circle cx="32" cy="31" r="4" fill="var(--primary)" />
                <circle cx="54" cy="31" r="4" fill="var(--primary)" />
              </svg>
              <strong>Seu primeiro assistente está a caminho.</strong>
              <p>Criação de bots e templates chegam na Fase 2.</p>
              <Button variant="secondary" size="sm" asChild>
                <Link href="/app/templates">
                  Conhecer os templates <ArrowRight size={13} />
                </Link>
              </Button>
            </div>
          )}
        </section>
        <section className="card workspace-status">
          <div className="card-heading">
            <div>
              <h2>Seu espaço, por dentro</h2>
              <p>Um passo de cada vez.</p>
            </div>
            <span className="workspace-status-icon">
              <Sparkles size={19} />
            </span>
          </div>
          <div className="usage-plan">
            <span>Seu plano</span>
            <Badge tone="primary">
              {workspace.plan === 'pro'
                ? 'Pro · demo'
                : workspace.plan === 'business'
                  ? 'Business'
                  : 'Gratuito'}
            </Badge>
          </div>
          <div className="usage-meter">
            <div>
              <span>Contatos</span>
              <strong>
                {formatNumber(totals.contacts)}{' '}
                <span>
                  /{' '}
                  {workspace.plan === 'pro'
                    ? '2.000'
                    : workspace.plan === 'business'
                      ? '10.000'
                      : '100'}
                </span>
              </strong>
            </div>
            <progress
              value={totals.contacts}
              max={workspace.plan === 'pro' ? 2000 : workspace.plan === 'business' ? 10000 : 100}
            />
          </div>
          <div className="usage-info">
            <span>
              <Bot size={14} /> Bots
            </span>
            <strong>
              {bots.length} /{' '}
              {workspace.plan === 'pro' ? 5 : workspace.plan === 'business' ? 20 : 1}
            </strong>
          </div>
          <div className="usage-info">
            <span>
              <Users size={14} /> Pessoas na equipe
            </span>
            <strong>
              {totals.members} /{' '}
              {workspace.plan === 'pro' ? 5 : workspace.plan === 'business' ? 15 : 1}
            </strong>
          </div>
          <div className="connection-state">
            <span className="connection-dot" />
            <span>
              {connections.length && isDemo ? 'Conexões ilustrativas' : 'Nenhum canal conectado'}
            </span>
            <Link href="/app/channels">
              Ver <ChevronRight size={11} />
            </Link>
          </div>
          <p className="usage-footnote">Seus dados ficam com você, mesmo ao atingir um limite.</p>
        </section>
      </div>
      <div className="dashboard-tip">
        <span>
          <Sparkles size={18} />
        </span>
        <div>
          <strong>Uma boa conversa começa com uma boa ideia.</strong>
          <p>Explore templates para atendimento, agendamento e captação de clientes.</p>
        </div>
        <Link href="/app/templates">
          Buscar inspiração <ArrowRight size={15} />
        </Link>
      </div>
    </>
  );
}
function LayoutTemplateIcon({ size }: { size?: number }) {
  return <GitBranch size={size} />;
}
