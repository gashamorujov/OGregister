import { useState } from 'react';
import { FolderIcon } from './Icons';

export default function LoginScreen({ onLogin, hasAccess }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const ok = onLogin(code.trim());
    if (!ok) setError('Yanlış kod. Yenidən cəhd edin.');
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-logo"><FolderIcon /></div>
        <h1>İSTREGISTER</h1>
        <p className="login-sub">Tədris Reyestri İdarəetmə Sistemi</p>

        <form onSubmit={handleSubmit}>
          <label className="login-label" htmlFor="access-code">Giriş kodu</label>
          <input
            id="access-code"
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            className="login-input"
            placeholder="••••"
            value={code}
            maxLength={10}
            onChange={(e) => { setCode(e.target.value); setError(''); }}
            autoFocus
          />
          {error && <div className="login-error">{error}</div>}

          <button type="submit" className="btn-login">Giriş</button>
        </form>

      </div>
    </div>
  );
}

