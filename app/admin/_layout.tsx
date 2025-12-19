
import React, { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { useUserStore } from '../../lib/store';
import { ActivityIndicator, View } from 'react-native';
import { useThemeColors } from '../../lib/hooks/useTheme';

export default function AdminLayout() {
    const user = useUserStore((state) => state.user);
    const router = useRouter();
    const { colors } = useThemeColors();

    useEffect(() => {
        if (!user || user.role !== 'admin') {
            router.replace('/');
        }
    }, [user]);

    if (!user || user.role !== 'admin') {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background.primary }}>
                <ActivityIndicator color={colors.primary[500]} />
            </View>
        );
    }

    return (
        <Stack
            screenOptions={{
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
