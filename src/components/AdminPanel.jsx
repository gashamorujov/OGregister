import { useState } from 'react';
import {
  CloseIcon, UsersIcon, BookIcon, LayersIcon, ArchiveIcon, JournalIcon, DocIcon,
  PlusIcon, DeleteIcon, DownloadIcon, RefreshIcon, EditIcon, CheckIcon,
} from './Icons';
import useTeachers from '../lib/useTeachers';
import useCourseSettings from '../lib/useCourseSettings';
import useGroupCounters from '../lib/useGroupCounters';
import useArchive from '../lib/useArchive';
import courses from '../data/courses';
import {
  downloadBase64File, mimeForFileName, bufferToBase64, base64ToBuffer,
} from '../lib/downloadFile';
import { fetchLogoBuffer } from '../lib/logo';
import { generateTrainingPlan } from '../lib/excelGenerator';
import { generateJournal } from '../lib/journalGenerator';
import { generateProtokol } from '../lib/protokolGenerator';

const DEFAULT_CODE = '0706';

function getCode() {
  return localStorage.getItem('istregister_passcode') || DEFAULT_CODE;
}

function setCode(code) {
  localStorage.setItem('istregister_passcode', code);
}

export function getAccessCode() {
  return getCode();
}

/* ── Şifrə ── */
function PasswordTab() {
  const [currentCode, setCurrentCode] = useState('');
  const [newCode, setNewCode] = useState('');
  const [confirmCode, setConfirmCode] = useState('');
  const [msg, setMsg] = useState('');
  const [msgOk, setMsgOk] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSave = (e) => {
    e.preventDefault();
    setMsg('');
    setMsgOk(false);
    if (currentCode !== getCode()) { setMsg('Cari kod yanlışdır.'); return; }
    if (!newCode || newCode.length < 4) { setMsg('Yeni kod minimum 4 simvol olmalıdır.'); return; }
    if (newCode !== confirmCode) { setMsg('Yeni kodlar uyğun gəlmir.'); return; }
    setLoading(true);
    setTimeout(() => {
      setCode(newCode);
      setMsg('Kod uğurla dəyişdirildi.');
      setMsgOk(true);
      setCurrentCode(''); setNewCode(''); setConfirmCode('');
      setLoading(false);
    }, 400);
  };

  return (
    <form className="admin-form" onSubmit={handleSave}>
      <label className="admin-label">Cari giriş kodu</label>
      <input type="password" inputMode="numeric" className="admin-input" placeholder="••••" value={currentCode} onChange={(e) => setCurrentCode(e.target.value)} autoFocus />
      <label className="admin-label">Yeni kod</label>
      <input type="password" inputMode="numeric" className="admin-input" placeholder="••••" value={newCode} onChange={(e) => setNewCode(e.target.value)} />
      <label className="admin-label">Yeni kodu təsdiqlə</label>
      <input type="password" inputMode="numeric" className="admin-input" placeholder="••••" value={confirmCode} onChange={(e) => setConfirmCode(e.target.value)} />
      {msg && <div className={`admin-msg ${msgOk ? 'ok' : 'err'}`}>{msg}</div>}
      <button className="btn-admin-save" type="submit" disabled={loading}>
        {loading ? 'Yadda saxlanılır...' : 'Kodu dəyişdir'}
      </button>
    </form>
  );
}

