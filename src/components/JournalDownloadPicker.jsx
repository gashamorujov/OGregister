import { useState } from 'react';
import {
  CloseIcon, JournalIcon, DownloadIcon, CheckIcon,
} from './Icons';
import { generateJournal } from '../lib/journalGenerator';
import { downloadWorkbookBuffer, bufferToBase64 } from '../lib/downloadFile';
import { fetchLogoBuffer } from '../lib/logo';

export default function JournalDownloadPicker({
  groups, getDays, addJournalEntry, onClose,
}) {
  const [downloaded, setDownloaded] = useState({});
  const [busyKey, setBusyKey] = useState(null);
  const [errorKey, setErrorKey] = useState(null);

  const handleDownload = async (group) => {
    setBusyKey(group.key);
    setErrorKey(null);
    try {
      const logoBuffer = await fetchLogoBuffer();
      const result = await generateJournal([group], { logoBuffer, getDays });
      const fileBase64 = bufferToBase64(result.buffer);
      await addJournalEntry({
        groupKey: group.key,
        fileName: result.fileName,
        fileBase64,
        courseCode: group.courseCode,
        courseName: group.courseName,
        courseHours: group.courseHours,
        startDate: group.startDate,
        groupNum: group.groupNum,
        teacher: group.teacher,
        studentCount: group.students.length,
        students: group.students.map((s) => ({
          fullName: s.fullName || '', rank: s.rank || '', email: s.email || '', phone: s.phone || '',
        })),
      });
      downloadWorkbookBuffer(result.buffer, result.fileName);
      setDownloaded((prev) => ({ ...prev, [group.key]: true }));
    } catch (err) {
      console.error('Jurnal download failed:', err);
      setErrorKey(group.key);
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2><JournalIcon /> Jurnal Yükləmə</h2>
          <button className="modal-close" onClick={onClose} aria-label="Bağla"><CloseIcon /></button>
        </div>
        <div className="modal-body">
          <p className="modal-info">
            Hər qrupu ayrıca seçib öz jurnalını yükləyin. Bir qrupu yüklədikdən sonra
            pəncərə açıq qalır — istədiyiniz digər qrupu da seçib davam edə bilərsiniz.
          </p>
          <div className="course-group-list">
            {groups.map((g) => {
              const isDownloaded = !!downloaded[g.key];
              const isBusy = busyKey === g.key;
              return (
                <div className="course-group-row journal-picker-row" key={g.key}>
                  <div className="course-group-info">
                    <strong>{g.courseName}{g.subLabel ? ` — ${g.subLabel}` : ''}</strong>
                    <span className="course-group-meta">
                      {g.courseCode} · {g.groupNum} · {g.teacher} · {g.studentCount} nəfər
                    </span>
                    {errorKey === g.key && (
                      <span className="autogroup-invalid">Xəta baş verdi. Yenidən cəhd edin.</span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="btn-primary btn-compact"
                    disabled={isBusy}
                    onClick={() => handleDownload(g)}
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
