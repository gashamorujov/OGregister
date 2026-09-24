import { useState } from 'react';
import { CloseIcon, ImportIcon, JournalIcon } from './Icons';

function parseSeq(groupNum) {
  const [seqStr] = (groupNum || '').split('/');
  return parseInt(seqStr, 10) || 0;
}

function initialEntries(groups, peekNext, groupAssignments = {}) {
  const codeCounts = {};
  const out = {};
  groups.forEach((g) => {
    const saved = groupAssignments[g.key];
    if (saved) {
      out[g.key] = { teacher: saved.teacher || '', groupNum: saved.groupNum || '', touched: true };
      return;
    }
    const base = peekNext(g.courseCode) || '001/26';
    const [seqStr, year] = base.split('/');
    const baseSeq = parseInt(seqStr, 10) || 1;
    const offset = codeCounts[g.courseCode] || 0;
    codeCounts[g.courseCode] = offset + 1;
    const seq = baseSeq + offset;
    const groupNum = `${String(seq).padStart(3, '0')}/${year || ''}`;
    out[g.key] = { teacher: '', groupNum, touched: false };
  });
  return out;
}

/**
 * Shared "assign teacher + group number" step for both document types.
 * `setCounter` — when provided and a group number is manually typed, the
 * Firebase counter is updated to that number so the next auto-generate
 * starts from manual+1 (§ group number persistence spec).
 */
export default function DocGenModal({
  mode, groups, activeTeachers, peekNext, allocate, setCounter, groupAssignments, onConfirm, onCancel,
}) {
  const [entries, setEntries] = useState(() => initialEntries(groups, peekNext, groupAssignments));
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');

  const update = (key, field, val) => {
    setEntries((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] || {}),
        [field]: val,
        ...(field === 'groupNum' ? { touched: true } : {}),
      },
    }));
  };

  const allValid = groups.length > 0 && groups.every((g) => {
    const e = entries[g.key] || {};
    return e.teacher && e.teacher.trim() !== '' && e.groupNum && e.groupNum.trim() !== '';
  });

  const handleConfirm = async () => {
    if (!allValid || confirming) return;
    setConfirming(true);
    setError('');
    try {
      // For auto (untouched) entries: allocate atomically from Firebase
      const untouchedByCode = {};
      groups.forEach((g) => {
        const e = entries[g.key];
        if (!e.touched) {
          untouchedByCode[g.courseCode] = untouchedByCode[g.courseCode] || [];
          untouchedByCode[g.courseCode].push(g.key);
        }
      });

      const finalNumbers = {};
      const codes = Object.keys(untouchedByCode);
      for (let i = 0; i < codes.length; i += 1) {
        const code = codes[i];
        const keys = untouchedByCode[code];
        // eslint-disable-next-line no-await-in-loop
        const nums = await allocate(code, keys.length);
        keys.forEach((k, idx) => { finalNumbers[k] = nums[idx]; });
      }

      // For manual (touched) entries: update Firebase counter so next auto = manual + 1
      if (setCounter) {
        groups.forEach((g) => {
          const e = entries[g.key];
          if (e.touched) {
            setCounter(g.courseCode, parseSeq(e.groupNum));
          }
        });
      }

      const assigned = groups.map((g) => {
        const e = entries[g.key];
        const groupNum = e.touched ? e.groupNum : (finalNumbers[g.key] || e.groupNum);
        return { ...g, teacher: e.teacher, groupNum };
      });

      await onConfirm(assigned);
    } catch (err) {
      console.error('Document generation failed:', err);
      setError('Sənəd yaradılarkən xəta baş verdi. Yenidən cəhd edin.');
      setConfirming(false);
    }
  };

  const isJournal = mode === 'journal';
  const title = isJournal ? 'Jurnal - Qrup Təyinatı' : 'Training Plan - Yükləmə';
  const confirmLabel = isJournal ? 'Təsdiqlə və qrup seç' : 'Yüklə (Excel)';

  return (
    <div className="modal-overlay">
      <div className="modal modal-wide">
        <div className="modal-header">
          <h2>{isJournal ? <JournalIcon /> : <ImportIcon />} {title}</h2>
          <button className="modal-close" onClick={onCancel} aria-label="Bağla"><CloseIcon /></button>
        </div>
        <div className="modal-body">
          <p className="modal-info">
            <strong>{groups.length}</strong> kurs qrupu tapıldı. Hər kurs üçün <strong>müəllim</strong> təyin edin
            — qrup nömrəsi avtomatik təklif olunur, istəsəniz dəyişə bilərsiniz:
          </p>
          <div className="course-group-list">
            {groups.map((g) => {
              const e = entries[g.key] || {};
              const hasTeacher = e.teacher && e.teacher.trim() !== '';
              return (
                <div className="course-group-row" key={g.key}>
                  <div className="course-group-info">
                    <strong>{g.courseName}{g.subLabel ? ` — ${g.subLabel}` : ''}</strong>
                    <span className="course-group-meta">
                      {g.courseCode} · {g.startDate || '—'} · {g.studentCount} nəfər
                    </span>
                  </div>
                  <div className="tp-fields">
                    <div className="tp-field">
                      <label className="tp-label">Qrup nömrəsi</label>
                      <input
                        className="tp-input"
                        type="text"
                        value={e.groupNum || ''}
                        onChange={(ev) => update(g.key, 'groupNum', ev.target.value)}
                      />
                    </div>
                    <div className="tp-field">
                      <label className="tp-label">Müəllim *</label>
                      <select
                        className={`tp-select ${hasTeacher ? '' : 'tp-required'}`}
                        value={e.teacher || ''}
                        onChange={(ev) => update(g.key, 'teacher', ev.target.value)}
                      >
                        <option value="">— Müəllim seçin (məcburi) —</option>
                        {activeTeachers.map((t) => <option key={t._id} value={t.name}>{t.name}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {error && <div className="admin-msg err">{error}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onCancel} disabled={confirming}>Ləğv</button>
          <button className="btn-primary" disabled={!allValid || confirming} onClick={handleConfirm}>
            {isJournal ? <JournalIcon /> : <ImportIcon />} {confirming ? 'Yaradılır...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
