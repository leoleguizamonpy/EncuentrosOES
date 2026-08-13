import { LoginForm } from '../../components/login-form';
import { OesMark } from '../../components/oes-mark';

export default function LoginPage(): React.JSX.Element {
  return (
    <main className="login-page">
      <section className="login-story" aria-label="Sistema de competencias OES">
        <OesMark />
        <div className="story-copy">
          <span className="eyebrow">Temporada 2026</span>
          <h1>La competencia empieza con reglas claras.</h1>
          <p>Sorteos verificables, resultados con doble control y tablas que se actualizan desde evidencia confirmada.</p>
        </div>
        <div className="story-index"><span>01</span><p>Fuente única<br />de verdad</p></div>
      </section>
      <section className="login-access">
        <div className="login-card">
          <span className="eyebrow eyebrow--dark">Acceso institucional</span>
          <h2>Ingresá a tu cuenta</h2>
          <p className="login-intro">Usá las credenciales asignadas por la administración de OES.</p>
          <LoginForm />
        </div>
        <p className="legal-note">Las operaciones oficiales quedan asociadas a tu identidad y registradas para auditoría.</p>
      </section>
    </main>
  );
}
