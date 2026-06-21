import { useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from '../../utils/toast';
import { useTheme } from '../../contexts/ThemeContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useAuth } from '../../contexts/AuthContext';
import { CardsContext, taskSignature } from '../../contexts/CardsContext';
import { THEME_TOKENS } from '../../themes/themes';
import '../ThemeSettings.css';
import {
  VscAccount, VscColorMode, VscEdit, VscSettingsGear, VscDatabase, VscClose, VscCopy,
  VscCloud, VscDesktopDownload,
} from 'react-icons/vsc';
import AvatarCropper from '../AvatarCropper';

const SQLITE_PATH = '~/Library/Application Support/com.kandoo.desktop/kandoo.db';
const APP_VERSION = '1.0.0';
const REPO_URL = 'https://github.com/Somen1228/kandoo-app';

const ACCENTS = [
  { label: 'Theme default', value: '' },
  { label: 'Navy', value: '#1e3a5f' },
  { label: 'Blue', value: '#3b82f6' },
  { label: 'Violet', value: '#7c3aed' },
  { label: 'Pink', value: '#db2777' },
  { label: 'Teal', value: '#0d9488' },
  { label: 'Amber', value: '#d97706' },
  { label: 'Red', value: '#dc2626' },
];

const FONT_FAMILIES = [
  { label: 'Default', value: '' },
  { label: 'Sans (Inter)', value: 'Inter, -apple-system, sans-serif' },
  { label: 'Serif (Georgia)', value: 'Georgia, "Times New Roman", serif' },
  { label: 'Mono', value: '"SF Mono", ui-monospace, monospace' },
];

const mod = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform) ? '⌘' : 'Ctrl';
const SHORTCUTS = [
  { group: 'Navigation', items: [
    { keys: [`${mod}`, 'K'], desc: 'Focus search' },
    { keys: [`${mod}`, 'B'], desc: 'Toggle sidebar' },
    { keys: ['Esc'], desc: 'Close modal / clear search' },
  ]},
  { group: 'Actions', items: [
    { keys: [`${mod}`, 'N'], desc: 'Quick-add task' },
    { keys: [`${mod}`, 'Z'], desc: 'Undo' },
    { keys: [`${mod}`, '⇧', 'Z'], desc: 'Redo' },
    { keys: ['T'], desc: 'Cycle theme' },
    { keys: [`${mod}`, '⇧', '1'], desc: 'Help & features' },
  ]},
  { group: 'Editing', items: [
    { keys: [`${mod}`, 'B / I / U'], desc: 'Bold / italic / underline' },
    { keys: ['Drag'], desc: 'Move tasks between columns' },
    { keys: ['Right-click'], desc: 'Context menu (task / card / board)' },
  ]},
];

// ── Workspace diff ───────────────────────────────────────────────────────────
function diffWorkspaces(localBoards = [], cloudBoards = []) {
  const cloudById = Object.fromEntries(cloudBoards.map(b => [b.id, b]));
  const localById = Object.fromEntries(localBoards.map(b => [b.id, b]));
  let cloudOnlyBoards = 0, localOnlyBoards = 0;
  let cloudOnlyTasks = 0, localOnlyTasks = 0, sharedEditedTasks = 0;

  cloudBoards.forEach(b => {
    if (!localById[b.id]) {
      cloudOnlyBoards++;
      (b.cards || []).forEach(col => { cloudOnlyTasks += Object.keys(col.tasks || {}).length; });
    }
  });
  localBoards.forEach(b => {
    if (!cloudById[b.id]) {
      localOnlyBoards++;
      (b.cards || []).forEach(col => { localOnlyTasks += Object.keys(col.tasks || {}).length; });
    } else {
      const cloudBoard = cloudById[b.id];
      const cloudColByUid = Object.fromEntries((cloudBoard.cards || []).map(c => [c.uid, c]));
      (b.cards || []).forEach(col => {
        if ((col.type || 'todo') !== 'todo') return;
        const cloudCol = cloudColByUid[col.uid];
        if (!cloudCol) return;
        const lTasks = col.tasks || {}, cTasks = cloudCol.tasks || {};
        Object.keys(cTasks).forEach(k => {
          if (!lTasks[k]) cloudOnlyTasks++;
          else if (taskSignature(lTasks[k]) !== taskSignature(cTasks[k])) sharedEditedTasks++;
        });
        Object.keys(lTasks).forEach(k => { if (!cTasks[k]) localOnlyTasks++; });
      });
    }
  });
  return { cloudOnlyBoards, localOnlyBoards, cloudOnlyTasks, localOnlyTasks, sharedEditedTasks };
}

