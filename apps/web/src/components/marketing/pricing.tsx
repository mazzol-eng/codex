'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Check, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatMoney } from '@/lib/utils';
const plans = [
  {
    name: 'Gratuito',
    price: 0,
    description: 'Para dar o primeiro passo.',
    features: [
      '1 bot',
      '100 contatos',
      '500 mensagens por mês',
      '1 pessoa na equipe',
      'Simulador de conversas',
    ],
  },
  {
    name: 'Pro',
    price: 99,
    description: 'Para quem está crescendo.',
    features: [
      '5 bots',
      '2.000 contatos',
      '10.000 mensagens por mês',
      '5 pessoas na equipe',
      'Todos os canais',
    ],
    popular: true,
  },
  {
    name: 'Business',
    price: 299,
    description: 'Para ir ainda mais longe.',
    features: [
      '20 bots',
      '10.000 contatos',
      '50.000 mensagens por mês',
      '15 pessoas na equipe',
      'Todos os canais',
    ],
  },
];
export function Pricing() {
  const [annual, setAnnual] = useState(false);
  return (
    <>
      <div className="billing-toggle" role="group" aria-label="Período de cobrança">
        <button
          aria-pressed={!annual}
          className={!annual ? 'active' : ''}
          onClick={() => setAnnual(false)}
        >
          Mensal
        </button>
        <button
          aria-pressed={annual}
          className={annual ? 'active' : ''}
          onClick={() => setAnnual(true)}
        >
          Anual <span>−20%</span>
        </button>
      </div>
      <div className="pricing-grid">
        {plans.map((plan) => (
          <article key={plan.name} className={`pricing-card card ${plan.popular ? 'popular' : ''}`}>
            {plan.popular && <span className="popular-label">O favorito dos negócios</span>}
            <h3>{plan.name}</h3>
            <p className="muted">{plan.description}</p>
            <div className="price">
              {formatMoney(annual ? plan.price * 0.8 : plan.price).replace(',00', '')}
              <span>/mês</span>
            </div>
            <p className="price-caption">
              {plan.price === 0
                ? 'Grátis para começar.'
                : annual
                  ? `${formatMoney(plan.price * 0.8 * 12)} por ano, em uma cobrança.`
                  : 'Sem compromisso anual.'}
            </p>
            <Button asChild variant={plan.popular ? 'default' : 'outline'}>
              <Link href="/cadastro">
                Começar {plan.price === 0 ? 'grátis' : 'agora'} <ArrowRight size={15} />
              </Link>
            </Button>
            <div className="divider" />
            <ul>
              {plan.features.map((feature) => (
                <li key={feature}>
                  <Check size={15} />
                  {feature}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
      <p className="pricing-note">
        Valores e limites ilustrativos. Cobrança e recursos dos planos serão ativados em uma próxima
        fase.
      </p>
    </>
  );
}
