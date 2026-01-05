import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
// @ts-ignore
import DiceBox from '@3d-dice/dice-box';

interface DiceBox3DProps {
    notation: string; // e.g., "d20", "2d6"
    onRollComplete: (result: { roll: number; total: number }) => void;
    onRollStarted?: () => void;
    theme?: string;
    modifier?: number;
}

export const DiceBox3D = ({ notation, onRollComplete, onRollStarted, theme = 'default', modifier = 0 }: DiceBox3DProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const boxRef = useRef<any>(null);
    const [isInitialized, setIsInitialized] = useState(false);

    useEffect(() => {
        if (Platform.OS !== 'web') return;

        // Initialize Dice Box with a small delay to ensure DOM is ready
        const timer = setTimeout(() => {
            const diceBox = new DiceBox({
                container: '#dice-box-container', // Use CSS selector instead of ref
                assetPath: '/assets/dice-box/',
                gravity: 1,
                friction: 0.8,
                restitution: 0.5,
                theme: theme,
                startingHeight: 8,
                spinStrength: 5,
                throwStrength: 5,
                settleTimeout: 5000,
                enableSound: false, // Disable audio to prevent 404 errors
            });

            diceBox.init().then(() => {
                boxRef.current = diceBox;
                setIsInitialized(true);

                // Listen for roll complete
                diceBox.onRollComplete = (results: any) => {
                    const totalRoll = results.totalValue;
                    onRollComplete({
                        roll: totalRoll,
                        total: totalRoll + modifier
                    });
                };
            }).catch((err: any) => {
                console.error('[DiceBox3D] Initialization failed:', err);
            });
        }, 100);

        return () => {
            clearTimeout(timer);
            // Cleanup: clear the canvas if possible
            const container = document.getElementById('dice-box-container');
            if (container) {
                container.innerHTML = '';
            }
        };
    }, []);

    // Handle rolling when trigger changes and initialized
    const rollTrigger = useRef(0);

    useEffect(() => {
        if (isInitialized && boxRef.current && notation) {
            // We can use a prop or just rely on notation changing
            // But usually we want to trigger it multiple times for same notation
            boxRef.current.roll(notation);
        }
    }, [isInitialized, notation]);

    if (Platform.OS !== 'web') {
        return null;
    }

    return (
        <View style={styles.container}>
            {/* dice-box needs a DOM element, so we use a div on web */}
            <div
                id="dice-box-container"
                ref={containerRef}
                style={{
                    width: '100%',
                    height: 200,
                    cursor: 'pointer',
                    background: 'transparent'
                }}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        height: 200,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
