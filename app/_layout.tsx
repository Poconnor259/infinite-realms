import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { colors } from '../lib/theme';
import { useSettingsStore } from '../lib/store';

export default function RootLayout() {
    const loadSettings = useSettingsStore((state) => state.loadSettings);

    useEffect(() => {
        // Load user settings on app start
        loadSettings();
    }, []);

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
