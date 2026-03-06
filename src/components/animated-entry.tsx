import React, { useEffect, useRef } from "react";
import { Animated, StyleProp, ViewStyle } from "react-native";

interface AnimatedEntryProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
  direction?: "up" | "down" | "left" | "right" | "none";
  distance?: number;
}

export function AnimatedEntry({
  children,
  delay = 0,
  duration = 400,
  style,
  direction = "up",
  distance = 20,
}: AnimatedEntryProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(distance)).current;

  // Initialize slideAnim value based on direction
  useEffect(() => {
    let initialSlide = distance;
    if (direction === "down" || direction === "right") {
      initialSlide = -distance;
    }
    if (direction === "none") {
      initialSlide = 0;
    }
    slideAnim.setValue(initialSlide);
  }, [direction, distance, slideAnim]);

  useEffect(() => {
    const animations = [
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration,
        delay,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        delay,
        useNativeDriver: true,
        stiffness: 100,
        damping: 15,
        mass: 1,
      }),
    ];

    Animated.parallel(animations).start();
  }, [delay, duration, fadeAnim, slideAnim]);

  const transform = [];
  if (direction === "up" || direction === "down") {
    transform.push({ translateY: slideAnim });
  } else if (direction === "left" || direction === "right") {
    transform.push({ translateX: slideAnim });
  }

  return (
    <Animated.View style={[style, { opacity: fadeAnim, transform }]}>
      {children}
    </Animated.View>
  );
}
