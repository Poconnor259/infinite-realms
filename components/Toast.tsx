import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useGameStore, Toast as ToastType } from '../lib/store';
import { useThemeColors } from '../lib/hooks/useTheme';
import { spacing, borderRadius, typography } from '../lib/theme';

export function ToastContainer() {
    const toasts = useGameStore((state) => state.toasts);
    const removeToast = useGameStore((state) => state.removeToast);
    const { colors } = useThemeColors();

    if (toasts.length === 0) return null;

    return (
        <View style={styles.container} pointerEvents="box-none">
            {toasts.map((toast) => (
                <ToastItem
                    key={toast.id}
                    toast={toast}
                    onDismiss={() => removeToast(toast.id)}
                    colors={colors}
                />
            ))}
        </View>
    );
}

interface ToastItemProps {
    toast: ToastType;
    onDismiss: () => void;
    colors: any;
}

function ToastItem({ toast, onDismiss, colors }: ToastItemProps) {
    const fadeAnim = React.useRef(new Animated.Value(0)).current;

    React.useEffect(() => {
        // Fade in
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
        }).start();
    }, []);

    const handleDismiss = () => {
        // Fade out
        Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
        }).start(() => {
            onDismiss();
        });
    };

    const getToastColor = () => {
        switch (toast.type) {
            case 'success':
                return colors.status.success;
            case 'error':
                return colors.status.error;
            case 'warning':
                return colors.status.warning;
            case 'info':
            default:
                return colors.primary[400];
        }
    };

    const getToastIcon = () => {
        switch (toast.type) {
            case 'success':
                return 'checkmark-circle';
            case 'error':
                return 'close-circle';
            case 'warning':
                return 'warning';
            case 'info':
            default:
                return 'information-circle';
        }
    };

    const toastColor = getToastColor();
    const toastIcon = getToastIcon();

    return (
        <Animated.View
            style={[
                styles.toast,
                {
                    backgroundColor: colors.background.secondary,
                    borderLeftColor: toastColor,
                    opacity: fadeAnim,
                    transform: [{
                        translateY: fadeAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [-20, 0],
                        }),
                    }],
                },
            ]}
        >
            <View style={styles.toastContent}>
                <Ionicons name={toastIcon as any} size={20} color={toastColor} style={styles.icon} />
                <Text style={[styles.message, { color: colors.text.primary }]} numberOfLines={3}>
                    {toast.message}
                </Text>
                {toast.action && (
                    <TouchableOpacity
                        onPress={() => {
                            toast.action?.onPress();
                            handleDismiss();
                        }}
                        style={[styles.actionButton, { backgroundColor: toastColor }]}
                    >
                        <Text style={styles.actionText}>{toast.action.label}</Text>
                    </TouchableOpacity>
                )}
                <TouchableOpacity onPress={handleDismiss} style={styles.closeButton}>
                    <Ionicons name="close" size={18} color={colors.text.muted} />
                </TouchableOpacity>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 60,
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 9999,
        paddingHorizontal: spacing.md,
    },
    toast: {
        width: '100%',
        maxWidth: 500,
        borderRadius: borderRadius.md,
        borderLeftWidth: 4,
        marginBottom: spacing.sm,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    toastContent: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
    },
    icon: {
        marginRight: spacing.sm,
    },
    message: {
        flex: 1,
        fontSize: typography.fontSize.sm,
        lineHeight: typography.fontSize.sm * 1.4,
    },
    closeButton: {
        marginLeft: spacing.sm,
        padding: spacing.xs,
    },
    actionButton: {
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.sm,
        marginLeft: spacing.sm,
    },
    actionText: {
        color: '#FFFFFF',
        fontSize: typography.fontSize.xs,
        fontWeight: '600',
    },
});