const TABS = [
  { id: 'account', label: 'Account & Sync', icon: <VscAccount /> },
  { id: 'appearance', label: 'Appearance', icon: <VscColorMode /> },
  { id: 'editor', label: 'Editor', icon: <VscEdit /> },
  { id: 'behavior', label: 'Behavior & Shortcuts', icon: <VscSettingsGear /> },
  { id: 'data', label: 'Data & About', icon: <VscDatabase /> },
];

export default function SettingsModal({ onClose, initialTab = 'appearance', onOpenExportImport, onResetWorkspace, storageKind, onOpenHelp }) {
  const [tab, setTab] = useState(initialTab);
  const panelRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className="settings-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="settings-modal" ref={panelRef}>
        <aside className="settings-rail">
          <div className="settings-rail__title">Settings</div>
          {TABS.map((t) => (
            <button key={t.id} className={`settings-rail__item${tab === t.id ? ' is-active' : ''}`} onClick={() => setTab(t.id)}>
              <span className="settings-rail__icon">{t.icon}</span>{t.label}
            </button>
          ))}
        </aside>

        <div className="settings-content">
          <button className="settings-close" onClick={onClose} aria-label="Close settings"><VscClose /></button>
          {tab === 'account' && <AccountPanel onOpenHelp={onOpenHelp} />}
          {tab === 'appearance' && <AppearancePanel />}
          {tab === 'editor' && <EditorPanel />}
          {tab === 'behavior' && <BehaviorPanel />}
          {tab === 'data' && (
            <DataPanel
              storageKind={storageKind}
              onOpenExportImport={onOpenExportImport}
              onResetWorkspace={onResetWorkspace}
            />
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function ConflictTooltip({ onOpenHelp }) {
  const [visible, setVisible] = useState(false);
  return (
    <span
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      <button
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 16, height: 16, borderRadius: '50%',
          background: 'var(--theme-bg-hover)',
          border: '1px solid var(--theme-border)',
          color: 'var(--theme-text-muted)',
          fontSize: '0.65rem', fontWeight: 700,
          cursor: 'default', flexShrink: 0,
          padding: 0, lineHeight: 1,
        }}
        aria-label="What is a sync conflict?"
        tabIndex={0}
      >
        ?
      </button>
      {visible && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 9999,
          paddingTop: 6, // fills the gap so the mouse doesn't leave the span
        }}>
          <div style={{
            width: 260,
            background: 'var(--theme-bg-modal)',
            border: '1px solid var(--theme-border)',
            borderRadius: '0.625rem',
            boxShadow: '0 8px 28px rgba(0,0,0,0.22)',
            padding: '0.75rem 0.875rem',
          }}>
            <p style={{ margin: '0 0 0.4rem', fontSize: '0.78rem', fontWeight: 600, color: 'var(--theme-text-primary)' }}>
              What is a sync conflict?
            </p>
            <p style={{ margin: '0 0 0.625rem', fontSize: '0.75rem', lineHeight: 1.55, color: 'var(--theme-text-secondary)' }}>
              This happens when you edit your workspace on two devices while one was offline. Both versions have changes the other doesn’t know about.
            </p>
            {onOpenHelp && (
              <button
                onClick={onOpenHelp}
                style={{
                  background: 'none', border: 'none', padding: 0,
                  fontSize: '0.72rem', fontWeight: 600,
                  color: 'var(--theme-accent)', cursor: 'pointer',
                  textDecoration: 'underline', textUnderlineOffset: 2,
                }}
              >
                Learn more →
              </button>
            )}
          </div>
        </div>
      )}
    </span>
  );
}

