import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    Alert,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography, shadows } from '../../lib/theme';
import { useGameStore, useUserStore } from '../../lib/store';
import { AnimatedPressable, FadeInView } from '../../components/ui/Animated';
import { createCampaign, signInAnonymouslyIfNeeded } from '../../lib/firebase';
import type { WorldModuleType } from '../../lib/types';

const WORLD_INFO: Record<string, { name: string; icon: string; color: string; description: string }> = {
    classic: {
        name: 'The Classic',
        icon: '⚔️',
        color: colors.gold.main,
        description: 'Prepare your character sheet. Your party awaits properly.',
    },
    outworlder: {
        name: 'The Outworlder',
        icon: '🌌',
        color: '#10b981',
        description: 'You are about to be reincarnated. What will you call yourself?',
    },
    shadowMonarch: {
        name: 'Shadow Monarch',
        icon: '👤',
        color: '#8b5cf6',
        description: 'The System is initializing. Enter your Hunter name.',
    },
};

export default function CreateCampaignScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ world: WorldModuleType }>();
    const worldId = params.world || 'classic';
    const world = WORLD_INFO[worldId];

    const { setCurrentCampaign, setMessages } = useGameStore();

    const [characterName, setCharacterName] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    const handleCreate = async () => {
        console.log('[Create] handleCreate called');
        if (!characterName.trim()) {
            Alert.alert('Required', 'Please enter a character name.');
            return;
        }

        setIsCreating(true);

        try {
            // Ensure we are signed in
            console.log('[Create] Signing in...');
            const user = await signInAnonymouslyIfNeeded();
            console.log('[Create] User:', user?.uid);

            if (!user) {
                throw new Error("Failed to sign in anonymously");
            }

            // Call Cloud Function to create campaign
            console.log('[Create] Calling createCampaign cloud function...');
            const result = await createCampaign({
                name: world.name, // Campaign name defaults to world name for now
                worldModule: worldId as WorldModuleType,
                characterName: characterName.trim(),
            });
            console.log('[Create] Cloud function result:', result);

            if (result.data && result.data.campaignId) {
                console.log('[Create] Campaign created:', result.data.campaignId);

                // Use initial narrative from backend (AI-generated or fallback)
                const initialNarrative = (result.data as any).initialNarrative || '*Your adventure begins...*';

                // TODO: Using a temporary local object until we implement full hydration in [id].tsx
                const newCampaign = {
                    id: result.data.campaignId,
                    userId: user.uid,
                    name: world.name,
                    worldModule: worldId as WorldModuleType,
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                    character: {
                        id: 'char_new',
                        name: characterName.trim(),
                        hp: { current: 100, max: 100 },
                        level: 1,
                    },
                    moduleState: {},
                };

                setCurrentCampaign(newCampaign as any);
                setMessages([{
                    id: 'intro',
                    role: 'narrator',
                    content: initialNarrative,
                    timestamp: Date.now(),
                }]);

                router.replace(`/campaign/${result.data.campaignId}`);
            } else {
                throw new Error('No campaign ID returned');
            }
        } catch (error: any) {
            console.error('Failed to create campaign:', error);
            Alert.alert('Error', `Failed to create campaign: ${error.message || 'Unknown error'}`);
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView contentContainerStyle={styles.scrollContent}>

                    {/* Header */}
                    <FadeInView delay={0} style={styles.header}>
                        <AnimatedPressable onPress={() => router.back()} style={styles.backButton}>
                            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
                        </AnimatedPressable>
                        <Text style={styles.headerTitle}>New Character</Text>
                        <View style={{ width: 24 }} />
                    </FadeInView>

                    {/* World Info */}
                    <FadeInView delay={100} style={styles.worldCard}>
                        <View style={[styles.worldIconContainer, { backgroundColor: world.color + '20' }]}>
                            <Text style={styles.worldIcon}>{world.icon}</Text>
                        </View>
                        <Text style={styles.worldName}>{world.name}</Text>
                        <Text style={styles.worldDescription}>{world.description}</Text>
                    </FadeInView>

                    {/* Input Section */}
                    <FadeInView delay={200} style={styles.inputSection}>
                        <Text style={styles.label}>Character Name</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Enter your name..."
                            placeholderTextColor={colors.text.muted}
                            value={characterName}
                            onChangeText={setCharacterName}
                            autoFocus
                            maxLength={30}
                            onSubmitEditing={handleCreate}
                            onKeyPress={(e) => {
                                // Web-only: Handle Enter vs Shift+Enter
                                if (Platform.OS === 'web' && (e as any).nativeEvent.key === 'Enter') {
                                    if (!(e as any).nativeEvent.shiftKey && characterName.trim()) {
                                        e.preventDefault();
                                        handleCreate();
                                    }
                                }
                            }}
                        />
                    </FadeInView>

                </ScrollView>

                {/* Footer Action */}
                <FadeInView delay={300} style={styles.footer}>
                    <AnimatedPressable
                        style={[
                            styles.createButton,
                            (!characterName.trim() || isCreating) && styles.createButtonDisabled,
                            { backgroundColor: world.color }
                        ]}
                        onPress={handleCreate}
                        disabled={!characterName.trim() || isCreating}
                    >
                        {isCreating ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <>
                                <Text style={styles.createButtonText}>Begin Adventure</Text>
                                <Ionicons name="arrow-forward" size={20} color="#fff" />
                            </>
                        )}
                    </AnimatedPressable>
                </FadeInView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background.primary,
    },
    scrollContent: {
        padding: spacing.lg,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.xl,
        marginTop: spacing.md,
    },
    backButton: {
        padding: spacing.sm,
        marginLeft: -spacing.sm,
    },
    headerTitle: {
        ...typography.h3,
        color: colors.text.primary,
    },
    worldCard: {
        alignItems: 'center',
        padding: spacing.xl,
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.xl,
        marginBottom: spacing.xl,
        ...shadows.md,
    },
    worldIconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.md,
    },
    worldIcon: {
        fontSize: 40,
    },
    worldName: {
        ...typography.h2,
        color: colors.text.primary,
        marginBottom: spacing.sm,
    },
    worldDescription: {
        ...typography.body,
        color: colors.text.secondary,
        textAlign: 'center',
        maxWidth: 260,
    },
    inputSection: {
        marginBottom: spacing.xl,
    },
    label: {
        ...typography.label,
        color: colors.text.secondary,
        marginBottom: spacing.sm,
        marginLeft: spacing.xs,
    },
    input: {
        backgroundColor: colors.background.tertiary,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        color: colors.text.primary,
        ...typography.body,
        borderWidth: 1,
        borderColor: colors.border.default,
    },
    footer: {
        padding: spacing.lg,
        borderTopWidth: 1,
        borderTopColor: colors.border.default,
        backgroundColor: colors.background.primary,
    },
    createButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        gap: spacing.sm,
        height: 56,
        ...shadows.md,
    },
    createButtonDisabled: {
        opacity: 0.5,
        ...shadows.none,
    },
    createButtonText: {
        ...typography.h4,
        color: '#fff',
    },
});
