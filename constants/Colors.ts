/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

const tintColorLight = '#2e78b7';
const tintColorDark = '#fff';

export default {
  light: {
    text: '#1A1A1A',
    background: '#FFFFFF',
    tint: tintColorLight,
    tabIconDefault: '#94A3B8',
    tabIconSelected: '#FFFFFF',
    primary: '#6B4EFF',
    secondary: '#E6E1FF',
    accent: '#FFB74D',
    cardBackground: '#F5F3FF',
    tabBarBackground: '#FFFFFF',
  },
  dark: {
    text: '#FFFFFF',
    background: '#000000',
    tint: tintColorDark,
    tabIconDefault: '#94A3B8',
    tabIconSelected: '#FFFFFF',
    primary: '#8970FF',
    secondary: '#2D2B52',
    accent: '#FFB74D',
    cardBackground: '#1A1A1A',
    tabBarBackground: '#000000',
  },
};
