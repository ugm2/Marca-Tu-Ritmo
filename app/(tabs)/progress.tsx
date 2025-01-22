import React, { useState, useCallback, useRef } from 'react';
import { StyleSheet, View, ScrollView, Dimensions, Platform, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '../../components/ThemedText';
import { ThemedView } from '../../components/ThemedView';
import Colors from '../../constants/Colors';
import { useColorScheme } from 'react-native';
import { Exercise, WOD, getAllLogs } from '../../app/utils/db';
import { LineChart } from 'react-native-chart-kit';
import { format } from 'date-fns';
import { useSettings } from '../../contexts/SettingsContext';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity } from 'react-native';
import { AnimatedTabScreen } from '../../components/AnimatedTabScreen';

type WorkoutLog = (Exercise | WOD) & { type: 'exercise' | 'wod' };

type ColorScheme = 'light' | 'dark';

type Colors = {
  [key in ColorScheme]: {
    text: string;
    background: string;
    tint: string;
    tabIconDefault: string;
    tabIconSelected: string;
    primary: string;
    secondary: string;
    accent: string;
    cardBackground: string;
    tabBarBackground: string;
    tabBarActiveTintColor: string;
  };
};

type PRData = {
  name: string;
  bestAttempt: {
    weight?: number;
    reps?: number;
    time?: string;
    distance?: string;
    date: Date;
  };
  type: 'weight_reps' | 'time_only' | 'distance_time' | 'reps_only';
};

type Settings = {
  useMetric: boolean;
};

type ExerciseDataBase = {
  date: Date;
  value: number;
};

type WeightExerciseData = ExerciseDataBase & {
  type: 'weight';
  reps: number;
};

type TimeExerciseData = ExerciseDataBase & {
  type: 'time';
};

type TimeDistanceExerciseData = ExerciseDataBase & {
  type: 'time_distance';
  distance: string;
};

type RepsExerciseData = ExerciseDataBase & {
  type: 'reps';
};

type ExerciseData = WeightExerciseData | TimeExerciseData | TimeDistanceExerciseData | RepsExerciseData;

type ChartData = {
  name: string;
  data: number[];
  dates: string[];
  type: 'weight' | 'time' | 'reps';
  formatter: (value: number) => string;
};

