import React, { useRef, useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography } from '../../lib/theme';
import { useGameStore, useTurnsStore } from '../../lib/store';
import { MessageBubble } from '../../components/chat/MessageBubble';
import { ChatInput } from '../../components/chat/ChatInput';
import { HPBar } from '../../components/hud/HPBar';
import { StatRow, ResourceBar } from '../../components/hud/StatCard';
import type { Message, WorldModuleType } from '../../lib/types';

const WORLD_INFO: Record<WorldModuleType, { name: string; icon: string; color: string }> = {
    classic: { name: 'The Classic', icon: '⚔️', color: colors.gold.main },
    outworlder: { name: 'The Outworlder', icon: '🌌', color: '#10b981' },
    shadowMonarch: { name: 'Shadow Monarch', icon: '👤', color: '#8b5cf6' },
};

// Turn Counter Component
function TurnCounter() {
    const { getRemaining, tier } = useTurnsStore();
    const remaining = getRemaining();
    const router = useRouter();

    const displayText = remaining === Infinity ? '∞' : remaining.toString();
    const lowTurns = typeof remaining === 'number' && remaining < 10;

    return (
        <TouchableOpacity
            onPress={() => router.push('/subscription')}
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: spacing.sm,
                paddingVertical: spacing.xs,
                backgroundColor: lowTurns ? colors.hp.low + '20' : colors.background.tertiary,
                borderRadius: borderRadius.sm,
                borderWidth: 1,
                borderColor: lowTurns ? colors.hp.low : colors.border.default,
            }}
        >
            <Ionicons
                name="flash"
                size={16}
                color={lowTurns ? colors.hp.low : colors.primary[400]}
                style={{ marginRight: 4 }}
            />
            <Text
                style={{
                    color: lowTurns ? colors.hp.low : colors.text.secondary,
                    fontSize: typography.fontSize.sm,
                    fontWeight: '600',
                }}
            >
                {displayText}
            </Text>
        </TouchableOpacity>
    );
}

