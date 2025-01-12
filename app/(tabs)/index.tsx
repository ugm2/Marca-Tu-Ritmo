import React, { useState } from 'react';
import { StyleSheet, View, ScrollView, Platform, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '../../components/ThemedText';
import { ThemedView } from '../../components/ThemedView';
import Colors from '../../constants/Colors';
import { useColorScheme } from 'react-native';
import { Exercise, WOD, getAllLogs } from '../../app/utils/db';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, subDays } from 'date-fns';

type WorkoutLog = (Exercise | WOD) & { type: 'exercise' | 'wod' };

interface WeeklyStats {
  totalWorkouts: number;
  strengthWorkouts: number;
  wodWorkouts: number;
  streakDays: number;
}

const motivationalQuotes = [
  "The only bad workout is the one that didn't happen.",
  "Your body can stand almost anything. It's your mind you have to convince.",
  "The pain you feel today will be the strength you feel tomorrow.",
  "Don't stop when you're tired. Stop when you're done.",
  "Your strongest muscle and worst enemy is your mind.",
  "No matter how slow you go, you're still lapping everyone on the couch.",
  "Success starts with self-discipline.",
];

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats>({
    totalWorkouts: 0,
    strengthWorkouts: 0,
    wodWorkouts: 0,
    streakDays: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);

  const getWeeklyWorkoutData = () => {
    const today = new Date();
    const start = startOfWeek(today);
    const end = endOfWeek(today);
    const days = eachDayOfInterval({ start, end });
    
    const labels = days.map(day => format(day, 'EEE'));
    const data = days.map(day => {
      return logs.filter(log => {
        const logDate = new Date(log.date);
        return format(logDate, 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd');
      }).length;
    });

    return { labels, data };
  };

  const loadWeeklyStats = async () => {
    try {
      setIsLoading(true);
      const allLogs = await getAllLogs();
      setLogs(allLogs);
      
      // Get start of current week
      const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
      
      // Filter logs for current week
      const weekLogs = allLogs.filter(log => {
        const logDate = new Date(log.date);
        return logDate >= weekStart && logDate <= new Date();
      });

      // Calculate streak
      let streakDays = 0;
      let currentDate = new Date();
      let hasWorkout = true;

      while (hasWorkout) {
        const dateStr = format(currentDate, 'yyyy-MM-dd');
        const workoutsOnDate = allLogs.filter(log => log.date === dateStr);
        
        if (workoutsOnDate.length > 0) {
          streakDays++;
          currentDate = subDays(currentDate, 1);
        } else {
          hasWorkout = false;
        }
      }

      setWeeklyStats({
        totalWorkouts: weekLogs.length,
        strengthWorkouts: weekLogs.filter(log => log.type === 'exercise').length,
        wodWorkouts: weekLogs.filter(log => log.type === 'wod').length,
        streakDays,
      });
    } catch (error) {
      console.error('Error loading weekly stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      loadWeeklyStats();
    }, [])
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ThemedText>Loading...</ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  const weeklyData = getWeeklyWorkoutData();

  // Get daily quote based on the day of the year
  const getDailyQuote = () => {
    const dayOfYear = Math.floor((new Date().getTime() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 1000 / 60 / 60 / 24);
    return motivationalQuotes[dayOfYear % motivationalQuotes.length];
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView 
          style={styles.scrollView} 
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="never"
        >
        <View style={styles.header}>
          <ThemedText style={styles.title}>Weekly Progress</ThemedText>
          <ThemedText style={styles.date}>{format(new Date(), 'MMMM d, yyyy')}</ThemedText>
        </View>

        {/* Motivation Card */}
        <ThemedView style={[styles.card, { backgroundColor: colors.primary }]}>
          <ThemedText style={styles.quoteText}>{getDailyQuote()}</ThemedText>
        </ThemedView>

        {/* Weekly Activity */}
        <ThemedView style={[styles.card, { backgroundColor: colors.cardBackground }]}>
          <ThemedText style={styles.cardTitle}>Weekly Activity</ThemedText>
          <View style={styles.weeklyActivityContainer}>
            {weeklyData.data.map((count, index) => {
              const isToday = weeklyData.labels[index] === format(new Date(), 'EEE');
              return (
                <View key={index} style={styles.dayContainer}>
                  <ThemedText style={[
                    styles.dayLabel,
                    isToday && styles.todayLabel
                  ]}>{weeklyData.labels[index]}</ThemedText>
                  <View style={[
                    styles.activityIndicator,
                    {
                      backgroundColor: colors.primary + (isToday ? '30' : '20'),
                      height: Math.max(30, count * 25),
                    },
                    isToday && { borderWidth: 2, borderColor: colors.primary }
                  ]}>
                    <View style={[
                      styles.activityFill,
                      {
                        backgroundColor: colors.primary,
                        height: count > 0 ? '100%' : 0,
                        opacity: Math.min(0.3 + (count * 0.2), 1),
                      }
                    ]} />
                  </View>
                  <ThemedText style={[
                    styles.countLabel,
                    isToday && styles.todayLabel
                  ]}>{count}</ThemedText>
                </View>
              );
            })}
          </View>
        </ThemedView>

        {/* Weekly Stats */}
        <View style={styles.statsContainer}>
          <ThemedView style={[styles.statsCard, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.statItem}>
              <Ionicons name="fitness" size={24} color={colors.primary} />
              <ThemedText style={styles.statNumber}>{weeklyStats.totalWorkouts}</ThemedText>
              <ThemedText style={styles.statLabel}>Total Workouts</ThemedText>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Ionicons name="flame" size={24} color={colors.primary} />
              <ThemedText style={styles.statNumber}>{weeklyStats.streakDays}</ThemedText>
              <ThemedText style={styles.statLabel}>Day Streak</ThemedText>
            </View>
          </ThemedView>

          <View style={styles.statsRow}>
            <ThemedView style={[styles.statsCardHalf, { backgroundColor: colors.cardBackground }]}>
              <Ionicons name="barbell" size={24} color={colors.primary} />
              <ThemedText style={styles.statNumber}>{weeklyStats.strengthWorkouts}</ThemedText>
              <ThemedText style={styles.statLabel}>Strength</ThemedText>
            </ThemedView>
            <ThemedView style={[styles.statsCardHalf, { backgroundColor: colors.cardBackground }]}>
              <Ionicons name="stopwatch" size={24} color={colors.primary} />
              <ThemedText style={styles.statNumber}>{weeklyStats.wodWorkouts}</ThemedText>
              <ThemedText style={styles.statLabel}>WODs</ThemedText>
            </ThemedView>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  date: {
    fontSize: 16,
    opacity: 0.7,
    marginTop: 2,
  },
  card: {
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    borderRadius: 16,
  },
  quoteText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 24,
  },
  calendarContainer: {
    marginBottom: 20,
  },
  calendarContent: {
    paddingHorizontal: 20,
  },
  dayContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    width: 56,
    height: 72,
    marginRight: 8,
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  todayContainer: {
    backgroundColor: '#F3F4F6',
  },
  dayName: {
    fontSize: 13,
    opacity: 0.6,
    marginBottom: 4,
  },
  dayNumber: {
    fontSize: 17,
    fontWeight: '600',
  },
  selectedText: {
    color: '#FFFFFF',
    opacity: 1,
  },
  statsContainer: {
    padding: 16,
    paddingTop: 8,
    marginBottom: 100,
  },
  statsCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
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
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(0,0,0,0.1)',
    marginHorizontal: 20,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  statsCardHalf: {
    flex: 1,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
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
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    marginVertical: 8,
  },
  statLabel: {
    fontSize: 14,
    opacity: 0.6,
  },
  weeklyActivityContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 160,
    paddingTop: 12,
  },
  dayLabel: {
    fontSize: 12,
    marginBottom: 8,
    opacity: 0.6,
  },
  todayLabel: {
    opacity: 1,
    fontWeight: '600',
  },
  activityIndicator: {
    width: 32,
    borderRadius: 16,
    overflow: 'hidden',
    minHeight: 30,
  },
  activityFill: {
    width: '100%',
    position: 'absolute',
    bottom: 0,
    borderRadius: 16,
  },
  countLabel: {
    fontSize: 12,
    marginTop: 8,
    fontWeight: '600',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
});