/* ── Müəllimlər ── */
function TeachersTab() {
  const {
    teachers, loading, addTeacher, updateTeacher, removeTeacher,
  } = useTeachers();
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const handleAdd = (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    addTeacher(newName);
    setNewName('');
  };

  const startEdit = (t) => { setEditingId(t._id); setEditingName(t.name); };
  const saveEdit = () => {
    if (editingName.trim()) updateTeacher(editingId, { name: editingName.trim() });
    setEditingId(null);
  };

  return (
    <div className="admin-tab-content">
      <form className="admin-inline-form" onSubmit={handleAdd}>
        <input
          className="admin-input"
          placeholder="Yeni müəllimin adı"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button type="submit" className="btn-primary btn-compact"><PlusIcon /> Əlavə et</button>
      </form>

      {loading ? <div className="admin-loading">Yüklənir...</div> : (
        <div className="admin-list">
          {teachers.length === 0 && <div className="admin-empty">Hələ müəllim yoxdur.</div>}
          {teachers.map((t) => (
            <div className="admin-list-row" key={t._id}>
              {editingId === t._id ? (
                <input
                  className="admin-input admin-input-inline"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingId(null); }}
                  autoFocus
                />
              ) : (
                <span className={`admin-list-name ${t.active ? '' : 'inactive'}`}>{t.name}</span>
              )}
              <div className="admin-list-actions">
                {editingId === t._id ? (
                  <button className="btn-icon" onClick={saveEdit} title="Yadda saxla"><CheckIcon /></button>
                ) : (
                  <button className="btn-icon" onClick={() => startEdit(t)} title="Redaktə et"><EditIcon /></button>
                )}
                <button
                  className={`btn-icon ${t.active ? '' : 'active-toggle-off'}`}
                  onClick={() => updateTeacher(t._id, { active: !t.active })}
                  title={t.active ? 'Deaktiv et' : 'Aktiv et'}
                >
                  {t.active ? 'Aktiv' : 'Deaktiv'}
                </button>
                {confirmDeleteId === t._id ? (
                  <>
                    <button className="btn-icon danger" onClick={() => { removeTeacher(t._id); setConfirmDeleteId(null); }}>Bəli</button>
                    <button className="btn-icon" onClick={() => setConfirmDeleteId(null)}>Xeyr</button>
                  </>
                ) : (
                  <button className="btn-icon danger" onClick={() => setConfirmDeleteId(t._id)} title="Sil"><DeleteIcon /></button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Kurslar ── */
function CoursesTab() {
  const { settings, loading, updateSetting } = useCourseSettings();
  const [drafts, setDrafts] = useState({});

  const draftFor = (code, field, fallback) => {
    const d = drafts[code];
    if (d && d[field] != null) return d[field];
    return fallback;
  };

  const setDraft = (code, field, val) => {
    setDrafts((prev) => ({ ...prev, [code]: { ...(prev[code] || {}), [field]: val } }));
  };

  const commit = (code, field, current) => {
    const draft = drafts[code];
    if (!draft || draft[field] == null || draft[field] === '') return;
    const num = Number(draft[field]);
    if (Number.isNaN(num) || num === current) return;
    updateSetting(code, { [field]: num });
  };

  if (loading) return <div className="admin-loading">Yüklənir...</div>;

  return (
    <div className="admin-tab-content">
      <p className="admin-hint">Hər kursun müddəti (gün) Jurnal tarixlərini, maksimum iştirakçı sayı isə avtomatik qruplaşdırmanı təyin edir.</p>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Kod</th>
              <th>Kurs adı</th>
              <th>Gün sayı</th>
              <th>Maks. iştirakçı</th>
            </tr>
          </thead>
          <tbody>
            {settings.map((s) => (
              <tr key={s.code}>
                <td className="mono">{s.code}</td>
                <td className="admin-table-name">{s.name}</td>
                <td>
                  <input
                    type="number"
                    className="admin-input admin-input-sm"
                    min={1}
                    value={draftFor(s.code, 'days', s.days)}
                    onChange={(e) => setDraft(s.code, 'days', e.target.value)}
                    onBlur={() => commit(s.code, 'days', s.days)}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    className="admin-input admin-input-sm"
                    min={1}
                    value={draftFor(s.code, 'maxParticipants', s.maxParticipants)}
                    onChange={(e) => setDraft(s.code, 'maxParticipants', e.target.value)}
                    onBlur={() => commit(s.code, 'maxParticipants', s.maxParticipants)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Qrup Nömrələri ── */
function CountersTab() {
  const {
    counters, loading, peekNext, setCounter, currentYear,
  } = useGroupCounters();
  const allCodes = Object.keys(courses);
  const [drafts, setDrafts] = useState({});
  const [savedCode, setSavedCode] = useState(null);

  const draft = (code) => drafts[code] || {};

  // Real-time preview: use draft value if exists, else Firebase value
  const previewNext = (code) => {
    const d = draft(code);
    if (d.seq != null && d.seq !== '') {
      const seq = Number(d.seq) + 1;
      return `${String(seq).padStart(3, '0')}/${currentYear}`;
    }
    return peekNext(code);
  };

  const handleSave = (code) => {
    const d = draft(code);
    const seq = d.seq != null ? Number(d.seq) : (counters[code]?.seq || 0);
    setCounter(code, seq);
    setSavedCode(code);
    setTimeout(() => setSavedCode(null), 1500);
  };

  if (loading) return <div className="admin-loading">Yüklənir...</div>;

  return (
    <div className="admin-tab-content">
      <p className="admin-hint">
        Cari sıranı dəyişib "Saxla"ya basın — növbəti nömrə <strong>real-time</strong> yenilənir.
        Cari il: {currentYear}. Yeni ilə keçdikdə avtomatik dəyişir.
      </p>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Kod</th>
              <th>Kurs adı</th>
              <th>Cari sıra</th>
              <th>İl</th>
              <th>Növbəti nömrə</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {allCodes.map((code) => {
              const c = counters[code] || {};
              return (
                <tr key={code}>
                  <td className="mono">{code}</td>
                  <td className="admin-table-name">{courses[code]?.shortName || code}</td>
                  <td>
                    <input
                      type="number"
                      className="admin-input admin-input-sm"
                      min={0}
                      value={draft(code).seq != null ? draft(code).seq : (c.seq || 0)}
                      onChange={(e) => setDrafts((p) => ({ ...p, [code]: { ...p[code], seq: e.target.value } }))}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSave(code); }}
                    />
                  </td>
                  <td className="mono admin-year-cell">{currentYear}</td>
                  <td className="mono">{previewNext(code)}</td>
                  <td>
                    <button className="btn-icon" onClick={() => handleSave(code)} title="Yadda saxla">
                      {savedCode === code ? <CheckIcon /> : 'Saxla'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Tək Arxiv Sənədi Sətri ── */
function ArchiveRow({ item, kind, getDays, activeTeachers, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editTeacher, setEditTeacher] = useState('');
  const [editGroupNum, setEditGroupNum] = useState('');
  const [busyId, setBusyId] = useState(null);

  const { updateEntry } = useArchive(kind);

  const startEdit = () => {
    setEditingId(item._id);
    setEditTeacher(item.teacher || '');
    setEditGroupNum(item.groupNum || '');
  };

  const saveEdit = async () => {
    setBusyId(item._id);
    try {
      const logoBuffer = await fetchLogoBuffer();
      const group = {
        courseCode: item.courseCode,
        courseName: item.courseName,
        courseHours: item.courseHours,
        startDate: item.startDate,
        students: item.students || [],
        teacher: editTeacher,
        groupNum: editGroupNum,
      };
      let result;
      if (kind === 'journal') {
        result = await generateJournal([group], { logoBuffer, getDays });
      } else if (kind === 'protokol') {
        result = await generateProtokol(group, { getDays });
      } else {
        result = await generateTrainingPlan([group], logoBuffer);
      }
      const fileBase64 = bufferToBase64(result.buffer);
      await updateEntry(item._id, {
        teacher: editTeacher, groupNum: editGroupNum, fileBase64, fileName: result.fileName,
      });
      setEditingId(null);
    } catch (err) {
      console.error('Archive regenerate failed:', err);
    } finally {
      setBusyId(null);
    }
  };

  const handleDownload = () => downloadBase64File(item.fileBase64, item.fileName || 'sənəd');

  const handleReopen = () => {
    try {
      const buf = base64ToBuffer(item.fileBase64);
      const blob = new Blob([buf], { type: mimeForFileName(item.fileName) });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      console.error('Reopen failed:', err);
    }
  };

  const isEditing = editingId === item._id;

  return (
    <div className="archive-row">
      <div className="archive-info">
        <strong>{item.courseName || item.courseCode}</strong>
        <span className="archive-meta">
          {item.courseCode} · {item.groupNum || '—'} · {item.teacher || '—'} · {item.studentCount ?? (item.students || []).length} nəfər
        </span>
        <span className="archive-meta subtle">
          {item.startDate || ''} {item.createdAt ? `· ${new Date(item.createdAt).toLocaleDateString('az-AZ')}` : ''}
        </span>
      </div>

      {isEditing ? (
        <div className="archive-edit-form">
          <select className="tp-select" value={editTeacher} onChange={(e) => setEditTeacher(e.target.value)}>
            <option value="">— Müəllim seçin —</option>
            {activeTeachers.map((t) => <option key={t._id} value={t.name}>{t.name}</option>)}
          </select>
          <input className="tp-input" value={editGroupNum} onChange={(e) => setEditGroupNum(e.target.value)} placeholder="Qrup nömrəsi" />
          <button className="btn-primary btn-compact" disabled={busyId === item._id} onClick={saveEdit}>
            {busyId === item._id ? 'Yenilənir...' : 'Yadda saxla'}
          </button>
          <button className="btn-secondary btn-compact" onClick={() => setEditingId(null)}>Ləğv</button>
        </div>
      ) : (
        <div className="archive-actions">
          <button className="btn-icon" onClick={handleDownload} title="Yüklə"><DownloadIcon /></button>
          <button className="btn-icon" onClick={handleReopen} title="Yenidən aç"><RefreshIcon /></button>
          <button className="btn-icon" onClick={startEdit} title="Redaktə et"><EditIcon /></button>
          {confirmDelete ? (
            <>
              <button className="btn-icon danger" onClick={() => { onDelete(item._id); setConfirmDelete(false); }}>Bəli</button>
              <button className="btn-icon" onClick={() => setConfirmDelete(false)}>Xeyr</button>
            </>
          ) : (
            <button className="btn-icon danger" onClick={() => setConfirmDelete(true)} title="Sil"><DeleteIcon /></button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Arxiv Tab-ı (3 alt-tab: Training Plan, Jurnal, Protokol) ── */
function ArchivesTab({ getDays }) {
  const [subTab, setSubTab] = useState('trainingPlan');
  const { activeTeachers } = useTeachers();

  const {
    items: tpItems, loading: tpLoading, removeEntry: tpRemove,
  } = useArchive('trainingPlan');
  const {
    items: jItems, loading: jLoading, removeEntry: jRemove,
  } = useArchive('journal');
  const {
    items: pItems, loading: pLoading, removeEntry: pRemove,
  } = useArchive('protokol');

  const SUB_TABS = [
    { id: 'trainingPlan', label: 'Training Planlar', icon: ArchiveIcon },
    { id: 'journal',      label: 'Jurnallar',        icon: JournalIcon },
    { id: 'protokol',     label: 'Protokollar',      icon: DocIcon },
  ];

  const current = subTab === 'trainingPlan'
    ? { items: tpItems, loading: tpLoading, remove: tpRemove, kind: 'trainingPlan' }
    : subTab === 'journal'
    ? { items: jItems,  loading: jLoading,  remove: jRemove,  kind: 'journal'      }
    : { items: pItems,  loading: pLoading,  remove: pRemove,  kind: 'protokol'     };

  return (
    <div className="admin-tab-content">
      {/* Sub-tabs */}
      <div className="admin-subtabs">
        {SUB_TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              className={`admin-subtab ${subTab === t.id ? 'active' : ''}`}
              onClick={() => setSubTab(t.id)}
            >
              {Icon && <Icon />} {t.label}
            </button>
          );
        })}
      </div>

      {current.loading ? (
        <div className="admin-loading">Yüklənir...</div>
      ) : current.items.length === 0 ? (
        <div className="admin-empty">Bu bölmədə hələ arxivlənmiş sənəd yoxdur.</div>
      ) : (
        <div className="archive-list">
          {current.items.map((item) => (
            <ArchiveRow
              key={item._id}
              item={item}
              kind={current.kind}
              getDays={getDays}
              activeTeachers={activeTeachers}
              onDelete={current.remove}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const TABS = [
  { id: 'password',  label: 'Şifrə'          },
  { id: 'teachers',  label: 'Müəllimlər', icon: UsersIcon   },
  { id: 'courses',   label: 'Kurslar',    icon: BookIcon     },
  { id: 'counters',  label: 'Qrup №',     icon: LayersIcon   },
  { id: 'archives',  label: 'Arxiv',      icon: ArchiveIcon  },
];

export default function AdminPanel({ onClose }) {
  const [tab, setTab] = useState('teachers');
  const { getDays } = useCourseSettings();

  return (
    <div className="admin-overlay">
      <div className="admin-panel admin-panel-wide">
        <div className="admin-header">
          <h2>Admin Panel</h2>
          <button className="admin-close" onClick={onClose} aria-label="Bağla"><CloseIcon /></button>
        </div>

        <div className="admin-tabs">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                className={`admin-tab ${tab === t.id ? 'active' : ''}`}
                onClick={() => setTab(t.id)}
              >
                {Icon && <Icon />} {t.label}
              </button>
            );
          })}
        </div>

        <div className="admin-tab-body">
          {tab === 'password' && <PasswordTab />}
          {tab === 'teachers' && <TeachersTab />}
          {tab === 'courses'  && <CoursesTab />}
          {tab === 'counters' && <CountersTab />}
          {tab === 'archives' && <ArchivesTab getDays={getDays} />}
        </div>
      </div>
    </div>
  );
}
