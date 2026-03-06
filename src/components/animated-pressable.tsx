import React, { useRef } from "react";
import { Animated, GestureResponderEvent, Pressable, PressableProps, StyleProp, ViewStyle } from "react-native";

interface AnimatedPressableProps extends PressableProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
}

const AnimatedPressableCore = Animated.createAnimatedComponent(Pressable);

export function AnimatedPressable({ children, style, scaleTo = 0.96, onPressIn, onPressOut, ...props }: AnimatedPressableProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = (e: GestureResponderEvent) => {
    Animated.spring(scaleAnim, {
      toValue: scaleTo,
      useNativeDriver: true,
      stiffness: 400,
      damping: 25,
      mass: 1,
    }).start();
    if (onPressIn) {
      onPressIn(e);
    }
  };

  const handlePressOut = (e: GestureResponderEvent) => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      stiffness: 400,
      damping: 25,
      mass: 1,
    }).start();
    if (onPressOut) {
      onPressOut(e);
    }
  };

  return (
    <AnimatedPressableCore
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[style, { transform: [{ scale: scaleAnim }] }]}
      {...props}
    >
      {children}
    </AnimatedPressableCore>
  );
}
