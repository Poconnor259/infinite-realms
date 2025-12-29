// Theme configuration for Infinite Realms
// Dark fantasy theme with ethereal blues, deep purples, and gold accents

export const darkColors = {
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
        inverse: '#ffffff',    // White text on colored backgrounds (user bubbles)
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

export const lightColors = {
    // Primary palette (same as dark for now, might tune later)
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

    // Background colors (Clean white/slate theme)
    background: {
        primary: '#f8fafc',    // Slate 50 (App background)
        secondary: '#ffffff',  // White (Content background)
        tertiary: '#ffffff',   // Card backgrounds (with shadow)
        elevated: '#f1f5f9',   // Slate 100
    },

    // Text colors
    text: {
        primary: '#0f172a',    // Slate 900 (Headers)
        secondary: '#334155',  // Slate 700 (Body)
        muted: '#64748b',      // Slate 500
        inverse: '#f8fafc',    // White text on dark accents
    },

    // Status colors (same)
    status: {
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
        info: '#3b82f6',
    },

    // HP Bar
    hp: {
        full: '#10b981',
        medium: '#f59e0b',
        low: '#ef4444',
        critical: '#991b1b',
    },

    // Chat bubble colors
    chat: {
        user: '#7c3aed',       // Primary 400 (Lighter than dark mode user)
        narrator: '#f1f5f9',   // Slate 100
        system: '#eff6ff',     // Blue 50
        blueBox: '#dbeafe',    // Blue 100
    },

    // Border colors
    border: {
        default: '#e2e8f0',    // Slate 200
        light: '#cbd5e1',      // Slate 300
        glow: '#7c3aed',       // Primary 400
    },
};

// Default export for backward compatibility
export const colors = darkColors;

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

// Glassmorphism effects (frosted glass UI)
export const glassmorphism = {
    // Light glass effect (for cards, bubbles)
    light: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)', // Safari support
        borderColor: 'rgba(255, 255, 255, 0.2)',
        borderWidth: 1,
    },
    // Medium glass effect (for modals, overlays)
    medium: {
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderColor: 'rgba(255, 255, 255, 0.3)',
        borderWidth: 1,
    },
    // Strong glass effect (for prominent UI elements)
    strong: {
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        backdropFilter: 'blur(30px)',
        WebkitBackdropFilter: 'blur(30px)',
        borderColor: 'rgba(255, 255, 255, 0.4)',
        borderWidth: 1,
    },
    // Dark glass (for dark-themed components)
    dark: {
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        backdropFilter: 'blur(15px)',
        WebkitBackdropFilter: 'blur(15px)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
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
    glassmorphism,
    animation,
};

export type Theme = typeof theme;
export default theme;
