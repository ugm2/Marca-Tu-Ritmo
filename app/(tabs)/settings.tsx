import React, { useState, useCallback } from 'react';
import { StyleSheet, View, ScrollView, Platform, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '../../components/ThemedText';
import { ThemedView } from '../../components/ThemedView';
import Colors from '../../constants/Colors';
import { useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../../contexts/SettingsContext';
import { AnimatedTabScreen } from '../../components/AnimatedTabScreen';

export default function SettingsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { settings, updateSettings } = useSettings();
  const [key, setKey] = useState(0);

  const handleScreenFocus = useCallback(async () => {
    setKey(prev => prev + 1);
  }, []);

  const SettingItem = ({ 
    icon, 
    title, 
    description, 
    value, 
    onValueChange 
  }: { 
    icon: React.ComponentProps<typeof Ionicons>['name'];
    title: string;
    description: string;
    value: boolean;
    onValueChange: (newValue: boolean) => void;
  }) => (
    <ThemedView style={[styles.settingCard, { backgroundColor: colors.cardBackground }]}>
      <View style={styles.settingHeader}>
        <View style={styles.settingIcon}>
          <Ionicons name={icon} size={24} color={colors.primary} />
        </View>
        <View style={styles.settingInfo}>
          <ThemedText style={styles.settingTitle}>{title}</ThemedText>
          <ThemedText style={styles.settingDescription}>{description}</ThemedText>
        </View>
        <Switch
          value={value}
          onValueChange={onValueChange}
          ios_backgroundColor="#3e3e3e"
          trackColor={{ false: Platform.select({ ios: '#3e3e3e', android: '#767577' }), true: colors.primary }}
        />
      </View>
    </ThemedView>
  );

  const Content = () => (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScrollView 
          style={styles.scrollView} 
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="never"
        >
          <View style={styles.header}>
            <ThemedText style={styles.title}>Settings</ThemedText>
          </View>

          <View style={styles.settingsContainer}>
            <SettingItem
              icon="scale"
              title="Use Metric System"
              description="Switch between kilograms (kg) and pounds (lb)"
              value={settings.useMetric}
              onValueChange={(value) => updateSettings({ useMetric: value })}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );

  return (
    <AnimatedTabScreen onScreenFocus={handleScreenFocus}>
      <Content />
    </AnimatedTabScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  settingsContainer: {
    padding: 20,
    gap: 16,
  },
  settingCard: {
    borderRadius: 16,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  settingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingInfo: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    opacity: 0.6,
  },
}); 