function DiffSummary({ localBoards, cloudBoards }) {
  const diff = diffWorkspaces(localBoards, cloudBoards);
  const rows = [
    {
      icon: <VscCloud />,
      side: 'Cloud',
      parts: [
        diff.cloudOnlyTasks   > 0 && `+${diff.cloudOnlyTasks} task${diff.cloudOnlyTasks !== 1 ? 's' : ''}`,
        diff.cloudOnlyBoards  > 0 && `${diff.cloudOnlyBoards} new board${diff.cloudOnlyBoards !== 1 ? 's' : ''}`,
      ].filter(Boolean),
    },
    {
      icon: <VscDesktopDownload />,
      side: 'This device',
      parts: [
        diff.localOnlyTasks   > 0 && `+${diff.localOnlyTasks} task${diff.localOnlyTasks !== 1 ? 's' : ''}`,
        diff.localOnlyBoards  > 0 && `${diff.localOnlyBoards} new board${diff.localOnlyBoards !== 1 ? 's' : ''}`,
      ].filter(Boolean),
    },
  ];
  const hasEdited = diff.sharedEditedTasks > 0;

  if (rows.every(r => r.parts.length === 0) && !hasEdited) {
    return (
      <p style={{ fontSize: '0.78rem', color: 'var(--theme-text-muted)', margin: '0 0 0.75rem' }}>
        Both versions appear similar — the revision counter diverged but content may be identical.
      </p>
    );
  }

  return (
    <div style={{
      background: 'var(--theme-bg-hover)',
      borderRadius: '0.625rem',
      padding: '0.625rem 0.875rem',
      display: 'flex', flexDirection: 'column', gap: '0.4rem',
      marginBottom: '0.875rem',
      fontSize: '0.78rem',
    }}>
      {rows.map(({ icon, side, parts }) => parts.length > 0 && (
        <div key={side} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--theme-text-secondary)' }}>
          <span style={{ color: 'var(--theme-accent)', fontSize: '0.85rem', flexShrink: 0 }}>{icon}</span>
          <span style={{ fontWeight: 600, minWidth: 84, color: 'var(--theme-text-primary)' }}>{side}</span>
          <span>{parts.join(' · ')}</span>
        </div>
      ))}
      {hasEdited && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--theme-text-muted)', paddingTop: rows.some(r => r.parts.length > 0) ? '0.2rem' : 0, borderTop: rows.some(r => r.parts.length > 0) ? '1px solid var(--theme-border)' : 'none', marginTop: rows.some(r => r.parts.length > 0) ? '0.2rem' : 0 }}>
          <span style={{ fontSize: '0.85rem', flexShrink: 0 }}>⚡</span>
          <span>
            <strong style={{ color: 'var(--theme-text-primary)' }}>{diff.sharedEditedTasks} task{diff.sharedEditedTasks !== 1 ? 's' : ''}</strong>
            {' '}edited on both — you’ll choose per task if you merge
          </span>
        </div>
      )}
    </div>
  );
}

