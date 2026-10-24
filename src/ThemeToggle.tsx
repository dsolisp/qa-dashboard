import { useTheme } from './useTheme';

export default function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const next = theme === 'light' ? 'dark' : 'light';
  return (
    <button
      type="button"
      onClick={toggle}
      title={`Switch to ${next} mode`}
      aria-label="Toggle theme"
      className="theme-toggle"
    >
      {theme === 'light' ? 'Dark' : 'Light'}
    </button>
  );
}
