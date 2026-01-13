import { useColorScheme } from 'react-native';
import { useSettingsStore } from '../store';
import { getColorsByVariant, getTypography } from '../theme';

export function useThemeColors() {
    const { themeMode, themeVariant, fontFamily, fontSize } = useSettingsStore();
    const systemScheme = useColorScheme();

    const activeTheme = themeMode === 'system'
        ? (systemScheme === 'dark' ? 'dark' : 'light')
        : themeMode;

    const isDark = activeTheme === 'dark';
    const colors = getColorsByVariant(themeVariant, isDark);
    const formattedFontFamily = fontFamily.charAt(0).toUpperCase() + fontFamily.slice(1);
    const typography = getTypography(formattedFontFamily, fontSize);

    return {
        colors,
        typography,
        isDark,
        theme: activeTheme,
        variant: themeVariant,
        fontFamily
    };
}
