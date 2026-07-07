import { useTheme } from './useTheme';

export default function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
      aria-label="Toggle theme"
      className="theme-toggle"
    >
      {theme === 'light' ? '🌙' : '☀️'}
    </button>
  );
}
