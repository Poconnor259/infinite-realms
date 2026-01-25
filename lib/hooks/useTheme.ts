import { useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { useSettingsStore } from '../store';
import { getColorsByVariant, getTypography } from '../theme';

export function useThemeColors() {
    const { themeMode, themeVariant, fontFamily, fontSize } = useSettingsStore();
    const systemScheme = useColorScheme();
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    // During SSR/SSG/First Render, force a deterministic theme (e.g. system=light)
    // This prevents hydration mismatch if the server assumes light but client system is dark.
    // Once mounted, we switch to the actual system scheme.
    const resolvedScheme = (themeMode === 'system')
        ? (isMounted ? (systemScheme === 'dark' ? 'dark' : 'light') : 'light')
        : themeMode;

    const activeTheme = resolvedScheme;

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
