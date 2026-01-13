import React from 'react';
import { View, StyleSheet, Platform, ViewStyle, Pressable } from 'react-native';
import { BlurView } from 'expo-blur';
import { useThemeColors } from '../../lib/hooks/useTheme';
import { borderRadius, shadows as themeShadows } from '../../lib/theme';

interface CardProps {
    children: React.ReactNode;
    variant?: 'default' | 'glass' | 'outlined' | 'elevated';
    glassIntensity?: 'light' | 'medium' | 'dark';
    padding?: 'none' | 'xs' | 'sm' | 'md' | 'lg';
    onPress?: () => void;
    style?: ViewStyle | ViewStyle[];
    containerStyle?: ViewStyle;
}

/**
 * Card - A modern, theme-aware panel component
 * Supports standard styles and glassmorphism (frosted glass)
 */
export function Card({
    children,
    variant = 'default',
    glassIntensity = 'light',
    padding = 'md',
    onPress,
    style,
    containerStyle,
}: CardProps) {
    const { colors, isDark } = useThemeColors();

    const getPadding = () => {
        const values = { none: 0, xs: 4, sm: 8, md: 16, lg: 24 };
        return values[padding];
    };

    const isGlass = variant === 'glass';

    const CardContent = (
        <View style={[
            styles.content,
            { padding: getPadding() },
            style
        ]}>
            {children}
        </View>
    );

    const baseStyle: ViewStyle = {
        borderRadius: borderRadius.lg,
        overflow: 'hidden',
    };

    if (isGlass) {
        const glassBg = isDark
            ? (glassIntensity === 'dark' ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.3)')
            : (glassIntensity === 'dark' ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.5)');

        const borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)';

        return (
            <Pressable disabled={!onPress} onPress={onPress}>
                <BlurView
                    intensity={glassIntensity === 'light' ? 20 : glassIntensity === 'medium' ? 40 : 60}
                    tint={isDark ? 'dark' : 'light'}
                    style={[baseStyle, { backgroundColor: glassBg, borderColor, borderWidth: 1 }, containerStyle]}
                >
                    {CardContent}
                </BlurView>
            </Pressable>
        );
    }

    const standardStyles: ViewStyle = {
        backgroundColor: variant === 'elevated' ? colors.background.elevated : colors.background.tertiary,
        borderColor: variant === 'outlined' ? colors.border.default : 'transparent',
        borderWidth: variant === 'outlined' ? 1 : 0,
        ...((variant === 'elevated' || variant === 'default') && isDark === false ? themeShadows.md : {}),
    };

    return (
        <Pressable disabled={!onPress} onPress={onPress}>
            <View style={[baseStyle, standardStyles, containerStyle]}>
                {CardContent}
            </View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    content: {
        width: '100%',
    },
});
