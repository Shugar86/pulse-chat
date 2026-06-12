import React, { useRef, useCallback, useEffect } from 'react';
import { Pressable, Animated, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import { colors, radius, typography } from '../theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function Button({ title, onPress, variant = 'primary', loading, disabled, fullWidth = true, style, textStyle }: ButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);

  const animateTo = useCallback((value: number) => {
    animationRef.current?.stop();
    animationRef.current = Animated.spring(scale, { toValue: value, useNativeDriver: true, friction: 5 });
    animationRef.current.start();
  }, [scale]);

  const handlePressIn = useCallback(() => {
    animateTo(0.97);
  }, [animateTo]);

  const handlePressOut = useCallback(() => {
    animateTo(1);
  }, [animateTo]);

  const isDisabled = disabled || loading;

  useEffect(() => {
    if (isDisabled) {
      animationRef.current?.stop();
      scale.setValue(1);
    }
  }, [isDisabled, scale]);

  useEffect(() => {
    return () => {
      animationRef.current?.stop();
    };
  }, []);

  const containerStyle = [
    styles.base,
    variant === 'primary' && styles.primary,
    variant === 'secondary' && styles.secondary,
    variant === 'ghost' && styles.ghost,
    variant === 'danger' && styles.danger,
    isDisabled && styles.disabled,
    style,
  ];

  const titleStyle = [
    styles.text,
    variant === 'primary' && styles.primaryText,
    variant === 'secondary' && styles.secondaryText,
    variant === 'ghost' && styles.ghostText,
    variant === 'danger' && styles.dangerText,
    textStyle,
  ];

  return (
    <Animated.View style={{ transform: [{ scale }], width: fullWidth ? '100%' : undefined }}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isDisabled}
        style={({ pressed }) => [containerStyle, pressed && !isDisabled && styles.pressed]}
      >
        {loading ? (
          <ActivityIndicator color={variant === 'primary' || variant === 'danger' ? colors.surface : colors.primary} />
        ) : (
          <Text style={titleStyle}>{title}</Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.primary },
  ghost: { backgroundColor: 'transparent' },
  danger: { backgroundColor: colors.error },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.9 },
  text: { ...typography.bodySmall, fontWeight: '600' },
  primaryText: { color: colors.surface },
  secondaryText: { color: colors.primary },
  ghostText: { color: colors.primary },
  dangerText: { color: colors.surface },
});
