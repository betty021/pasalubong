import './progress.css';
import { STATUS } from '../format.js';

const FLOW = ['pending', 'preparing', 'ready', 'completed'];

// Hakbang-hakbang na takbo ng order (para sa customer)
export default function OrderProgress({ status }) {
  if (status === 'cancelled') return <div className="err">This order was cancelled.</div>;
  const at = FLOW.indexOf(status);
  return (
    <ol className="progress">
      {FLOW.map((s, i) => (
        <li key={s} className={i < at || status === 'completed' ? 'done' : i === at ? 'now' : ''}>
          <span className="dot">{i < at || status === 'completed' ? <i className="fa-solid fa-check" aria-hidden="true" /> : i + 1}</span>{STATUS[s].label}
        </li>
      ))}
    </ol>
  );
}
