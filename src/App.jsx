import { useState } from 'react';
import SpreadsheetTable from './components/SpreadsheetTable';
import LoginScreen from './components/LoginScreen';
import AdminPanel, { getAccessCode } from './components/AdminPanel';
import { SettingsIcon, LogoutIcon, FolderIcon } from './components/Icons';
import './App.css';

const SESSION_KEY = 'istregister_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function readSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || !s.access) return null;
    if (Date.now() > (s.expiresAt || 0)) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

function App() {
  const [session, setSession] = useState(() => readSession());
  const [showAdmin, setShowAdmin] = useState(false);

  const handleLogin = (code) => {
    if (code === '__ADMIN__') {
      const s = { access: true, isAdmin: true, expiresAt: Date.now() + SESSION_TTL_MS };
      localStorage.setItem(SESSION_KEY, JSON.stringify(s));
      setSession(s);
      return true;
    }
    if (code === getAccessCode()) {
      const s = { access: true, isAdmin: false, expiresAt: Date.now() + SESSION_TTL_MS };
      localStorage.setItem(SESSION_KEY, JSON.stringify(s));
      setSession(s);
      return true;
    }
    return false;
  };

  const handleLogout = () => {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
  };

  if (!session) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  const isAdmin = session.isAdmin;

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-brand">
          <span className="brand-icon"><FolderIcon /></span>
          <div className="brand-text">
            <h1>İSTREGISTER</h1>
            <span className="brand-sub">Tədris Reyestri İdarəetmə Sistemi</span>
          </div>
        </div>
        <div className="header-right">
          <span className="org-label">Industrial Support and Training MMC</span>
          {isAdmin && (
            <button className="btn-admin-panel" onClick={() => setShowAdmin(true)}>
              <SettingsIcon /> Admin Panel
            </button>
          )}
          <button className="btn-header-text danger logout-btn" onClick={handleLogout}>
            <LogoutIcon /> Çıxış
          </button>
        </div>
      </header>

      <SpreadsheetTable onOpenAdmin={() => setShowAdmin(true)} />

      <footer className="app-footer">
        <span>© 2026 Industrial Support and Training MMC · İSTREGISTER</span>
      </footer>

      {showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} />}
    </div>
  );
}

export default App;
