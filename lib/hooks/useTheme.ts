import { useColorScheme } from 'react-native';
import { useSettingsStore } from '../store';
import { darkColors, lightColors } from '../theme';

export function useThemeColors() {
    const themeMode = useSettingsStore(state => state.themeMode);
    const systemScheme = useColorScheme();

    const activeTheme = themeMode === 'system'
        ? (systemScheme === 'dark' ? 'dark' : 'light')
        : themeMode;

    const colors = activeTheme === 'dark' ? darkColors : lightColors;

    return {
        colors,
        isDark: activeTheme === 'dark',
        theme: activeTheme
    };
}
