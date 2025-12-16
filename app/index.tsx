import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography, shadows } from '../lib/theme';
import { useGameStore, getDefaultModuleState, useTurnsStore } from '../lib/store';
import { TurnsMeter } from '../components/monetization/TurnsMeter';
import type { WorldModuleType, Campaign } from '../lib/types';

// Sample campaigns for demo
const SAMPLE_CAMPAIGNS: Campaign[] = [
    {
        id: 'demo_classic',
        userId: 'demo',
        name: 'The Lost Mines',
        worldModule: 'classic',
        createdAt: Date.now() - 86400000 * 3,
        updatedAt: Date.now() - 3600000,
        character: {
            id: 'char_1',
            name: 'Thorin Ironforge',
            hp: { current: 28, max: 35 },
            level: 3,
        },
        moduleState: getDefaultModuleState('classic'),
    },
    {
        id: 'demo_outworlder',
        userId: 'demo',
        name: 'Greenstone Trials',
        worldModule: 'outworlder',
        createdAt: Date.now() - 86400000 * 7,
        updatedAt: Date.now() - 86400000,
        character: {
            id: 'char_2',
            name: 'Jason Asano',
            hp: { current: 95, max: 100 },
            level: 12,
        },
        moduleState: getDefaultModuleState('outworlder'),
    },
];

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
    const [campaigns] = useState<Campaign[]>(SAMPLE_CAMPAIGNS);

    const handleCampaignPress = (campaign: Campaign) => {
        setCurrentCampaign(campaign);
        setMessages([
            {
                id: 'welcome',
                role: 'narrator',
                content: `Welcome back, ${campaign.character.name}. Your adventure continues...`,
                timestamp: Date.now(),
            },
        ]);
        router.push(`/campaign/${campaign.id}`);
    };

    const handleNewCampaign = () => {
        router.push('/world-select');
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

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.greeting}>Welcome to</Text>
                    <Text style={styles.title}>Infinite Realms</Text>
                </View>
                <TouchableOpacity
                    style={styles.settingsButton}
                    onPress={() => router.push('/settings')}
                >
                    <Ionicons name="settings-outline" size={24} color={colors.text.secondary} />
                </TouchableOpacity>
            </View>

            {/* Turns Usage Meter */}
            <View style={styles.turnsMeterContainer}>
                <TurnsMeter />
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* New Campaign Button */}
                <View>
                    <TouchableOpacity
                        style={styles.newCampaignButton}
                        onPress={handleNewCampaign}
                        activeOpacity={0.8}
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
                    </TouchableOpacity>
                </View>

                {/* Campaigns Section */}
                {campaigns.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>
                            Continue Your Journey
                        </Text>

                        {campaigns.map((campaign, index) => {
                            const worldInfo = WORLD_INFO[campaign.worldModule];
                            const hpPercent = (campaign.character.hp.current / campaign.character.hp.max) * 100;

                            return (
                                <View key={campaign.id}>
                                    <TouchableOpacity
                                        style={styles.campaignCard}
                                        onPress={() => handleCampaignPress(campaign)}
                                        activeOpacity={0.7}
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

                                        {/* Last Played */}
                                        <View style={styles.campaignMeta}>
                                            <Text style={styles.lastPlayed}>
                                                {formatDate(campaign.updatedAt)}
                                            </Text>
                                            <Ionicons
                                                name="chevron-forward"
                                                size={20}
                                                color={colors.text.muted}
                                            />
                                        </View>
                                    </TouchableOpacity>
                                </View>
                            );
                        })}
                    </View>
                )}

                {/* World Modules Preview */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>
                        Available Worlds
                    </Text>

                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.worldsScroll}
                    >
                        {Object.entries(WORLD_INFO).map(([key, info], index) => (
                            <View key={key}>
                                <View style={[styles.worldCard, { borderColor: info.color + '40' }]}>
                                    <Text style={styles.worldCardIcon}>{info.icon}</Text>
                                    <Text style={styles.worldCardName}>{info.name}</Text>
                                    <Text style={styles.worldCardDesc}>{info.description}</Text>
                                </View>
                            </View>
                        ))}
                    </ScrollView>
                </View>
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
    },
    miniHpText: {
        color: colors.text.muted,
        fontSize: typography.fontSize.xs,
    },
    campaignMeta: {
        alignItems: 'flex-end',
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
