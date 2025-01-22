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
  multiline?: boolean;
}

export const FloatingLabelInput: React.FC<FloatingLabelInputProps> = ({
  label,
  value,
  onChangeText,
  colorScheme = 'light',
  style,
  multiline = false,
  ...props
}) => {
  const labelAnimation = useRef(new Animated.Value(value ? 1 : 0)).current;
  const borderAnimation = useRef(new Animated.Value(0)).current;
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(labelAnimation, {
        toValue: isFocused || value ? 1 : 0,
        duration: 200,
        useNativeDriver: false,
      }),
      Animated.timing(borderAnimation, {
        toValue: isFocused ? 1 : 0,
        duration: 200,
        useNativeDriver: false,
      })
    ]).start();
  }, [isFocused, value]);

  const labelTranslateY = labelAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [multiline ? 24 : 16, -8],
  });

  const labelFontSize = labelAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [17, 14],
  });

  const borderWidth = borderAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [Platform.OS === 'ios' ? 0.5 : 1, Platform.OS === 'ios' ? 2 : 3],
  });

  const borderColor = borderAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(128,128,128,0.3)', Colors[colorScheme].primary],
  });

  return (
    <View style={[styles.outerContainer, multiline && styles.multilineOuterContainer]}>
      <View style={styles.container}>
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
            multiline && styles.multilineInput,
            {
              color: Colors[colorScheme].text,
            },
            style,
          ]}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          multiline={multiline}
          {...props}
        />
      </View>
      <Animated.View 
        style={[
          styles.border,
          {
            borderBottomWidth: borderWidth,
            borderBottomColor: borderColor,
          }
        ]} 
      />
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    marginBottom: 16,
    marginTop: 8,
  },
  multilineOuterContainer: {
    marginBottom: 24,
  },
  container: {
    position: 'relative',
    minHeight: 32,
  },
  label: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  textInput: {
    fontSize: 17,
    minHeight: 32,
    padding: 0,
    marginTop: 16,
  },
  multilineInput: {
    minHeight: 100,
    textAlignVertical: 'top',
    paddingTop: 8,
  },
  border: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderStyle: 'solid',
  },
});