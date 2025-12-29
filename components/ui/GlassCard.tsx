import React from 'react';
import { View, StyleSheet, Platform, ViewStyle } from 'react-native';
import { glassmorphism, borderRadius } from '../../lib/theme';

interface GlassCardProps {
    children: React.ReactNode;
    variant?: 'light' | 'medium' | 'strong' | 'dark';
    style?: ViewStyle | ViewStyle[];
}

/**
 * GlassCard - A reusable glassmorphism component
 * 
 * Creates a frosted-glass effect with:
 * - Semi-transparent background
 * - Backdrop blur (web only)
 * - Subtle border
 * - Layered depth
 * 
 * @param variant - Glass effect intensity: 'light' | 'medium' | 'strong' | 'dark'
 * @param style - Additional styles to apply
 */
export function GlassCard({ children, variant = 'light', style }: GlassCardProps) {
    const glassStyle = glassmorphism[variant];

    // Platform-specific styles
    const platformStyles: ViewStyle = Platform.select({
        web: {
            // @ts-ignore - backdropFilter is valid on web
            backdropFilter: glassStyle.backdropFilter,
            // @ts-ignore - WebkitBackdropFilter for Safari
            WebkitBackdropFilter: glassStyle.WebkitBackdropFilter,
        },
        default: {
            // On mobile, use shadow for depth since backdrop-filter isn't supported
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 3,
        },
    }) || {};

    return (
        <View
            style={[
                styles.container,
                {
                    backgroundColor: glassStyle.backgroundColor,
                    borderColor: glassStyle.borderColor,
                    borderWidth: glassStyle.borderWidth,
                },
                platformStyles,
                style,
            ]}
        >
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        borderRadius: borderRadius.md,
        overflow: 'hidden',
    },
});
