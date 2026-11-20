import { img } from '../api.js';

// Profile picture. Kapag walang larawan: bilog na may unang letra ng pangalan.
export default function Avatar({ src, name = '', size = 40, className = '' }) {
  const letter = String(name).trim().charAt(0).toUpperCase();
  return (
    <span className={`av ${className}`} style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }} aria-hidden="true">
      {src ? <img src={img(src)} alt="" /> : (letter || <i className="fa-solid fa-user" />)}
    </span>
  );
}
