import React, { useEffect, useRef } from 'react';
import { Pressable, Animated, Text, View, StyleSheet, ViewStyle } from 'react-native';
import { colors, spacing, typography } from '../theme';
import { Avatar } from './Avatar';

interface ListItemProps {
  title: string;
  subtitle?: string;
  avatarUri?: string | null;
  avatarName?: string;
  trailing?: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
}

export function ListItem({ title, subtitle, avatarUri, avatarName, trailing, onPress, style }: ListItemProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    Animated.timing(translateY, { toValue: 0, duration: 200, useNativeDriver: true }).start();
  }, []);

  const content = (
    <Animated.View style={[styles.row, { opacity, transform: [{ translateY }] }, style]}>
      {avatarName ? <Avatar uri={avatarUri} name={avatarName} size="md" /> : null}
      <View style={styles.textContainer}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </Animated.View>
  );

  if (onPress) {
    return <Pressable onPress={onPress}>{content}</Pressable>;
  }
  return content;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  textContainer: { flex: 1, justifyContent: 'center' },
  title: { ...typography.bodySmall, fontWeight: '600', color: colors.text },
  subtitle: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  trailing: { alignItems: 'flex-end' },
});
