import React from 'react';
import { Text, StyleSheet, ViewStyle, TextStyle, ActivityIndicator, View } from 'react-native';
import { useThemeColors } from '../../lib/hooks/useTheme';
import { borderRadius, spacing, shadows } from '../../lib/theme';
import { AnimatedPressable } from './Animated';

interface ButtonProps {
    title: string;
    onPress: () => void;
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold';
    size?: 'sm' | 'md' | 'lg';
    loading?: boolean;
    disabled?: boolean;
    icon?: React.ReactNode;
    style?: ViewStyle;
    textStyle?: TextStyle;
}

/**
 * Button - A modern, animated button component with multiple variants
 */
export function Button({
    title,
    onPress,
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    icon,
    style,
    textStyle,
}: ButtonProps) {
    const { colors, typography } = useThemeColors();

    const getVariantStyles = (): { container: ViewStyle; text: TextStyle } => {
        switch (variant) {
            case 'secondary':
                return {
                    container: { backgroundColor: colors.background.elevated, borderWidth: 1, borderColor: colors.border.default },
                    text: { color: colors.text.primary },
                };
            case 'ghost':
                return {
                    container: { backgroundColor: 'transparent' },
                    text: { color: colors.primary[400], fontWeight: '600' },
                };
            case 'danger':
                return {
                    container: { backgroundColor: colors.status.error },
                    text: { color: colors.text.inverse, fontWeight: 'bold' },
                };
            case 'gold':
                return {
                    container: { backgroundColor: colors.gold.main },
                    text: { color: colors.text.inverse, fontWeight: 'bold' },
                };
            case 'primary':
            default:
                return {
                    container: { backgroundColor: colors.primary[500] },
                    text: { color: colors.text.inverse, fontWeight: 'bold' },
                };
        }
    };

    const getSizeStyles = (): { container: ViewStyle; text: TextStyle } => {
        switch (size) {
            case 'sm':
                return {
                    container: { paddingVertical: spacing.xs, paddingHorizontal: spacing.md },
                    text: { fontSize: typography.fontSize.sm },
                };
            case 'lg':
                return {
                    container: { paddingVertical: spacing.md, paddingHorizontal: spacing.xl },
                    text: { fontSize: typography.fontSize.lg },
                };
            case 'md':
            default:
                return {
                    container: { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
                    text: { fontSize: typography.fontSize.md },
                };
        }
    };

    const variantStyles = getVariantStyles();
    const sizeStyles = getSizeStyles();

    return (
        <AnimatedPressable
            onPress={onPress}
            disabled={disabled || loading}
            style={[
                styles.base,
                variantStyles.container,
                sizeStyles.container,
                disabled && styles.disabled,
                style,
            ]}
        >
            {loading ? (
                <ActivityIndicator color={variantStyles.text.color} size="small" />
            ) : (
                <View style={styles.content}>
                    {icon && <View style={styles.iconContainer}>{icon}</View>}
                    <Text style={[
                        styles.text,
                        { fontFamily: typography.fontFamily.medium },
                        variantStyles.text,
                        sizeStyles.text,
                        textStyle,
                    ]}>
                        {title}
                    </Text>
                </View>
            )}
        </AnimatedPressable>
    );
}

const styles = StyleSheet.create({
    base: {
        borderRadius: borderRadius.md,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 80,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    text: {
        textAlign: 'center',
    },
    disabled: {
        opacity: 0.5,
    },
    iconContainer: {
        marginRight: spacing.sm,
    },
});