export default function CampaignScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const flatListRef = useRef<FlatList>(null);

    const {
        currentCampaign,
        messages,
        isLoading,
        processUserInput,
        loadCampaign,
        error,
    } = useGameStore();

    useEffect(() => {
        if (!id) return;

        // If we don't have a campaign, or it's the wrong one, load it
        if (!currentCampaign || currentCampaign.id !== id) {
            loadCampaign(id);
        }
    }, [id, currentCampaign, loadCampaign]);

    const [hudExpanded, setHudExpanded] = useState(true);
    const hudAnimation = useRef(new Animated.Value(1)).current;

    // Toggle HUD visibility
    const toggleHud = () => {
        Animated.spring(hudAnimation, {
            toValue: hudExpanded ? 0 : 1,
            useNativeDriver: false,
        }).start();
        setHudExpanded(!hudExpanded);
    };

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        if (messages.length > 0) {
            setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
        }
    }, [messages.length]);

    const handleSend = async (text: string) => {
        await processUserInput(text);
    };

    if (isLoading && !currentCampaign) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary[400]} />
                    <Text style={[styles.loadingText, { marginTop: spacing.md }]}>Loading adventure...</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (!currentCampaign) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>Campaign not found</Text>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => router.back()}
                    >
                        <Text style={styles.backButtonText}>Go Back</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    const worldInfo = WORLD_INFO[currentCampaign.worldModule];
    const character = currentCampaign.character;
    const moduleState = currentCampaign.moduleState;

    // Render module-specific HUD
    const renderModuleHud = () => {
        switch (moduleState.type) {
            case 'classic':
                const classicState = moduleState;
                return (
                    <View style={styles.moduleHud}>
                        <StatRow stats={classicState.character.stats} />
                        <View style={styles.hudRow}>
                            <View style={styles.hudStat}>
                                <Text style={styles.hudLabel}>AC</Text>
                                <Text style={styles.hudValue}>{classicState.character.ac}</Text>
                            </View>
                            <View style={styles.hudStat}>
                                <Text style={styles.hudLabel}>Gold</Text>
                                <Text style={[styles.hudValue, { color: colors.gold.main }]}>
                                    {classicState.character.gold}
                                </Text>
                            </View>
                            <View style={styles.hudStat}>
                                <Text style={styles.hudLabel}>Prof</Text>
                                <Text style={styles.hudValue}>+{classicState.character.proficiencyBonus}</Text>
                            </View>
                        </View>
                    </View>
                );

            case 'outworlder':
                const outworlderState = moduleState;
                return (
                    <View style={styles.moduleHud}>
                        <View style={styles.hudRow}>
                            <View style={[styles.rankBadge, { borderColor: worldInfo.color }]}>
                                <Text style={[styles.rankText, { color: worldInfo.color }]}>
                                    {outworlderState.character.rank}
                                </Text>
                            </View>
                            <View style={styles.essences}>
                                {outworlderState.character.essences.map((essence, i) => (
                                    <View key={i} style={styles.essenceBadge}>
                                        <Text style={styles.essenceText}>{essence}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                        <ResourceBar
                            label="Mana"
                            current={outworlderState.character.mana.current}
                            max={outworlderState.character.mana.max}
                            color="#3b82f6"
                            icon="💧"
                        />
                        <ResourceBar
                            label="Spirit"
                            current={outworlderState.character.spirit.current}
                            max={outworlderState.character.spirit.max}
                            color="#a855f7"
                            icon="✨"
                        />
                    </View>
                );

            case 'shadowMonarch':
                const shadowState = moduleState;
                return (
                    <View style={styles.moduleHud}>
                        <View style={styles.hudRow}>
                            <View style={styles.jobBadge}>
                                <Text style={styles.jobText}>{shadowState.character.job}</Text>
                            </View>
                            {shadowState.character.title && (
                                <View style={styles.titleBadge}>
                                    <Text style={styles.titleText}>{shadowState.character.title}</Text>
                                </View>
                            )}
                        </View>
                        <ResourceBar
                            label="Mana"
                            current={shadowState.character.mana.current}
                            max={shadowState.character.mana.max}
                            color="#3b82f6"
                            icon="💧"
                        />
                        <ResourceBar
                            label="Fatigue"
                            current={shadowState.character.fatigue.current}
                            max={shadowState.character.fatigue.max}
                            color="#f59e0b"
                            icon="⚡"
                        />
                        <View style={styles.shadowArmyPreview}>
                            <Text style={styles.shadowLabel}>
                                👤 Shadow Army: {shadowState.character.shadowArmy.length}
                            </Text>
                        </View>
                    </View>
                );

            default:
                return null;
        }
    };

    const renderMessage = ({ item, index }: { item: Message; index: number }) => (
        <MessageBubble message={item} index={index} />
    );

    const hudHeight = hudAnimation.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 200],
    });

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <KeyboardAvoidingView
                style={styles.keyboardView}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={0}
            >
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.headerButton}
                        onPress={() => router.back()}
                    >
                        <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
                    </TouchableOpacity>

                    <View style={styles.headerCenter}>
                        <View style={styles.campaignHeader}>
                            <Text style={styles.worldIcon}>{worldInfo.icon}</Text>
                            <View>
                                <Text style={styles.campaignTitle} numberOfLines={1}>
                                    {currentCampaign.name}
                                </Text>
                                <Text style={styles.characterInfo}>
                                    {character.name} • Lv.{character.level}
                                </Text>
                            </View>
                        </View>
                    </View>

                    <TurnCounter />

                    <TouchableOpacity
                        style={styles.headerButton}
                        onPress={() => {/* Open menu */ }}
                    >
                        <Ionicons name="ellipsis-vertical" size={24} color={colors.text.primary} />
                    </TouchableOpacity>
                </View>

                {/* Collapsible HUD */}
                <Animated.View style={[styles.hudContainer, { maxHeight: hudHeight, opacity: hudAnimation }]}>
                    <View style={styles.hpSection}>
                        <HPBar
                            current={character.hp.current}
                            max={character.hp.max}
                            size="md"
                        />
                    </View>
                    {renderModuleHud()}
                </Animated.View>

                {/* HUD Toggle */}
                <TouchableOpacity
                    style={styles.hudToggle}
                    onPress={toggleHud}
                >
                    <Ionicons
                        name={hudExpanded ? 'chevron-up' : 'chevron-down'}
                        size={20}
                        color={colors.text.muted}
                    />
                </TouchableOpacity>

                {/* Chat Messages */}
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    renderItem={renderMessage}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.messageList}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <View style={styles.emptyChat}>
                            <Text style={styles.emptyChatIcon}>📜</Text>
                            <Text style={styles.emptyChatText}>Your adventure awaits...</Text>
                            <Text style={styles.emptyChatHint}>
                                Type your first action to begin
                            </Text>
                        </View>
                    }
                />

                {/* Loading Indicator */}
                {isLoading && (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator color={colors.primary[400]} />
                        <Text style={styles.loadingText}>The narrator is writing...</Text>
                    </View>
                )}

                {/* Error Display */}
                {error && (
                    <View style={styles.errorBanner}>
                        <Ionicons name="alert-circle" size={16} color={colors.status.error} />
                        <Text style={styles.errorBannerText}>{error}</Text>
                    </View>
                )}

                {/* Chat Input */}
                <ChatInput
                    onSend={handleSend}
                    disabled={isLoading}
                    placeholder="What do you do?"
                />
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background.primary,
    },
    keyboardView: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.default,
    },
    headerButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerCenter: {
        flex: 1,
        alignItems: 'center',
    },
    campaignHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    worldIcon: {
        fontSize: 24,
        marginRight: spacing.sm,
    },
    campaignTitle: {
        color: colors.text.primary,
        fontSize: typography.fontSize.md,
        fontWeight: '600',
        maxWidth: 180,
    },
    characterInfo: {
        color: colors.text.muted,
        fontSize: typography.fontSize.xs,
    },
    hudContainer: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        backgroundColor: colors.background.secondary,
        overflow: 'hidden',
    },
    hpSection: {
        marginBottom: spacing.sm,
    },
    moduleHud: {
        gap: spacing.sm,
    },
    hudRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    hudStat: {
        alignItems: 'center',
        backgroundColor: colors.background.tertiary,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.md,
    },
    hudLabel: {
        color: colors.text.muted,
        fontSize: typography.fontSize.xs,
    },
    hudValue: {
        color: colors.text.primary,
        fontSize: typography.fontSize.lg,
        fontWeight: 'bold',
    },
    hudToggle: {
        alignItems: 'center',
        paddingVertical: spacing.xs,
        backgroundColor: colors.background.secondary,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.default,
    },
    rankBadge: {
        borderWidth: 2,
        borderRadius: borderRadius.md,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
    },
    rankText: {
        fontSize: typography.fontSize.md,
        fontWeight: 'bold',
    },
    essences: {
        flexDirection: 'row',
        gap: spacing.xs,
    },
    essenceBadge: {
        backgroundColor: colors.background.tertiary,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs / 2,
        borderRadius: borderRadius.sm,
    },
    essenceText: {
        color: colors.text.secondary,
        fontSize: typography.fontSize.xs,
    },
    jobBadge: {
        backgroundColor: colors.primary[700],
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.md,
    },
    jobText: {
        color: colors.text.primary,
        fontSize: typography.fontSize.sm,
        fontWeight: '600',
    },
    titleBadge: {
        backgroundColor: colors.gold.dark,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.md,
    },
    titleText: {
        color: colors.text.primary,
        fontSize: typography.fontSize.sm,
        fontWeight: '600',
    },
    shadowArmyPreview: {
        backgroundColor: colors.background.tertiary,
        padding: spacing.sm,
        borderRadius: borderRadius.md,
        marginTop: spacing.xs,
    },
    shadowLabel: {
        color: colors.text.secondary,
        fontSize: typography.fontSize.sm,
    },
    messageList: {
        paddingVertical: spacing.md,
        flexGrow: 1,
    },
    emptyChat: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: spacing.xxl * 2,
    },
    emptyChatIcon: {
        fontSize: 48,
        marginBottom: spacing.md,
    },
    emptyChatText: {
        color: colors.text.secondary,
        fontSize: typography.fontSize.lg,
        fontWeight: '600',
        marginBottom: spacing.xs,
    },
    emptyChatHint: {
        color: colors.text.muted,
        fontSize: typography.fontSize.sm,
    },
    loadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.sm,
        gap: spacing.sm,
        backgroundColor: colors.background.secondary,
    },
    loadingText: {
        color: colors.text.muted,
        fontSize: typography.fontSize.sm,
        fontStyle: 'italic',
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xl,
    },
    errorText: {
        color: colors.text.secondary,
        fontSize: typography.fontSize.lg,
        marginBottom: spacing.md,
    },
    backButton: {
        backgroundColor: colors.primary[600],
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.md,
    },
    backButtonText: {
        color: colors.text.primary,
        fontWeight: '600',
    },
    errorBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        backgroundColor: colors.status.error + '20',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        marginHorizontal: spacing.md,
        marginBottom: spacing.sm,
        borderRadius: borderRadius.md,
    },
    errorBannerText: {
        color: colors.status.error,
        fontSize: typography.fontSize.sm,
    },
});
