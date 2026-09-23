import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import ContextMenu from './ContextMenu';
import FilterPanel from './FilterPanel';
import DocGenModal from './DocGenModal';
import JournalDownloadPicker from './JournalDownloadPicker';
import ProtokolPicker from './ProtokolPicker';
import AutoGroupSplitModal from './AutoGroupSplitModal';
import ImportExcelModal from './ImportExcelModal';
import ExcelGrid from './ExcelGrid';
import { generateTrainingPlan } from '../lib/excelGenerator';
import { buildCourseGroups } from '../lib/courseGroups';
import { downloadWorkbookBuffer, bufferToBase64 } from '../lib/downloadFile';
import { fetchLogoBuffer } from '../lib/logo';
import { rowKey, FIELD_LABELS } from '../lib/importMapping';
import useFirebaseData from '../lib/useFirebaseData';
import useTeachers from '../lib/useTeachers';
import useCourseSettings from '../lib/useCourseSettings';
import useGroupCounters from '../lib/useGroupCounters';
import useArchive from '../lib/useArchive';
import {
  SearchIcon, CloseIcon, ResetFilterIcon, ImportIcon, WarningIcon,
} from './Icons';

// The literal trigger the spec asks for: typing this into the main search
// box opens the Admin Panel, with no separate URL or login flow (§1). This
// is intentionally a fixed string — independent of whatever the regular
// login passcode is currently set to in the Admin Panel's "Şifrə" tab.
const SECRET_ADMIN_CODE = '0706';

