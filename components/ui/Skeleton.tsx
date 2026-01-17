import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, Platform, type ViewStyle, type DimensionValue } from 'react-native';
import { colors, borderRadius, spacing } from '../../lib/theme';

// useNativeDriver is not supported on web
const USE_NATIVE_DRIVER = Platform.OS !== 'web';

interface SkeletonProps {
    width?: DimensionValue;
    height?: number;
    borderRadius?: number;
    style?: ViewStyle;
}

/**
 * Animated skeleton loading placeholder
 */
export function Skeleton({
    width = '100%',
    height = 20,
    borderRadius: radius = borderRadius.md,
    style,
}: SkeletonProps) {
    const shimmerAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const animation = Animated.loop(
            Animated.sequence([
                Animated.timing(shimmerAnim, {
                    toValue: 1,
                    duration: 1000,
                    useNativeDriver: USE_NATIVE_DRIVER,
                }),
                Animated.timing(shimmerAnim, {
                    toValue: 0,
                    duration: 1000,
                    useNativeDriver: USE_NATIVE_DRIVER,
                }),
            ])
        );
        animation.start();
        return () => animation.stop();
    }, [shimmerAnim]);

    const opacity = shimmerAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0.3, 0.7],
    });

    return (
        <Animated.View
            style={[
                {
                    width: typeof width === 'number' ? width : width,
                    height,
                    borderRadius: radius,
                    backgroundColor: colors.background.tertiary,
                    opacity,
                },
                style,
            ]}
        />
    );
}

/**
 * Skeleton placeholder for a campaign card
 */
export function CampaignCardSkeleton() {
    return (
        <View style={styles.campaignCard}>
            <Skeleton width={48} height={48} borderRadius={24} />
            <View style={styles.campaignCardContent}>
                <Skeleton width="60%" height={18} style={{ marginBottom: 8 }} />
                <Skeleton width="40%" height={14} style={{ marginBottom: 8 }} />
                <Skeleton width="30%" height={10} />
            </View>
            <Skeleton width={60} height={14} />
        </View>
    );
}

/**
 * Skeleton placeholder for a world module card
 */
export function WorldCardSkeleton() {
    return (
        <View style={styles.worldCard}>
            <Skeleton width={60} height={60} borderRadius={30} style={{ marginBottom: 12 }} />
            <Skeleton width="70%" height={18} style={{ marginBottom: 8 }} />
            <Skeleton width="90%" height={14} style={{ marginBottom: 8 }} />
            <Skeleton width="80%" height={12} />
            <Skeleton width="85%" height={12} style={{ marginTop: 4 }} />
        </View>
    );
}

/**
 * Skeleton placeholder for a text line
 */
export function TextSkeleton({ width = '100%', height = 16 }: { width?: DimensionValue; height?: number }) {
    return <Skeleton width={width} height={height} />;
}

/**
 * Skeleton placeholder for an avatar/icon
 */
export function AvatarSkeleton({ size = 40 }: { size?: number }) {
    return <Skeleton width={size} height={size} borderRadius={size / 2} />;
}

/**
 * Skeleton placeholder for a chat message
 */
export function MessageSkeleton({ isUser = false }: { isUser?: boolean }) {
    return (
        <View style={[styles.messageContainer, isUser && styles.messageUser]}>
            <View style={styles.messageBubble}>
                <Skeleton width="90%" height={16} style={{ marginBottom: 8 }} />
                <Skeleton width="75%" height={16} style={{ marginBottom: 8 }} />
                <Skeleton width="60%" height={16} />
            </View>
        </View>
    );
}

/**
 * Skeleton placeholder for character panel
 */
export function CharacterPanelSkeleton() {
    return (
        <View style={styles.characterPanel}>
            {/* Header */}
            <View style={styles.characterHeader}>
                <AvatarSkeleton size={60} />
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                    <Skeleton width="70%" height={20} style={{ marginBottom: 8 }} />
                    <Skeleton width="50%" height={16} style={{ marginBottom: 4 }} />
                    <Skeleton width="40%" height={14} />
                </View>
            </View>

            {/* Stats */}
            <View style={styles.statsGrid}>
                {[1, 2, 3, 4].map((i) => (
                    <View key={i} style={styles.statItem}>
                        <Skeleton width="100%" height={12} style={{ marginBottom: 4 }} />
                        <Skeleton width="60%" height={18} />
                    </View>
                ))}
            </View>

            {/* Resources */}
            <View style={{ gap: spacing.sm }}>
                <Skeleton width="100%" height={24} />
                <Skeleton width="100%" height={24} />
                <Skeleton width="100%" height={24} />
            </View>
        </View>
    );
}

/**
 * Skeleton placeholder for quest list
 */
export function QuestListSkeleton({ count = 3 }: { count?: number }) {
    return (
        <View style={{ gap: spacing.md }}>
            {Array.from({ length: count }).map((_, i) => (
                <View key={i} style={styles.questCard}>
                    <View style={styles.questHeader}>
                        <Skeleton width="70%" height={18} />
                        <Skeleton width={60} height={24} borderRadius={12} />
                    </View>
                    <Skeleton width="100%" height={14} style={{ marginBottom: 8 }} />
                    <Skeleton width="85%" height={14} style={{ marginBottom: 12 }} />
                    <View style={styles.questFooter}>
                        <Skeleton width={80} height={32} borderRadius={16} />
                        <Skeleton width={80} height={32} borderRadius={16} />
                    </View>
                </View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({

    campaignCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.lg,
        marginBottom: spacing.sm,
        gap: spacing.md,
    },
    campaignCardContent: {
        flex: 1,
    },
    worldCard: {
        width: 160,
        padding: spacing.lg,
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.xl,
        alignItems: 'center',
        marginRight: spacing.md,
    },
    messageContainer: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        maxWidth: '80%',
    },
    messageUser: {
        alignSelf: 'flex-end',
    },
    messageBubble: {
        padding: spacing.md,
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.lg,
    },
    characterPanel: {
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        gap: spacing.lg,
    },
    characterHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.md,
    },
    statItem: {
        width: '47%',
    },
    questCard: {
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
    },
    questHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    questFooter: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
});
