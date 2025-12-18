import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Image,
    ActivityIndicator,
    TouchableOpacity,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography, shadows } from '../lib/theme';
import { useGameStore, getDefaultModuleState, useTurnsStore, useUserStore } from '../lib/store';
import { TurnsMeter } from '../components/monetization/TurnsMeter';
import { AnimatedPressable, FadeInView } from '../components/ui/Animated';
import { getUserCampaigns, deleteCampaignFn } from '../lib/firebase';
import type { WorldModuleType, Campaign } from '../lib/types';

const WORLD_INFO: Record<WorldModuleType, {
    name: string;
    icon: string;
    color: string;
    description: string;
}> = {
    classic: {
        name: 'The Classic',
        icon: '⚔️',
        color: colors.gold.main,
        description: 'D&D 5e Rules',
    },
    outworlder: {
        name: 'The Outworlder',
        icon: '🌌',
        color: '#10b981',
        description: 'HWFWM Essence System',
    },
    shadowMonarch: {
        name: 'Shadow Monarch',
        icon: '👤',
        color: '#8b5cf6',
        description: 'Solo Leveling System',
    },
};

export default function HomeScreen() {
    const router = useRouter();
    const { setCurrentCampaign, setMessages } = useGameStore();
    const user = useUserStore((state) => state.user);
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [loading, setLoading] = useState(true);

    // Load user's campaigns from Firestore
    useEffect(() => {
        async function loadCampaigns() {
            if (!user?.id) {
                setLoading(false);
                return;
            }

            try {
                const userCampaigns = await getUserCampaigns(user.id);
                setCampaigns(userCampaigns as Campaign[]);
            } catch (error) {
                console.error('Failed to load campaigns:', error);
            } finally {
                setLoading(false);
            }
        }

        loadCampaigns();
    }, [user?.id]);

    const handleCampaignPress = (campaign: Campaign) => {
        // Just navigate - the campaign page will load the data
        router.push(`/campaign/${campaign.id}`);
    };

    const handleNewCampaign = () => {
        router.push('/world-select');
    };

    const handleWorldSelect = (worldId: string) => {
        router.push(`/campaign/create?world=${worldId}`);
    };

    const formatDate = (timestamp: number) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffHours = Math.floor((now.getTime() - timestamp) / (1000 * 60 * 60));

        if (diffHours < 1) return 'Just now';
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffHours < 48) return 'Yesterday';
        return date.toLocaleDateString();
    };

    const handleDeleteCampaign = async (campaign: Campaign, event: any) => {
        // Stop propagation to prevent opening the campaign
        event.stopPropagation();

        const confirmed = Platform.OS === 'web'
            ? window.confirm(`Are you sure you want to delete "${campaign.name}"? This cannot be undone.`)
            : true; // On mobile, could use Alert.alert

        if (!confirmed) return;

        try {
            await deleteCampaignFn({ campaignId: campaign.id });
            // Refresh campaigns list
            if (user?.id) {
                const userCampaigns = await getUserCampaigns(user.id);
                setCampaigns(userCampaigns as Campaign[]);
            }
        } catch (error) {
            console.error('Failed to delete campaign:', error);
            if (Platform.OS === 'web') {
                window.alert('Failed to delete campaign');
            }
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <FadeInView style={styles.header} delay={0}>
                <View>
                    <Text style={styles.greeting}>Welcome to</Text>
                    <Text style={styles.title}>Infinite Realms</Text>
                    {user?.isAnonymous && (
                        <AnimatedPressable
                            style={styles.createAccountLink}
                            onPress={() => router.push('/auth/signin')}
                        >
                            <Text style={styles.createAccountText}>Sign In / Create Account</Text>
                            <Ionicons name="arrow-forward" size={16} color={colors.primary[400]} />
                        </AnimatedPressable>
                    )}
                </View>
                <AnimatedPressable
                    style={styles.settingsButton}
                    onPress={() => router.push('/settings')}
                >
                    <Ionicons name="settings-outline" size={24} color={colors.text.secondary} />
                </AnimatedPressable>
            </FadeInView>

            {/* Turns Usage Meter */}
            <FadeInView style={styles.turnsMeterContainer} delay={100}>
                <TurnsMeter />
            </FadeInView>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* New Campaign Button */}
                <FadeInView delay={200}>
                    <AnimatedPressable
                        style={styles.newCampaignButton}
                        onPress={handleNewCampaign}
                    >
                        <View style={styles.newCampaignGradient}>
                            <View style={styles.newCampaignContent}>
                                <View style={styles.newCampaignIcon}>
                                    <Ionicons name="add" size={32} color={colors.text.primary} />
                                </View>
                                <View>
                                    <Text style={styles.newCampaignTitle}>Start New Adventure</Text>
                                    <Text style={styles.newCampaignSubtitle}>
                                        Choose a world and create your character
                                    </Text>
                                </View>
                            </View>
                            <Ionicons name="chevron-forward" size={24} color={colors.text.muted} />
                        </View>
                    </AnimatedPressable>
                </FadeInView>

                {/* Campaigns Section */}
                {loading ? (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>
                            Continue Your Journey
                        </Text>
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="small" color={colors.primary[400]} />
                            <Text style={styles.loadingText}>Loading campaigns...</Text>
                        </View>
                    </View>
                ) : campaigns.length > 0 ? (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>
                            Continue Your Journey
                        </Text>

                        {campaigns.map((campaign, index) => {
                            const worldInfo = WORLD_INFO[campaign.worldModule] || {
                                name: 'Unknown',
                                icon: '❓',
                                color: colors.text.muted,
                                description: 'Unknown World',
                            };
                            const hpPercent = campaign.character?.hp
                                ? (campaign.character.hp.current / campaign.character.hp.max) * 100
                                : 100;

                            return (
                                <FadeInView key={campaign.id} delay={300 + index * 100}>
                                    <AnimatedPressable
                                        style={styles.campaignCard}
                                        onPress={() => handleCampaignPress(campaign)}
                                    >
                                        {/* World Badge */}
                                        <View style={[styles.worldBadge, { backgroundColor: worldInfo.color + '20' }]}>
                                            <Text style={styles.worldIcon}>{worldInfo.icon}</Text>
                                        </View>

                                        {/* Campaign Info */}
                                        <View style={styles.campaignInfo}>
                                            <Text style={styles.campaignName}>{campaign.name}</Text>
                                            <Text style={styles.characterName}>
                                                {campaign.character.name} • Lv.{campaign.character.level}
                                            </Text>

                                            {/* Mini HP Bar */}
                                            <View style={styles.miniHpContainer}>
                                                <View style={styles.miniHpTrack}>
                                                    <View
                                                        style={[
                                                            styles.miniHpFill,
                                                            {
                                                                width: `${hpPercent}%`,
                                                                backgroundColor: hpPercent > 50 ? colors.hp.full :
                                                                    hpPercent > 25 ? colors.hp.medium : colors.hp.low
                                                            }
                                                        ]}
                                                    />
                                                </View>
                                                <Text style={styles.miniHpText}>
                                                    {campaign.character.hp.current}/{campaign.character.hp.max}
                                                </Text>
                                            </View>
                                        </View>

                                        {/* Last Played & Delete */}
                                        <View style={styles.campaignMeta}>
                                            <Text style={styles.lastPlayed}>
                                                {formatDate(campaign.updatedAt)}
                                            </Text>
                                            <View style={styles.campaignActions}>
                                                <TouchableOpacity
                                                    style={styles.deleteButton}
                                                    onPress={(e) => handleDeleteCampaign(campaign, e)}
                                                >
                                                    <Ionicons
                                                        name="trash-outline"
                                                        size={18}
                                                        color={colors.status.error}
                                                    />
                                                </TouchableOpacity>
                                                <Ionicons
                                                    name="chevron-forward"
                                                    size={20}
                                                    color={colors.text.muted}
                                                />
                                            </View>
                                        </View>
                                    </AnimatedPressable>
                                </FadeInView>
                            );
                        })}
                    </View>
                ) : null}

                {/* World Modules Preview */}
                <FadeInView style={styles.section} delay={500}>
                    <Text style={styles.sectionTitle}>
                        Available Worlds
                    </Text>

                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.worldsScroll}
                    >
                        {Object.entries(WORLD_INFO).map(([key, info], index) => (
                            <AnimatedPressable
                                key={key}
                                style={[styles.worldCard, { borderColor: info.color + '40' }]}
                                onPress={() => handleWorldSelect(key)}
                            >
                                <Text style={styles.worldCardIcon}>{info.icon}</Text>
                                <Text style={styles.worldCardName}>{info.name}</Text>
                                <Text style={styles.worldCardDesc}>{info.description}</Text>
                            </AnimatedPressable>
                        ))}
                    </ScrollView>
                </FadeInView>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background.primary,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
    },
    greeting: {
        color: colors.text.muted,
        fontSize: typography.fontSize.md,
    },
    title: {
        color: colors.text.primary,
        fontSize: typography.fontSize.xxxl,
        fontWeight: 'bold',
    },
    settingsButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.background.tertiary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.lg,
        gap: spacing.sm,
    },
    loadingText: {
        color: colors.text.muted,
        fontSize: typography.fontSize.sm,
    },
    turnsMeterContainer: {
        paddingHorizontal: spacing.lg,
        marginBottom: spacing.md,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.xxl,
    },
    newCampaignButton: {
        marginBottom: spacing.xl,
    },
    newCampaignGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.background.tertiary,
        borderRadius: borderRadius.xl,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.primary[700],
        ...shadows.md,
    },
    newCampaignContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    newCampaignIcon: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: colors.primary[600],
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    newCampaignTitle: {
        color: colors.text.primary,
        fontSize: typography.fontSize.lg,
        fontWeight: 'bold',
        marginBottom: 2,
    },
    newCampaignSubtitle: {
        color: colors.text.muted,
        fontSize: typography.fontSize.sm,
    },
    createAccountLink: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: spacing.xs,
        gap: spacing.xs,
    },
    createAccountText: {
        fontSize: typography.fontSize.sm,
        color: colors.primary[400],
        fontWeight: '600',
    },
    section: {
        marginBottom: spacing.xl,
    },
    sectionTitle: {
        color: colors.text.secondary,
        fontSize: typography.fontSize.md,
        fontWeight: '600',
        marginBottom: spacing.md,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    campaignCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.background.tertiary,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        marginBottom: spacing.sm,
        borderWidth: 1,
        borderColor: colors.border.default,
    },
    worldBadge: {
        width: 48,
        height: 48,
        borderRadius: borderRadius.md,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    worldIcon: {
        fontSize: 24,
    },
    campaignInfo: {
        flex: 1,
    },
    campaignName: {
        color: colors.text.primary,
        fontSize: typography.fontSize.md,
        fontWeight: '600',
        marginBottom: 2,
    },
    characterName: {
        color: colors.text.muted,
        fontSize: typography.fontSize.sm,
        marginBottom: spacing.xs,
    },
    miniHpContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    miniHpTrack: {
        flex: 1,
        height: 4,
        backgroundColor: colors.background.secondary,
        borderRadius: 2,
        overflow: 'hidden',
        maxWidth: 80,
    },
    miniHpFill: {
        height: '100%',
        borderRadius: 2,
        overflow: 'hidden',
    },
    miniHpText: {
        color: colors.text.muted,
        fontSize: typography.fontSize.xs,
    },
    campaignMeta: {
        alignItems: 'flex-end',
    },
    campaignActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    deleteButton: {
        padding: spacing.xs,
        borderRadius: borderRadius.sm,
    },
    lastPlayed: {
        color: colors.text.muted,
        fontSize: typography.fontSize.xs,
        marginBottom: spacing.xs,
    },
    worldsScroll: {
        paddingRight: spacing.lg,
    },
    worldCard: {
        width: 140,
        padding: spacing.md,
        backgroundColor: colors.background.tertiary,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        marginRight: spacing.sm,
        alignItems: 'center',
    },
    worldCardIcon: {
        fontSize: 32,
        marginBottom: spacing.sm,
    },
    worldCardName: {
        color: colors.text.primary,
        fontSize: typography.fontSize.sm,
        fontWeight: '600',
        marginBottom: 2,
        textAlign: 'center',
    },
    worldCardDesc: {
        color: colors.text.muted,
        fontSize: typography.fontSize.xs,
        textAlign: 'center',
    },
});
