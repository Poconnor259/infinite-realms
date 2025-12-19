import React from 'react';
import { TouchableOpacity, Image, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

interface LogoProps {
    size?: number;
}

export function Logo({ size = 40 }: LogoProps) {
    const router = useRouter();

    return (
        <TouchableOpacity
            onPress={() => router.push('/')}
            style={styles.container}
            activeOpacity={0.7}
        >
            <Image
                source={require('../../assets/infinite_realms_logo.png')}
                style={[styles.logo, { width: size, height: size }]}
                resizeMode="contain"
            />
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 4,
    },
    logo: {
        borderRadius: 4,
    },
});
