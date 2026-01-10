import * as React from 'react';
import { useRef, useEffect, useState, useMemo } from 'react';
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
    Modal,
    ScrollView as RNScrollView,
} from 'react-native';
import { signInAnonymouslyIfNeeded, onAuthChange, createOrUpdateUser, getUser, deleteCampaignFn, functions, db, subscribeToCampaignMessages } from '../../lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { doc, onSnapshot } from 'firebase/firestore';
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
import { DiceRoller } from '../../components/DiceRoller';
import { normalizeCharacter } from '../../lib/normalizeCharacter';
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
    const hasScrolledInitial = useRef(false);
    const hudAnimation = useRef(new Animated.Value(1)).current;

    // Client-only render guard to prevent SSR/hydration mismatch
    const [isMounted, setIsMounted] = useState(false);
    useEffect(() => {
        setIsMounted(true);
    }, []);

    const { colors, isDark } = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const {
        currentCampaign,
        messages,
        isLoading,
        processUserInput,
        loadCampaign,
        error,
        pendingChoice,
        setPendingChoice,
        pendingRoll,
        submitRollResult,
        updateCurrentCampaign,
        clearRollHistory,
        lastFailedRequest,
        retryLastRequest,
        setMessages,
    } = useGameStore();

    const user = useUserStore((state) => state.user);
    const isUserLoading = useUserStore((state) => state.isLoading);

    const [isDeleting, setIsDeleting] = useState(false);
    const [menuVisible, setMenuVisible] = useState(false);
    const [panelVisible, setPanelVisible] = useState(false);
    const [hudExpanded, setHudExpanded] = useState(true);
    const [isProcessingQuest, setIsProcessingQuest] = useState(false);
    const [isRequestingQuests, setIsRequestingQuests] = useState(false);
    const [isDesktop, setIsDesktop] = useState(() => {
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
            return window.innerWidth >= 768;
        }
        return false;
    });

    // 1. Memoized Values (Defined before effects)
    const reversedMessages = useMemo(() => [...messages].reverse(), [messages]);

    const lastNarratorIndexReversed = useMemo(() => {
        for (let i = 0; i < reversedMessages.length; i++) {
            if (reversedMessages[i].role === 'narrator') return i;
        }
        return -1;
    }, [reversedMessages]);

    const lastUserMessageIndexReversed = useMemo(() => {
        for (let i = 0; i < reversedMessages.length; i++) {
            if (reversedMessages[i].role === 'user') return i;
        }
        return -1;
    }, [reversedMessages]);

    // 2. Helper Handlers (Defined before effects)
    const scrollToBottom = () => {
        requestAnimationFrame(() => {
            // In an inverted list, index 0 is the bottom
            if (reversedMessages.length > 0) {
                flatListRef.current?.scrollToIndex({ index: 0, animated: true });
            }
        });
    };

    const scrollToLastResponse = () => {
        if (lastNarratorIndexReversed !== -1) {
            flatListRef.current?.scrollToIndex({
                index: lastNarratorIndexReversed,
                animated: true,
                viewPosition: 1, // Aligns IT to the top of the screen
            });
        }
    };

    const handleSend = async (text: string) => {
        await processUserInput(text);
    };

    const toggleHud = () => {
        Animated.spring(hudAnimation, {
            toValue: hudExpanded ? 0 : 1,
            useNativeDriver: false,
        }).start();
        setHudExpanded(!hudExpanded);
    };

    const handleAcceptQuest = async (questId: string) => {
        if (!id) return;
        setIsProcessingQuest(true);
        try {
            const acceptTrigger = httpsCallable(functions, 'acceptQuestTrigger');
            await acceptTrigger({ campaignId: id, questId });
            // Reload campaign to update UI with accepted quest
            await loadCampaign(id);
        } catch (error) {
            console.error('Error accepting quest:', error);
            Alert.alert('Error', 'Failed to accept quest');
        } finally {
            setIsProcessingQuest(false);
        }
    };

    const handleDeclineQuest = async (questId: string) => {
        if (!id) return;
        setIsProcessingQuest(true);
        try {
            const declineTrigger = httpsCallable(functions, 'declineQuestTrigger');
            await declineTrigger({ campaignId: id, questId });
            // Reload campaign to update UI with declined quest removed
            await loadCampaign(id);
        } catch (error) {
            console.error('Error declining quest:', error);
            Alert.alert('Error', 'Failed to decline quest');
        } finally {
            setIsProcessingQuest(false);
        }
    };

    const handleRequestQuests = async () => {
        if (!id) return;
        setIsRequestingQuests(true);
        try {
            const requestTrigger = httpsCallable(functions, 'requestQuestsTrigger');
            const result: any = await requestTrigger({ campaignId: id });
            if (result.data?.success) {
                console.log(`Quest Master: ${result.data.questsGenerated} new opportunities found.`);
            }
        } catch (error: any) {
            console.error('Error requesting quests:', error);
            const errorMessage = error.message || 'The Quest Master is currently unavailable.';
            const displayMessage = errorMessage.replace('INTERNAL: ', '').replace('FAILED_PRECONDITION: ', '');
            if (Platform.OS === 'web') {
                console.warn(`Quest Master Error: ${displayMessage}`);
            } else {
                Alert.alert('Quest Master Error', displayMessage);
            }
        } finally {
            setIsRequestingQuests(false);
        }
    };

    const handleDeleteCampaign = async () => {
        setMenuVisible(false);
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

    // 3. Side Effects (Dependencies are now initialized above)

    // Auto-scroll removed - Inverted list naturally loads at the bottom (index 0)

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

    // 2. Effects (Ordered by dependency)
    // 2.1 Load campaign on mount or ID change
    useEffect(() => {
        if (id && isMounted) {
            loadCampaign(id);
            // Clear roll history when switching campaigns
            clearRollHistory();
        }
    }, [id, isMounted, loadCampaign, clearRollHistory]);

    // Real-time listener for campaign updates (character stats, module state)
    useEffect(() => {
        if (!id || !user?.id) return;
        const campaignRef = doc(db, 'users', user.id, 'campaigns', id);
        const unsubscribe = onSnapshot(campaignRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data();
                updateCurrentCampaign(data);
            }
        });
        return () => unsubscribe();
    }, [id, user?.id]);

    // Real-time listener for messages - syncs narratives even if frontend errors
    useEffect(() => {
        if (!id || !user?.id) return;

        console.log('[Campaign] Starting real-time message sync for:', id);
        const unsubscribe = subscribeToCampaignMessages(
            user.id,
            id,
            (firestoreMessages) => {
                // Only update if we have more messages from Firestore than locally
                // This prevents overwriting local optimistic updates
                const currentMessages = useGameStore.getState().messages;
                if (firestoreMessages.length > currentMessages.length) {
                    console.log('[Campaign] Syncing', firestoreMessages.length, 'messages from Firestore (had', currentMessages.length, 'local)');
                    setMessages(firestoreMessages);
                }
            }
        );

        return () => {
            console.log('[Campaign] Stopping message sync');
            unsubscribe();
        };
    }, [id, user?.id, setMessages]);

    // Auto-scroll to top of narrator response when it finishes loading
    const prevIsLoading = useRef(isLoading);
    useEffect(() => {
        if (prevIsLoading.current && !isLoading && lastNarratorIndexReversed !== -1) {
            // Give the list a moment to layout the new content
            requestAnimationFrame(() => {
                scrollToLastResponse();
            });
        }
        prevIsLoading.current = isLoading;
    }, [isLoading, lastNarratorIndexReversed]);

    // Auto-show panel on mobile when dice roll is required
    useEffect(() => {
        if (pendingRoll && !isDesktop && !panelVisible) {
            setPanelVisible(true);
        }
    }, [pendingRoll, isDesktop, panelVisible]);

    // Smart Idle Detection for Cache Heartbeat
    useEffect(() => {
        if (!id || Platform.OS !== 'web' || typeof document === 'undefined') return;
        const HEARTBEAT_INTERVAL = 270000;
        const IDLE_TIMEOUT = 900000;
        let heartbeatInterval: any = null;
        let idleTimeout: any = null;
        let lastActivity = Date.now();
        let isHeartbeatActive = true;
        const keepAlive = httpsCallable(functions, 'keepVoiceCacheAlive');

        const resetIdleTimer = () => {
            lastActivity = Date.now();
            if (idleTimeout) clearTimeout(idleTimeout);
            if (!isHeartbeatActive) {
                isHeartbeatActive = true;
                startHeartbeat();
            }
            idleTimeout = setTimeout(() => {
                isHeartbeatActive = false;
                if (heartbeatInterval) {
                    clearInterval(heartbeatInterval);
                    heartbeatInterval = null;
                }
            }, IDLE_TIMEOUT);
        };

        const startHeartbeat = () => {
            if (heartbeatInterval) clearInterval(heartbeatInterval);
            heartbeatInterval = setInterval(() => {
                if (isHeartbeatActive) {
                    keepAlive({ campaignId: id }).catch(e => console.warn('[Heartbeat] Fail:', e));
                }
            }, HEARTBEAT_INTERVAL);
        };

        const activityEvents = ['mousedown', 'keydown', 'touchstart', 'click'];
        activityEvents.forEach(event => document.addEventListener(event, resetIdleTimer));
        resetIdleTimer();
        startHeartbeat();

        return () => {
            if (heartbeatInterval) clearInterval(heartbeatInterval);
            if (idleTimeout) clearTimeout(idleTimeout);
            activityEvents.forEach(event => document.removeEventListener(event, resetIdleTimer));
        };
    }, [id]);

    // Show loading state until client is hydrated and campaign is loaded
    if (!isMounted || ((isLoading || isUserLoading) && !currentCampaign)) {
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
    const rawCharacter = currentCampaign.character || (currentCampaign.moduleState as any)?.character;
    const character = normalizeCharacter(rawCharacter, currentCampaign.worldModule);
    const moduleState = currentCampaign.moduleState;

    const renderMessage = ({ item, index }: { item: Message; index: number }) => (
        <MessageBubble
            message={item}
            index={index}
            isLastUserMessage={index === lastUserMessageIndexReversed}
        />
    );

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
                            <View style={styles.headerLeft}>
                                <Logo size={32} />
                                <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
                                    <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
                                </TouchableOpacity>
                                <View>
                                    <Text style={styles.campaignName} numberOfLines={1}>
                                        {currentCampaign?.name || 'Loading...'}
                                    </Text>
                                    <Text style={styles.worldName}>
                                        {currentCampaign?.worldModule ? getWorldInfo(colors)[currentCampaign.worldModule]?.name : '...'}
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.headerRight}>
                                <TurnCounter />
                                <TouchableOpacity style={styles.iconButton} onPress={() => setMenuVisible(true)}>
                                    <Ionicons name="ellipsis-vertical" size={24} color={colors.text.primary} />
                                </TouchableOpacity>
                            </View>

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

                        {/* Menu Dropdown */}
                        {menuVisible && (
                            <View style={styles.menuDropdown}>
                                <TouchableOpacity
                                    style={styles.menuItem}
                                    onPress={handleDeleteCampaign}
                                    disabled={isDeleting}
                                >
                                    <Ionicons name="trash-outline" size={20} color="#ef4444" />
                                    <Text style={[styles.menuItemText, { color: '#ef4444' }]}>
                                        {isDeleting ? 'Deleting...' : 'Delete Campaign'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* Chat Messages */}
                        <FlatList
                            ref={flatListRef}
                            data={reversedMessages}
                            renderItem={renderMessage}
                            keyExtractor={(item) => item.id}
                            inverted={true}
                            contentContainerStyle={styles.messageList}
                            showsVerticalScrollIndicator={false}
                            onScrollToIndexFailed={(info) => {
                                flatListRef.current?.scrollToOffset({
                                    offset: info.averageItemLength * info.index,
                                    animated: true
                                });
                            }}
                            ListEmptyComponent={
                                <View style={[styles.emptyChat, { transform: [{ scaleY: -1 }] }]}>
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

                        {/* Choice Display */}
                        {!isLoading && pendingChoice && (
                            <View style={styles.choiceContainer}>
                                <View style={styles.choicePrompt}>
                                    <Ionicons name="help-circle" size={20} color={colors.primary[400]} />
                                    <Text style={styles.choicePromptText}>
                                        {pendingChoice.prompt}
                                    </Text>
                                </View>
                                {pendingChoice.options && pendingChoice.options.length > 0 ? (
                                    <View style={styles.choiceButtons}>
                                        {pendingChoice.options.map((option, index) => (
                                            <TouchableOpacity
                                                key={index}
                                                style={styles.choiceButton}
                                                onPress={() => {
                                                    handleSend(option);
                                                    setPendingChoice(null);
                                                }}
                                            >
                                                <Text style={styles.choiceButtonText}>• {option}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                ) : (
                                    <Text style={styles.choiceFreeformHint}>
                                        Type your response below
                                    </Text>
                                )}
                            </View>
                        )}



                        {/* Navigation Buttons */}
                        {messages.length > 0 && (
                            <View style={styles.navButtons}>
                                {lastNarratorIndexReversed !== -1 && (
                                    <TouchableOpacity
                                        style={styles.navButton}
                                        onPress={scrollToLastResponse}
                                        activeOpacity={0.7}
                                    >
                                        <Ionicons name="text" size={20} color={colors.text.primary} />
                                    </TouchableOpacity>
                                )}
                                <TouchableOpacity
                                    style={styles.navButton}
                                    onPress={scrollToBottom}
                                    activeOpacity={0.7}
                                >
                                    <Ionicons name="arrow-down" size={20} color={colors.text.primary} />
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* Retry Button - shows when last request failed */}
                        {lastFailedRequest && !isLoading && (
                            <TouchableOpacity
                                onPress={retryLastRequest}
                                style={styles.retryButton}
                            >
                                <Ionicons name="refresh" size={18} color={colors.status.error} />
                                <Text style={[styles.retryButtonText, { color: colors.status.error }]}>
                                    Retry Failed Message
                                </Text>
                            </TouchableOpacity>
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
                {
                    (isDesktop || panelVisible) && currentCampaign && (<View style={[
                        styles.panelContainer,
                        !isDesktop && styles.panelMobile
                    ]}>
                        {/* Close button for mobile */}
                        {!isDesktop && (
                            <TouchableOpacity
                                style={styles.closePanelButton}
                                onPress={() => setPanelVisible(false)}
                            >
                                <Ionicons name="close" size={24} color={colors.text.primary} />
                            </TouchableOpacity>
                        )}
                        <CharacterPanel
                            moduleState={currentCampaign.moduleState}
                            worldModule={currentCampaign.worldModule}
                            onAcceptQuest={handleAcceptQuest}
                            onDeclineQuest={handleDeclineQuest}
                            onRequestQuests={handleRequestQuests}
                            isRequestingQuests={isRequestingQuests}
                            pendingRoll={pendingRoll}
                            onRollComplete={(result) => {
                                console.log('[Campaign] Dice roll complete:', result);
                                submitRollResult(result.total);
                            }}
                        />
                    </View>
                    )
                }
            </View >
        </SafeAreaView >
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
        justifyContent: 'space-between',
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
    menuItemText: {
        color: colors.text.primary,
        fontSize: typography.fontSize.sm,
        fontWeight: '500',
    },
    // Quest UI Styles
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconButton: {
        padding: spacing.xs,
    },
    campaignName: {
        color: colors.text.primary,
        fontSize: typography.fontSize.md,
        fontWeight: 'bold',
    },
    worldName: {
        color: colors.text.muted,
        fontSize: typography.fontSize.xs,
    },
    questLogContainer: {
        backgroundColor: colors.background.secondary,
        width: '90%',
        maxWidth: 500,
        maxHeight: '80%',
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.border.default,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 8,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.md,
        paddingBottom: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.default,
    },
    modalTitle: {
        fontSize: typography.fontSize.xl,
        fontWeight: 'bold',
        color: colors.text.primary,
    },
    questLogScroll: {
        flexGrow: 0,
    },
    emptyText: {
        color: colors.text.muted,
        textAlign: 'center',
        paddingVertical: spacing.xl,
        fontStyle: 'italic',
    },
    questCard: {
        backgroundColor: colors.background.tertiary,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        marginBottom: spacing.md,
        borderLeftWidth: 4,
        borderLeftColor: colors.primary[400],
    },
    questTitle: {
        fontSize: typography.fontSize.md,
        fontWeight: 'bold',
        color: colors.text.primary,
        marginBottom: spacing.xs,
    },
    questDescription: {
        fontSize: typography.fontSize.sm,
        color: colors.text.secondary,
        marginBottom: spacing.sm,
        lineHeight: 20,
    },
    questFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: spacing.xs,
        paddingTop: spacing.xs,
        borderTopWidth: 1,
        borderTopColor: colors.border.default + '40',
    },
    questStatus: {
        fontSize: typography.fontSize.xs,
        fontWeight: 'bold',
        color: colors.primary[400],
    },
    questReward: {
        fontSize: typography.fontSize.xs,
        color: colors.gold.main,
        fontWeight: '600',
    },
    suggestedQuestContainer: {
        backgroundColor: colors.background.secondary,
        width: '95%',
        maxWidth: 450,
        maxHeight: '70%',
        borderRadius: borderRadius.xl,
        padding: spacing.lg,
        borderWidth: 2,
        borderColor: colors.primary[400],
    },
    suggestedTitle: {
        fontSize: typography.fontSize.xxl,
        fontWeight: 'bold',
        color: colors.primary[400],
        textAlign: 'center',
        marginBottom: spacing.lg,
    },
    suggestedScroll: {
        flexGrow: 0,
    },
    suggestedCard: {
        gap: spacing.md,
    },
    questInhibitor: {
        alignSelf: 'flex-start',
        backgroundColor: colors.primary[400] + '20',
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs / 2,
        borderRadius: borderRadius.sm,
        borderWidth: 1,
        borderColor: colors.primary[400] + '40',
    },
    questInhibitorText: {
        color: colors.primary[400],
        fontSize: 10,
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    rewardBox: {
        backgroundColor: colors.background.tertiary,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        alignItems: 'center',
        marginVertical: spacing.sm,
        borderWidth: 1,
        borderColor: colors.gold.main + '40',
    },
    rewardTitle: {
        fontSize: 10,
        color: colors.gold.main,
        fontWeight: 'bold',
        letterSpacing: 2,
        marginBottom: 4,
    },
    rewardText: {
        fontSize: typography.fontSize.lg,
        color: colors.text.primary,
        fontWeight: 'bold',
    },
    suggestedActions: {
        flexDirection: 'row',
        gap: spacing.md,
        marginTop: spacing.md,
    },
    declineButton: {
        flex: 1,
        paddingVertical: spacing.md,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: borderRadius.md,
        backgroundColor: colors.background.tertiary,
        borderWidth: 1,
        borderColor: colors.border.default,
    },
    declineButtonText: {
        color: colors.text.secondary,
        fontWeight: '600',
    },
    acceptButton: {
        flex: 2,
        paddingVertical: spacing.md,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: borderRadius.md,
        backgroundColor: colors.primary[400],
    },
    acceptButtonText: {
        color: '#000',
        fontWeight: 'bold',
        fontSize: typography.fontSize.md,
    },
    modalFooter: {
        paddingTop: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.border.default,
    },
    requestQuestsButton: {
        flexDirection: 'row',
        backgroundColor: colors.primary[400],
        padding: spacing.md,
        borderRadius: borderRadius.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    requestQuestsButtonText: {
        color: '#000',
        fontWeight: 'bold',
        fontSize: typography.fontSize.md,
    },
    disabledButton: {
        opacity: 0.6,
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
    menuDropdown: {
        position: 'absolute' as const,
        top: 60,
        right: spacing.md,
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border.default,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
        zIndex: 1000,
        minWidth: 180,
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
    closePanelButton: {
        position: 'absolute' as const,
        top: spacing.md,
        right: spacing.md,
        zIndex: 1001,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.background.tertiary,
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 3,
    },
    choiceContainer: {
        backgroundColor: colors.background.secondary,
        marginHorizontal: spacing.md,
        marginBottom: spacing.sm,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.primary[600] + '40',
    },
    choicePrompt: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        gap: spacing.sm,
        marginBottom: spacing.sm,
    },
    choicePromptText: {
        flex: 1,
        color: colors.text.primary,
        fontSize: typography.fontSize.md,
        fontWeight: '600' as const,
    },
    choiceButtons: {
        gap: spacing.sm,
    },
    choiceButton: {
        backgroundColor: colors.primary[700],
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.primary[500],
    },
    choiceButtonText: {
        color: colors.text.primary,
        fontSize: typography.fontSize.md,
    },
    choiceFreeformHint: {
        color: colors.text.muted,
        fontSize: typography.fontSize.sm,
        fontStyle: 'italic' as const,
        textAlign: 'center' as const,
    },
    navButtons: {
        flexDirection: 'row' as const,
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
        gap: spacing.sm,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
    },
    navButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.background.tertiary,
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
        borderWidth: 1,
        borderColor: colors.border.default,
    },
    retryButton: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        padding: spacing.sm,
        backgroundColor: colors.status.error + '15', // 15% opacity
        borderRadius: borderRadius.sm,
        marginHorizontal: spacing.md,
        marginBottom: spacing.xs,
    },
    retryButtonText: {
        fontSize: typography.fontSize.sm,
        marginLeft: spacing.xs,
        fontWeight: '600' as const,
    },
});
