'use client';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUp, CheckCheck, MoreHorizontal, Sparkles } from 'lucide-react';
import { ChannelIcon, channelLabel } from '@/components/channel-icon';
const channels = ['whatsapp', 'telegram', 'sms'] as const;
export function ChatDemo() {
  const [index, setIndex] = useState(0);
  const [choice, setChoice] = useState('Quero agendar um horário 😊');
  useEffect(() => {
    const timer = setInterval(() => setIndex((i) => (i + 1) % channels.length), 6000);
    return () => clearInterval(timer);
  }, []);
  const channel = channels[index]!;
  return (
    <div className="hero-visual">
      <div className="orbit orbit-one" />
      <div className="orbit orbit-two" />
      <div className="floating-card floating-top">
        <span className="mini-check">✓</span>
        <div>
          <strong>Atendimento no piloto automático</strong>
          <span>Seu cliente recebe atenção. Sempre.</span>
        </div>
      </div>
      <div className="chat-window card">
        <div className="chat-window-header">
          <span className="chat-avatar">
            <Sparkles size={22} />
          </span>
          <div>
            <strong>Assistente Aurora</strong>
            <span>
              <i /> Disponível para ajudar
            </span>
          </div>
          <MoreHorizontal size={20} className="muted" />
        </div>
        <div className="chat-channel-tabs" role="tablist" aria-label="Exemplo por canal">
          {channels.map((c, i) => (
            <button
              key={c}
              role="tab"
              aria-selected={index === i}
              onClick={() => setIndex(i)}
              className={index === i ? 'active' : ''}
            >
              <ChannelIcon channel={c} size={13} />
              {channelLabel(c)}
            </button>
          ))}
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            className="chat-preview-messages"
            key={channel}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25 }}
          >
            <span className="chat-date">Hoje</span>
            <div className="preview-bubble incoming">
              Oi, Camila! 👋
              <br />
              Que bom ter você por aqui. Como posso ajudar?<span>10:24</span>
            </div>
            <div className="preview-options">
              {channel === 'sms' ? (
                <p>
                  Responda 1 para agendar, 2 para consultar horários ou 3 para falar com a equipe.
                </p>
              ) : (
                <>
                  <button onClick={() => setChoice('Quero agendar um horário 😊')}>
                    Quero agendar <span>↗</span>
                  </button>
                  <button onClick={() => setChoice('Quais horários estão disponíveis?')}>
                    Ver horários <span>↗</span>
                  </button>
                  <button onClick={() => setChoice('Quero falar com sua equipe.')}>
                    Falar com a equipe <span>↗</span>
                  </button>
                </>
              )}
            </div>
            <div className="preview-bubble outgoing">
              {choice}
              <span>
                10:25 <CheckCheck size={13} />
              </span>
            </div>
            <div className="preview-bubble incoming">
              {choice.includes('equipe')
                ? 'Claro! Nossa equipe já vai te receber. 💜'
                : choice.includes('disponíveis')
                  ? 'Temos horários pela manhã e à tarde. Qual prefere?'
                  : 'Claro! Vou te ajudar a encontrar o melhor horário. 💜'}
              <span>10:25</span>
            </div>
          </motion.div>
        </AnimatePresence>
        <div className="chat-input-preview">
          <span>Exemplo de conversa</span>
          <span className="send-preview">
            <ArrowUp size={18} />
          </span>
        </div>
      </div>
      <div className="floating-card floating-bottom">
        <span className="floating-icon">
          <Sparkles size={19} />
        </span>
        <div>
          <strong>Você cuida do negócio.</strong>
          <span>O bot cuida do primeiro “oi”.</span>
        </div>
        <span className="mini-sparkle">✦</span>
      </div>
    </div>
  );
}
