import { useEffect, useRef } from 'react';
import {
  ClipboardIcon, DeleteIcon, JournalIcon, DocIcon,
} from './Icons';

export default function ContextMenu({
  x, y, onClose, onDelete, onTrainingPlan, onJournal, onProtokol,
}) {
  const ref = useRef(null);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const k = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', h);
    document.addEventListener('keydown', k);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k); };
  }, [onClose]);

  return (
    <div ref={ref} className="context-menu" style={{ left: x, top: y }} onContextMenu={(e) => e.preventDefault()}>
      <div className="context-menu-header">Əməliyyatlar</div>
      <div className="context-menu-item highlight" onClick={onTrainingPlan}>
        <span className="menu-icon"><ClipboardIcon /></span> Training Plan
      </div>
      <div className="context-menu-item highlight" onClick={onJournal}>
        <span className="menu-icon"><JournalIcon /></span> Jurnal
      </div>
      <div className="context-menu-item highlight" onClick={onProtokol}>
        <span className="menu-icon"><DocIcon /></span> Protokol
      </div>
      <div className="context-menu-divider" />
      <div className="context-menu-item danger" onClick={onDelete}>
        <span className="menu-icon"><DeleteIcon /></span> Sətri sil
      </div>
    </div>
  );
}
