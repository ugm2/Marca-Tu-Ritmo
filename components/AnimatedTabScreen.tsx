import React, { useRef, useState } from 'react';
import { Animated, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Colors from '../constants/Colors';
import { useColorScheme } from 'react-native';

interface AnimatedTabScreenProps {
  children: React.ReactNode;
  onScreenFocus?: () => Promise<void>;
}

export function AnimatedTabScreen({ children, onScreenFocus }: AnimatedTabScreenProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const slideInAnim = useRef(new Animated.Value(30)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [showScreen, setShowScreen] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      // 1) Hide everything again
      setShowScreen(false);
  
      // 2) Handle any data loading
      const loadData = async () => {
        if (onScreenFocus) {
          await onScreenFocus();
        }
        
        // 3) Now that data is loaded, position at 30
        slideInAnim.setValue(30);
        fadeAnim.setValue(0);
        // 4) Reveal the screen
        setShowScreen(true);
  
        // 5) Delay animation one frame
        requestAnimationFrame(() => {
          Animated.parallel([
            Animated.spring(slideInAnim, {
              toValue: 0,
              useNativeDriver: true,
              friction: 4,          // Bounce
              tension: 10,
            }),
            Animated.timing(fadeAnim, {
              toValue: 1,           // fully opaque
              duration: 300,        // fade in over 300ms
              useNativeDriver: true,
            }),
          ]).start();
        });
      };

      loadData();
    }, [slideInAnim, fadeAnim, onScreenFocus])
  );

  if (!showScreen) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Could show a loading spinner if you want */}
      </View>
    );
  }

  return (
    <Animated.View
      style={{
        flex: 1,
        transform: [{ translateY: slideInAnim }],
        opacity: fadeAnim
      }}
    >
      {children}
    </Animated.View>
  );
} 