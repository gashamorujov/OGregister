import { useState, useRef, useEffect } from 'react';
import { CloseIcon } from './Icons';

export default function FilterPanel({ field, headerName, values, selected, onApply, onClose }) {
  const [searchText, setSearchText] = useState('');
  const [checked, setChecked] = useState(new Set(selected));
  const ref = useRef(null);

  useEffect(() => setChecked(new Set(selected)), [selected]);

  useEffect(() => {
    const h = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);

  const filtered = values.filter(v =>
    v.toLowerCase().includes(searchText.toLowerCase())
  );

  const toggle = (v) => setChecked(prev => {
    const n = new Set(prev);
    n.has(v) ? n.delete(v) : n.add(v);
    return n;
  });

  const toggleAll = () => {
    setChecked(checked.size === filtered.length ? new Set() : new Set(filtered));
  };

  return (
    <div className="filter-overlay">
      <div className="filter-panel" ref={ref}>
        <div className="filter-header">
          <h3>{headerName}</h3>
          <button className="filter-close" onClick={onClose} aria-label="Bağla"><CloseIcon /></button>
        </div>
        <div className="filter-search">
          <input
            type="text"
            placeholder="Axtar..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            autoFocus
          />
        </div>
        <label className="filter-check filter-check-all">
          <input
            type="checkbox"
            checked={checked.size === filtered.length && filtered.length > 0}
            onChange={toggleAll}
          />
          Hamısı ({filtered.length})
        </label>
        <div className="filter-values">
          {filtered.map(v => (
            <label className="filter-check" key={v}>
              <input type="checkbox" checked={checked.has(v)} onChange={() => toggle(v)} />
              <span>{v}</span>
            </label>
          ))}
          {filtered.length === 0 && <div className="filter-empty">Nəticə tapılmadı</div>}
        </div>
        <div className="filter-footer">
          <button className="btn-secondary" onClick={onClose}>Ləğv</button>
          <button className="btn-primary" onClick={() => onApply(field, Array.from(checked))}>
            Təsdiq
          </button>
        </div>
      </div>
    </div>
  );
}

