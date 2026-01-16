// Theme configuration for Atlas Cortex
// Modern dark fantasy theme with selectable color variants and fonts

// ==================== COLOR PALETTES ====================

export const palettes = {
    default: { // Alias for midnight
        primary: {
            50: '#f0e6ff', 100: '#d4bfff', 200: '#b794ff', 300: '#9966ff',
            400: '#7c3aed', 500: '#6d28d9', 600: '#5b21b6', 700: '#4c1d95',
            800: '#3b1578', 900: '#2e1065',
        },
        background: {
            primary: '#0f0a1e', secondary: '#1a1332', tertiary: '#241b47', elevated: '#2d2354',
        },
        border: { default: '#3b1578', light: '#4c1d95', glow: '#9966ff' },
        chat: { user: '#4c1d95' }
    },
    midnight: { // Default Deep Purple
        primary: {
            50: '#f0e6ff', 100: '#d4bfff', 200: '#b794ff', 300: '#9966ff',
            400: '#7c3aed', 500: '#6d28d9', 600: '#5b21b6', 700: '#4c1d95',
            800: '#3b1578', 900: '#2e1065',
        },
        background: {
            primary: '#0f0a1e', secondary: '#1a1332', tertiary: '#241b47', elevated: '#2d2354',
        },
        border: { default: '#3b1578', light: '#4c1d95', glow: '#9966ff' },
        chat: { user: '#4c1d95' }
    },
    forest: { // Deep Green
        primary: {
            50: '#ecfdf5', 100: '#d1fae5', 200: '#a7f3d0', 300: '#6ee7b7',
            400: '#34d399', 500: '#10b981', 600: '#059669', 700: '#047857',
            800: '#065f46', 900: '#064e3b',
        },
        background: {
            primary: '#06130e', secondary: '#0a1d15', tertiary: '#11291e', elevated: '#1a3528',
        },
        border: { default: '#065f46', light: '#047857', glow: '#10b981' },
        chat: { user: '#047857' }
    },
    ocean: { // Deep Blue
        primary: {
            50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd',
            400: '#60a5fa', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8',
            800: '#1e40af', 900: '#1e3a8a',
        },
        background: {
            primary: '#050b18', secondary: '#0a1428', tertiary: '#111e3c', elevated: '#1a2a4f',
        },
        border: { default: '#1e40af', light: '#1d4ed8', glow: '#3b82f6' },
        chat: { user: '#1e40af' }
    },
    crimson: { // Deep Red
        primary: {
            50: '#fef2f2', 100: '#fee2e2', 200: '#fecaca', 300: '#fca5a5',
            400: '#f87171', 500: '#ef4444', 600: '#dc2626', 700: '#b91c1c',
            800: '#991b1b', 900: '#7f1d1d',
        },
        background: {
            primary: '#1a0505', secondary: '#2d0a0a', tertiary: '#3f1010', elevated: '#521616',
        },
        border: { default: '#991b1b', light: '#b91c1c', glow: '#ef4444' },
        chat: { user: '#b91c1c' }
    },
    parchment: { // Warm Beige (Light Theme)
        primary: {
            50: '#fefce8', 100: '#fef9c3', 200: '#fef08a', 300: '#fde047',
            400: '#facc15', 500: '#eab308', 600: '#ca8a04', 700: '#a16207',
            800: '#854d0e', 900: '#713f12',
        },
        background: {
            primary: '#faf8f3', secondary: '#f5f1e8', tertiary: '#ebe5d6', elevated: '#e0d9c7',
        },
        border: { default: '#d4c5a0', light: '#c9b88f', glow: '#a16207' },
        chat: { user: '#a16207' }
    },
    highContrast: { // Maximum Contrast (Accessibility)
        primary: {
            50: '#ffffff', 100: '#f0f0f0', 200: '#e0e0e0', 300: '#d0d0d0',
            400: '#b0b0b0', 500: '#909090', 600: '#707070', 700: '#505050',
            800: '#303030', 900: '#101010',
        },
        background: {
            primary: '#000000', secondary: '#0a0a0a', tertiary: '#141414', elevated: '#1e1e1e',
        },
        border: { default: '#ffffff', light: '#e0e0e0', glow: '#ffffff' },
        chat: { user: '#303030' }
    }
};


// Common accents and statuses independent of variant
const sharedColors = {
    gold: { light: '#fcd34d', main: '#f59e0b', dark: '#d97706' },
    status: { success: '#10b981', warning: '#f59e0b', error: '#ef4444', info: '#3b82f6' },
    hp: { full: '#10b981', medium: '#f59e0b', low: '#ef4444', critical: '#991b1b' },
};

