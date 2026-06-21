import { useState, useRef, useEffect } from 'react';
import { toast } from '../../utils/toast';
import { VscClose, VscExport, VscFile } from 'react-icons/vsc';
import {
  serializeBoards, downloadJson, safeFilename, downloadBoardsAsXlsx,
  parseExportFile, regenerateIds, dedupeTitles,
} from '../../utils/boardIO';

function ExportImportModal({ boards, activeBoardId, isOpen, onClose, onImport }) {
  const [scope, setScope]   = useState('current'); // 'current' | 'all'
  const [format, setFormat] = useState('json');    // 'json' | 'xlsx'
  const [importPreview, setImportPreview] = useState(null); // { boards, names }
  const modalRef = useRef(null);
  const fileInputRef = useRef(null);

  const activeBoard = boards.find((b) => b.id === activeBoardId);

  useEffect(() => {
    if (!isOpen) {
      setImportPreview(null);
      setScope('current');
      setFormat('json');
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onMouse = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) onClose();
    };
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onMouse);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onMouse);
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleExport = async () => {
    const today = new Date().toISOString().split('T')[0];
    const targets = scope === 'current' ? (activeBoard ? [activeBoard] : []) : boards;
    if (targets.length === 0) {
      toast.warning(scope === 'current' ? 'No active board to export' : 'No boards to export');
      return;
    }
    const base = scope === 'current'
      ? `kandoo-${safeFilename(targets[0].title)}-${today}`
      : `kandoo-all-boards-${today}`;

    try {
      if (format === 'xlsx') {
        await downloadBoardsAsXlsx(targets, `${base}.xlsx`);
      } else {
        downloadJson(`${base}.json`, serializeBoards(targets));
      }
      toast.success(
        scope === 'current'
          ? `Exported "${targets[0].title}" as ${format.toUpperCase()}`
          : `Exported ${targets.length} board${targets.length > 1 ? 's' : ''} as ${format.toUpperCase()}`
      );
      onClose();
    } catch (err) {
      toast.error(err.message || 'Export failed');
    }
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting same file
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      toast.warning('File is too large (max 50 MB)');
      return;
    }
    try {
      const text = await file.text();
      const parsed = parseExportFile(text);
      const regen = regenerateIds(parsed);
      const deduped = dedupeTitles(regen, boards);
      setImportPreview({ boards: deduped, names: deduped.map((b) => b.title) });
    } catch (err) {
      toast.error(err.message || "Couldn't read the file");
    }
  };

  const confirmImport = () => {
    if (!importPreview) return;
    onImport(importPreview.boards);
    toast.success(
      `Imported ${importPreview.boards.length} board${importPreview.boards.length > 1 ? 's' : ''}`
    );
    setImportPreview(null);
    onClose();
  };

  const sectionStyle = {
    border: '1px solid var(--theme-border)',
    borderRadius: '0.5rem',
    padding: '0.875rem',
    display: 'flex', flexDirection: 'column', gap: '0.5rem',
  };
  const headingStyle = {
    fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.05em',
    color: 'var(--theme-text-secondary)', display: 'flex', alignItems: 'center', gap: '6px',
  };
  const primaryBtn = {
    padding: '0.5rem 0.9rem', border: 'none', borderRadius: '0.375rem',
    background: 'var(--theme-accent)', color: 'white',
    cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500,
    display: 'inline-flex', alignItems: 'center', gap: '6px', alignSelf: 'flex-start',
  };
  const secondaryBtn = {
    padding: '0.4rem 0.8rem', border: '1px solid var(--theme-border)', borderRadius: '0.375rem',
    background: 'var(--theme-bg-secondary)', color: 'var(--theme-text-primary)',
    cursor: 'pointer', fontSize: '0.8rem',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.35)',
      backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div
        ref={modalRef}
        style={{
          backgroundColor: 'var(--theme-bg-primary)',
          border: '1px solid var(--theme-border)',
          borderRadius: '0.75rem',
          padding: '1.5rem',
          maxWidth: '520px', width: '92%',
          maxHeight: '90vh', overflowY: 'auto',
          boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
          display: 'flex', flexDirection: 'column', gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: 'var(--theme-text-primary)' }}>
            Export / Import Boards
          </h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--theme-text-secondary)', fontSize: '1.25rem', display: 'flex' }}
          >
            <VscClose />
          </button>
        </div>

        {/* Export */}
        <div style={sectionStyle}>
          <div style={headingStyle}><VscExport /> EXPORT</div>

          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--theme-text-primary)', fontSize: '0.85rem', cursor: 'pointer' }}>
              <input type="radio" name="format" value="json" checked={format === 'json'} onChange={() => setFormat('json')} />
              JSON <span style={{ color: 'var(--theme-text-muted)', fontSize: '0.75rem' }}>(re-importable backup)</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--theme-text-primary)', fontSize: '0.85rem', cursor: 'pointer' }}>
              <input type="radio" name="format" value="xlsx" checked={format === 'xlsx'} onChange={() => setFormat('xlsx')} />
              XLSX <span style={{ color: 'var(--theme-text-muted)', fontSize: '0.75rem' }}>(Excel / Google Sheets)</span>
            </label>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--theme-text-primary)', fontSize: '0.875rem', cursor: 'pointer' }}>
            <input type="radio" name="scope" value="current" checked={scope === 'current'} onChange={() => setScope('current')} />
            Current board <span style={{ color: 'var(--theme-text-muted)' }}>({activeBoard?.title || 'none'})</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--theme-text-primary)', fontSize: '0.875rem', cursor: 'pointer' }}>
            <input type="radio" name="scope" value="all" checked={scope === 'all'} onChange={() => setScope('all')} />
            All boards <span style={{ color: 'var(--theme-text-muted)' }}>({boards.length})</span>
          </label>

          {format === 'xlsx' && (
            <p style={{ margin: 0, color: 'var(--theme-text-muted)', fontSize: '0.72rem', lineHeight: 1.4 }}>
              Each board becomes a sheet; cards become columns; tasks become rows.
              Images and rich-text formatting are flattened — use JSON to preserve them.
            </p>
          )}

          <button style={primaryBtn} onClick={handleExport}>
            <VscExport /> Download {format.toUpperCase()}
          </button>
        </div>

        {/* Import */}
        <div style={sectionStyle}>
          <div style={headingStyle}><VscFile /> IMPORT</div>
          {!importPreview ? (
            <>
              <p style={{ color: 'var(--theme-text-muted)', fontSize: '0.8rem', margin: 0 }}>
                Choose a previously exported .json file. Imported boards are appended to your existing ones.
              </p>
              <button style={primaryBtn} onClick={() => fileInputRef.current?.click()}>
                <VscFile /> Select File
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFile}
                style={{ display: 'none' }}
              />
            </>
          ) : (
            <>
              <p style={{ color: 'var(--theme-text-primary)', fontSize: '0.875rem', margin: 0 }}>
                Ready to import <strong>{importPreview.boards.length}</strong>{' '}
                board{importPreview.boards.length > 1 ? 's' : ''}:
              </p>
              <ul style={{
                margin: 0, padding: '0.5rem 0.75rem',
                background: 'var(--theme-bg-secondary)', borderRadius: '0.375rem',
                listStyle: 'disc inside', fontSize: '0.85rem',
                color: 'var(--theme-text-primary)', maxHeight: '140px', overflowY: 'auto',
              }}>
                {importPreview.names.map((n, i) => (<li key={i}>{n}</li>))}
              </ul>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button style={primaryBtn} onClick={confirmImport}>
                  Confirm Import
                </button>
                <button style={secondaryBtn} onClick={() => setImportPreview(null)}>
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default ExportImportModal;
