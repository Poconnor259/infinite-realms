import React, { useRef, useEffect, useState, useMemo } from 'react';
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
    Alert,
} from 'react-native';
import { signInAnonymouslyIfNeeded, onAuthChange, createOrUpdateUser, getUser, deleteCampaignFn } from '../../lib/firebase';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { spacing, borderRadius, typography } from '../../lib/theme';
import { useThemeColors } from '../../lib/hooks/useTheme';
import { useGameStore, useTurnsStore, useUserStore } from '../../lib/store';
import { MessageBubble } from '../../components/chat/MessageBubble';
import { ChatInput } from '../../components/chat/ChatInput';
import { HPBar } from '../../components/hud/HPBar';
import { StatRow, ResourceBar } from '../../components/hud/StatCard';
import { CharacterPanel } from '../../components/character/CharacterPanel';
import { Logo } from '../../components/ui/Logo';
import type { Message, WorldModuleType, ClassicModuleState, OutworlderModuleState, TacticalModuleState } from '../../lib/types';

const getWorldInfo = (colors: any): Record<string, { name: string; icon: string; color: string }> => {
    const info: Record<string, { name: string; icon: string; color: string }> = {
        classic: { name: 'The Classic', icon: '⚔️', color: colors.gold.main },
        outworlder: { name: 'The Outworlder', icon: '🌌', color: '#10b981' },
        tactical: { name: 'PRAXIS: Operation Dark Tide', icon: '👤', color: '#8b5cf6' },
    };
    // Add legacy mappings
    info['shadow-monarch'] = info.tactical;
    info['shadowMonarch'] = info.tactical;
    return info;
};

