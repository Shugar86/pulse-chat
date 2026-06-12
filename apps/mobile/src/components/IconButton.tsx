import React, { useMemo } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface IconButtonProps {
  icon: IconName;
  onPress: () => void;
  size?: number;
  color?: string;
  backgroundColor?: string;
  disabled?: boolean;
}

export function IconButton({
  icon,
  onPress,
  size = 24,
  color = colors.surface,
  backgroundColor = colors.primary,
  disabled,
}: IconButtonProps) {
  const buttonStyle = useMemo(
    () => [styles.button, { backgroundColor }, disabled && styles.disabled],
    [backgroundColor, disabled]
  );

  return (
    <Pressable onPress={onPress} disabled={disabled} style={buttonStyle}>
      <Ionicons name={icon} size={size} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.5 },
});
