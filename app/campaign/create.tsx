import React, { useState, useMemo } from 'react';
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
import { spacing, borderRadius, typography, shadows } from '../../lib/theme';
import { useThemeColors } from '../../lib/hooks/useTheme';
import { useGameStore, useUserStore } from '../../lib/store';
import { AnimatedPressable, FadeInView } from '../../components/ui/Animated';
import { createCampaign, signInAnonymouslyIfNeeded, getWorlds } from '../../lib/firebase';
import { ClassicCharacterCreation } from '../../components/character/ClassicCharacterCreation';
import { OutworlderCharacterCreation } from '../../components/character/OutworlderCharacterCreation';
import { TacticalCharacterCreation } from '../../components/character/TacticalCharacterCreation';
import type { WorldModule, WorldModuleType, ModuleCharacter } from '../../lib/types';

// Helper to get default character creation component
const CharacterCreationMap: Record<string, any> = {
    classic: ClassicCharacterCreation,
    outworlder: OutworlderCharacterCreation,
    tactical: TacticalCharacterCreation,
    shadowMonarch: TacticalCharacterCreation,
};

export default function CreateCampaignScreen() {
    const { colors } = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const router = useRouter();
    const params = useLocalSearchParams<{ world: string }>();
    const worldId = params.world;

    const [world, setWorld] = useState<WorldModule | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const { setCurrentCampaign, setMessages } = useGameStore();

    const [characterName, setCharacterName] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [step, setStep] = useState<'name' | 'character'>('name');
    const [characterData, setCharacterData] = useState<ModuleCharacter | null>(null);

    React.useEffect(() => {
        const loadWorld = async () => {
            if (!worldId) return;
            try {
                const worlds = await getWorlds();
                const found = worlds.find(w => w.id === worldId);
                if (found) {
                    setWorld(found);
                } else {
                    Alert.alert('Error', 'World not found');
                    router.back();
                }
            } catch (error) {
                console.error(error);
                Alert.alert('Error', 'Failed to load world settings');
            } finally {
                setIsLoading(false);
            }
        };
        loadWorld();
    }, [worldId]);

    const handleCharacterComplete = async (character: ModuleCharacter) => {
        setCharacterData(character);
        await handleCreate(character);
    };

    const handleCreate = async (character: ModuleCharacter) => {
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

            // Call Cloud Function to create campaign with character data
            console.log('[Create] Calling createCampaign cloud function...');
            const result = await createCampaign({
                name: world?.name || 'New Campaign',
                worldModule: worldId,
                characterName: characterName.trim(),
                initialCharacter: character,
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
                    name: world?.name || 'New Campaign',
                    worldModule: worldId,
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                    character: character,
                    moduleState: {
                        type: world?.type || 'classic',
                        character: character,
                    },
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

    // Render character creation step based on world module
    if (step === 'character' && world) {
        const CharacterComp = CharacterCreationMap[world.type] || ClassicCharacterCreation;
        return <CharacterComp
            characterName={characterName}
            onComplete={handleCharacterComplete}
            onBack={() => setStep('name')}
        />;
    }

    if (isLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <ActivityIndicator size="large" color={colors.primary[500]} style={{ marginTop: spacing.xxl }} />
            </SafeAreaView>
        );
    }

    if (!world) return null;

    // Render name input step
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
                            onSubmitEditing={() => {
                                if (characterName.trim()) {
                                    setStep('character');
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
                            !characterName.trim() && styles.createButtonDisabled,
                            { backgroundColor: world.color }
                        ]}
                        onPress={() => {
                            if (characterName.trim()) {
                                setStep('character');
                            }
                        }}
                        disabled={!characterName.trim()}
                    >
                        <Text style={styles.createButtonText}>Next</Text>
                        <Ionicons name="arrow-forward" size={20} color="#fff" />
                    </AnimatedPressable>
                </FadeInView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const createStyles = (colors: any) => StyleSheet.create({
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
        fontSize: typography.h3.fontSize,
        fontWeight: typography.h3.fontWeight as any,
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
        fontSize: typography.h2.fontSize,
        fontWeight: typography.h2.fontWeight as any,
        color: colors.text.primary,
        marginBottom: spacing.sm,
    },
    worldDescription: {
        fontSize: typography.body.fontSize,
        color: colors.text.secondary,
        textAlign: 'center',
        maxWidth: 260,
    },
    inputSection: {
        marginBottom: spacing.xl,
    },
    label: {
        fontSize: typography.label.fontSize,
        fontWeight: typography.label.fontWeight as any,
        color: colors.text.secondary,
        marginBottom: spacing.sm,
        marginLeft: spacing.xs,
    },
    input: {
        backgroundColor: colors.background.tertiary,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        color: colors.text.primary,
        fontSize: typography.body.fontSize,
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
        fontSize: typography.h4.fontSize,
        fontWeight: typography.h4.fontWeight as any,
        color: '#fff',
    },
});
