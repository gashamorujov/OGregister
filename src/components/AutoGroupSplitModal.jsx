import { useMemo, useState } from 'react';
import { splitGroupBySize } from '../lib/courseGroups';
import { WarningIcon, CloseIcon } from './Icons';

/**
 * Walks through every course group whose headcount exceeds the course's
 * max-participant setting (§4) and asks how to split it into two
 * sub-groups (§5). Only rendered when at least one group actually
 * overflows — see SpreadsheetTable, which checks that before mounting this.
 */
export default function AutoGroupSplitModal({ groups, getMaxParticipants, onResolved, onCancel }) {
  const overflowing = useMemo(
    () => groups.filter((g) => g.studentCount > getMaxParticipants(g.courseCode)),
    [groups, getMaxParticipants],
  );
  const okGroups = useMemo(
    () => groups.filter((g) => g.studentCount <= getMaxParticipants(g.courseCode)),
    [groups, getMaxParticipants],
  );

  const [queueIdx, setQueueIdx] = useState(0);
  const [resolved, setResolved] = useState([]);
  const [step, setStep] = useState('ask'); // 'ask' | 'confirm'
  const [firstCount, setFirstCount] = useState(() => {
    const g = overflowing[0];
    return g ? Math.ceil(g.studentCount / 2) : 0;
  });

  const current = overflowing[queueIdx];
  if (!current) {
    // Nothing left to resolve (shouldn't normally render, but guard anyway).
    return null;
  }

  const max = getMaxParticipants(current.courseCode);
  const total = current.studentCount;
  const secondCount = total - firstCount;
  const validFirst = firstCount >= 1 && firstCount <= total - 1;

  const goNext = (splitPair) => {
    const nextResolved = splitPair ? [...resolved, ...splitPair] : [...resolved, current];
    const nextIdx = queueIdx + 1;
    if (nextIdx >= overflowing.length) {
      onResolved([...okGroups, ...nextResolved]);
      return;
    }
    setResolved(nextResolved);
    setQueueIdx(nextIdx);
    setStep('ask');
    const ng = overflowing[nextIdx];
    setFirstCount(Math.ceil(ng.studentCount / 2));
  };

  const handleAskSubmit = (e) => {
    e.preventDefault();
    if (!validFirst) return;
    setStep('confirm');
  };

  const handleConfirmYes = () => {
    const [g1, g2] = splitGroupBySize(current, firstCount);
    goNext([g1, g2]);
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h2>Avtomatik Qruplaşdırma</h2>
          <button className="modal-close" onClick={onCancel} aria-label="Bağla"><CloseIcon /></button>
        </div>
        <div className="modal-body">
          <div className="autogroup-warning">
            <span className="autogroup-warning-icon"><WarningIcon /></span>
            <div>
              <strong>Kurs üzrə maksimum iştirakçı sayı aşılmışdır.</strong>
              <div className="autogroup-meta">
                {current.courseName} ({current.courseCode}) · Maksimum: {max} nəfər
              </div>
            </div>
          </div>

          <div className="autogroup-count">Cari iştirakçı sayı: <strong>{total}</strong></div>

          {step === 'ask' && (
            <form onSubmit={handleAskSubmit} className="autogroup-form">
              <label className="tp-label">Birinci qrupun sayı</label>
              <input
                type="number"
                className="tp-input"
                min={1}
                max={total - 1}
                value={firstCount}
                onChange={(e) => setFirstCount(Number(e.target.value) || 0)}
                autoFocus
              />
              <div className="autogroup-preview">
                {validFirst
                  ? <>Qrup 1 → <strong>{firstCount}</strong> nəfər, Qrup 2 → <strong>{secondCount}</strong> nəfər</>
                  : <span className="autogroup-invalid">1 ilə {total - 1} arasında bir ədəd daxil edin.</span>}
              </div>
              <div className="modal-footer no-border">
                <button type="button" className="btn-secondary" onClick={onCancel}>Ləğv</button>
                <button type="submit" className="btn-primary" disabled={!validFirst}>Davam et</button>
              </div>
            </form>
          )}

          {step === 'confirm' && (
            <div className="autogroup-form">
              <div className="autogroup-question">
                <strong>{firstCount}</strong> və <strong>{secondCount}</strong> nəfərlik iki qrup yaradılsın?
              </div>
              <div className="modal-footer no-border">
                <button type="button" className="btn-secondary" onClick={() => setStep('ask')}>Geri</button>
                <button type="button" className="btn-primary" onClick={handleConfirmYes}>Bəli, yarat</button>
              </div>
            </div>
          )}

          {overflowing.length > 1 && (
            <div className="autogroup-progress">
              Qrup {queueIdx + 1} / {overflowing.length}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
