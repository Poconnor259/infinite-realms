module.exports = {
    expo: {
        name: "Atlas Cortex",
        slug: "atlas-cortex",
        version: "1.0.0",
        orientation: "portrait",
        icon: "./assets/icon.png",
        userInterfaceStyle: "dark",
        scheme: "atlas-cortex",
        newArchEnabled: true,
        splash: {
            image: "./assets/splash-icon.png",
            resizeMode: "contain",
            backgroundColor: "#0f0a1e"
        },
        ios: {
            supportsTablet: true,
            bundleIdentifier: "com.atlascortex.app"
        },
        android: {
            adaptiveIcon: {
                foregroundImage: "./assets/adaptive-icon.png",
                backgroundColor: "#0f0a1e"
            },
            package: "com.atlascortex.app",
            edgeToEdgeEnabled: true
        },
        web: {
            favicon: "./assets/favicon.png",
            bundler: "metro",
            output: "static"
        },
        plugins: [
            "expo-router",
            "expo-font",
            "expo-secure-store",
            [
                "expo-build-properties",
                {
                    ios: {
                        useFrameworks: "static"
                    }
                }
            ],
            "@react-native-firebase/app",
            "expo-asset"
        ],
        experiments: {
            typedRoutes: true
        },
        extra: {
            firebaseApiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
            firebaseAuthDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
            firebaseProjectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
            firebaseStorageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
            firebaseMessagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
            firebaseAppId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
            firebaseMeasurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID
        }
    }
};
