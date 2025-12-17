
import React, { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { useUserStore } from '../../lib/store';
import { ActivityIndicator, View } from 'react-native';
import { colors } from '../../lib/theme';

export default function AdminLayout() {
    const user = useUserStore((state) => state.user);
    const router = useRouter();

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
        </Stack>
    );
}
