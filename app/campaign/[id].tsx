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
import { useGameStore, useTurnsStore, useUserStore, useSettingsStore } from '../../lib/store';
import { MessageBubble } from '../../components/chat/MessageBubble';
import { ChatInput } from '../../components/chat/ChatInput';
import { HPBar } from '../../components/hud/HPBar';
import { StatRow, ResourceBar } from '../../components/hud/StatCard';
import { CharacterPanel } from '../../components/character/CharacterPanel';

const DIFFICULTY_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
    story: { label: 'Story', icon: '🎭', color: '#60a5fa' },
    novice: { label: 'Novice', icon: '📚', color: '#10b981' },
    adventurer: { label: 'Adventurer', icon: '⚔️', color: '#3b82f6' },
    hero: { label: 'Hero', icon: '🏆', color: '#f59e0b' },
    legendary: { label: 'Legendary', icon: '💀', color: '#ef4444' },
};
import { Logo } from '../../components/ui/Logo';
import { ReadingSettingsPanel } from '../../components/ui/ReadingSettingsPanel';
import { normalizeCharacter } from '../../lib/normalizeCharacter';
import { loadSoundEffects } from '../../lib/sounds';
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
                    fontFamily: typography.fontFamily.bold,
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

    const { colors, typography, isDark } = useThemeColors();
    const styles = useMemo(() => createStyles(colors, typography), [colors, typography]);

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
        setPendingRoll,
        rollHistory,
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
    const [readingSettingsVisible, setReadingSettingsVisible] = useState(false);
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
            // Force scroll to absolute bottom (offset 0 in inverted list)
            flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
        });
    };

    const scrollToLastResponse = (index?: number) => {
        const targetIndex = typeof index === 'number' ? index : lastNarratorIndexReversed;
        if (targetIndex !== -1) {
            flatListRef.current?.scrollToIndex({
                index: targetIndex,
                animated: true,
                viewPosition: 1, // Aligns the top of the item to the top of the screen
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
        // Clear sync lock to allow immediate real-time update from Firestore
        useGameStore.setState({ syncBlockedUntil: 0 });

        try {
            const acceptTrigger = httpsCallable(functions, 'acceptQuestTrigger');
            await acceptTrigger({ campaignId: id, questId });
            // RELOAD REMOVED: onSnapshot listener handles real-time updates
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
        // Clear sync lock
        useGameStore.setState({ syncBlockedUntil: 0 });

        try {
            const declineTrigger = httpsCallable(functions, 'declineQuestTrigger');
            await declineTrigger({ campaignId: id, questId });
            // RELOAD REMOVED: onSnapshot listener handles real-time updates
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
        // Clear sync lock
        useGameStore.setState({ syncBlockedUntil: 0 });

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
            router.replace('/');
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

    // Load sound effects on mount
    useEffect(() => {
        loadSoundEffects().catch(err => console.error('[Campaign] Failed to load sounds:', err));
    }, []);

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
    // Skip individual sync callbacks during active interaction to prevent race conditions
    useEffect(() => {
        if (!id || !user?.id) return;

        console.log('[Campaign] Starting real-time message sync for:', id);
        const unsubscribe = subscribeToCampaignMessages(
            user.id,
            id,
            (firestoreMessages) => {
                const currentMessages = useGameStore.getState().messages;
                const currentIsLoading = useGameStore.getState().isLoading;
                const currentPendingRoll = useGameStore.getState().pendingRoll;
                const syncBlockedUntil = useGameStore.getState().syncBlockedUntil;

                // Allow initial load even when sync is blocked
                const isInitialLoad = currentMessages.length === 0 && firestoreMessages.length > 0;

                // Skip sync callback during active flow to prevent race conditions
                // But keep the listener active so it can sync when flow completes
                // AND always allow initial load
                if (!isInitialLoad && (currentIsLoading || currentPendingRoll || Date.now() < syncBlockedUntil)) {
                    console.log('[Campaign] Sync blocked - active flow or cooldown period');
                    return;
                }

                // Only sync if Firestore has more messages than local
                // This handles cases where backend saved but frontend errored
                if (firestoreMessages.length > currentMessages.length) {
                    console.log('[Campaign] Syncing', firestoreMessages.length, 'messages from Firestore (had', currentMessages.length, 'local)');
                    setMessages(firestoreMessages);
                } else if (isInitialLoad) {
                    // Initial load case
                    console.log('[Campaign] Initial load:', firestoreMessages.length, 'messages');
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
    const prevPendingRoll = useRef(pendingRoll);

    useEffect(() => {
        // Don't scroll if we were just waiting for dice input
        // (User is waiting for NEW response, not re-reading old one)
        const wasWaitingForDice = prevPendingRoll.current !== null && pendingRoll === null;

        // Don't scroll if we just received a pending roll request
        const justReceivedPendingRoll = prevPendingRoll.current === null && pendingRoll !== null;

        if (prevIsLoading.current && !isLoading && lastNarratorIndexReversed !== -1 && !wasWaitingForDice && !pendingRoll && !justReceivedPendingRoll) {
            // Check if the latest message is indeed from the narrator/assistant
            const isNarratorResponse = reversedMessages.length > 0 &&
                (reversedMessages[0].role === 'narrator' || reversedMessages[0].role === 'system');

            if (isNarratorResponse) {
                // Give the list a moment to layout the potentially long new content
                setTimeout(() => {
                    scrollToLastResponse(lastNarratorIndexReversed);
                }, 100);
            }
        }
        prevIsLoading.current = isLoading;
        prevPendingRoll.current = pendingRoll;
    }, [isLoading, lastNarratorIndexReversed, pendingRoll]);

    // Auto-show panel when dice roll is required
    useEffect(() => {
        if (pendingRoll && !panelVisible) {
            setPanelVisible(true);
        }
    }, [pendingRoll, panelVisible]);

    // Auto-resolve pending rolls when dice mode is 'auto'
    useEffect(() => {
        const settings = useSettingsStore.getState();

        // If there's a pending roll and dice mode is auto, automatically roll and submit
        if (pendingRoll && settings.diceRollMode === 'auto' && !isLoading) {
            console.log('[Campaign] Auto-resolving pending roll:', pendingRoll.purpose);

            // Simulate a dice roll based on the type
            const diceType = pendingRoll.type || 'd20';
            const maxValue = parseInt(diceType.substring(1)) || 20;
            const rollResult = Math.floor(Math.random() * maxValue) + 1;

            // Submit the roll result
            submitRollResult(rollResult);
        }
    }, [pendingRoll, isLoading, submitRollResult]);


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
                        onPress={() => router.push('/')}
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
    const charData = (currentCampaign.character || (currentCampaign.moduleState as any)?.character || {}) as any;
    const moduleState = currentCampaign.moduleState || {};

    // Merge critical progress data that can sometimes exist at the top level of moduleState
    // Priority: moduleState (AI's direct report) > charData (nested object)
    const rawCharacter = {
        ...charData,
        experience: ((moduleState as any).experience !== undefined && (moduleState as any).experience !== null)
            ? (moduleState as any).experience
            : charData.experience,
        gold: ((moduleState as any).gold !== undefined && (moduleState as any).gold !== null)
            ? (moduleState as any).gold
            : charData.gold,
        credits: ((moduleState as any).credits !== undefined && (moduleState as any).credits !== null)
            ? (moduleState as any).credits
            : charData.credits,
    };

    const character = normalizeCharacter(rawCharacter, currentCampaign.worldModule);

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
                                <TouchableOpacity style={styles.iconButton} onPress={() => router.push('/')}>
                                    <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
                                </TouchableOpacity>
                                <View>
                                    <Text style={styles.campaignName} numberOfLines={1}>
                                        {currentCampaign?.name || 'Loading...'}
                                    </Text>
                                    {(currentCampaign?.name?.toLowerCase() !== (currentCampaign?.worldModule ? getWorldInfo(colors)[currentCampaign.worldModule]?.name?.toLowerCase() : '...')) && (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <Text style={styles.worldName}>
                                                {currentCampaign?.worldModule ? getWorldInfo(colors)[currentCampaign.worldModule]?.name : '...'}
                                            </Text>
                                            {currentCampaign?.character && (currentCampaign.character as any).difficulty && (
                                                <Text style={[styles.worldName, { color: DIFFICULTY_CONFIG[(currentCampaign.character as any).difficulty]?.color || colors.text.muted, opacity: 0.9 }]}>
                                                    • {DIFFICULTY_CONFIG[(currentCampaign.character as any).difficulty]?.icon} {DIFFICULTY_CONFIG[(currentCampaign.character as any).difficulty]?.label}
                                                </Text>
                                            )}
                                        </View>
                                    )}
                                </View>
                            </View>

                            <View style={styles.headerRight}>
                                <TurnCounter />
                                <TouchableOpacity style={styles.iconButton} onPress={() => setReadingSettingsVisible(true)}>
                                    <Text style={{ color: colors.text.primary, fontSize: 20, fontFamily: typography.fontFamily.bold }}>Aa</Text>
                                </TouchableOpacity>
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
                            ListHeaderComponent={
                                pendingRoll ? (
                                    <View style={{ padding: 16, alignItems: 'center', opacity: 0.8 }}>
                                        <Text style={{ color: colors.text.secondary, fontStyle: 'italic', marginBottom: 8 }}>
                                            🎲 Roll required: {pendingRoll.purpose}
                                        </Text>
                                        <TouchableOpacity
                                            onPress={() => setPanelVisible(true)}
                                            style={{
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                gap: 8,
                                                backgroundColor: colors.background.tertiary,
                                                paddingHorizontal: 16,
                                                paddingVertical: 8,
                                                borderRadius: 20
                                            }}
                                        >
                                            <Text style={{ color: colors.primary[400], fontWeight: 'bold' }}>Open Dice Roller</Text>
                                            <Ionicons name="arrow-forward" size={16} color={colors.primary[400]} />
                                        </TouchableOpacity>
                                    </View>
                                ) : null
                            }
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

                        {/* Navigation Buttons */}
                        {messages.length > 0 && (
                            <View style={styles.navButtons}>
                                {lastNarratorIndexReversed !== -1 && (
                                    <TouchableOpacity
                                        style={styles.navButton}
                                        onPress={() => {
                                            const index = messages.findIndex(m => m.role === 'user');
                                            if (index !== -1) scrollToLastResponse(index);
                                        }}>
                                        <Text style={{
                                            color: colors.text.primary,
                                            fontSize: 18,
                                            fontWeight: '700'
                                        }}>T</Text>
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
                            pendingChoice={pendingChoice}
                        />
                    </KeyboardAvoidingView>
                </View>

                {/* Mobile Panel Backdrop */}
                {!isDesktop && panelVisible && (
                    <TouchableOpacity
                        style={styles.panelBackdrop}
                        onPress={() => setPanelVisible(false)}
                        activeOpacity={1}
                    />
                )}

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
                            isProcessing={isProcessingQuest}
                            pendingRoll={pendingRoll}
                            onRollComplete={(result) => {
                                console.log('[Campaign] Dice roll complete:', result);
                                // DiceRoller returns the raw roll number directly, not an object
                                const rollValue = typeof result === 'object' ? result.roll : result;
                                submitRollResult(rollValue);
                            }}
                            onDismiss={() => setPendingRoll(null)}
                        />
                    </View>
                    )
                }


                {/* Reading Settings Panel */}
                <ReadingSettingsPanel
                    visible={readingSettingsVisible}
                    onClose={() => setReadingSettingsVisible(false)}
                />
            </View >
        </SafeAreaView >
    );
}

const createStyles = (colors: any, typography: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background.primary,
    },
    contentWrapper: {
        flex: 1,
        flexDirection: 'row',
        maxWidth: 1600, // Limit max width on large screens
        width: '100%',
        alignSelf: 'center',
    },
    desktopLayout: {
        paddingHorizontal: spacing.lg,
    },
    chatContainer: {
        flex: 1,
        position: 'relative',
    },
    chatContainerDesktop: {
        borderRightWidth: 1,
        borderRightColor: colors.border.default,
    },
    panelContainer: {
        width: 380, // Slightly wider for better reading
        backgroundColor: colors.background.secondary, // Distinguishable from chat
        borderLeftWidth: 1,
        borderLeftColor: colors.border.default,
    },
    panelMobile: {
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        width: '85%', // Drawer width
        maxWidth: 400,
        zIndex: 100,
        shadowColor: "#000",
        shadowOffset: { width: -4, height: 0 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
        elevation: 16,
    },
    panelBackdrop: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 99, // Just below the panel
    },

    keyboardView: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.default,
        backgroundColor: colors.background.primary,
        zIndex: 10,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        width: 120, // Balancing width
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        width: 120, // Balancing width
        justifyContent: 'flex-end',
    },
    headerCenter: {
        flex: 1,
        alignItems: 'center',
    },
    iconButton: {
        padding: spacing.xs,
        borderRadius: borderRadius.md,
        // backgroundColor: colors.background.tertiary, // Optional: removing for cleaner look
    },
    headerButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.background.tertiary,
    },
    campaignName: {
        color: colors.text.primary,
        fontSize: typography.fontSize.md,
        fontFamily: typography.fontFamily.bold,
        textAlign: 'center',
    },
    worldName: {
        color: colors.text.muted,
        fontSize: 11,
        fontFamily: typography.fontFamily.medium,
        marginTop: 2,
        textAlign: 'center',
        textTransform: 'uppercase',
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
    closePanelButton: {
        position: 'absolute',
        top: spacing.md,
        right: spacing.md,
        zIndex: 1001,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.background.tertiary,
        justifyContent: 'center',
        alignItems: 'center',
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
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginBottom: spacing.sm,
    },
    choicePromptText: {
        flex: 1,
        color: colors.text.primary,
        fontSize: typography.fontSize.md,
        fontWeight: '600',
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
        fontStyle: 'italic',
        textAlign: 'center',
    },
    navButtons: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: spacing.sm,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
    },
    navButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.background.tertiary,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border.default,
    },
    retryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.sm,
        backgroundColor: colors.status.error + '15', // 15% opacity
        borderRadius: borderRadius.sm,
        marginHorizontal: spacing.md,
        marginBottom: spacing.xs,
    },
    retryButtonText: {
        fontSize: typography.fontSize.sm,
        marginLeft: spacing.xs,
        fontWeight: '600',
    },
});
