export default function Loading() {
  return (
    <div aria-label="Carregando painel" role="status">
      <div className="loading-block" style={{ height: 80, marginBottom: 25 }} />
      <div className="metrics-grid">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="loading-block" />
        ))}
      </div>
      <div className="loading-block" style={{ height: 300, marginTop: 25 }} />
    </div>
  );
}
