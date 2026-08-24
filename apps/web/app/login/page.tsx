import { LoginForm } from '../../components/login-form';
import { OesMark } from '../../components/oes-mark';
import styles from './login.module.css';

export default function LoginPage(): React.JSX.Element {
  return (
    <main className={styles.page}>
      <section className={styles.story} aria-label="Sistema de competencias OES">
        <OesMark />
        <div className={styles.storyCopy}>
          <span className={styles.eyebrow}>Temporada 2026</span>
          <h1>La competencia empieza con reglas claras.</h1>
          <p>Sorteos verificables, resultados con doble control y tablas que se actualizan desde evidencia confirmada.</p>
        </div>
        <div className={styles.storyIndex}><span>01</span><p>Fuente única<br />de verdad</p></div>
      </section>
      <section className={styles.access}>
        <div className={styles.card}>
          <span className={styles.cardEyebrow}>Acceso institucional</span>
          <h2>Ingresá a tu cuenta</h2>
          <p className={styles.intro}>Usá las credenciales asignadas por la administración de OES.</p>
          <LoginForm />
        </div>
        <p className={styles.legal}>Las operaciones oficiales quedan asociadas a tu identidad y registradas para auditoría.</p>
      </section>
    </main>
  );
}
