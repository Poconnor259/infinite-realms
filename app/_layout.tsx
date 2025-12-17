import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../lib/theme';
import { useSettingsStore, useUserStore, useTurnsStore } from '../lib/store';
import { signInAnonymouslyIfNeeded, onAuthChange, createOrUpdateUser, getUser } from '../lib/firebase';

import { useRouter, useSegments } from 'expo-router';

export default function RootLayout() {
    const loadSettings = useSettingsStore((state) => state.loadSettings);
    const router = useRouter();
    const segments = useSegments();
    const setTier = useTurnsStore((state) => state.setTier);

    // Load Ionicons font for web
    const [fontsLoaded] = useFonts({
        ...Ionicons.font,
    });

    const user = useUserStore((state) => state.user);
    const isLoading = useUserStore((state) => state.isLoading);

    useEffect(() => {
        // Load user settings on app start
        loadSettings();

        // Listen for auth changes
        const unsubscribe = onAuthChange(async (firebaseUser) => {
            if (firebaseUser) {
                // Get or create user profile with latest data
                await createOrUpdateUser(firebaseUser.uid, {
                    email: firebaseUser.email || '',
                    displayName: firebaseUser.displayName || '',
                    lastActive: Date.now()
                });

                // Fetch full user profile to get role and tier
                const userDoc = await getUser(firebaseUser.uid);
                const userTier = userDoc?.tier || 'scout';

                // Sync tier to turns store
                setTier(userTier);

                // Update store
                useUserStore.getState().setUser({
                    id: firebaseUser.uid,
                    email: firebaseUser.email || '',
                    isAnonymous: firebaseUser.isAnonymous,
                    createdAt: userDoc?.createdAt || Date.now(),
                    tier: userTier,
                    role: userDoc?.role || 'user',
                });
            } else {
                useUserStore.getState().setUser(null);
            }
        });

        return () => unsubscribe();
    }, []);

    // Handle routing protection
    useEffect(() => {
        if (isLoading) return;

        const inAuthGroup = segments[0] === 'auth';
        const isVerifyEmail = segments[0] === 'auth' && segments[1] === 'verify-email';

        if (user) {
            // If user is authenticated...

            // 1. Allow anonymous users to access auth screens (to sign in/up)
            if (user.isAnonymous) {
                return;
            }

            // 2. Redirect real users away from auth screens (except verify-email)
            if (inAuthGroup && !isVerifyEmail) {
                router.replace('/');
            }
        } else {
            // If user is NOT authenticated

            // Redirect to signin if not already there
            if (!inAuthGroup) {
                router.replace('/auth/signin');
            }
        }
    }, [user, segments, isLoading]);

    return (
        <GestureHandlerRootView style={styles.container}>
            <StatusBar style="light" />
            <Stack
                screenOptions={{
                    headerStyle: {
                        backgroundColor: colors.background.primary,
                    },
                    headerTintColor: colors.text.primary,
                    headerTitleStyle: {
                        fontWeight: 'bold',
                    },
                    contentStyle: {
                        backgroundColor: colors.background.primary,
                    },
                    animation: 'slide_from_right',
                }}
            >
                <Stack.Screen
                    name="index"
                    options={{ headerShown: false }}
                />
                <Stack.Screen
                    name="campaign/[id]"
                    options={{
                        headerShown: false,
                        animation: 'fade',
                    }}
                />
                <Stack.Screen
                    name="world-select"
                    options={{
                        title: 'Choose Your World',
                        presentation: 'modal',
                    }}
                />
                <Stack.Screen
                    name="settings"
                    options={{
                        title: 'Settings',
                        presentation: 'modal',
                    }}
                />
                <Stack.Screen
                    name="character-create"
                    options={{
                        title: 'Create Character',
                        presentation: 'modal',
                    }}
                />
            </Stack>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background.primary,
    },
});
