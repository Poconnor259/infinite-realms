// Theme configuration for Infinite Realms
// Dark fantasy theme with ethereal blues, deep purples, and gold accents

export const colors = {
    // Primary palette
    primary: {
        50: '#f0e6ff',
        100: '#d4bfff',
        200: '#b794ff',
        300: '#9966ff',
        400: '#7c3aed',
        500: '#6d28d9',
        600: '#5b21b6',
        700: '#4c1d95',
        800: '#3b1578',
        900: '#2e1065',
    },

    // Gold accent
    gold: {
        light: '#fcd34d',
        main: '#f59e0b',
        dark: '#d97706',
    },

    // Background colors (deep space theme)
    background: {
        primary: '#0f0a1e',    // Deepest purple-black
        secondary: '#1a1332',  // Slightly lighter
        tertiary: '#241b47',   // Card backgrounds
        elevated: '#2d2354',   // Elevated surfaces
    },

    // Text colors
    text: {
        primary: '#f8fafc',    // Pure white for headers
        secondary: '#cbd5e1',  // Light gray for body
        muted: '#94a3b8',      // Muted text
        inverse: '#0f0a1e',    // Dark text on light bg
    },

    // Status colors
    status: {
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
        info: '#3b82f6',
    },

    // HP Bar gradient colors
    hp: {
        full: '#10b981',       // Green
        medium: '#f59e0b',     // Yellow
        low: '#ef4444',        // Red
        critical: '#991b1b',   // Dark red
    },

    // Chat bubble colors
    chat: {
        user: '#4c1d95',       // User message background
        narrator: '#1e293b',   // Narrator message background
        system: '#1e3a5f',     // System alert background
        blueBox: '#1e40af',    // Special "Blue Box" alerts
    },

    // Border colors
    border: {
        default: '#3b1578',
        light: '#4c1d95',
        glow: '#9966ff',
    },
};

export const spacing = {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
};

export const borderRadius = {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    xxl: 24,
    full: 9999,
};

export const typography = {
    // Font families (we'll load custom fonts later)
    fontFamily: {
        regular: 'System',
        medium: 'System',
        bold: 'System',
        fantasy: 'System', // Will be replaced with a fantasy font
    },

    // Font sizes
    fontSize: {
        xs: 12,
        sm: 14,
        md: 16,
        lg: 18,
        xl: 20,
        xxl: 24,
        xxxl: 32,
        display: 40,
    },

    // Line heights
    lineHeight: {
        tight: 1.2,
        normal: 1.5,
        relaxed: 1.75,
    },

    // Presets
    h1: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#f8fafc',
    },
    h2: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#f8fafc',
    },
    h3: {
        fontSize: 20,
        fontWeight: '600',
        color: '#f8fafc',
    },
    h4: {
        fontSize: 18,
        fontWeight: '600',
        color: '#f8fafc',
    },
    body: {
        fontSize: 16,
        color: '#cbd5e1',
    },
    label: {
        fontSize: 14,
        fontWeight: '500',
        color: '#94a3b8',
    },
};

export const shadows = {
    sm: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 2,
    },
    md: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 4,
    },
    lg: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    glow: {
        shadowColor: '#9966ff',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 12,
        elevation: 12,
    },
    none: {
        shadowColor: 'transparent',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0,
        shadowRadius: 0,
        elevation: 0,
    },
};

// Animation durations
export const animation = {
    fast: 150,
    normal: 300,
    slow: 500,
};

export const theme = {
    colors,
    spacing,
    borderRadius,
    typography,
    shadows,
    animation,
};

export type Theme = typeof theme;
export default theme;
