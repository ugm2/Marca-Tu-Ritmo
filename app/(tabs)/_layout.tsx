import { Tabs } from 'expo-router';
import { useColorScheme, View, StyleSheet, Dimensions, TouchableOpacity, Platform } from 'react-native';
import Colors from '../../constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import Animated, { 
  useAnimatedStyle,
  withSpring,
  withTiming,
  useSharedValue,
  withSequence,
  FadeInDown,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { router } from 'expo-router';

const SCREEN_WIDTH = Dimensions.get('window').width;
const TAB_BAR_WIDTH = 350;

export const FadeInView = ({ children, style }: { children: React.ReactNode, style?: any }) => {
  return (
    <Animated.View 
      entering={FadeInDown.duration(300).springify()}
      style={[{ flex: 1 }, style]}
    >
      {children}
    </Animated.View>
  );
};

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const handleAddWorkout = () => {
    router.push('/add-workout');
  };

  const TabBarIcon = ({ name, focused, position }: { 
    name: React.ComponentProps<typeof Ionicons>['name']; 
    focused: boolean;
    position?: 'beforePlus' | 'afterPlus';
  }) => {
    const scale = useSharedValue(1);
    
    useEffect(() => {
      if (focused) {
        scale.value = withSequence(
          withSpring(1.2, { damping: 10, stiffness: 200 }),
          withSpring(1.1, { damping: 10, stiffness: 200 })
        );
      } else {
        scale.value = withSpring(1, { damping: 10, stiffness: 200 });
      }
    }, [focused]);

    const animatedStyle = useAnimatedStyle(() => {
      return {
        transform: [{ scale: scale.value }],
        backgroundColor: withTiming(focused ? colors.tabBarActiveTintColor : 'transparent', {
          duration: 200,
        }),
      };
    });

    return (
      <View style={[
        styles.iconContainer,
        position === 'beforePlus' && styles.beforePlusIcon,
        position === 'afterPlus' && styles.afterPlusIcon,
        name === 'home' && styles.firstIcon,
        name === 'cog' && styles.lastIcon,
      ]}>
        <Animated.View style={[styles.iconWrapper, animatedStyle]}>
          <Ionicons 
            name={name} 
            size={28}
            color={focused ? colors.tabIconSelected : colors.tabIconDefault}
          />
        </Animated.View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={[styles.floatingButton, { backgroundColor: colors.primary }]}
        onPress={handleAddWorkout}
      >
        <Ionicons name="add" size={35} color="#FFFFFF" />
      </TouchableOpacity>

      <Tabs
        screenOptions={{
          tabBarStyle: {
            position: 'absolute',
            bottom: 30,
            transform: [{ translateX: TAB_BAR_WIDTH / 16 }],
            width: TAB_BAR_WIDTH,
            height: 55,
            backgroundColor: colorScheme === 'dark' ? '#1C1C1E' : colors.cardBackground,
            borderRadius: 30,
            ...styles.shadow,
            justifyContent: 'space-between',
            alignItems: 'center',
            flexDirection: 'row',
            paddingHorizontal: 0,
          },
          headerShown: false,
          tabBarShowLabel: false,
          tabBarHideOnKeyboard: true,
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ focused }) => (
              <TabBarIcon name="home" focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="logs"
          options={{
            title: 'Logs',
            tabBarIcon: ({ focused }) => (
              <TabBarIcon name="list" focused={focused} position="beforePlus" />
            ),
          }}
        />
        <Tabs.Screen
          name="progress"
          options={{
            title: 'Progress',
            tabBarIcon: ({ focused }) => (
              <TabBarIcon name="stats-chart" focused={focused} position="afterPlus" />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarIcon: ({ focused }) => (
              <TabBarIcon name="cog" focused={focused} />
            ),
          }}
        />
      </Tabs>
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  shadow: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  iconContainer: {
    width: 32,
    alignItems: 'center',
    marginTop: 6,
  },
  beforePlusIcon: {
    marginRight: 50,
  },
  afterPlusIcon: {
    marginLeft: 50,
  },
  firstIcon: {
    marginLeft: -28,
  },
  lastIcon: {
    marginRight: -28,
  },
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 42,
    height: 42,
    borderRadius: 24,
  },
  floatingButton: {
    position: 'absolute',
    bottom: 56,
    alignSelf: 'center',
    width: 60,
    height: 60,
    borderRadius: 35,
    backgroundColor: '#6B4EFF',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
      },
      android: {
        elevation: 5,
      },
    }),
  },
});

