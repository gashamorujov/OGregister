import { useMemo, useState, useCallback } from 'react';
import {
  CloseIcon, DocIcon, DownloadIcon, CheckIcon,
} from './Icons';
import { generateProtokol } from '../lib/protokolGenerator';
import { downloadDocxBuffer, bufferToBase64 } from '../lib/downloadFile';
import { addDays, buildCourseGroups } from '../lib/courseGroups';

function parseSeq(groupNum) {
  const [seqStr] = (groupNum || '').split('/');
  return parseInt(seqStr, 10) || 0;
}

export default function ProtokolPicker({
  rows, protokolEntries, peekNext, getDays, allocate, setCounter, addProtokolEntry, onClose,
}) {
  const [downloaded, setDownloaded] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [errorId, setErrorId] = useState(null);
  const [groupNums, setGroupNums] = useState({});

  const baseGroups = useMemo(() => {
    const archived = new Map();
    [...(protokolEntries || [])].forEach((entry) => {
      const key = entry.groupKey || `${entry.courseCode}__${entry.startDate || ''}`;
      if (!archived.has(key)) archived.set(key, entry);
    });
    return buildCourseGroups(rows || []).map((group) => {
      const entry = archived.get(group.key);
      return {
        ...group,
        groupNum: entry?.groupNum || peekNext?.(group.courseCode) || '001/26',
        teacher: entry?.teacher || '',
        archiveId: entry?._id || group.key,
      };
    });
  }, [rows, protokolEntries, peekNext]);

  const getGroupNum = useCallback((entry) => {
    return groupNums[entry.key] !== undefined ? groupNums[entry.key] : entry.groupNum;
  }, [groupNums]);

  const handleDownload = async (entry) => {
    const id = entry.archiveId || entry.key;
    setBusyId(id);
    setErrorId(null);
    try {
      let currentGroupNum = getGroupNum(entry);
      const isManual = groupNums[entry.key] !== undefined;
      if (!isManual && allocate) {
        const allocated = await allocate(entry.courseCode, 1);
        currentGroupNum = allocated[0] || currentGroupNum;
      }

      const group = {
        courseCode: entry.courseCode,
        courseName: entry.courseName,
        courseHours: entry.courseHours,
        startDate: entry.startDate,
        teacher: entry.teacher,
        groupNum: currentGroupNum,
        students: entry.students || [],
      };

      const result = await generateProtokol(group, { getDays });
      // Manual protocol numbers advance only the protocol counter.
      if (isManual && setCounter) {
        setCounter(entry.courseCode, parseSeq(currentGroupNum));
      }

      const fileBase64 = bufferToBase64(result.buffer);
      await addProtokolEntry({
        groupKey: entry.key,
        fileName: result.fileName || '',
        fileBase64,
        courseCode: entry.courseCode || '',
        courseName: entry.courseName || '',
        courseHours: Number(entry.courseHours) || 0,
        startDate: entry.startDate || '',
        groupNum: currentGroupNum,
        teacher: entry.teacher || '',
        studentCount: (entry.students || []).length,
        // Realtime Database rejects undefined values. Keep the protocol
        // archive deliberately small and JSON-safe, just like the Journal
        // archive, instead of persisting the full raw registry row.
        students: (entry.students || []).map((s) => ({
          fullName: s.fullName || '',
          rank: s.rank || '',
          email: s.email || '',
          phone: s.phone || '',
        })),
        sourceJournalId: entry._id || '',
      });
      // The download is reported as successful only after the archive write is
      // confirmed, so every downloaded protocol is recoverable from Admin.
      downloadDocxBuffer(result.buffer, result.fileName);
      setDownloaded((prev) => ({ ...prev, [entry.key]: true }));

    } catch (err) {
      console.error('Protokol download failed:', err);
      setErrorId(entry.key);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2><DocIcon /> Protokol Yükləmə</h2>
          <button className="modal-close" onClick={onClose} aria-label="Bağla"><CloseIcon /></button>
        </div>
        <div className="modal-body">
          <p className="modal-info">
            Aşağıdakı qruplar üçün protokol yaradılacaq. Qrup nömrəsini
            <strong> avtomatik</strong> istifadə edin və ya istəsəniz <strong>manual dəyişin</strong>:
          </p>
          {baseGroups.length === 0 && (
            <div className="admin-empty">
              Aktiv filterlərə uyğun qrup tapılmadı. Əvvəlcə cədvəldə filter seçin
              və ya yeni qrup məlumatı əlavə edin.
            </div>
          )}
          <div className="course-group-list">
            {baseGroups.map((entry) => {
              const currentGroupNum = getGroupNum(entry);
              const isDownloaded = !!downloaded[entry.key];
              const isBusy = busyId === (entry.archiveId || entry.key);
              const finishDate = entry.startDate
                ? addDays(entry.startDate, Math.max(1, getDays?.(entry.courseCode) || 1) - 1)
                : '';
              return (
                <div className="course-group-row journal-picker-row" key={entry.key}>
                  <div className="course-group-info">
                    <strong>{entry.courseName}</strong>
                    <span className="course-group-meta">
                      {entry.courseCode} · {entry.startDate || '—'} – {finishDate || '—'} · {entry.teacher || '—'} · {(entry.students || []).length} nəfər
                    </span>
                    {errorId === entry.key && (
                      <span className="autogroup-invalid">Xəta baş verdi. Yenidən cəhd edin.</span>
                    )}
                  </div>
                  <div className="tp-field" style={{ minWidth: 120 }}>
                    <label className="tp-label">Qrup nömrəsi</label>
                    <input
                      className="tp-input"
                      type="text"
                      value={currentGroupNum}
                      onChange={(ev) => setGroupNums((prev) => ({ ...prev, [entry.key]: ev.target.value }))}
                      disabled={isBusy}
                    />
                  </div>
                  <button
                    type="button"
                    className="btn-primary btn-compact"
                    disabled={isBusy}
                    onClick={() => handleDownload(entry)}
                  >
                    {isBusy && 'Yüklənir...'}
                    {!isBusy && isDownloaded && <><CheckIcon /> Yenidən yüklə</>}
                    {!isBusy && !isDownloaded && <><DownloadIcon /> Yüklə</>}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Bağla</button>
        </div>
      </div>
    </div>
  );
}
