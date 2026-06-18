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
      closeButton
      duration={3500}
      toastOptions={{
        style: {
          background: 'var(--theme-bg-modal)',
          color: 'var(--theme-text-primary)',
          border: '1px solid var(--theme-border)',
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
        },
      }}
    />
  );
}

export default KandooToaster;
