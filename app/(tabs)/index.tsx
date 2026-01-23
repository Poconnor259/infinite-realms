import React, { useState, useEffect, useCallback } from 'react';
import { View, FlatList, StyleSheet, RefreshControl, Alert, Platform } from 'react-native';
import { Appbar, FAB, Card, Text, Avatar, IconButton, useTheme, Surface, TouchableRipple, Chip, ActivityIndicator, Divider } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useGameStore, useUserStore, useSettingsStore, useTurnsStore } from '../../lib/store';
import { getUserCampaigns, deleteCampaignFn, getWorlds } from '../../lib/firebase';
import type { Campaign, WorldModule } from '../../lib/types';
import { TurnsMeter } from '../../components/monetization/TurnsMeter';

const DEFAULT_WORLD_COLORS: Record<string, string> = {
    classic: '#ffd700',
    outworlder: '#10b981',
    tactical: '#8b5cf6',
};

export default function HomeScreen() {
    const router = useRouter();
    const theme = useTheme();
    const { user } = useUserStore();
    const { setCurrentCampaign } = useGameStore();
    const { themeMode, setPreference } = useSettingsStore();

    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [availableWorlds, setAvailableWorlds] = useState<WorldModule[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Initial Load
    useEffect(() => {
        loadData();
    }, [user?.id]);

    const loadData = async () => {
        setLoading(true);
        await Promise.all([loadWorlds(), loadCampaigns()]);
        setLoading(false);
    };

    const loadWorlds = async () => {
        try {
            const fetchedWorlds = await getWorlds();
            setAvailableWorlds(fetchedWorlds);
        } catch (error) {
            console.error('Failed to load worlds:', error);
        }
    };

    const loadCampaigns = async () => {
        if (!user?.id) return;
        try {
            const userCampaigns = await getUserCampaigns(user.id);
            setCampaigns(userCampaigns as Campaign[]);
        } catch (error) {
            console.error('Failed to load campaigns:', error);
        }
    };

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await loadCampaigns();
        setRefreshing(false);
    }, [user?.id]);

    const handleDeleteCampaign = async (campaign: Campaign) => {
        const confirmDelete = () => {
            deleteCampaignFn({ campaignId: campaign.id })
                .then(() => loadCampaigns())
                .catch(err => console.error(err));
        };

        if (Platform.OS === 'web') {
            if (window.confirm(`Delete "${campaign.name}"? This cannot be undone.`)) {
                confirmDelete();
            }
        } else {
            Alert.alert(
                'Delete Campaign',
                `Are you sure you want to delete "${campaign.name}"?`,
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: confirmDelete },
                ]
            );
        }
    };

    const toggleTheme = () => {
        const nextMode = theme.dark ? 'light' : 'dark';
        setPreference('themeMode', nextMode);
    };

    const renderHeader = () => (
        <View>
            <Surface style={styles.surface} elevation={1}>
                <TurnsMeter />
            </Surface>
            {campaigns.length > 0 && (
                <View style={[styles.campaignListHeader, { marginTop: 8 }]}>
                    <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurfaceVariant, paddingHorizontal: 0 }]}>
                        Recent Campaigns
                    </Text>
                </View>
            )}
        </View>
    );

    const renderFooter = () => (
        <View style={styles.headerContainer}>
            <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurfaceVariant }]}>
                Start New Adventure
            </Text>

            <FlatList
                horizontal
                data={availableWorlds}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.worldsList}
                renderItem={({ item }) => (
                    <Card
                        style={[styles.worldCard, { borderColor: theme.colors.outlineVariant }]}
                        onPress={() => router.push(`/campaign/create?world=${item.id}`)}
                        mode="outlined"
                    >
                        <Card.Content style={styles.worldCardContent}>
                            <Text style={styles.worldIcon}>{item.icon || '🌍'}</Text>
                            <Text variant="labelLarge" numberOfLines={1} style={styles.worldName}>{item.name}</Text>
                        </Card.Content>
                    </Card>
                )}
                keyExtractor={item => item.id}
            />
        </View>
    );

    const renderCampaignItem = ({ item }: { item: Campaign }) => {
        const worldInfo = availableWorlds.find(w => w.id === item.worldModule);

        return (
            <Card
                style={styles.campaignCard}
                onPress={() => router.push(`/campaign/${item.id}`)}
                mode="contained"
            >
                <Card.Title
                    title={item.name}
                    titleVariant="titleMedium"
                    subtitle={`${item.character.name} • Lv.${item.character.level}`}
                    left={(props) => (
                        <View style={[styles.squareIconContainer, { backgroundColor: worldInfo?.color || theme.colors.primaryContainer }]}>
                            <Text style={styles.squareIconText}>
                                {worldInfo?.icon || '🌍'}
                            </Text>
                        </View>
                    )}
                    right={(props) => (
                        <IconButton
                            {...props}
                            icon="delete-outline"
                            onPress={() => handleDeleteCampaign(item)}
                        />
                    )}
                />
            </Card>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <Appbar.Header elevated>
                <Appbar.Content title="Atlas Cortex" />
                <Appbar.Action icon={theme.dark ? "white-balance-sunny" : "weather-night"} onPress={toggleTheme} />
            </Appbar.Header>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" />
                </View>
            ) : (
                <FlatList
                    data={campaigns}
                    renderItem={renderCampaignItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={[styles.listContent, { backgroundColor: theme.colors.background }]}
                    ListHeaderComponent={renderHeader}
                    ListFooterComponent={renderFooter}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.colors.primary]} />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant }}>
                                No campaigns yet. Start a new adventure!
                            </Text>
                        </View>
                    }
                />
            )}

            <FAB
                icon="plus"
                style={[styles.fab, { backgroundColor: theme.colors.primary }]}
                color={theme.colors.onPrimary}
                onPress={() => router.push('/worlds')}
                label="New Campaign"
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        paddingBottom: 80, // Space for FAB
    },
    headerContainer: {
        paddingTop: 16,
    },
    surface: {
        marginHorizontal: 16,
        marginBottom: 24,
        padding: 0,
        borderRadius: 12,
        overflow: 'hidden',
    },
    sectionTitle: {
        paddingHorizontal: 16,
        marginBottom: 8,
        fontWeight: 'bold',
    },
    worldsList: {
        paddingHorizontal: 16,
        paddingBottom: 8,
    },
    worldCard: {
        width: 120,
        marginRight: 12,
    },
    worldCardContent: {
        alignItems: 'center',
        paddingVertical: 12,
    },
    worldIcon: {
        fontSize: 32,
        marginBottom: 8,
    },
    worldName: {
        fontWeight: 'bold',
    },
    campaignListHeader: {
        marginTop: 24,
        paddingHorizontal: 16,
        marginBottom: 8,
    },
    campaignCard: {
        marginHorizontal: 16,
        marginBottom: 12,
    },
    statRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 8,
    },
    statChip: {
        height: 28,
    },
    emptyState: {
        padding: 32,
        alignItems: 'center',
    },
    fab: {
        position: 'absolute',
        margin: 16,
        right: 0,
        bottom: 0,
    },
    squareIconContainer: {
        width: 44,
        height: 44,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    squareIconText: {
        fontSize: 24,
    },
});
