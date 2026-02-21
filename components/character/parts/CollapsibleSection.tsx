import * as React from 'react';
import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, LayoutAnimation } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface CollapsibleSectionProps {
    title: string;
    children: React.ReactNode;
    colors: any;
    styles: any;
    hasUpdate?: boolean;
    defaultExpanded?: boolean;
    onExpand?: () => void;
    rightElement?: React.ReactNode;
}

export function CollapsibleSection({ title, children, colors, styles, hasUpdate, defaultExpanded = false, onExpand, rightElement }: CollapsibleSectionProps) {
    const [expanded, setExpanded] = useState(defaultExpanded);

    useEffect(() => {
        if (defaultExpanded) {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setExpanded(true);
        }
    }, [defaultExpanded]);

    const toggle = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        const nextState = !expanded;
        setExpanded(nextState);
        if (nextState && onExpand) {
            onExpand();
        }
    };

    return (
        <View style={styles.sectionContainer}>
            <TouchableOpacity onPress={toggle} style={styles.sectionHeader} activeOpacity={0.7}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>{title}</Text>
                    {hasUpdate && !expanded && (
                        <View style={styles.updateDot} />
                    )}
                </View>
                {rightElement}
                <Ionicons
                    name={expanded ? "chevron-down" : "chevron-forward"}
                    size={20}
                    color={colors.text.muted}
                />
            </TouchableOpacity>

            {expanded && (
                <View style={styles.sectionContent}>
                    {children}
                </View>
            )}
        </View>
    );
}
