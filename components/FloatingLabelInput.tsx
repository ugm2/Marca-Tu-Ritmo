// components/FloatingLabelInput.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  TextInput,
  Animated,
  StyleSheet,
  TextInputProps,
  Platform,
} from 'react-native';
import Colors from '../constants/Colors';

interface FloatingLabelInputProps extends TextInputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  colorScheme?: 'light' | 'dark';
}

export const FloatingLabelInput: React.FC<FloatingLabelInputProps> = ({
  label,
  value,
  onChangeText,
  colorScheme = 'light',
  style,
  ...props
}) => {
  const labelAnimation = useRef(new Animated.Value(value ? 1 : 0)).current;
  const [isFocused, setIsFocused] = useState(false);

  // Animate the label whenever focus or value changes
  useEffect(() => {
    Animated.timing(labelAnimation, {
      toValue: isFocused || value ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [isFocused, value]);

  // Interpolate label position & size
  const labelTranslateY = labelAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [16, -8], // from near the TextInput to above
  });

  const labelFontSize = labelAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [17, 14],
  });

  const borderColor = isFocused
    ? Colors[colorScheme].primary
    : 'rgba(128,128,128,0.3)';

  const borderWidth = isFocused
    ? Platform.OS === 'ios' ? 2 : 3
    : Platform.OS === 'ios' ? 0.5 : 1;

  return (
    <View style={[styles.container, { borderBottomColor: borderColor, borderBottomWidth: borderWidth }]}>
      <Animated.Text
        style={[
          styles.label,
          {
            transform: [{ translateY: labelTranslateY }],
            fontSize: labelFontSize,
            color: isFocused
              ? Colors[colorScheme].primary
              : Colors[colorScheme].tabIconDefault,
          },
        ]}
      >
        {label}
      </Animated.Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        style={[
          styles.textInput,
          {
            color: Colors[colorScheme].text,
          },
          style,
        ]}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        {...props}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  label: {
    position: 'absolute',
    left: 0,
    top: -8,
    // The top position is the same for 0 and 1 in labelTranslateY,
    // but we can nudge it for different screen densities if needed.
  },
  textInput: {
    fontSize: 17,
    height: 32,
    padding: 0,
  },
});