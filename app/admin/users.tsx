
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert, TextInput, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { colors, spacing, typography, borderRadius, shadows } from '../../lib/theme';
import { AnimatedPressable, FadeInView, StaggeredList } from '../../components/ui/Animated';
import { getAdminData, updateUserRole, updateUserTier } from '../../lib/firebase';
import { User } from '../../lib/types';
import { useUserStore } from '../../lib/store';

export default function AdminUsersScreen() {
    const router = useRouter();
    const currentUser = useUserStore((state) => state.user);
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async (showLoading = true) => {
        if (showLoading) setLoading(true);
        try {
            const data = await getAdminData();
            setUsers(data.users);
        } catch (error) {
            console.error('Failed to load users:', error);
            Alert.alert('Error', 'Failed to load user list');
        } finally {
            setLoading(false);
        }
    };

    const handleRoleUpdate = async (userId: string, currentRole: string | undefined, name: string) => {
        // Prevent changing own role
        if (userId === currentUser?.id) {
            Alert.alert('Restricted', 'You cannot change your own role.');
            return;
        }

        const newRole = currentRole === 'admin' ? 'user' : 'admin';

        if (Platform.OS === 'web') {
            if (window.confirm(`Change ${name}'s role to ${newRole.toUpperCase()}?`)) {
                await performRoleUpdate(userId, newRole);
            }
        } else {
            Alert.alert(
                'Change Role',
                `Change ${name}'s role to ${newRole.toUpperCase()}?`,
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Confirm', onPress: () => performRoleUpdate(userId, newRole) }
                ]
            );
        }
    };

    const performRoleUpdate = async (userId: string, newRole: any) => {
        try {
            await updateUserRole(userId, newRole);
            setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
        } catch (error) {
            Alert.alert('Error', 'Failed to update role');
        }
    };

    const handleTierUpdate = async (userId: string, currentTier: string, name: string) => {
        const tiers = ['scout', 'hero', 'legend'];
        const nextTier = tiers[(tiers.indexOf(currentTier) + 1) % tiers.length];

        try {
            await updateUserTier(userId, nextTier as any);
            setUsers(users.map(u => u.id === userId ? { ...u, tier: nextTier as any } : u));
        } catch (error) {
            Alert.alert('Error', 'Failed to update tier');
        }
    };

    const filteredUsers = users.filter(u =>
        (u.email?.toLowerCase().includes(filter.toLowerCase())) ||
        (u.displayName?.toLowerCase().includes(filter.toLowerCase())) ||
        (u.id.includes(filter))
    );

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary[500]} />
            </View>
        );
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <View style={styles.header}>
                <AnimatedPressable onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
                </AnimatedPressable>
                <Text style={styles.title}>User Management</Text>
            </View>

            <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color={colors.text.muted} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search users..."
                    placeholderTextColor={colors.text.muted}
                    value={filter}
                    onChangeText={setFilter}
                />
            </View>

            <StaggeredList style={{ gap: spacing.sm }}>
                {filteredUsers.map((user) => (
                    <View key={user.id} style={styles.userCard}>
                        <View style={styles.userInfo}>
                            <Text style={styles.userName}>{user.displayName || 'Anonymous User'}</Text>
                            <Text style={styles.userEmail}>{user.email || user.id}</Text>
                            <Text style={styles.userStats}>
                                Created: {new Date(user.createdAt).toLocaleDateString()} • Turns: {user.turnsUsed || 0}
                            </Text>
                        </View>

                        <View style={styles.actions}>
                            <AnimatedPressable
                                style={[
                                    styles.badge,
                                    user.role === 'admin' ? styles.adminBadge : styles.userBadge
                                ]}
                                onPress={() => handleRoleUpdate(user.id, user.role, user.displayName || 'User')}
                            >
                                <Text style={[
                                    styles.badgeText,
                                    user.role === 'admin' ? styles.adminText : styles.userText
                                ]}>
                                    {user.role === 'admin' ? 'ADMIN' : 'USER'}
                                </Text>
                            </AnimatedPressable>

                            <AnimatedPressable
                                style={[styles.badge, styles.tierBadge]}
                                onPress={() => handleTierUpdate(user.id, user.tier, user.displayName || 'User')}
                            >
                                <Ionicons name="star" size={12} color={colors.gold.main} style={{ marginRight: 4 }} />
                                <Text style={styles.tierText}>{user.tier.toUpperCase()}</Text>
                            </AnimatedPressable>
                        </View>
                    </View>
                ))}
            </StaggeredList>

            {filteredUsers.length === 0 && (
                <Text style={styles.emptyText}>No users found matching "{filter}"</Text>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background.primary,
    },
    loadingContainer: {
        flex: 1,
        backgroundColor: colors.background.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        padding: spacing.lg,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    backButton: {
        padding: spacing.sm,
        marginRight: spacing.md,
    },
    title: {
        fontSize: typography.fontSize.xl,
        fontWeight: 'bold',
        color: colors.text.primary,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.md,
        paddingHorizontal: spacing.md,
        marginBottom: spacing.lg,
        borderWidth: 1,
        borderColor: colors.border.default,
    },
    searchInput: {
        flex: 1,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.sm,
        color: colors.text.primary,
        fontSize: typography.fontSize.md,
    },
    userCard: {
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.border.default,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    userInfo: {
        flex: 1,
    },
    userName: {
        fontSize: typography.fontSize.md,
        fontWeight: 'bold',
        color: colors.text.primary,
    },
    userEmail: {
        fontSize: typography.fontSize.sm,
        color: colors.text.secondary,
        marginVertical: 2,
    },
    userStats: {
        fontSize: typography.fontSize.xs,
        color: colors.text.muted,
    },
    actions: {
        alignItems: 'flex-end',
        gap: spacing.xs,
    },
    badge: {
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: borderRadius.sm,
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        minWidth: 70,
        justifyContent: 'center',
    },
    adminBadge: {
        backgroundColor: colors.primary[900] + '40',
        borderColor: colors.primary[500],
    },
    userBadge: {
        backgroundColor: colors.background.tertiary,
        borderColor: colors.border.default,
    },
    tierBadge: {
        backgroundColor: colors.gold.main + '20',
        borderColor: colors.gold.main,
    },
    badgeText: {
        fontSize: 10,
        fontWeight: 'bold',
    },
    adminText: { color: colors.primary[400] },
    userText: { color: colors.text.muted },
    tierText: { color: colors.gold.main, fontSize: 10, fontWeight: 'bold' },
    emptyText: {
        textAlign: 'center',
        color: colors.text.muted,
        marginTop: spacing.xl,
    }
});
