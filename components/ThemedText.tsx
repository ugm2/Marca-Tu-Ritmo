import React from 'react';
import { Text, TextProps, useColorScheme } from 'react-native';
import Colors from '../constants/Colors';

interface ThemedTextProps extends TextProps {
  style?: TextProps['style'];
}

export function ThemedText({ style, ...props }: ThemedTextProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <Text
      style={[
        {
          color: colors.text,
        },
        style,
      ]}
      {...props}
    />
  );
}