export default function ProgressScreen() {
  const colorScheme = useColorScheme() as ColorScheme | null;
  const colors = Colors[colorScheme ?? 'light'] as Colors[ColorScheme];
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [filteredExercises, setFilteredExercises] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const { settings } = useSettings() as { settings: Settings };
  const screenWidth = Dimensions.get('window').width;
  const searchRef = useRef<string>('');

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
          // Determine measurement type based on filled fields
          let measurement_type: Exercise['measurement_type'];
          if (log.measurement_type) {
            measurement_type = log.measurement_type;
          } else if (log.weight && log.reps) {
            measurement_type = 'weight_reps';
          } else if (log.time && log.distance) {
            measurement_type = 'distance_time';
          } else if (log.time) {
            measurement_type = 'time_only';
          } else if (log.reps) {
            measurement_type = 'reps_only';
          } else {
            measurement_type = 'weight_reps'; // fallback
          }

          return {
            id: log.id,
            name: log.name,
            date: log.date,
            notes: log.notes || '',
            type: 'exercise' as const,
            measurement_type,
            weight: log.weight || '',
            reps: log.reps || '',
            time: log.time || '',
            distance: log.distance || '',
          };
        }
      });
      const sortedLogs = typedLogs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setLogs(sortedLogs);
      
      const exerciseProgress = getExerciseProgressData(sortedLogs);
      setFilteredExercises(exerciseProgress);
    } catch (error) {
      console.error('Error loading logs:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getExerciseProgressData = useCallback((currentLogs: WorkoutLog[]): ChartData[] => {
    const exerciseLogs = currentLogs.filter(log => log.type === 'exercise') as Exercise[];
    const exerciseNames = [...new Set(exerciseLogs.map(log => log.name))];
    
    return exerciseNames.map(name => {
      const exerciseData = exerciseLogs
        .filter(log => log.name === name)
        .map(log => {
          const date = new Date(log.date);
          
          switch (log.measurement_type) {
            case 'weight_reps':
              return {
                date,
                value: parseFloat(log.weight || '0'),
                reps: parseInt(log.reps || '0'),
                type: 'weight' as const
              };
            
            case 'time_only':
              console.log('Processing time_only:', log.time);
              const timeValue = Number(log.time || '0');
              console.log('Converted to:', timeValue);
              return {
                date,
                value: timeValue,
                type: 'time' as const
              };
            
            case 'distance_time':
              console.log('Processing distance_time:', log.time);
              const distanceTimeValue = Number(log.time || '0');
              console.log('Converted to:', distanceTimeValue);
              return {
                date,
                value: distanceTimeValue,
                distance: log.distance || '',
                type: 'time_distance' as const
              };
            
            case 'reps_only':
              return {
                date,
                value: parseInt(log.reps || '0'),
                type: 'reps' as const
              };
            
            default:
              return null;
          }
        })
        .filter((data): data is NonNullable<typeof data> => !!data && data.value > 0)
        .sort((a, b) => a.date.getTime() - b.date.getTime());

      if (exerciseData.length === 0) return null;

      // Group by distance for distance_time exercises
      if (exerciseData[0]?.type === 'time_distance') {
        const byDistance = new Map<string, TimeDistanceExerciseData[]>();
        exerciseData.forEach(data => {
          if (data.type === 'time_distance' && data.distance) {
            const distance = data.distance;
            if (!byDistance.has(distance)) {
              byDistance.set(distance, []);
            }
            const distanceData = byDistance.get(distance);
            if (distanceData) {
              distanceData.push(data);
            }
          }
        });

        // Return separate datasets for each distance
        return Array.from(byDistance.entries()).map(([distance, data]): ChartData => ({
          name,
          data: data.map(d => d.value),
          dates: data.map(d => format(d.date, 'MMM d')),
          type: 'time',
          formatter: formatSeconds
        }));
      }

      const getChartType = (data: ExerciseData[]): ChartData['type'] => {
        const firstType = data[0]?.type;
        if (firstType === 'time' || firstType === 'time_distance') return 'time';
        if (firstType === 'reps') return 'reps';
        return 'weight';
      };

      const chartType = getChartType(exerciseData);
      return {
        name,
        data: exerciseData.map(d => d.value),
        dates: exerciseData.map(d => format(d.date, 'MMM d')),
        type: chartType,
        formatter: chartType === 'time' ? formatSeconds : String
      };
    })
    .flat()
    .filter((data): data is NonNullable<typeof data> => !!data)
    .sort((a, b) => b.data.length - a.data.length);
  }, []);

  const timeToSeconds = (timeStr: string | undefined): number => {
    if (!timeStr) return 0;
    const [minutes = '0', seconds = '0'] = timeStr.split(':').map(part => part.trim());
    return parseInt(minutes) * 60 + parseInt(seconds);
  };

  const formatSeconds = (seconds: number): string => {
    console.log('Formatting raw seconds:', seconds);
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const formatted = `${mins}:${secs.toString().padStart(2, '0')}`;
    console.log('Formatted time:', formatted);
    return formatted;
  };

  const handleSearch = useCallback((text: string) => {
    const searchTerm = text.toLowerCase();
    const exerciseProgress = getExerciseProgressData(logs);
    const filtered = exerciseProgress.filter(exercise => 
      exercise.name.toLowerCase().includes(searchTerm)
    );
    setFilteredExercises(filtered);
  }, [logs, getExerciseProgressData]);

  const handleScreenFocus = useCallback(async () => {
    await loadLogs();
  }, [loadLogs]);

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

  const getPRData = useCallback(() => {
    const exerciseLogs = logs.filter(log => log.type === 'exercise') as Exercise[];
    const exerciseNames = [...new Set(exerciseLogs.map(log => log.name))];

    return exerciseNames.map(name => {
      const exerciseData = exerciseLogs.filter(log => log.name === name);
      if (exerciseData.length === 0) return null;
      
      const measurementType = exerciseData[0]?.measurement_type;
      if (!measurementType) return null;

      switch (measurementType) {
        case 'weight_reps': {
          const bestAttempts = exerciseData.reduce((acc, data) => {
            const reps = parseInt(data.reps || '0');
            const weight = parseFloat(data.weight || '0');
            if (reps > 0 && weight > 0 && (!acc[reps] || weight > acc[reps].weight)) {
              acc[reps] = { weight, date: new Date(data.date) };
            }
            return acc;
          }, {} as Record<number, { weight: number; date: Date }>);

          const bestReps = Object.entries(bestAttempts)
            .sort(([, a], [, b]) => b.weight - a.weight)[0];

          if (!bestReps) return null;

          return {
            name,
            bestAttempt: {
              weight: bestReps[1].weight,
              reps: parseInt(bestReps[0]),
              date: bestReps[1].date
            },
            type: 'weight_reps' as const
          };
        }

        case 'time_only': {
          const times = exerciseData
            .map(data => {
              const time = Number(data.time || '0');
              console.log('Time from DB:', data.time, 'parsed as:', time);
              return { 
                time,
                date: new Date(data.date) 
              };
            })
            .filter(({ time }) => time > 0);

          if (times.length === 0) return null;

          const bestTime = times.reduce((best, current) => 
            current.time < best.time ? current : best
          );

          return {
            name,
            bestAttempt: {
              time: formatSeconds(bestTime.time),
              date: bestTime.date
            },
            type: 'time_only' as const
          };
        }

        case 'distance_time': {
          const byDistance = exerciseData.reduce((acc, data) => {
            if (!data.distance) return acc;
            
            const time = Number(data.time || '0');
            console.log('Distance time from DB:', data.time, 'parsed as:', time);
            if (time === 0) return acc;

            if (!acc[data.distance]) {
              acc[data.distance] = [];
            }
            acc[data.distance].push({ time, date: new Date(data.date) });
            return acc;
          }, {} as Record<string, { time: number; date: Date }[]>);

          return Object.entries(byDistance).map(([distance, attempts]) => {
            const bestTime = attempts.reduce((best, current) => 
              current.time < best.time ? current : best
            );

            return {
              name,
              bestAttempt: {
                time: formatSeconds(bestTime.time),
                distance,
                date: bestTime.date
              },
              type: 'distance_time' as const
            };
          });
        }

        case 'reps_only': {
          const attempts = exerciseData
            .map(data => ({ reps: parseInt(data.reps || '0'), date: new Date(data.date) }))
            .filter(({ reps }) => reps > 0);

          if (attempts.length === 0) return null;

          const bestAttempt = attempts.reduce((best, current) => 
            current.reps > best.reps ? current : best
          );

          return {
            name,
            bestAttempt: {
              reps: bestAttempt.reps,
              date: bestAttempt.date
            },
            type: 'reps_only' as const
          };
        }

        default:
          return null;
      }
    })
    .flat()
    .filter((data): data is NonNullable<typeof data> => !!data)
    .sort((a, b) => b.bestAttempt.date.getTime() - a.bestAttempt.date.getTime());
  }, [logs]);

  const getChartSuffix = (type: ChartData['type']): string => {
    switch (type) {
      case 'weight':
        return settings.useMetric ? 'kg' : 'lb';
      case 'reps':
        return ' reps';
      case 'time':
        return '';  // Remove suffix for time since we format it
      default:
        return '';
    }
  };

  const formatDistance = useCallback((meters: string): string => {
    const distance = parseFloat(meters);
    if (settings.useMetric) {
      return `${distance}m`;
    } else {
      // Convert meters to miles (1 mile = 1609.34 meters)
      const miles = distance / 1609.34;
      return `${miles.toFixed(2)}mi`;
    }
  }, [settings.useMetric]);

  const Content = () => {
    if (isLoading) return null;

    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <ScrollView 
          style={styles.scrollView} 
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="automatic"
        >
          <View style={styles.header}>
            <ThemedText style={styles.title}>Progress Insights</ThemedText>
            <View style={[styles.searchContainer, { backgroundColor: colors.cardBackground }]}>
              <Ionicons 
                name="search" 
                size={20} 
                color={colors.text} 
                style={styles.searchIcon}
              />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder="Search workouts..."
                placeholderTextColor={colors.text + '80'}
                defaultValue={searchRef.current}
                onChangeText={(text) => {
                  searchRef.current = text;
                }}
                onSubmitEditing={() => {
                  setSearchQuery(searchRef.current);
                  handleSearch(searchRef.current);
                }}
              />
              {searchQuery !== '' && (
                  <TouchableOpacity 
                    onPress={() => {
                      searchRef.current = '';
                      setSearchQuery('');
                      handleSearch('');
                    }}
                    style={styles.clearButton}
                  >
                    <Ionicons 
                      name="close-circle" 
                      size={20} 
                      color={colors.text}
                    />
                  </TouchableOpacity>
                )}
            </View>
          </View>

          {logs.length > 0 ? (
            <>
              <View style={styles.logsContainer}>
                {getPRData()
                  .filter(exercise => exercise.name.toLowerCase().includes(searchQuery.toLowerCase()))
                  .length > 0 ? (
                  <ThemedView style={[styles.card, { backgroundColor: colors.cardBackground }]}>
                    <ThemedText style={styles.cardTitle}>Personal Records</ThemedText>
                    <View style={styles.prGrid}>
                      {getPRData()
                        .filter(exercise => exercise.name.toLowerCase().includes(searchQuery.toLowerCase()))
                        .map((exercise, index) => {
                          return (
                            <React.Fragment key={`${exercise.name}-${exercise.type}-${index}`}>
                              {renderPR(exercise)}
                            </React.Fragment>
                          );
                        })}
                    </View>
                  </ThemedView>
                ) : searchQuery !== '' && (
                  <ThemedView style={[styles.card, { backgroundColor: colors.cardBackground }]}>
                    <View style={styles.noResultsContainer}>
                      <Ionicons 
                        name="search-outline" 
                        size={48} 
                        color={colors.text + '40'}
                        style={styles.noResultsIcon}
                      />
                      <ThemedText style={styles.noResultsTitle}>No records found</ThemedText>
                      <ThemedText style={styles.noResultsText}>
                        No personal records match your search for "{searchQuery}"
                      </ThemedText>
                    </View>
                  </ThemedView>
                )}
              </View>
            </>
          ) : (
            <ThemedText style={styles.noDataText}>No workout data available</ThemedText>
          )}

          {filteredExercises.map((exercise, index) => (
            <ThemedView key={index} style={[styles.card, { backgroundColor: colors.cardBackground}]}>
              <ThemedText style={styles.cardTitle}>{exercise.name} Progress</ThemedText>
              <View style={styles.chartWrapper}>
                <LineChart
                  data={{
                    labels: exercise.dates,
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
                    formatYLabel: (value) => {
                      if (exercise.type === 'time') {
                        console.log('Formatting Y label value:', value);
                        const seconds = Number(value);
                        console.log('Converted to seconds:', seconds);
                        return formatSeconds(seconds);
                      }
                      return value;
                    }
                  }}
                  style={styles.chart}
                  bezier
                  withDots
                  withInnerLines={false}
                  withOuterLines={false}
                  withVerticalLabels
                  withHorizontalLabels
                  withShadow={false}
                  yAxisLabel=""
                  yAxisSuffix={getChartSuffix(exercise.type)}
                />
              </View>
              <ThemedText style={styles.chartLabel}>
                All {exercise.data.length} sessions
              </ThemedText>
            </ThemedView>
          ))}
          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>
    );
  };

  const renderPR = useCallback((pr: PRData) => {
    const currentColors = Colors[colorScheme ?? 'light'] as Colors[ColorScheme];

    switch (pr.type) {
      case 'weight_reps':
        return (
          <View style={[styles.prCard, { backgroundColor: currentColors.primary + '10' }]}>
            <View style={styles.prHeader}>
              <ThemedText style={styles.prExerciseName}>
                {pr.name}
              </ThemedText>
              <View style={[styles.prBadge, { backgroundColor: currentColors.primary }]}>
                <ThemedText style={styles.prLabel}>
                  {pr.bestAttempt.reps} {pr.bestAttempt.reps === 1 ? 'rep' : 'reps'}
                </ThemedText>
              </View>
            </View>
            <ThemedText style={styles.prWeight}>
              {settings.useMetric ? 
                `${pr.bestAttempt.weight}kg` : 
                `${Math.round((pr.bestAttempt.weight || 0) * 2.20462)}lb`}
            </ThemedText>
          </View>
        );

      case 'time_only':
        return (
          <View style={[styles.prCard, { backgroundColor: currentColors.primary + '10' }]}>
            <View style={styles.prHeader}>
              <ThemedText style={styles.prExerciseName}>
                {pr.name}
              </ThemedText>
            </View>
            <ThemedText style={styles.prWeight}>
              {pr.bestAttempt.time}
            </ThemedText>
          </View>
        );

      case 'distance_time':
        return (
          <View style={[styles.prCard, { backgroundColor: currentColors.primary + '10' }]}>
            <View style={styles.prHeader}>
              <ThemedText style={styles.prExerciseName}>
                {pr.name}
              </ThemedText>
              <View style={[styles.prBadge, { backgroundColor: currentColors.primary }]}>
                <ThemedText style={styles.prLabel}>
                  {formatDistance(pr.bestAttempt.distance || '0')}
                </ThemedText>
              </View>
            </View>
            <ThemedText style={styles.prWeight}>
              {pr.bestAttempt.time}
            </ThemedText>
          </View>
        );

      case 'reps_only':
        return (
          <View style={[styles.prCard, { backgroundColor: currentColors.primary + '10' }]}>
            <View style={styles.prHeader}>
              <ThemedText style={styles.prExerciseName}>
                {pr.name}
              </ThemedText>
            </View>
            <ThemedText style={styles.prWeight}>
              {pr.bestAttempt.reps} {pr.bestAttempt.reps === 1 ? 'rep' : 'reps'}
            </ThemedText>
          </View>
        );
    }
  }, [colorScheme, settings, formatDistance]);

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
  bottomSpacer: {
    height: 100,
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
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 8,
  },
  legendText: {
    fontSize: 14,
    opacity: 0.8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    justifyContent: 'center',
    marginTop: 16,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 2,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  searchIcon: {
    marginRight: 8,
    opacity: 0.7,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
  clearButton: {
    padding: 4,
  },
  prGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  prCard: {
    width: '48%',
    padding: 16,
    borderRadius: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  prHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  prExerciseName: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    marginRight: 8,
  },
  prBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  prLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  prWeight: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 2,
  },
  prReps: {
    fontSize: 16,
    opacity: 0.8,
    marginBottom: 4,
  },
  prDate: {
    fontSize: 12,
    opacity: 0.6,
  },
  noResultsContainer: {
    alignItems: 'center',
    padding: 24,
  },
  noResultsIcon: {
    marginBottom: 12,
  },
  noResultsTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  noResultsText: {
    textAlign: 'center',
    opacity: 0.6,
    fontSize: 14,
  },
  prSuggestion: {
    fontSize: 12,
    color: Colors.light.primary,
    marginTop: 8,
    fontStyle: 'italic',
  },
  logsContainer: {
    paddingTop: 20,
  },
}); 