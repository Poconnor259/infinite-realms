
import React, { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { useUserStore } from '../../lib/store';
import { ActivityIndicator, View } from 'react-native';
import { useThemeColors } from '../../lib/hooks/useTheme';

// Admin email whitelist - these users have admin access even if role field isn't set
const ADMIN_EMAILS = [
    'patrick@shouldersofgiants.app',
    // Add more admin emails as needed
];

function isAdmin(user: any): boolean {
    if (!user) return false;
    if (user.role === 'admin') return true;
    if (user.email && ADMIN_EMAILS.includes(user.email)) return true;
    return false;
}

export default function AdminLayout() {
    const user = useUserStore((state) => state.user);
    const router = useRouter();
    const { colors } = useThemeColors();

    useEffect(() => {
        if (!isAdmin(user)) {
            router.replace('/');
        }
    }, [user]);

    if (!isAdmin(user)) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background.primary }}>
                <ActivityIndicator color={colors.primary[500]} />
            </View>
        );
    }

    return (
        <Stack
            screenOptions={{
                headerShown: false, // Hide default header - each screen implements its own
                headerStyle: {
                    backgroundColor: colors.background.secondary,
                },
                headerTintColor: colors.text.primary,
                headerTitleStyle: {
                    fontWeight: 'bold',
                },
            }}
        >
            <Stack.Screen name="index" options={{ title: 'Admin Dashboard' }} />
            <Stack.Screen name="users" options={{ title: 'User Management' }} />
            <Stack.Screen name="worlds" options={{ title: 'World Management' }} />
            <Stack.Screen name="costs" options={{ title: 'Cost Estimator' }} />
            <Stack.Screen name="training" options={{ title: 'Knowledge Base' }} />
            <Stack.Screen name="metrics" options={{ title: 'System Metrics' }} />
            <Stack.Screen name="config" options={{ title: 'Global Config' }} />
        </Stack>
    );
}
