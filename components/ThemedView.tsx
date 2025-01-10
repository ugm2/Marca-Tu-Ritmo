import React from 'react';
import { View, ViewProps, useColorScheme } from 'react-native';
import Colors from '../constants/Colors';

interface ThemedViewProps extends ViewProps {
  style?: ViewProps['style'];
}

export function ThemedView({ style, ...props }: ThemedViewProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <View
      style={[
        {
          backgroundColor: colors.cardBackground,
        },
        style,
      ]}
      {...props}
    />
  );
}