function AccountPanel({ onOpenHelp }) {
  const { user, isGuest, logout, exitOfflineMode, updateDisplayName, updatePhotoURL, changeEmail, changePassword, deleteAccount } = useAuth();
  const { boards, syncState, cloudConflict, resolveSyncConflict } = useContext(CardsContext);
  const [editingName, setEditingName]   = useState(false);
  const [newName, setNewName]           = useState('');
  const [showEmailForm, setShowEmailForm]   = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [formData, setFormData] = useState({ currentPassword: '', newEmail: '', newPassword: '', confirmPassword: '', deletePassword: '' });
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [cropSrc, setCropSrc] = useState(null);
  const photoInputRef = useRef(null);

  const isEmailUser   = user?.authProvider === 'password';
  const isGoogleUser  = user?.authProvider === 'google.com';

  const runAction = async (fn, onSuccess) => {
    setSaving(true);
    try { await fn(); onSuccess?.(); }
    catch (err) { toast.error(err.message?.replace('Firebase: ', '').replace(/\s*\(auth\/[\w-]+\)\.?\s*$/, '') || 'Action failed'); }
    finally { setSaving(false); }
  };

  const saveName = () => runAction(
    () => updateDisplayName(newName),
    () => { setEditingName(false); toast.success('Display name updated'); }
  );

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Show cropper instead of uploading directly
    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCropDone = async (croppedFile) => {
    setCropSrc(null);
    setUploadingPhoto(true);
    const tid = toast.loading('Uploading photo…');
    try {
      const { uploadImage } = await import('../../services/imageStorage');
      const url = await uploadImage(croppedFile);
      await updatePhotoURL(url);
      toast.dismiss(tid);
      toast.success('Profile photo updated');
    } catch (err) {
      toast.dismiss(tid);
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const saveEmail = () => runAction(
    () => changeEmail(formData.newEmail, formData.currentPassword),
    () => { setShowEmailForm(false); setFormData(f => ({ ...f, newEmail: '', currentPassword: '' })); toast.success('Verification sent to new email — click the link to confirm.'); }
  );

  const savePassword = () => {
    if (formData.newPassword !== formData.confirmPassword) { toast.warning('Passwords do not match'); return; }
    runAction(
      () => changePassword(formData.currentPassword, formData.newPassword),
      () => { setShowPasswordForm(false); setFormData(f => ({ ...f, currentPassword: '', newPassword: '', confirmPassword: '' })); toast.success('Password updated'); }
    );
  };

  const confirmDelete = () => runAction(
    () => deleteAccount(isEmailUser ? formData.deletePassword : undefined),
    () => toast.success('Account deleted')
  );

  const resolve = async (strategy) => {
    try { await resolveSyncConflict(strategy); }
    catch (error) { toast.error(error.message || 'Could not resolve sync conflict'); }
  };

  return (
    <div>
      <h2 className="settings-h2">Account &amp; Sync</h2>
      <Section title="Account">
        {user ? (
          <>
            {/* Profile row with avatar */}
            <div className="settings-row" style={{ alignItems: 'flex-start', gap: 14 }}>
              {/* Avatar */}
              <div style={{ flexShrink: 0 }}>
                <input ref={photoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />
                <button
                  onClick={() => photoInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  title="Change profile photo"
                  style={{
                    position: 'relative', width: 52, height: 52, borderRadius: '50%',
                    border: '2px solid var(--theme-border)', overflow: 'hidden',
                    background: 'var(--theme-bg-input)', cursor: 'pointer', padding: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                  {user.photoUrl
                    ? <img src={user.photoUrl} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--accent)' }}>
                        {(user.displayName || user.email || '?')[0].toUpperCase()}
                      </span>
                  }
                  <span style={{
                    position: 'absolute', inset: 0, borderRadius: '50%',
                    background: 'rgba(0,0,0,0.38)', opacity: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'white', fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.02em',
                    transition: 'opacity 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '0'}>
                    {uploadingPhoto ? '…' : 'Edit'}
                  </span>
                </button>
              </div>

              {/* Name / email */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {editingName ? (
                  <>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                      <input
                        className="settings-inline-input"
                        value={newName} onChange={e => setNewName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false); }}
                        autoFocus style={{ flex: 1 }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="settings-btn settings-btn--primary" onClick={saveName} disabled={saving}>Save</button>
                      <button className="settings-btn" onClick={() => setEditingName(false)}>Cancel</button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="settings-row__name" style={{ marginBottom: 2 }}>{user.displayName || 'Kandoo user'}</div>
                    <div className="settings-row__desc" style={{ marginBottom: 8 }}>{user.email || user.phone || 'Signed in'}</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="settings-btn" onClick={() => { setNewName(user.displayName || ''); setEditingName(true); }}>Edit name</button>
                      <button className="settings-btn" onClick={logout}>Sign out</button>
                    </div>
                  </>
                )}
              </div>
            </div>

            <Row title="Cloud sync" desc={
                syncState === 'synced'   ? 'Workspace is up to date across all devices.' :
                syncState === 'syncing'  ? 'Saving changes to the cloud…' :
                syncState === 'conflict' ? 'Another device saved a newer version.' :
                syncState === 'offline'  ? 'Firestore unreachable. Changes are saved locally.' :
                'Connecting to Firestore…'
              }>
              <span className="mac-chip" data-tone={syncState === 'conflict' || syncState === 'offline' ? 'overdue' : syncState === 'synced' ? 'today' : undefined}>
                {syncState}
              </span>
            </Row>
          </>
        ) : (
          <Row title="Offline workspace" desc="This workspace is stored only on this device until you sign in.">
            <button className="settings-btn settings-btn--primary" onClick={exitOfflineMode}>{isGuest ? 'Sign in' : 'Open login'}</button>
          </Row>
        )}
      </Section>

      {/* Email/password management — only for email users */}
      {user && isEmailUser && (
        <Section title="Security">
          <Row title="Change email" desc={showEmailForm ? '' : `Current: ${user.email}`}>
            {!showEmailForm ? (
              <button className="settings-btn" onClick={() => setShowEmailForm(true)}>Change</button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', marginTop: 8 }}>
                <input className="settings-inline-input" type="password" placeholder="Current password"
                  value={formData.currentPassword} onChange={e => setFormData(f => ({ ...f, currentPassword: e.target.value }))} />
                <input className="settings-inline-input" type="email" placeholder="New email address"
                  value={formData.newEmail} onChange={e => setFormData(f => ({ ...f, newEmail: e.target.value }))} />
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="settings-btn settings-btn--primary" onClick={saveEmail} disabled={saving}>Send verification</button>
                  <button className="settings-btn" onClick={() => setShowEmailForm(false)}>Cancel</button>
                </div>
              </div>
            )}
          </Row>
          <Row title="Change password" desc={showPasswordForm ? '' : 'Update your account password'}>
            {!showPasswordForm ? (
              <button className="settings-btn" onClick={() => setShowPasswordForm(true)}>Change</button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', marginTop: 8 }}>
                <input className="settings-inline-input" type="password" placeholder="Current password"
                  value={formData.currentPassword} onChange={e => setFormData(f => ({ ...f, currentPassword: e.target.value }))} />
                <input className="settings-inline-input" type="password" placeholder="New password (min 6 chars)"
                  value={formData.newPassword} onChange={e => setFormData(f => ({ ...f, newPassword: e.target.value }))} />
                <input className="settings-inline-input" type="password" placeholder="Confirm new password"
                  value={formData.confirmPassword} onChange={e => setFormData(f => ({ ...f, confirmPassword: e.target.value }))} />
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="settings-btn settings-btn--primary" onClick={savePassword} disabled={saving}>Update password</button>
                  <button className="settings-btn" onClick={() => setShowPasswordForm(false)}>Cancel</button>
                </div>
              </div>
            )}
          </Row>
        </Section>
      )}

      {/* Account deletion */}
      {user && (
        <Section title="Danger zone">
          {!showDeleteConfirm ? (
            <Row title="Delete account" desc="Permanently removes your account and all cloud data.">
              <button className="settings-btn" style={{ color: 'var(--theme-danger)', borderColor: 'var(--theme-danger)' }}
                onClick={() => setShowDeleteConfirm(true)}>Delete account</button>
            </Row>
          ) : (
            <div style={{ padding: '12px', borderRadius: 8, border: '1px solid var(--theme-danger)', background: 'var(--theme-danger-bg)' }}>
              <p style={{ margin: '0 0 10px', fontSize: '0.8rem', color: 'var(--theme-danger)', fontWeight: 600 }}>
                This cannot be undone. All your cloud data will be deleted.
              </p>
              {isEmailUser && (
                <input className="settings-inline-input" type="password" placeholder="Enter your password to confirm"
                  style={{ marginBottom: 8 }}
                  value={formData.deletePassword} onChange={e => setFormData(f => ({ ...f, deletePassword: e.target.value }))} />
              )}
              {isGoogleUser && (
                <p style={{ margin: '0 0 8px', fontSize: '0.75rem', color: 'var(--theme-text-muted)' }}>
                  You’ll be asked to sign in with Google to confirm.
                </p>
              )}
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="settings-btn" style={{ background: 'var(--theme-danger)', color: 'white', border: 'none' }}
                  onClick={confirmDelete} disabled={saving}>
                  {saving ? 'Deleting…' : 'Yes, delete my account'}
                </button>
                <button className="settings-btn" onClick={() => { setShowDeleteConfirm(false); setFormData(f => ({ ...f, deletePassword: '' })); }}>Cancel</button>
              </div>
            </div>
          )}
        </Section>
      )}

      {cloudConflict && (
        <Section title={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            Sync conflict
            <ConflictTooltip onOpenHelp={onOpenHelp} />
          </span>
        }>
          <DiffSummary localBoards={boards} cloudBoards={cloudConflict.boards || []} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <ConflictOption
              label="Load cloud"
              desc="Replaces everything on this device with the cloud version. Your local changes will be lost."
              onClick={() => resolve('cloud')}
            />
            <ConflictOption
              label="Upload this device"
              desc="Overwrites the cloud with this device's version. Cloud-only changes will be lost."
              onClick={() => resolve('local')}
              danger
            />
            <ConflictOption
              label="Merge both"
              desc="Keeps everything from both sides. If the same task was edited on both, you'll pick a version per task."
              onClick={() => resolve('merge')}
              primary
            />
          </div>
        </Section>
      )}
      {cropSrc && (
        <AvatarCropper
          imageSrc={cropSrc}
          onDone={handleCropDone}
          onCancel={() => setCropSrc(null)}
        />
      )}
    </div>
  );
}

function ConflictOption({ label, desc, onClick, danger, primary }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
        gap: '0.2rem',
        padding: '0.625rem 0.875rem',
        borderRadius: '0.5rem',
        background: primary
          ? 'color-mix(in srgb, var(--theme-accent) 10%, var(--theme-bg-card))'
          : danger
            ? 'color-mix(in srgb, var(--theme-danger) 8%, var(--theme-bg-card))'
            : 'var(--theme-bg-card)',
        border: `1px solid ${primary ? 'var(--theme-accent)' : danger ? 'var(--theme-danger)' : 'var(--theme-border)'}`,
        cursor: 'pointer',
        textAlign: 'left',
        width: '100%',
        transition: 'opacity 0.15s',
      }}
      onMouseEnter={e => e.currentTarget.style.opacity = '0.82'}
      onMouseLeave={e => e.currentTarget.style.opacity = '1'}
    >
      <span style={{
        fontSize: '0.82rem', fontWeight: 600,
        color: primary ? 'var(--theme-accent)' : danger ? 'var(--theme-danger)' : 'var(--theme-text-primary)',
      }}>
        {label}
      </span>
      <span style={{ fontSize: '0.73rem', color: 'var(--theme-text-muted)', lineHeight: 1.45 }}>
        {desc}
      </span>
    </button>
  );
}

// ── Reusable rows / controls ────────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <div className="settings-section">
      <div className="settings-section__title">{title}</div>
      {children}
    </div>
  );
}
function Row({ title, desc, children }) {
  return (
    <div className="settings-row">
      <div className="settings-row__info">
        <div className="settings-row__name">{title}</div>
        {desc && <div className="settings-row__desc">{desc}</div>}
      </div>
      <div className="settings-row__control">{children}</div>
    </div>
  );
}
function Toggle({ checked, onChange }) {
  return (
    <button role="switch" aria-checked={checked} className={`settings-toggle${checked ? ' is-on' : ''}`} onClick={() => onChange(!checked)}>
      <span className="settings-toggle__knob" />
    </button>
  );
}
function Segmented({ value, options, onChange }) {
  return (
    <div className="settings-seg">
      {options.map((o) => (
        <button key={o.value} className={`settings-seg__btn${value === o.value ? ' is-active' : ''}`} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}
function Select({ value, options, onChange }) {
  return (
    <select className="settings-select" value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

// ── Appearance ──────────────────────────────────────────────────────────────
function AppearancePanel() {
  const { currentThemeId, builtInThemes, customThemes, setTheme, addCustomTheme, removeCustomTheme, exportTheme } = useTheme();
  const { settings, setSetting } = useSettings();
  const [jsonInput, setJsonInput] = useState('');
  const [msg, setMsg] = useState(null);

  const handleExport = (id) => {
    const json = exportTheme(id);
    if (!json) return;
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `kandoo-theme-${id}.json`; a.click();
    URL.revokeObjectURL(url);
  };
  const handleImport = () => {
    try {
      const parsed = JSON.parse(jsonInput);
      const res = addCustomTheme(parsed);
      if (res.success) { setMsg({ ok: true, text: `Imported “${parsed.name}”` }); setJsonInput(''); setTheme(res.theme.id); }
      else setMsg({ ok: false, text: res.error });
    } catch { setMsg({ ok: false, text: 'Invalid JSON.' }); }
  };
  const sampleTheme = JSON.stringify({ name: 'My Theme', colors: THEME_TOKENS.reduce((a, t) => (a[t] = '#000000', a), {}) }, null, 2);

  const ThemeCard = ({ theme, custom }) => {
    const isActive = currentThemeId === theme.id;
    return (
      <div
        className="ts-theme-card"
        onClick={() => setTheme(theme.id)}
        style={{
          borderColor: isActive ? theme.colors.accent : 'transparent',
          borderRadius: 14, border: `2px solid ${isActive ? theme.colors.accent : 'transparent'}`,
          overflow: 'hidden', cursor: 'pointer',
          boxShadow: isActive ? `0 0 0 3px ${theme.colors.accentLight}` : '0 2px 8px rgba(0,0,0,0.08)',
          transition: 'all 0.18s', transform: 'none',
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.14)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = isActive ? `0 0 0 3px ${theme.colors.accentLight}` : '0 2px 8px rgba(0,0,0,0.08)'; }}
      >
        {/* Mini preview — full card bg */}
        <div style={{ background: theme.colors.bgPrimary, padding: '18px 16px 14px', display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ flex: 2, height: 9, borderRadius: 9, background: theme.colors.bgSecondary }} />
            <div style={{ width: 22, height: 9, borderRadius: 9, background: theme.colors.accent, flexShrink: 0 }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 13, height: 13, borderRadius: '50%', background: theme.colors.danger, flexShrink: 0 }} />
            <div style={{ width: 13, height: 13, borderRadius: '50%', background: theme.colors.accent, flexShrink: 0 }} />
            <div style={{ flex: 1, height: 9, borderRadius: 9, background: theme.colors.bgInput }} />
          </div>
        </div>
        {/* Name footer */}
        <div style={{
          background: theme.colors.bgCard,
          borderTop: `1px solid ${theme.colors.border}`,
          padding: '9px 13px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: theme.colors.textPrimary }}>{theme.name}</span>
          {isActive && <span style={{ fontSize: '0.8rem', fontWeight: 700, color: theme.colors.accent }}>✓</span>}
        </div>
        {custom && (
          <div style={{ display: 'flex', gap: 6, padding: '0 10px 10px', background: theme.colors.bgCard }}>
            <button className="ts-btn-sm ts-btn-export" onClick={(e) => { e.stopPropagation(); handleExport(theme.id); }}>Export</button>
            <button className="ts-btn-sm ts-btn-delete" onClick={(e) => { e.stopPropagation(); removeCustomTheme(theme.id); }}>Delete</button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <h2 className="settings-h2">Appearance</h2>
      <Section title="Theme">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          {builtInThemes.map((t) => <ThemeCard key={t.id} theme={t} />)}
        </div>
        {customThemes.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginTop: 12 }}>
            {customThemes.map((t) => <ThemeCard key={t.id} theme={t} custom />)}
          </div>
        )}
      </Section>

      <Section title="Accent">
        <div className="settings-swatches">
          {ACCENTS.map((a) => (
            <button key={a.label} title={a.label}
              className={`settings-swatch${settings.accent === a.value ? ' is-active' : ''}`}
              style={a.value ? { background: a.value } : undefined}
              onClick={() => setSetting('accent', a.value)}>
              {!a.value && 'A'}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Interface">
        <Row title="Density" desc="Compact tightens spacing across the app.">
          <Segmented value={settings.density} onChange={(v) => setSetting('density', v)}
            options={[{ label: 'Comfortable', value: 'comfortable' }, { label: 'Compact', value: 'compact' }]} />
        </Row>
        <Row title="Reduce motion" desc="Minimise animations and transitions.">
          <Toggle checked={settings.reduceMotion} onChange={(v) => setSetting('reduceMotion', v)} />
        </Row>
      </Section>

      <Section title="Import custom theme">
        <textarea className="ts-textarea" value={jsonInput}
          onChange={(e) => { setJsonInput(e.target.value); setMsg(null); }}
          placeholder={`Paste theme JSON…\n\n${sampleTheme.slice(0, 160)}…`} />
        <div className="settings-actions">
          <button className="settings-btn" onClick={() => handleExport(currentThemeId)}>Export current</button>
          <button className="settings-btn settings-btn--primary" onClick={handleImport} disabled={!jsonInput.trim()}>Import</button>
        </div>
        {msg && <div className={msg.ok ? 'ts-success' : 'ts-error'}>{msg.ok ? '✅ ' : '❌ '}{msg.text}</div>}
      </Section>
    </div>
  );
}

// ── Editor ──────────────────────────────────────────────────────────────────
function EditorPanel() {
  const { settings, setSetting } = useSettings();
  return (
    <div>
      <h2 className="settings-h2">Editor (Notes)</h2>
      <Section title="Typography">
        <Row title="Font" desc="Default font for the note body.">
          <Select value={settings.noteFontFamily} options={FONT_FAMILIES} onChange={(v) => setSetting('noteFontFamily', v)} />
        </Row>
        <Row title="Font size" desc={`${settings.noteFontSize}px`}>
          <input type="range" min="13" max="24" value={settings.noteFontSize}
            onChange={(e) => setSetting('noteFontSize', Number(e.target.value))} className="settings-range" />
        </Row>
        <Row title="Line height" desc={String(settings.noteLineHeight)}>
          <input type="range" min="1.3" max="2.2" step="0.1" value={settings.noteLineHeight}
            onChange={(e) => setSetting('noteLineHeight', Number(e.target.value))} className="settings-range" />
        </Row>
      </Section>
      <Section title="Behaviour">
        <Row title="Default view" desc="Open notes as a centred page or full width.">
          <Segmented value={settings.noteDefaultView} onChange={(v) => setSetting('noteDefaultView', v)}
            options={[{ label: 'Paper', value: 'paper' }, { label: 'Wide', value: 'wide' }]} />
        </Row>
        <Row title="Spell check" desc="Underline misspelled words while writing.">
          <Toggle checked={settings.noteSpellcheck} onChange={(v) => setSetting('noteSpellcheck', v)} />
        </Row>
      </Section>
      <div className="settings-preview note-prose" style={{ minHeight: 'auto' }}>
        <p style={{ fontFamily: settings.noteFontFamily || undefined, fontSize: `${settings.noteFontSize}px`, lineHeight: settings.noteLineHeight }}>
          The quick brown fox jumps over the lazy dog — preview of your note typography.
        </p>
      </div>
    </div>
  );
}

// ── Behavior & Shortcuts ────────────────────────────────────────────────────
function BehaviorPanel() {
  const { settings, setSetting } = useSettings();
  return (
    <div>
      <h2 className="settings-h2">Behavior &amp; Shortcuts</h2>
      <Section title="Tasks">
        <Row title="Deleting a task" desc="Undo shows a toast you can revert; Confirm asks first.">
          <Segmented value={settings.taskDeleteMode} onChange={(v) => setSetting('taskDeleteMode', v)}
            options={[{ label: 'Undo toast', value: 'undo' }, { label: 'Confirm', value: 'confirm' }]} />
        </Row>
        <Row title="Quick-add due date" desc="Menu-bar quick-add sets the task due today.">
          <Toggle checked={settings.quickAddDueToday} onChange={(v) => setSetting('quickAddDueToday', v)} />
        </Row>
        <Row title="Move done tasks to Done column" desc="When a task is marked complete, automatically move it to the Done column.">
          <Toggle checked={settings.autoMoveDone} onChange={(v) => setSetting('autoMoveDone', v)} />
        </Row>

      </Section>
      <Section title="Keyboard shortcuts">
        <div className="settings-shortcuts">
          {SHORTCUTS.map((g) => (
            <div key={g.group} className="settings-shortcuts__group">
              <div className="settings-shortcuts__label">{g.group}</div>
              {g.items.map((it, i) => (
                <div key={i} className="settings-shortcuts__row">
                  <span>{it.desc}</span>
                  <span className="settings-shortcuts__keys">{it.keys.map((k, j) => <kbd key={j}>{k}</kbd>)}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

// ── Data & About ────────────────────────────────────────────────────────────
function DataPanel({ storageKind, onOpenExportImport, onResetWorkspace }) {
  const { resetSettings } = useSettings();
  const [confirmReset, setConfirmReset] = useState(false);
  const path = storageKind === 'sqlite' ? SQLITE_PATH : 'Browser localStorage (development)';

  const copyPath = async () => {
    try { await navigator.clipboard.writeText(path); toast.success('Path copied'); } catch { toast.error('Copy failed'); }
  };

  return (
    <div>
      <h2 className="settings-h2">Data &amp; About</h2>
      <Section title="Backup">
        <Row title="Export / Import" desc="JSON backup of every board, or restore from a file.">
          <button className="settings-btn" onClick={onOpenExportImport}>Open</button>
        </Row>
        <Row title="Workspace location" desc={path}>
          <button className="settings-btn" onClick={copyPath}><VscCopy /> Copy</button>
        </Row>
      </Section>

      <Section title="Reset">
        <Row title="Reset settings" desc="Restore appearance, editor and behavior defaults.">
          <button className="settings-btn" onClick={() => { resetSettings(); toast.success('Settings reset'); }}>Reset settings</button>
        </Row>
        <Row title="Reset workspace" desc="Delete all boards, tasks and notes. Cannot be undone.">
          {confirmReset ? (
            <span style={{ display: 'inline-flex', gap: 6 }}>
              <button className="settings-btn settings-btn--danger" onClick={() => { onResetWorkspace(); setConfirmReset(false); }}>Delete everything</button>
              <button className="settings-btn" onClick={() => setConfirmReset(false)}>Cancel</button>
            </span>
          ) : (
            <button className="settings-btn settings-btn--danger" onClick={() => setConfirmReset(true)}>Reset workspace</button>
          )}
        </Row>
      </Section>

      <Section title="About">
        <div className="settings-about">
          <div className="settings-about__name">Kandoo Desktop</div>
          <div className="settings-about__ver">Version {APP_VERSION} · local-first, stored on this {storageKind === 'sqlite' ? 'Mac' : 'browser'}</div>
          <a className="settings-link" href={REPO_URL} target="_blank" rel="noopener noreferrer">{REPO_URL}</a>
        </div>
      </Section>
    </div>
  );
}
