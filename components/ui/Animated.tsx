import React, { useRef } from 'react';
import {
    Animated,
    Pressable,
    StyleSheet,
    type ViewStyle,
    type StyleProp,
    type PressableProps,
} from 'react-native';
import { lightHaptic } from '../../lib/haptics';

interface AnimatedPressableProps extends Omit<PressableProps, 'style'> {
    style?: StyleProp<ViewStyle>;
    children: React.ReactNode;
    scaleValue?: number;
    haptic?: boolean;
}

/**
 * A pressable component with scale animation on press and optional haptic feedback
 */
export function AnimatedPressable({
    style,
    children,
    scaleValue = 0.97,
    haptic = true,
    onPressIn,
    onPressOut,
    onPress,
    ...props
}: AnimatedPressableProps) {
    const scale = useRef(new Animated.Value(1)).current;

    const handlePressIn = (e: any) => {
        Animated.spring(scale, {
            toValue: scaleValue,
            useNativeDriver: true,
            speed: 50,
            bounciness: 4,
        }).start();
        if (haptic) {
            lightHaptic();
        }
        onPressIn?.(e);
    };

    const handlePressOut = (e: any) => {
        Animated.spring(scale, {
            toValue: 1,
            useNativeDriver: true,
            speed: 50,
            bounciness: 4,
        }).start();
        onPressOut?.(e);
    };

    return (
        <Pressable
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={onPress}
            {...props}
        >
            <Animated.View style={[style, { transform: [{ scale }] }]}>
                {children}
            </Animated.View>
        </Pressable>
    );
}

interface FadeInViewProps {
    children: React.ReactNode;
    style?: ViewStyle;
    delay?: number;
    duration?: number;
}

/**
 * A view that fades in when mounted
 */
export function FadeInView({
    children,
    style,
    delay = 0,
    duration = 400,
}: FadeInViewProps) {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(20)).current;

    React.useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration,
                delay,
                useNativeDriver: true,
            }),
            Animated.timing(translateY, {
                toValue: 0,
                duration,
                delay,
                useNativeDriver: true,
            }),
        ]).start();
    }, [fadeAnim, translateY, delay, duration]);

    return (
        <Animated.View
            style={[
                style,
                {
                    opacity: fadeAnim,
                    transform: [{ translateY }],
                },
            ]}
        >
            {children}
        </Animated.View>
    );
}

interface StaggeredListProps {
    children: React.ReactNode[];
    staggerDelay?: number;
    style?: ViewStyle;
}

/**
 * A container that staggers its children's fade-in animations
 */
export function StaggeredList({
    children,
    staggerDelay = 100,
    style,
}: StaggeredListProps) {
    return (
        <>
            {React.Children.map(children, (child, index) => (
                <FadeInView delay={index * staggerDelay} style={style}>
                    {child}
                </FadeInView>
            ))}
        </>
    );
}

interface PulseViewProps {
    children: React.ReactNode;
    style?: ViewStyle;
    isAnimating?: boolean;
}

/**
 * A view that pulses when isAnimating is true
 */
export function PulseView({
    children,
    style,
    isAnimating = false,
}: PulseViewProps) {
    const pulseAnim = useRef(new Animated.Value(1)).current;

    React.useEffect(() => {
        if (isAnimating) {
            const animation = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.05,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                ])
            );
            animation.start();
            return () => animation.stop();
        } else {
            pulseAnim.setValue(1);
        }
    }, [isAnimating, pulseAnim]);

    return (
        <Animated.View style={[style, { transform: [{ scale: pulseAnim }] }]}>
            {children}
        </Animated.View>
    );
}

const styles = StyleSheet.create({});
