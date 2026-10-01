import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  Clock3,
  GitBranch,
  HeartHandshake,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Users,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChannelIcon } from '@/components/channel-icon';
import { ChatDemo } from './chat-demo';
import { Pricing } from './pricing';
import { brand } from '../../../../../config/brand';
const features = [
  {
    icon: GitBranch,
    title: 'Seu fluxo, do seu jeito',
    text: 'Monte conversas visualmente. Conecte ideias, perguntas e respostas sem escrever código.',
  },
  {
    icon: MessageCircle,
    title: 'Uma conversa, vários canais',
    text: 'Encontre seu cliente no WhatsApp, Telegram ou SMS, com a mesma experiência.',
  },
  {
    icon: HeartHandshake,
    title: 'Automação com toque humano',
    text: 'Quando a conversa precisar de você, sua equipe assume com todo o contexto.',
  },
  {
    icon: Users,
    title: 'Clientes, não só contatos',
    text: 'Conheça quem conversa com você. Organize tags, preferências e histórico em um só lugar.',
  },
  {
    icon: Clock3,
    title: 'Seu negócio sempre presente',
    text: 'Receba os primeiros “ois”, mesmo quando você estiver ocupado cuidando de outras coisas.',
  },
  {
    icon: ShieldCheck,
    title: 'Confiança em cada interação',
    text: 'Consentimento, controle e privacidade para construir relações que duram.',
  },
];
const templates = [
  {
    icon: MessageCircle,
    name: 'Atendimento e FAQ',
    description: 'Responda às dúvidas mais comuns.',
    color: 'violet',
  },
  {
    icon: Sparkles,
    name: 'Captação de leads',
    description: 'Transforme interesse em oportunidade.',
    color: 'blue',
  },
  { icon: Clock3, name: 'Agendamento', description: 'Facilite o próximo encontro.', color: 'pink' },
  {
    icon: HeartHandshake,
    name: 'Pesquisa de satisfação',
    description: 'Ouça quem mais importa: seu cliente.',
    color: 'green',
  },
];
const faqs = [
  [
    'Preciso saber programar?',
    'Não. A proposta do editor é montar uma conversa conectando blocos, como mensagem, pergunta e condição. O editor será entregue na Fase 2.',
  ],
  [
    'Posso usar sem conectar um canal real?',
    'Sim. O simulador permitirá testar os fluxos sem tokens ou contas externas a partir da Fase 2. Nesta entrega, você já pode conhecer o painel de demonstração.',
  ],
  [
    'Como funciona a conexão com o WhatsApp?',
    'Usaremos somente a API oficial da Meta. A conexão e os templates aprovados chegam na Fase 3. Você precisará de uma conta WhatsApp Business Platform.',
  ],
  [
    'E se meu cliente precisar falar com uma pessoa?',
    'A Inbox permitirá que sua equipe assuma a conversa e pause o bot. Esse recurso está previsto para a Fase 2.',
  ],
  [
    'O que já posso usar agora?',
    'Cadastro, login, criação da empresa, navegação e dashboard com dados demonstrativos. Automação, canais e cobrança estão em desenvolvimento.',
  ],
];
export function Landing() {
  return (
    <main id="main-content" className="marketing-main">
      <section className="hero section-container">
        <div className="hero-copy">
          <span className="hero-kicker">
            <span>✦</span> MAIS CONVERSAS. MENOS COMPLICAÇÃO.
          </span>
          <h1>
            Seu atendimento
            <br />
            mais inteligente.
            <br />
            <span className="gradient-text">Seu negócio mais perto.</span>
          </h1>
          <p>
            Automatize seu atendimento no WhatsApp, Telegram e SMS, sem escrever código. E tenha
            mais tempo para o que faz seu negócio crescer.
          </p>
          <div className="hero-cta">
            <Button asChild>
              <Link href="/cadastro">
                Começar grátis <ArrowRight size={18} />
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/login?demo=1">
                Conhecer o painel <ArrowUpRight size={16} />
              </Link>
            </Button>
          </div>
          <div className="hero-reassurance">
            <span>
              <Check size={14} /> Sem cartão de crédito
            </span>
            <span>
              <Check size={14} /> Simples desde o primeiro “oi”
            </span>
          </div>
          <div className="hero-social">
            <div className="avatar-stack">
              <span>MC</span>
              <span>JL</span>
              <span>AP</span>
              <span>RS</span>
            </div>
            <div>
              <div className="stars">★★★★★</div>
              <span>Pensado para quem faz acontecer.</span>
            </div>
          </div>
        </div>
        <ChatDemo />
      </section>
      <section className="channel-strip section-container">
        <span>SEU NEGÓCIO ONDE SEU CLIENTE ESTÁ</span>
        <div>
          {['whatsapp', 'telegram', 'sms'].map((c) => (
            <span key={c}>
              <ChannelIcon channel={c} size={24} />
              {c === 'whatsapp' ? 'WhatsApp' : c === 'telegram' ? 'Telegram' : 'SMS'}
            </span>
          ))}
        </div>
        <span className="strip-note">Um fluxo. Várias possibilidades.</span>
      </section>
      <section className="marketing-section section-container" id="como-funciona">
        <div className="section-heading">
          <span className="eyebrow">DO PRIMEIRO OI AO PRÓXIMO PASSO</span>
          <h2>
            Começar é mais simples
            <br />
            do que você imagina.
          </h2>
          <p>Três passos para transformar conversas em resultados.</p>
        </div>
        <div className="steps-grid">
          {[
            {
              icon: Zap,
              title: 'Conecte seu canal',
              text: 'Escolha onde seus clientes conversam e traga seu negócio para perto.',
            },
            {
              icon: GitBranch,
              title: 'Monte sua conversa',
              text: 'Comece com um template e dê a ele a personalidade da sua empresa.',
            },
            {
              icon: Sparkles,
              title: 'Veja a mágica acontecer',
              text: 'Publique, acompanhe os resultados e melhore a cada conversa.',
            },
          ].map((step, i) => (
            <article key={step.title} className="step">
              <span className="step-icon">
                <step.icon size={25} />
                <b>0{i + 1}</b>
              </span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="features-section">
        <div className="section-container">
          <div className="section-heading">
            <span className="eyebrow">MENOS TRABALHO REPETITIVO, MAIS POSSIBILIDADES</span>
            <h2>
              Pequeno no esforço.
              <br />
              Grande no impacto.
            </h2>
            <p>Ferramentas que trabalham juntas para você trabalhar melhor.</p>
          </div>
          <div className="features-grid">
            {features.map((f) => (
              <article className="feature-card card" key={f.title}>
                <span className="feature-icon">
                  <f.icon size={23} />
                </span>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
                <span className="feature-phase">Em desenvolvimento</span>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="editor-preview-section section-container">
        <div className="editor-description">
          <span className="eyebrow">CONVERSAS QUE GANHAM FORMA</span>
          <h2>
            Se você consegue imaginar,
            <br />
            vai conseguir criar.
          </h2>
          <p>
            Um editor visual que deixa o complicado nos bastidores. Você só precisa pensar na melhor
            conversa para o seu cliente.
          </p>
          <ul>
            <li>
              <Check size={16} /> Blocos simples, possibilidades infinitas
            </li>
            <li>
              <Check size={16} /> Teste antes de publicar
            </li>
            <li>
              <Check size={16} /> Um fluxo para todos os seus canais
            </li>
          </ul>
          <span className="badge badge-primary">Editor visual · Fase 2</span>
        </div>
        <div className="flow-preview card">
          <div className="flow-preview-toolbar">
            <span>
              <GitBranch size={15} /> Atendimento inicial
            </span>
            <span>Prévia do editor</span>
          </div>
          <div className="flow-preview-canvas">
            <div className="preview-node trigger-node">
              <span>
                <Zap size={14} /> Primeiro contato
              </span>
              <p>Quando alguém disser “oi”</p>
            </div>
            <div className="flow-line" />
            <div className="preview-node">
              <span>
                <MessageCircle size={14} /> Mensagem
              </span>
              <p>Olá! Como posso te ajudar? 👋</p>
            </div>
            <div className="flow-branch" />
            <div className="flow-node-row">
              <div className="preview-node small-node">
                <span>
                  <Clock3 size={13} /> Agendar
                </span>
                <p>Encontrar um horário</p>
              </div>
              <div className="preview-node small-node">
                <span>
                  <HeartHandshake size={13} /> Atendimento
                </span>
                <p>Falar com a equipe</p>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="marketing-section section-container" id="templates">
        <div className="section-heading heading-split">
          <div>
            <span className="eyebrow">UMA BOA IDEIA PARA COMEÇAR</span>
            <h2>
              Não comece do zero.
              <br />
              Comece com inspiração.
            </h2>
            <p>Templates feitos para situações reais do seu negócio.</p>
          </div>
          <span className="badge badge-primary">Importação na Fase 2</span>
        </div>
        <div className="templates-grid">
          {templates.map((t) => (
            <article key={t.name} className="template-card card">
              <div className={`template-art ${t.color}`}>
                <t.icon size={35} />
                <span className="art-dot one" />
                <span className="art-dot two" />
                <span className="art-line" />
              </div>
              <div className="template-info">
                <h3>{t.name}</h3>
                <p>{t.description}</p>
                <span>
                  Em breve <ChevronRight size={14} />
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="testimonial-section">
        <div className="section-container">
          <span className="eyebrow">FEITO PARA O SEU DIA A DIA</span>
          <h2>Mais tempo para o que importa.</h2>
          <div className="testimonial-grid">
            {[
              {
                quote:
                  'Um atendimento simples faz toda a diferença para quem cuida de tudo em uma pequena empresa.',
                name: 'Marina',
                business: 'Exemplo · Estúdio de beleza',
              },
              {
                quote:
                  'Quero que cada cliente seja recebido com atenção, mesmo quando a loja está cheia.',
                name: 'João',
                business: 'Exemplo · Comércio local',
              },
              {
                quote:
                  'Automatizar o primeiro contato é ganhar tempo para ouvir melhor quem precisa de ajuda.',
                name: 'Ana',
                business: 'Exemplo · Consultoria',
              },
            ].map((t) => (
              <article className="card testimonial" key={t.name}>
                <span className="stars">★★★★★</span>
                <p>“{t.quote}”</p>
                <div>
                  <span className="testimonial-avatar">{t.name[0]}</span>
                  <div>
                    <strong>{t.name}</strong>
                    <span>{t.business}</span>
                  </div>
                </div>
                <small>Depoimento ilustrativo</small>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="marketing-section section-container" id="precos">
        <div className="section-heading">
          <span className="eyebrow">CRESÇA NO SEU RITMO</span>
          <h2>Um plano para cada próximo passo.</h2>
          <p>Comece pequeno. Vá mais longe quando fizer sentido.</p>
        </div>
        <Pricing />
      </section>
      <section className="faq-section section-container" id="faq">
        <div>
          <span className="eyebrow">PODE PERGUNTAR</span>
          <h2>
            Ainda tem dúvidas?
            <br />
            Vamos conversar.
          </h2>
          <p className="muted">Respostas diretas, sem complicação.</p>
        </div>
        <div className="faq-list">
          {faqs.map(([q, a]) => (
            <details key={q}>
              <summary>
                {q}
                <span>+</span>
              </summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>
      <section className="final-cta section-container">
        <div>
          <span className="cta-sparkle">✦</span>
          <h2>
            A próxima boa conversa
            <br />
            do seu negócio começa aqui.
          </h2>
          <p>Menos tarefas. Mais conexões. Mais possibilidades.</p>
          <Button asChild>
            <Link href="/cadastro">
              Começar com o {brand.name} <ArrowRight size={18} />
            </Link>
          </Button>
          <small>Grátis para começar. Sem cartão de crédito.</small>
        </div>
      </section>
    </main>
  );
}
