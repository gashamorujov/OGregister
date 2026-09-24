import { useEffect, useMemo, useRef, useState } from 'react';
import { CloseIcon, DownloadIcon, CalendarIcon } from './Icons';
import { getPlanCourses, getPlanDateRange, renderPlanImage } from '../lib/planImage';

export default function PlanModal({ rows, getDays, onClose }) {
  const initialRange = getPlanDateRange(7);
  const [days, setDays] = useState('7');
  const [startDateInput, setStartDateInput] = useState(initialRange.inputStartDate);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const startDateRef = useRef(null);
  const range = useMemo(
    () => getPlanDateRange(days, new Date(), startDateInput),
    [days, startDateInput],
  );

  useEffect(() => {
    const h = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const handleGenerate = () => {
    const count = Number(days);
    if (!Number.isInteger(count) || count < 1 || count > 366) {
      setError('1 ilə 366 arasında tam gün sayı daxil edin.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const nextRange = getPlanDateRange(count, new Date(), startDateInput);
      const courses = getPlanCourses(rows, nextRange.startDate, nextRange.endDate, getDays);
      const image = renderPlanImage(courses);
      setResult({ ...image, courses, ...nextRange });
    } catch (err) {
      console.error('Plan şəkli yaradılmadı:', err);
      setError('Plan yaradılarkən xəta baş verdi. Yenidən cəhd edin.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal plan-modal">
        <div className="modal-header">
          <h2><CalendarIcon /> Plan</h2>
          <button className="modal-close" onClick={onClose} aria-label="Bağla"><CloseIcon /></button>
        </div>
        <div className="modal-body">
          {!result ? (
            <div className="plan-form">
              <p className="modal-info">
                Cari lokal tarixdən başlayaraq plan üçün gün sayını daxil edin.
                Başlanğıc və son tarix hesablamaya daxil edilir.
              </p>
              <label className="tp-label" htmlFor="plan-days">Neçə günlük plan yaradılsın?</label>
              <input
                id="plan-days"
                className="tp-input plan-days-input"
                type="number"
                min="1"
                max="366"
                step="1"
                value={days}
                autoFocus
                onChange={(event) => setDays(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') handleGenerate(); }}
              />
              <label className="tp-label plan-start-label" htmlFor="plan-start-date">Başlanğıc tarixi</label>
              <input
                ref={startDateRef}
                id="plan-start-date"
                className="tp-input plan-start-date"
                type="date"
                value={range.inputStartDate}
                title="Təqvimi açmaq üçün tarix üzərinə iki dəfə klik edin"
                onChange={(event) => {
                  setStartDateInput(event.target.value);
                  setError('');
                }}
                onDoubleClick={() => {
                  if (typeof startDateRef.current?.showPicker === 'function') {
                    startDateRef.current.showPicker();
                  } else {
                    startDateRef.current?.focus();
                  }
                }}
              />
              <div className="plan-date-hint">Tarixi dəyişmək üçün tarix sahəsinə iki dəfə klik edin.</div>
              <div className="plan-range-preview">
                {range.startDate} – {range.endDate}
              </div>
              {error && <div className="admin-msg err">{error}</div>}
            </div>
          ) : (
            <div className="plan-result">
              <div className="plan-result-meta">
                {result.startDate} – {result.endDate} · {result.courses.length} kurs
              </div>
              {result.courses.length === 0 && (
                <div className="plan-empty">Bu tarix aralığında başlayan kurs tapılmadı.</div>
              )}
              <div className="plan-image-frame">
                <img src={result.dataUrl} alt="Plan nəticəsi" />
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          {!result ? (
            <>
              <button className="btn-secondary" onClick={onClose}>Ləğv</button>
              <button className="btn-primary" onClick={handleGenerate} disabled={busy}>
                <CalendarIcon /> {busy ? 'Yaradılır...' : 'Yarat'}
              </button>
            </>
          ) : (
            <>
              <button className="btn-secondary" onClick={() => setResult(null)}>Yeni plan</button>
              <a className="btn-primary plan-download" href={result.dataUrl} download={`Plan_${result.startDate}_${result.endDate}.png`}>
                <DownloadIcon /> Şəkli yüklə
              </a>
              <button className="btn-secondary" onClick={onClose}>Bağla</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}