import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { SettingsProvider } from '../contexts/SettingsContext';
import { PortalProvider } from '@gorhom/portal';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  return (
    <SettingsProvider>
      <RootLayoutNav />
    </SettingsProvider>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <PortalProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <Stack
            screenOptions={{
              animation: 'slide_from_right',
              animationDuration: 200,
              gestureEnabled: true,
              gestureDirection: 'horizontal',
              fullScreenGestureEnabled: true,
              headerShown: false,
              contentStyle: {
                backgroundColor: colorScheme === 'dark' ? '#000' : '#fff',
              },
            }}
          >
            <Stack.Screen 
              name="(tabs)" 
              options={{ 
                headerShown: false,
                animation: 'fade',
              }} 
            />
            <Stack.Screen 
              name="add-workout" 
              options={{ 
                presentation: 'modal',
                headerShown: false,
                animation: 'slide_from_bottom',
                gestureDirection: 'vertical',
              }} 
            />
          </Stack>
        </GestureHandlerRootView>
      </ThemeProvider>
    </PortalProvider>
  );
}
