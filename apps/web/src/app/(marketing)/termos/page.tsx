export const metadata = { title: 'Termos de uso' };
export default function Page() {
  return (
    <main id="main-content" className="section-container legal-page">
      <span className="eyebrow">DOCUMENTO PROVISÓRIO</span>
      <h1>Termos de uso</h1>
      <div className="card">
        <p>
          Este documento é um placeholder para desenvolvimento e não constitui um contrato ou
          política final.
        </p>
        <h2>Versão de demonstração</h2>
        <p>
          O ambiente inicial permite criar uma conta e uma empresa. Os dados de demonstração são
          fictícios. Não use dados pessoais reais em uma instância de testes.
        </p>
        <h2>Antes da publicação</h2>
        <p>
          A empresa responsável deverá informar sua identidade, contato, bases legais, finalidades,
          retenção de dados, subprocessadores e canais para exercício dos direitos previstos na
          LGPD.
        </p>
        <p>
          As condições comerciais, responsabilidades e regras dos canais deverão passar por revisão
          jurídica antes do uso em produção.
        </p>
      </div>
    </main>
  );
}
