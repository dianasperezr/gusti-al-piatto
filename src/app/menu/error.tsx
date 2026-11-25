"use client";

export default function MenuError({ reset }: { reset: () => void }) {
  return <main className="login-page"><div className="panel login-card">
    <h1>Menú no disponible</h1>
    <p>Inténtalo de nuevo en unos instantes.</p>
    <div className="export-links"><button className="button primary" onClick={reset}>Volver a intentar</button></div>
  </div></main>;
}