export default function SpreadsheetTable({ onOpenAdmin }) {
  const {
    rows, loading, connected, syncError,
    canUndo, canRedo,
    updateCell, addRow, deleteRow, importRows, undo, redo,
  } = useFirebaseData();

  const { activeTeachers } = useTeachers();
  const { getDays, getMaxParticipants } = useCourseSettings();
  const {
    peekNext, allocate, setCounter, peekNextProtokol, allocateProtokol, setCounterProtokol,
  } = useGroupCounters();
  const { items: trainingPlanEntries, addEntry: addTrainingPlanEntry } = useArchive('trainingPlan');
  const { addEntry: addJournalEntry } = useArchive('journal');
  const { items: protokolEntries, addEntry: addProtokolEntry } = useArchive('protokol');

  const [searchText, setSearchText] = useState('');
  const [columnFilters, setColumnFilters] = useState({});
  const [menuState, setMenuState] = useState(null);
  const [activeFilterColumn, setActiveFilterColumn] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  // Document generation flow: context menu -> (maybe) auto-grouping -> assignment modal.
  const [docMode, setDocMode] = useState(null); // 'trainingPlan' | 'journal' | null
  const [autoGroupBase, setAutoGroupBase] = useState(null); // groups still needing a split decision
  const [docGenGroups, setDocGenGroups] = useState(null); // final groups ready for assignment
  const [journalPickerGroups, setJournalPickerGroups] = useState(null); // groups ready for per-group Jurnal download
  const [showProtokolPicker, setShowProtokolPicker] = useState(false);

  // Training Plan is the source of the first group-number suggestion for a
  // matching course/date. The user can still overwrite it in the modal.
  const groupAssignments = useMemo(() => {
    const out = {};
    trainingPlanEntries.forEach((entry) => {
      const key = entry.groupKey || `${entry.courseCode}__${entry.startDate || ''}`;
      if (!out[key] && (entry.groupNum || entry.teacher)) {
        out[key] = { groupNum: entry.groupNum || '', teacher: entry.teacher || '' };
      }
    });
    return out;
  }, [trainingPlanEntries]);

  const gridRef = useRef(null);

  // Filter + search (unchanged logic, now backed by real-time rows).
  const filteredData = useMemo(() => {
    let data = rows;
    const af = Object.entries(columnFilters);
    if (af.length > 0) {
      data = data.filter((row) => af.every(([field, vals]) => {
        if (!vals || vals.length === 0) return true;
        return vals.some((v) => String(row[field] || '').toLowerCase().includes(v.toLowerCase()));
      }));
    }
    if (searchText.trim()) {
      const q = searchText.toLowerCase().trim();
      data = data.filter((row) => row && typeof row === 'object'
        && Object.values(row).some((v) => String(v || '').toLowerCase().includes(q)));
    }
    return data;
  }, [rows, columnFilters, searchText]);

  const getSynchronizedValues = useCallback((field) => {
    const af = Object.entries(columnFilters).filter(([f]) => f !== field);
    let data = rows;
    if (af.length > 0) {
      data = data.filter((row) => af.every(([f, vals]) => {
        if (!vals || vals.length === 0) return true;
        return vals.some((v) => String(row[f] || '').toLowerCase().includes(v.toLowerCase()));
      }));
    }
    const vals = new Set();
    data.forEach((r) => { const v = r[field]; if (v) vals.add(String(v)); });
    return Array.from(vals).sort();
  }, [rows, columnFilters]);

  // Clicking a column header opens the filter directly (no extra button).
  const handleHeaderClick = useCallback((field) => {
    if (!field) return;
    setActiveFilterColumn(field);
  }, []);

  // Map a filtered-row index back to its real index in the full dataset.
  const realIndex = useCallback((filteredIdx) => {
    const row = filteredData[filteredIdx];
    if (!row) return -1;
    return rows.indexOf(row);
  }, [filteredData, rows]);

  // ---- Secret admin trigger (§1): typing "0706" into the search box opens
  // the Admin Panel from right here in the User Panel — no separate URL. ----
  useEffect(() => {
    if (searchText.trim() === SECRET_ADMIN_CODE) {
      setSearchText('');
      if (onOpenAdmin) onOpenAdmin();
    }
  }, [searchText, onOpenAdmin]);

  // ---- Context menu + row operations ----

  const handleRowContextMenu = useCallback((rowIndex, x, y) => {
    setMenuState({ x, y, rowIndex });
  }, []);

  const insertRow = useCallback((position) => {
    if (!menuState) return;
    const idx = realIndex(menuState.rowIndex);
    if (idx >= 0) addRow(position, idx);
    setMenuState(null);
  }, [menuState, realIndex, addRow]);

  const requestDelete = useCallback((rowIndex) => {
    const row = filteredData[rowIndex];
    const actualIdx = row ? rows.indexOf(row) : rowIndex;
    setConfirmDelete({ rowIndex: actualIdx, name: row?.fullName || '' });
  }, [filteredData, rows]);

  const confirmDeleteRow = useCallback(() => {
    if (confirmDelete == null) return;
    deleteRow(confirmDelete.rowIndex);
    setConfirmDelete(null);
  }, [confirmDelete, deleteRow]);

  // ---- Training Plan / Jurnal generation (§2–§10) ----

  const startDocFlow = useCallback((mode) => {
    if (menuState == null) return;
    setMenuState(null);
    const baseGroups = buildCourseGroups(filteredData).filter((g) => g.studentCount > 0);
    if (baseGroups.length === 0) return;
    setDocMode(mode);
    const hasOverflow = baseGroups.some((g) => g.studentCount > getMaxParticipants(g.courseCode));
    if (hasOverflow) {
      setAutoGroupBase(baseGroups);
    } else {
      setDocGenGroups(baseGroups);
    }
  }, [menuState, filteredData, getMaxParticipants]);

  const handleTrainingPlan = useCallback(() => startDocFlow('trainingPlan'), [startDocFlow]);
  const handleJournal = useCallback(() => startDocFlow('journal'), [startDocFlow]);
  const handleProtokol = useCallback(() => {
    if (!menuState) return;
    setMenuState(null);
    setShowProtokolPicker(true);
  }, [menuState]);

  const handleAutoGroupResolved = useCallback((finalGroups) => {
    setAutoGroupBase(null);
    setDocGenGroups(finalGroups);
  }, []);

  const handleAutoGroupCancel = useCallback(() => {
    setAutoGroupBase(null);
    setDocMode(null);
  }, []);

  const handleDocGenCancel = useCallback(() => {
    setDocGenGroups(null);
    setDocMode(null);
  }, []);

  const handleJournalPickerClose = useCallback(() => {
    setJournalPickerGroups(null);
  }, []);

  const handleDocGenConfirm = useCallback(async (assignedGroups) => {
    const mode = docMode;

    if (mode === 'journal') {
      // The old combined multi-group Jurnal download is gone entirely: hand
      // the assigned groups to the per-group picker, which downloads each
      // one separately, on its own, as many times as the user wants.
      setDocGenGroups(null);
      setDocMode(null);
      setJournalPickerGroups(assignedGroups);
      return;
    }

    // Training Plan: unchanged — one combined workbook covering every
    // selected course group, same as before.
    // Intentionally no try/catch here: DocGenModal awaits this call in its
    // own try/catch and shows a retry-able error message without closing
    // itself, so on failure we must leave docGenGroups/docMode untouched
    // (closing here would rip the modal away right as the error is shown).
    const logoBuffer = await fetchLogoBuffer();
    const result = await generateTrainingPlan(assignedGroups, logoBuffer);
    downloadWorkbookBuffer(result.buffer, result.fileName);

    // Archive (§11): one entry per course group, so each can later be
    // individually reopened, edited or deleted from the Admin Panel.
    const fileBase64 = bufferToBase64(result.buffer);
    const withStudents = assignedGroups.filter((g) => g.students && g.students.length > 0);
    for (let i = 0; i < withStudents.length; i += 1) {
      const g = withStudents[i];
      // eslint-disable-next-line no-await-in-loop
      await addTrainingPlanEntry({
        groupKey: g.key,
        fileName: result.fileName,
        fileBase64,
        courseCode: g.courseCode,
        courseName: g.courseName,
        courseHours: g.courseHours,
        startDate: g.startDate,
        groupNum: g.groupNum,
        teacher: g.teacher,
        studentCount: g.students.length,
        students: g.students.map((s) => ({
          fullName: s.fullName || '', rank: s.rank || '', email: s.email || '',
        })),
      });
    }

    // Only close the assignment modal once everything actually succeeded.
    setDocGenGroups(null);
    setDocMode(null);
  }, [docMode, addTrainingPlanEntry]);

  // ---- Cell edit -> auto-save to Firebase ----
  const handleCellEdit = useCallback((rowId, field, value) => {
    updateCell(rowId, field, value);
  }, [updateCell]);

  // ---- Import confirm: write new + changed (+ optionally deleted) rows to Firebase ----
  const handleImportConfirm = useCallback(({ added, updated, removed }) => {
    const hasRemoved = removed && removed.length > 0;
    if ((!added || added.length === 0) && (!updated || updated.length === 0) && !hasRemoved) {
      setImportOpen(false);
      return;
    }
    const existing = new Set(rows.map((r) => rowKey(r)));
    const freshAdded = (added || []).filter((r) => !existing.has(rowKey(r)));
    if (freshAdded.length === 0 && (!updated || updated.length === 0) && !hasRemoved) { setImportOpen(false); return; }
    importRows(freshAdded, updated || [], removed || []);
    setImportOpen(false);
  }, [rows, importRows]);

  // ---- Keyboard shortcuts: Undo / Redo (Ctrl+Z / Ctrl+Y) ----
  useEffect(() => {
    const handler = (e) => {
      const { target } = e;
      const inInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !inInput) {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y' && !inInput) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo]);

  if (loading) {
    return (
      <div className="spreadsheet-root">
        <div className="loading-screen">
          <div className="loading-spinner" />
          <div className="loading-text">Məlumatlar yüklənir...</div>
          <div className="loading-sub">Firebase bağlantısı qurulur</div>
        </div>
      </div>
    );
  }

  return (
    <div className="spreadsheet-root">
      <div className="toolbar">
        <div className="toolbar-left">
          <span className="row-count">{filteredData.length} / {rows.length} sətir</span>
          <button className={`btn-control ${canUndo ? '' : 'disabled'}`} onClick={undo} disabled={!canUndo} title="Geri al (Ctrl+Z)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" aria-hidden="true">
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
          </button>
          <button className={`btn-control ${canRedo ? '' : 'disabled'}`} onClick={redo} disabled={!canRedo} title="İrəli get (Ctrl+Y)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" aria-hidden="true">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          </button>
          <span className={`sync-status ${connected ? 'online' : 'offline'}`} title={syncError || (connected ? 'Canlı' : 'Kəsildi')}>
            <span className="sync-dot" />{connected ? 'Canlı' : 'Kəsildi'}
          </span>
        </div>

        <div className="toolbar-center">
          <div className="search-box">
            <span className="search-icon"><SearchIcon /></span>
            <input type="text" className="search-input" placeholder="Axtar..." value={searchText} onChange={(e) => setSearchText(e.target.value)} />
            {searchText && <button className="search-clear" onClick={() => setSearchText('')} aria-label="Axtarışı təmizlə"><CloseIcon /></button>}
          </div>
        </div>

        <div className="toolbar-right">
          <div className="control-group">
            <button
              className={`btn-control reset ${Object.keys(columnFilters).length > 0 ? 'active' : ''}`}
              onClick={() => setColumnFilters({})}
              disabled={Object.keys(columnFilters).length === 0}
              title="Filtirləri sıfırla"
            >
              <ResetFilterIcon />
            </button>
            <button className="btn-control import" onClick={() => setImportOpen(true)} title="Excel-dən yeni məlumat idxal et">
              <ImportIcon /> Import
            </button>
          </div>
        </div>
      </div>

      {Object.keys(columnFilters).length > 0 && (
        <div className="active-filters-bar">
          {Object.entries(columnFilters).map(([field, values]) => (
            <span className="filter-chip" key={field}>
              {FIELD_LABELS[field] || field}: {values.length}
              <button onClick={() => setColumnFilters((prev) => { const n = { ...prev }; delete n[field]; return n; })} aria-label={`${field} filtrini sil`}>
                <CloseIcon />
              </button>
            </span>
          ))}
        </div>
      )}

      <ExcelGrid
        ref={gridRef}
        rows={filteredData}
        onCellEdit={handleCellEdit}
        onHeaderClick={handleHeaderClick}
        onRowContextMenu={handleRowContextMenu}
      />

      {menuState && (
        <ContextMenu
          x={menuState.x} y={menuState.y}
          onClose={() => setMenuState(null)}
          onInsertAbove={() => insertRow('above')}
          onInsertBelow={() => insertRow('below')}
          onDelete={() => requestDelete(menuState.rowIndex)}
          onTrainingPlan={handleTrainingPlan}
          onJournal={handleJournal}
          onProtokol={handleProtokol}
        />
      )}

      {activeFilterColumn && (
        <FilterPanel
          field={activeFilterColumn}
          headerName={FIELD_LABELS[activeFilterColumn] || activeFilterColumn}
          values={getSynchronizedValues(activeFilterColumn)}
          selected={columnFilters[activeFilterColumn] || []}
          onApply={(field, values) => {
            setColumnFilters((prev) => {
              const next = { ...prev };
              if (values && values.length > 0) next[field] = values;
              else delete next[field];
              return next;
            });
            setActiveFilterColumn(null);
          }}
          onClose={() => setActiveFilterColumn(null)}
        />
      )}

      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="modal confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-body">
              <div className="confirm-icon"><WarningIcon /></div>
              <div className="confirm-title">Sətir silinsin?</div>
              <div className="confirm-message">
                {confirmDelete.name
                  ? `"${confirmDelete.name}" məlumatı silinəcək.`
                  : 'Bu sətir tamamilə silinəcək.'} Bu əməliyyat geri qaytarıla bilməz.
              </div>
            </div>
            <div className="confirm-actions">
              <button className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>Ləğv et</button>
              <button className="btn btn-danger" onClick={confirmDeleteRow}>Sil</button>
            </div>
          </div>
        </div>
      )}

      {autoGroupBase && (
        <AutoGroupSplitModal
          groups={autoGroupBase}
          getMaxParticipants={getMaxParticipants}
          onResolved={handleAutoGroupResolved}
          onCancel={handleAutoGroupCancel}
        />
      )}

      {docGenGroups && (
      <DocGenModal
          mode={docMode}
          groups={docGenGroups}
          activeTeachers={activeTeachers}
          peekNext={peekNext}
          allocate={allocate}
          setCounter={setCounter}
          groupAssignments={docMode === 'journal' ? groupAssignments : undefined}
          onConfirm={handleDocGenConfirm}
          onCancel={handleDocGenCancel}
        />
      )}

      {journalPickerGroups && (
        <JournalDownloadPicker
          groups={journalPickerGroups}
          getDays={getDays}
          addJournalEntry={addJournalEntry}
          onClose={handleJournalPickerClose}
        />
      )}

      {showProtokolPicker && (
        <ProtokolPicker
          rows={filteredData}
          protokolEntries={protokolEntries}
          peekNext={peekNextProtokol}
          allocate={allocateProtokol}
          setCounter={setCounterProtokol}
          getDays={getDays}
          addProtokolEntry={addProtokolEntry}
          onClose={() => setShowProtokolPicker(false)}
        />
      )}

      {importOpen && (
        <ImportExcelModal
          existingRows={rows}
          onConfirm={handleImportConfirm}
          onCancel={() => setImportOpen(false)}
        />
      )}
    </div>
  );
}
