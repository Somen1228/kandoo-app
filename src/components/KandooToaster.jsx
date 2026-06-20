import { Toaster } from 'sonner';
import { useTheme } from '../contexts/ThemeContext';

const LIGHT_THEMES = ['light'];

function KandooToaster() {
  const { currentThemeId } = useTheme();
  const theme = LIGHT_THEMES.includes(currentThemeId) ? 'light' : 'dark';

  return (
    <Toaster
      position="bottom-right"
      theme={theme}
      richColors
      duration={3500}
      gap={6}
      offset={20}
      toastOptions={{
        className: 'kandoo-toast',
        style: {
          background: 'var(--theme-bg-modal)',
          color: 'var(--theme-text-primary)',
          border: '1px solid var(--theme-border)',
          borderRadius: '14px',
          fontFamily: 'var(--font-ui)',
          fontSize: '0.855rem',
          fontWeight: 500,
          boxShadow: '0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.1)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          padding: '11px 16px',
          minWidth: '260px',
          maxWidth: '360px',
        },
        classNames: {
          success: 'kandoo-toast--success',
          error:   'kandoo-toast--error',
          warning: 'kandoo-toast--warning',
          info:    'kandoo-toast--info',
        },
      }}
    />
  );
}

export default KandooToaster;
