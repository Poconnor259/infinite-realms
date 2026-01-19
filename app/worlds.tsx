import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import {
    Appbar,
    Card,
    Text,
    Button,
    Avatar,
    Chip,
    useTheme,
    ActivityIndicator,
    Surface
} from 'react-native-paper';
import { useRouter } from 'expo-router';
import { getWorlds } from '../lib/firebase';
import type { WorldModule } from '../lib/types';

export default function WorldsScreen() {
    const router = useRouter();
    const theme = useTheme();
    const [worlds, setWorlds] = useState<WorldModule[]>([]);
    const [selectedWorld, setSelectedWorld] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchWorlds = async () => {
            try {
                const data = await getWorlds();
                setWorlds(data);
            } catch (error) {
                console.error('Error fetching worlds:', error);
                Alert.alert("Error", "Failed to load worlds.");
            } finally {
                setIsLoading(false);
            }
        };
        fetchWorlds();
    }, []);

    const handleContinue = () => {
        if (!selectedWorld) return;
        router.push(`/campaign/create?world=${selectedWorld}`);
    };

    return (
        <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
            <Appbar.Header elevated>
                <Appbar.Content title="Explore Worlds" />
            </Appbar.Header>

            {isLoading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" />
                </View>
            ) : (
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <Text variant="bodyLarge" style={{ textAlign: 'center', marginBottom: 16, color: theme.colors.onSurfaceVariant }}>
                        Discover unique settings for your next adventure.
                    </Text>

                    {worlds.map((world) => {
                        const isSelected = selectedWorld === world.id;
                        const isLocked = world.locked;

                        return (
                            <Card
                                key={world.id}
                                mode={isSelected ? 'elevated' : 'outlined'}
                                style={[
                                    styles.card,
                                    isSelected && { borderColor: theme.colors.primary, borderWidth: 2 },
                                    isLocked && { opacity: 0.6 }
                                ]}
                                onPress={() => !isLocked && setSelectedWorld(world.id)}
                            >
                                <Card.Title
                                    title={world.name}
                                    titleStyle={{ fontWeight: 'bold' }}
                                    subtitle={world.subtitle}
                                    left={(props) => (
                                        <Avatar.Text
                                            {...props}
                                            label={world.icon || "?"}
                                            style={{ backgroundColor: isLocked ? theme.colors.surfaceDisabled : (world.color || theme.colors.primaryContainer) }}
                                            color={theme.colors.onPrimaryContainer}
                                        />
                                    )}
                                    right={(props) => isLocked ? <Avatar.Icon {...props} icon="lock" size={24} style={{ backgroundColor: 'transparent' }} /> : null}
                                />
                                <Card.Content>
                                    <Text variant="bodyMedium" style={{ marginBottom: 12 }}>
                                        {world.description}
                                    </Text>
                                    <div style={styles.chipContainer}>
                                        {world.features.map((feature, i) => (
                                            <Chip
                                                key={i}
                                                style={styles.chip}
                                                textStyle={{ fontSize: 12 }}
                                                compact
                                            >
                                                {feature}
                                            </Chip>
                                        ))}
                                    </div>
                                    {isLocked && world.lockReason && (
                                        <Text variant="labelSmall" style={{ color: theme.colors.error, marginTop: 8 }}>
                                            {world.lockReason}
                                        </Text>
                                    )}
                                </Card.Content>
                            </Card>
                        );
                    })}

                    <View style={{ height: 80 }} />
                </ScrollView>
            )}

            <Surface style={[styles.footer, { backgroundColor: theme.colors.surface }]} elevation={4}>
                <Button
                    mode="contained"
                    onPress={handleContinue}
                    disabled={!selectedWorld}
                    contentStyle={{ height: 50 }}
                    icon="arrow-right"
                >
                    Begin Adventure
                </Button>
            </Surface>
        </View>
    );
}

const styles = StyleSheet.create({
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollContent: {
        padding: 16,
    },
    card: {
        marginBottom: 16,
    },
    chipContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    chip: {
        backgroundColor: 'rgba(0,0,0,0.05)',
    },
    footer: {
        padding: 16,
        paddingBottom: 24,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.05)',
    }
});