// Generate full color set based on variant and dark/light mode
export const getColorsByVariant = (variant: keyof typeof palettes = 'midnight', isDark: boolean = true) => {
    const palette = palettes[variant] || palettes.midnight;

    if (isDark) {
        return {
            ...sharedColors,
            primary: palette.primary,
            background: palette.background,
            border: palette.border,
            text: {
                primary: '#f8fafc',
                secondary: '#cbd5e1',
                muted: '#94a3b8',
                inverse: '#ffffff',
            },
            chat: {
                ...palette.chat,
                narrator: '#1e293b',
                system: '#1e3a5f',
                blueBox: '#1e40af',
            },
        };
    } else {
        // Light mode adaptation (could be further specialized per variant)
        return {
            ...sharedColors,
            primary: palette.primary,
            background: {
                primary: '#f8fafc', secondary: '#ffffff', tertiary: '#ffffff', elevated: '#f1f5f9',
            },
            text: {
                primary: '#0f172a', secondary: '#334155', muted: '#64748b', inverse: '#f8fafc',
            },
            border: {
                default: '#e2e8f0', light: '#cbd5e1', glow: palette.primary[400],
            },
            chat: {
                user: palette.primary[400],
                narrator: '#f1f5f9',
                system: '#eff6ff',
                blueBox: '#dbeafe',
            },
        };
    }
};

// Legacy exports for backward compatibility
export const darkColors = getColorsByVariant('midnight', true);
export const lightColors = getColorsByVariant('midnight', false);
export const colors = darkColors;

// ==================== SPACING & RADIUS ====================

export const spacing = {
    xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48,
};

export const borderRadius = {
    xs: 2, sm: 4, md: 8, lg: 12, xl: 16, xxl: 24, full: 9999,
};

// ==================== TYPOGRAPHY ====================

const fontSizeMultipliers = {
    small: 0.85,
    medium: 1.0,
    large: 1.15,
    xlarge: 1.3,
};

export const getTypography = (fontFamilyBase: string = 'System', sizeKey: 'small' | 'medium' | 'large' | 'xlarge' = 'medium') => {
    // Map of logic font names to actual font families (loaded via _layout.tsx)
    const fonts = {
        regular: fontFamilyBase === 'System' ? 'System' : `${fontFamilyBase}_400Regular`,
        medium: fontFamilyBase === 'System' ? 'System' : `${fontFamilyBase}_500Medium`,
        bold: fontFamilyBase === 'System' ? 'System' : `${fontFamilyBase}_700Bold`,
    };

    const multiplier = fontSizeMultipliers[sizeKey];

    return {
        fontFamily: fonts,
        fontSize: {
            xs: Math.round(12 * multiplier),
            sm: Math.round(14 * multiplier),
            md: Math.round(16 * multiplier),
            lg: Math.round(18 * multiplier),
            xl: Math.round(20 * multiplier),
            xxl: Math.round(24 * multiplier),
            xxxl: Math.round(32 * multiplier),
            display: Math.round(40 * multiplier),
        },
        lineHeight: { tight: 1.2, normal: 1.5, relaxed: 1.75 },
        // Presets (caller needs to apply colors)
        h1: { fontSize: Math.round(32 * multiplier), fontFamily: fonts.bold },
        h2: { fontSize: Math.round(24 * multiplier), fontFamily: fonts.bold },
        h3: { fontSize: Math.round(20 * multiplier), fontFamily: fonts.medium },
        h4: { fontSize: Math.round(18 * multiplier), fontFamily: fonts.medium },
        body: { fontSize: Math.round(16 * multiplier), fontFamily: fonts.regular },
        label: { fontSize: Math.round(14 * multiplier), fontFamily: fonts.medium },
    };
};

// Legacy export
export const typography = getTypography('System');

// ==================== EFFECTS & ANIMATION ====================

export const shadows = {
    sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 2 },
    md: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 4 },
    lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
    glow: (color: string = '#9966ff') => ({
        shadowColor: color, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 12, elevation: 12
    }),
};

export const glassmorphism = {
    light: { backgroundColor: 'rgba(255, 255, 255, 0.1)', borderColor: 'rgba(255, 255, 255, 0.2)', borderWidth: 1 },
    medium: { backgroundColor: 'rgba(255, 255, 255, 0.15)', borderColor: 'rgba(255, 255, 255, 0.3)', borderWidth: 1 },
    dark: { backgroundColor: 'rgba(0, 0, 0, 0.3)', borderColor: 'rgba(255, 255, 255, 0.1)', borderWidth: 1 },
};

export const animation = { fast: 150, normal: 300, slow: 500 };

export const theme = {
    spacing,
    borderRadius,
    shadows,
    glassmorphism,
    animation,
};

export default theme;