// Turn Counter Component
function TurnCounter() {
    const { getRemaining, tier } = useTurnsStore();
    const remaining = getRemaining();
    const router = useRouter();
    const { colors } = useThemeColors();

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
    const { colors, isDark } = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const {
        currentCampaign,
        messages,
        isLoading,
        processUserInput,
        loadCampaign,
        error,
    } = useGameStore();
    const user = useUserStore((state) => state.user);
    const isUserLoading = useUserStore((state) => state.isLoading);

    const [isDeleting, setIsDeleting] = useState(false);
    const [menuVisible, setMenuVisible] = useState(false);
    const [panelVisible, setPanelVisible] = useState(false);
    const [isDesktop, setIsDesktop] = useState(() => {
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
            return window.innerWidth >= 768;
        }
        return false;
    });

    // Handle window resize for responsive panel
    useEffect(() => {
        if (Platform.OS !== 'web' || typeof window === 'undefined') return;

        const handleResize = () => {
            if (typeof window !== 'undefined') {
                setIsDesktop(window.innerWidth >= 768);
            }
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (!id || isUserLoading || !user) return;

        // If we don't have a campaign, or it's the wrong one, load it
        if (!currentCampaign || currentCampaign.id !== id) {
            loadCampaign(id);
        }
    }, [id, currentCampaign, loadCampaign, isUserLoading, user]);

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

    const handleDeleteCampaign = async () => {
        setMenuVisible(false);

        // Use window.confirm for web compatibility
        let confirmed = false;
        if (Platform.OS === 'web') {
            // @ts-ignore
            confirmed = window.confirm(`Are you sure you want to delete "${currentCampaign?.name}"? This cannot be undone.`);
        } else {
            confirmed = await new Promise<boolean>((resolve) => {
                // @ts-ignore
                Alert.alert(
                    'Delete Campaign',
                    `Are you sure you want to delete "${currentCampaign?.name}"? This cannot be undone.`,
                    [
                        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
                        { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
                    ]
                );
            });
        }

        if (!confirmed || !currentCampaign) return;

        setIsDeleting(true);
        try {
            await deleteCampaignFn({ campaignId: currentCampaign.id });
            router.replace('/world-select');
        } catch (error) {
            console.error('Failed to delete campaign:', error);
            if (Platform.OS === 'web') {
                // @ts-ignore
                window.alert('Failed to delete campaign');
            } else {
                // @ts-ignore
                Alert.alert('Error', 'Failed to delete campaign');
            }
            setIsDeleting(false);
        }
    };

    if ((isLoading || isUserLoading) && !currentCampaign) {
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

    const worldInfo = getWorldInfo(colors)[currentCampaign.worldModule] || {
        name: 'Unknown World',
        icon: '🌍',
        color: colors.text.muted
    };
    const character = currentCampaign.character;
    const moduleState = currentCampaign.moduleState;

    // Render module-specific HUD
    const renderModuleHud = () => {
        switch (moduleState.type as any) {
            case 'classic':
                const classicState = moduleState as ClassicModuleState;
                return (
                    <View style={styles.moduleHud}>
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
                const outworlderState = moduleState as OutworlderModuleState;
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

            case 'tactical':
            case 'shadowMonarch':
                const tacticalState = moduleState as TacticalModuleState;
                return (
                    <View style={styles.moduleHud}>
                        <View style={styles.hudRow}>
                            <View style={styles.jobBadge}>
                                <Text style={styles.jobText}>{tacticalState.character.job}</Text>
                            </View>
                            {tacticalState.character.title && (
                                <View style={styles.titleBadge}>
                                    <Text style={styles.titleText}>{tacticalState.character.title}</Text>
                                </View>
                            )}
                        </View>
                        <ResourceBar
                            label="Tactical Energy"
                            current={tacticalState.character.mana.current}
                            max={tacticalState.character.mana.max}
                            color="#3b82f6"
                            icon="⚡"
                        />
                        <ResourceBar
                            label="Fatigue Status"
                            current={tacticalState.character.fatigue.current}
                            max={tacticalState.character.fatigue.max}
                            color="#f59e0b"
                            icon="🔋"
                        />
                        <View style={styles.tacticalSquadPreview}>
                            <Text style={styles.tacticalSquadLabel}>
                                👥 Tactical Squad: {tacticalState.character.tacticalSquad.length}
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
            <View style={[styles.contentWrapper, isDesktop && styles.desktopLayout]}>
                {/* Main Chat Area */}
                <View style={[styles.chatContainer, isDesktop && styles.chatContainerDesktop]}>
                    <KeyboardAvoidingView
                        style={styles.keyboardView}
                        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                        keyboardVerticalOffset={0}
                    >
                        {/* Header */}
                        <View style={styles.header}>
                            <Logo size={32} />
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

                            {/* Inventory Button (Mobile) */}
                            {!isDesktop && (
                                <TouchableOpacity
                                    style={styles.headerButton}
                                    onPress={() => setPanelVisible(!panelVisible)}
                                >
                                    <Ionicons
                                        name={panelVisible ? "close" : "bag-outline"}
                                        size={24}
                                        color={colors.text.primary}
                                    />
                                </TouchableOpacity>
                            )}
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
                </View>

                {/* Character Panel - Desktop Sidebar / Mobile Drawer */}
                {(isDesktop || panelVisible) && currentCampaign && (<View style={[
                    styles.panelContainer,
                    !isDesktop && styles.panelMobile
                ]}>
                    <CharacterPanel
                        moduleState={currentCampaign.moduleState}
                        worldModule={currentCampaign.worldModule}
                    />
                </View>
                )}
            </View>
        </SafeAreaView>
    );
}

const createStyles = (colors: any) => StyleSheet.create({
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
    tacticalSquadPreview: {
        backgroundColor: colors.background.tertiary,
        padding: spacing.sm,
        borderRadius: borderRadius.md,
        marginTop: spacing.xs,
    },
    tacticalSquadLabel: {
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
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-start' as const,
        alignItems: 'flex-end' as const,
        paddingTop: 60,
        paddingRight: spacing.md,
    },
    menuContainer: {
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.md,
        padding: spacing.xs,
        minWidth: 180,
        borderWidth: 1,
        borderColor: colors.border.default,
    },
    menuItem: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        gap: spacing.sm,
        padding: spacing.md,
        borderRadius: borderRadius.sm,
    },
    menuItemText: {
        fontSize: typography.fontSize.md,
        fontWeight: '500' as const,
    },
    contentWrapper: {
        flex: 1,
    },
    desktopLayout: {
        flexDirection: 'row' as const,
    },
    chatContainer: {
        flex: 1,
    },
    chatContainerDesktop: {
        maxWidth: 'calc(100% - 320px)' as any,
    },
    panelContainer: {
        width: 320,
        borderLeftWidth: 1,
        borderLeftColor: colors.border.default,
        backgroundColor: colors.background.secondary,
    },
    panelMobile: {
        position: 'absolute' as const,
        top: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
        shadowColor: '#000',
        shadowOffset: { width: -2, height: 0 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 5,
    },
});
