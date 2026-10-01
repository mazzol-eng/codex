import { Pricing } from '@/components/marketing/pricing';
export const metadata = { title: 'Preços' };
export default function Page() {
  return (
    <main id="main-content" className="section-container pricing-page">
      <div className="section-heading">
        <span className="eyebrow">CRESÇA NO SEU RITMO</span>
        <h1>
          O plano certo para
          <br />a sua próxima conquista.
        </h1>
        <p>Valores transparentes, em reais. Sem cartão para começar.</p>
      </div>
      <Pricing />
    </main>
  );
}
