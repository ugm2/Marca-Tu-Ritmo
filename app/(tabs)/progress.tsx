import React, { useState, useCallback } from 'react';
import { StyleSheet, View, ScrollView, Dimensions, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '../../components/ThemedText';
import { ThemedView } from '../../components/ThemedView';
import Colors from '../../constants/Colors';
import { useColorScheme } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Exercise, WOD, getAllLogs } from '../../app/utils/db';
import { LineChart, PieChart, ContributionGraph } from 'react-native-chart-kit';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addDays } from 'date-fns';
import { useSettings } from '../../contexts/SettingsContext';

type WorkoutLog = (Exercise | WOD) & { type: 'exercise' | 'wod' };

export default function ProgressScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { settings } = useSettings();
  const screenWidth = Dimensions.get('window').width;

  const loadLogs = useCallback(async () => {
    try {
      setIsLoading(true);
      const allLogs = await getAllLogs();
      const typedLogs: WorkoutLog[] = allLogs.map(log => {
        if (log.type === 'wod') {
          return {
            id: log.id,
            name: log.name,
            date: log.date,
            notes: log.notes || '',
            type: 'wod' as const,
            description: log.description || '',
            result: log.result || ''
          };
        } else {
          return {
            id: log.id,
            name: log.name,
            date: log.date,
            notes: log.notes || '',
            type: 'exercise' as const,
            weight: log.weight || '',
            reps: log.reps || ''
          };
        }
      });
      setLogs(typedLogs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
    } catch (error) {
      console.error('Error loading logs:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadLogs();
    }, [loadLogs])
  );

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

  const getWorkoutTypeDistribution = () => {
    const wodCount = logs.filter(log => log.type === 'wod').length;
    const exerciseCount = logs.filter(log => log.type === 'exercise').length;
    const total = wodCount + exerciseCount;

    if (total === 0) return { labels: ['WODs', 'Exercises'], data: [0, 0] };

    return {
      labels: ['WODs', 'Exercises'],
      data: [
        Math.round((wodCount / total) * 100),
        Math.round((exerciseCount / total) * 100)
      ]
    };
  };

  const getExerciseProgressData = () => {
    const exerciseLogs = logs.filter(log => log.type === 'exercise') as Exercise[];
    const exerciseNames = [...new Set(exerciseLogs.map(log => log.name))];
    
    return exerciseNames.slice(0, 5).map(name => {
      const exerciseData = exerciseLogs
        .filter(log => log.name === name)
        .map(log => ({
          date: new Date(log.date),
          weight: typeof log.weight === 'string' ? parseFloat(log.weight) : (log.weight || 0)
        }))
        .sort((a, b) => a.date.getTime() - b.date.getTime());

      const weights = exerciseData.slice(-7).map(d => d.weight);
      return {
        name,
        data: weights.length > 0 ? weights : [0]
      };
    });
  };

  const chartConfig = {
    backgroundGradientFrom: colors.cardBackground,
    backgroundGradientTo: colors.cardBackground,
    color: (opacity = 1) => colors.primary + Math.round(opacity * 255).toString(16).padStart(2, '0'),
    labelColor: (opacity = 1) => colors.text + Math.round(opacity * 255).toString(16).padStart(2, '0'),
    strokeWidth: 2,
    useShadowColorFromDataset: false,
    propsForBackgroundLines: {
      strokeDasharray: '', // Solid lines
      strokeWidth: 0.5,
      stroke: colors.text + '20',
    },
    propsForLabels: {
      fontSize: 12,
    },
    fillShadowGradientFrom: colors.primary,
    fillShadowGradientTo: colors.cardBackground,
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ThemedText>Loading progress data...</ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  const weeklyData = getWeeklyWorkoutData();
  const typeDistribution = getWorkoutTypeDistribution();
  const exerciseProgress = getExerciseProgressData();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <ThemedText style={styles.title}>Progress Insights</ThemedText>
        </View>

        <ThemedView style={[styles.card, { backgroundColor: colors.cardBackground }]}>
          <ThemedText style={styles.cardTitle}>Weekly Activity</ThemedText>
          <View style={styles.weeklyActivityContainer}>
            {weeklyData.data.map((count, index) => (
              <View key={index} style={styles.dayContainer}>
                <ThemedText style={styles.dayLabel}>{weeklyData.labels[index]}</ThemedText>
                <View style={[
                  styles.activityIndicator,
                  {
                    backgroundColor: colors.primary + '20',
                    height: Math.max(30, count * 40),
                  }
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
                <ThemedText style={styles.countLabel}>{count}</ThemedText>
              </View>
            ))}
          </View>
        </ThemedView>

        <ThemedView style={[styles.card, { backgroundColor: colors.cardBackground }]}>
          <ThemedText style={styles.cardTitle}>Workout Type Distribution</ThemedText>
          {logs.length > 0 ? (
            <View style={styles.chartWrapper}>
              <PieChart
                data={[
                  {
                    name: 'WODs',
                    population: typeDistribution.data[0],
                    color: colors.primary,
                    legendFontColor: colors.text,
                  },
                  {
                    name: 'Exercises',
                    population: typeDistribution.data[1],
                    color: colors.secondary,
                    legendFontColor: colors.text,
                  }
                ]}
                width={screenWidth - 48}
                height={220}
                chartConfig={chartConfig}
                accessor="population"
                backgroundColor="transparent"
                paddingLeft="0"
                absolute
                style={styles.chart}
              />
            </View>
          ) : (
            <ThemedText style={styles.noDataText}>No workout data available</ThemedText>
          )}
        </ThemedView>

        {exerciseProgress.map((exercise, index) => (
          <ThemedView key={index} style={[styles.card, { backgroundColor: colors.cardBackground }]}>
            <ThemedText style={styles.cardTitle}>{exercise.name} Progress</ThemedText>
            <View style={styles.chartWrapper}>
              <LineChart
                data={{
                  labels: Array(exercise.data.length).fill(''),
                  datasets: [{ 
                    data: exercise.data,
                    color: (opacity = 1) => colors.primary + Math.round(opacity * 255).toString(16).padStart(2, '0'),
                    strokeWidth: 3,
                  }]
                }}
                width={screenWidth - 48}
                height={220}
                chartConfig={{
                  ...chartConfig,
                  fillShadowGradientFrom: colors.primary,
                  fillShadowGradientFromOpacity: 0.5,
                  fillShadowGradientTo: colors.cardBackground,
                  fillShadowGradientToOpacity: 0.1,
                }}
                style={styles.chart}
                bezier
                withDots
                withInnerLines={false}
                withOuterLines={false}
                withVerticalLabels={false}
                withHorizontalLabels
                withShadow={false}
                yAxisLabel=""
                yAxisSuffix={settings.useMetric ? "kg" : "lb"}
              />
            </View>
            <ThemedText style={styles.chartLabel}>
              Last {exercise.data.length} sessions
            </ThemedText>
          </ThemedView>
        ))}
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
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  card: {
    margin: 20,
    marginTop: 0,
    padding: 16,
    borderRadius: 16,
    overflow: 'hidden',
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
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  chartWrapper: {
    alignItems: 'center',
    marginHorizontal: -8,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  chartLabel: {
    fontSize: 12,
    textAlign: 'center',
    opacity: 0.6,
    marginTop: 8,
  },
  noDataText: {
    textAlign: 'center',
    opacity: 0.7,
    padding: 20,
  },
  weeklyActivityContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 220,
    paddingTop: 20,
  },
  dayContainer: {
    alignItems: 'center',
    flex: 1,
  },
  dayLabel: {
    fontSize: 12,
    marginBottom: 8,
    opacity: 0.6,
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
}); 