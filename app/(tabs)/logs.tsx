import React, { useState, useCallback, useEffect, useRef } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity, Platform, TextInput, Modal, Alert, Animated, GestureResponderEvent, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '../../components/ThemedText';
import { ThemedView } from '../../components/ThemedView';
import Colors from '../../constants/Colors';
import { useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Exercise, WOD, getAllLogs, deleteWOD, deleteExercise } from '../../app/utils/db';
import { useFocusEffect, useRouter } from 'expo-router';
import { format, subDays, subMonths } from 'date-fns';
import { useSettings } from '../../contexts/SettingsContext';
import { Portal } from '@gorhom/portal';

type WorkoutLog = (Exercise | WOD) & { type: 'exercise' | 'wod' };
type DateFilter = 'all' | 'week' | 'month' | '3months';
type SortOrder = 'newest' | 'oldest';
type WorkoutTypeFilter = 'all' | 'wod' | 'exercise';

export default function LogsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<WorkoutLog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [selectedLog, setSelectedLog] = useState<WorkoutLog | null>(null);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [workoutTypeFilter, setWorkoutTypeFilter] = useState<WorkoutTypeFilter>('all');
  const [tempWorkoutTypeFilter, setTempWorkoutTypeFilter] = useState<WorkoutTypeFilter>('all');
  const [tempDateFilter, setTempDateFilter] = useState<DateFilter>('all');
  const [tempSortOrder, setTempSortOrder] = useState<SortOrder>('newest');
  const { settings } = useSettings();
  const router = useRouter();
  const slideAnim = React.useRef(new Animated.Value(0)).current;

  const applyFilters = useCallback((logsToFilter: WorkoutLog[]) => {
    let filtered = [...logsToFilter];

    // Apply workout type filter
    if (workoutTypeFilter !== 'all') {
      filtered = filtered.filter(log => log.type === workoutTypeFilter);
    }

    // Apply date filter
    const today = new Date();
    switch (dateFilter) {
      case 'week':
        filtered = filtered.filter(log => {
          const logDate = new Date(log.date);
          return logDate >= subDays(today, 7);
        });
        break;
      case 'month':
        filtered = filtered.filter(log => {
          const logDate = new Date(log.date);
          return logDate >= subMonths(today, 1);
        });
        break;
      case '3months':
        filtered = filtered.filter(log => {
          const logDate = new Date(log.date);
          return logDate >= subMonths(today, 3);
        });
        break;
    }

    // Apply sort order
    filtered.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });

    return filtered;
  }, [dateFilter, workoutTypeFilter, sortOrder]);

  const loadLogs = useCallback(async () => {
    try {
      setIsLoading(true);
      const allLogs = await getAllLogs();
      
      const typedLogs: WorkoutLog[] = allLogs.map(log => {
        const baseLog = {
          id: log.id,
          name: log.name,
          date: log.date,
          notes: log.notes
        };
        
        if (log.type === 'wod') {
          return {
            ...baseLog,
            type: 'wod' as const,
            description: log.description,
            result: log.result
          };
        } else {
          return {
            ...baseLog,
            type: 'exercise' as const,
            weight: log.weight,
            reps: log.reps
          };
        }
      });

      const sortedLogs = typedLogs.sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      setLogs(sortedLogs);
      setFilteredLogs(applyFilters(sortedLogs));
    } catch (error) {
      console.error('Error loading logs:', error);
    } finally {
      setIsLoading(false);
    }
  }, [applyFilters]);

  const handleSearch = useCallback((text: string) => {
    setSearchQuery(text);
    const searchTerm = text.toLowerCase();
    const filtered = logs.filter(log => {
      const name = log.name.toLowerCase();
      const notes = (log.notes || '').toLowerCase();
      
      if (log.type === 'wod') {
        const wodLog = log as WOD;
        const description = wodLog.description?.toLowerCase() || '';
        const result = wodLog.result?.toLowerCase() || '';
        return name.includes(searchTerm) || 
               notes.includes(searchTerm) || 
               description.includes(searchTerm) ||
               result.includes(searchTerm);
      } else {
        const exerciseLog = log as Exercise;
        const weight = exerciseLog.weight?.toString().toLowerCase() || '';
        const reps = exerciseLog.reps?.toString().toLowerCase() || '';
        return name.includes(searchTerm) || 
               notes.includes(searchTerm) ||
               weight.includes(searchTerm) ||
               reps.includes(searchTerm);
      }
    });
    setFilteredLogs(applyFilters(filtered));
  }, [logs, applyFilters]);

  useFocusEffect(
    useCallback(() => {
      loadLogs();
    }, [loadLogs])
  );

  const formatWeight = (weight: number | string | undefined) => {
    if (!weight) return '';
    const numWeight = typeof weight === 'string' ? parseFloat(weight) : weight;
    return settings.useMetric ? `${numWeight}kg` : `${Math.round(numWeight * 2.20462)}lb`;
  };

  const handleEdit = (log: WorkoutLog) => {
    if (!log.id) return;
    
    const params = {
      editMode: 'true',
      workoutId: log.id.toString(),
      workoutType: log.type,
      name: log.name,
      notes: log.notes || '',
      date: log.date,
      ...(log.type === 'wod' 
        ? {
            description: (log as WOD).description || '',
            result: (log as WOD).result || ''
          }
        : {
            weight: (log as Exercise).weight?.toString() || '',
            reps: (log as Exercise).reps?.toString() || ''
          }
      )
    };
    
    router.push({
      pathname: '/add-workout',
      params
    });
  };

  const handleDeletePress = (log: WorkoutLog) => {
    if (!log.id) return;
    setSelectedLog(log);
    setDeleteModalVisible(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedLog?.id) return;

    try {
      const type = selectedLog.type;
      if (type === 'wod') {
        await deleteWOD(selectedLog.id);
      } else if (type === 'exercise') {
        await deleteExercise(selectedLog.id);
      } else {
        throw new Error('Invalid workout type');
      }
      
      setDeleteModalVisible(false);
      setSelectedLog(null);
      await loadLogs(); // Refresh the list
    } catch (error) {
      console.error('Error deleting log:', error);
      Alert.alert('Error', 'Failed to delete workout');
    }
  };

  const WorkoutCard = ({ log }: { log: WorkoutLog }) => {
    const isWOD = log.type === 'wod';
    const formattedDate = format(new Date(log.date), 'MMM d, yyyy');
    const errorColor = colorScheme === 'dark' ? '#ff6b6b' : '#ff4444';

    return (
      <TouchableOpacity 
        onPress={() => handleEdit(log)}
        activeOpacity={0.7}
        style={styles.cardContainer}
      >
        <ThemedView style={[styles.workoutCard, { backgroundColor: colors.cardBackground }]}>
          <View style={styles.workoutHeader}>
            <View style={styles.workoutInfo}>
              <ThemedText style={styles.workoutName}>{log.name}</ThemedText>
              <ThemedText style={styles.workoutDate}>{formattedDate}</ThemedText>
            </View>
            <View style={[styles.workoutType, { backgroundColor: isWOD ? colors.primary : colors.secondary }]}>
              <ThemedText style={styles.workoutTypeText}>
                {isWOD ? 'WOD' : 'Exercise'}
              </ThemedText>
            </View>
          </View>

          <View style={styles.workoutDetails}>
            {isWOD ? (
              <>
                <ThemedText style={styles.workoutDescription}>{(log as WOD).description}</ThemedText>
                {(log as WOD).result && (
                  <ThemedText style={styles.workoutResult}>Result: {(log as WOD).result}</ThemedText>
                )}
              </>
            ) : (
              <View style={styles.exerciseDetails}>
                {(log as Exercise).weight && (
                  <ThemedText style={styles.exerciseDetail}>
                    Weight: {formatWeight((log as Exercise).weight)}
                  </ThemedText>
                )}
                {(log as Exercise).reps && (
                  <ThemedText style={styles.exerciseDetail}>
                    Reps: {(log as Exercise).reps}
                  </ThemedText>
                )}
              </View>
            )}
            {log.notes && (
              <ThemedText style={styles.notes}>Notes: {log.notes}</ThemedText>
            )}
          </View>

          <TouchableOpacity 
            onPress={(e) => {
              e.stopPropagation();
              handleDeletePress(log);
            }}
            style={[styles.cardDeleteButton, { backgroundColor: errorColor + '15' }]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="trash" size={22} color={errorColor} />
          </TouchableOpacity>
        </ThemedView>
      </TouchableOpacity>
    );
  };

  const showFilterPanel = () => {
    setTempWorkoutTypeFilter(workoutTypeFilter);
    setTempDateFilter(dateFilter);
    setTempSortOrder(sortOrder);
    setFilterModalVisible(true);
    Animated.spring(slideAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 65,
      friction: 11
    }).start();
  };

  const closePanel = () => {
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 65,
      friction: 11
    }).start(() => {
      setFilterModalVisible(false);
    });
  };

  const applyFiltersAndClose = () => {
    setWorkoutTypeFilter(tempWorkoutTypeFilter);
    setDateFilter(tempDateFilter);
    setSortOrder(tempSortOrder);
    setFilteredLogs(applyFilters(logs));
    closePanel();
  };

  const handleOverlayPress = () => {
    closePanel();
  };

  const FilterPanel = () => {
    if (!filterModalVisible) return null;

    return (
      <Portal>
        <View style={styles.filterPanelContainer}>
          <Animated.View 
            style={[
              styles.filterPanelOverlay,
              {
                opacity: slideAnim
              }
            ]} 
          >
            <TouchableOpacity 
              style={{ flex: 1 }}
              activeOpacity={1} 
              onPress={handleOverlayPress}
            />
          </Animated.View>
          <Animated.View
            style={[
              styles.filterPanelContent,
              {
                backgroundColor: colors.cardBackground,
                transform: [{
                  translateY: slideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [600, 0]
                  })
                }]
              }
            ]}
          >
            <View style={styles.filterPanelHandle} />
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Filter Workouts</ThemedText>
              <TouchableOpacity onPress={closePanel}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.filterSection}>
              <ThemedText style={styles.filterSectionTitle}>Workout Type</ThemedText>
              <View style={styles.filterOptions}>
                <TouchableOpacity
                  style={[
                    styles.filterOption,
                    tempWorkoutTypeFilter === 'all' && { backgroundColor: colors.primary + '20' }
                  ]}
                  onPress={() => setTempWorkoutTypeFilter('all')}
                >
                  <ThemedText style={[
                    styles.filterOptionText,
                    tempWorkoutTypeFilter === 'all' && { color: colors.primary }
                  ]}>All</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.filterOption,
                    tempWorkoutTypeFilter === 'wod' && { backgroundColor: colors.primary + '20' }
                  ]}
                  onPress={() => setTempWorkoutTypeFilter('wod')}
                >
                  <ThemedText style={[
                    styles.filterOptionText,
                    tempWorkoutTypeFilter === 'wod' && { color: colors.primary }
                  ]}>WODs</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.filterOption,
                    tempWorkoutTypeFilter === 'exercise' && { backgroundColor: colors.primary + '20' }
                  ]}
                  onPress={() => setTempWorkoutTypeFilter('exercise')}
                >
                  <ThemedText style={[
                    styles.filterOptionText,
                    tempWorkoutTypeFilter === 'exercise' && { color: colors.primary }
                  ]}>Exercises</ThemedText>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.filterSection}>
              <ThemedText style={styles.filterSectionTitle}>Date Range</ThemedText>
              <View style={styles.filterOptions}>
                <TouchableOpacity
                  style={[
                    styles.filterOption,
                    tempDateFilter === 'all' && { backgroundColor: colors.primary + '20' }
                  ]}
                  onPress={() => setTempDateFilter('all')}
                >
                  <ThemedText style={[
                    styles.filterOptionText,
                    tempDateFilter === 'all' && { color: colors.primary }
                  ]}>All Time</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.filterOption,
                    tempDateFilter === 'week' && { backgroundColor: colors.primary + '20' }
                  ]}
                  onPress={() => setTempDateFilter('week')}
                >
                  <ThemedText style={[
                    styles.filterOptionText,
                    tempDateFilter === 'week' && { color: colors.primary }
                  ]}>Last Week</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.filterOption,
                    tempDateFilter === 'month' && { backgroundColor: colors.primary + '20' }
                  ]}
                  onPress={() => setTempDateFilter('month')}
                >
                  <ThemedText style={[
                    styles.filterOptionText,
                    tempDateFilter === 'month' && { color: colors.primary }
                  ]}>Last Month</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.filterOption,
                    tempDateFilter === '3months' && { backgroundColor: colors.primary + '20' }
                  ]}
                  onPress={() => setTempDateFilter('3months')}
                >
                  <ThemedText style={[
                    styles.filterOptionText,
                    tempDateFilter === '3months' && { color: colors.primary }
                  ]}>Last 3 Months</ThemedText>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.filterSection}>
              <ThemedText style={styles.filterSectionTitle}>Sort Order</ThemedText>
              <View style={styles.filterOptions}>
                <TouchableOpacity
                  style={[
                    styles.filterOption,
                    tempSortOrder === 'newest' && { backgroundColor: colors.primary + '20' }
                  ]}
                  onPress={() => setTempSortOrder('newest')}
                >
                  <ThemedText style={[
                    styles.filterOptionText,
                    tempSortOrder === 'newest' && { color: colors.primary }
                  ]}>Newest First</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.filterOption,
                    tempSortOrder === 'oldest' && { backgroundColor: colors.primary + '20' }
                  ]}
                  onPress={() => setTempSortOrder('oldest')}
                >
                  <ThemedText style={[
                    styles.filterOptionText,
                    tempSortOrder === 'oldest' && { color: colors.primary }
                  ]}>Oldest First</ThemedText>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.applyButton, { backgroundColor: colors.primary }]}
              onPress={applyFiltersAndClose}
            >
              <ThemedText style={styles.applyButtonText}>Apply Filters</ThemedText>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Portal>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ThemedText>Loading logs...</ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <>
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScrollView 
          style={styles.scrollView} 
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="never"
        >
          <View style={styles.header}>
            <ThemedText style={styles.title}>Workout Logs</ThemedText>
            <View style={styles.searchRow}>
              <View style={[styles.searchContainer, { backgroundColor: colors.cardBackground, flex: 1 }]}>
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
                  value={searchQuery}
                  onChangeText={handleSearch}
                />
                {searchQuery !== '' && (
                  <TouchableOpacity 
                    onPress={() => handleSearch('')}
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
              <TouchableOpacity
                onPress={showFilterPanel}
                style={[styles.filterButton, { height: Platform.OS === 'ios' ? 41 : 45 }]}
              >
                <Ionicons name="filter" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>
          </View>

          {filteredLogs.length > 0 ? (
            <ScrollView 
              style={styles.logsContainer}
              showsVerticalScrollIndicator={false}
            >
              {filteredLogs.map((log, index) => (
                <WorkoutCard key={index} log={log} />
              ))}
            </ScrollView>
          ) : searchQuery !== '' ? (
            <ThemedView style={[styles.card, { backgroundColor: colors.cardBackground }]}>
              <View style={styles.noResultsContainer}>
                <Ionicons 
                  name="search-outline" 
                  size={48} 
                  color={colors.text + '40'}
                  style={styles.noResultsIcon}
                />
                <ThemedText style={styles.noResultsTitle}>No workouts found</ThemedText>
                <ThemedText style={styles.noResultsText}>
                  No workouts match your search for "{searchQuery}"
                </ThemedText>
              </View>
            </ThemedView>
          ) : (
            <ThemedText style={styles.noDataText}>No workout logs available</ThemedText>
          )}
          <View style={styles.bottomSpacer} />
        </ScrollView>

        <Modal
          animationType="fade"
          transparent={true}
          visible={deleteModalVisible}
          onRequestClose={() => setDeleteModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <ThemedView style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}>
              <ThemedText style={styles.modalTitle}>Delete Workout</ThemedText>
              <ThemedText style={styles.modalText}>
                Are you sure you want to delete this workout? This action cannot be undone.
              </ThemedText>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setDeleteModalVisible(false)}
                >
                  <ThemedText style={styles.buttonText}>Cancel</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.confirmDeleteButton]}
                  onPress={handleDeleteConfirm}
                >
                  <ThemedText style={[styles.buttonText, styles.deleteButtonText]}>Delete</ThemedText>
                </TouchableOpacity>
              </View>
            </ThemedView>
          </View>
        </Modal>
      </SafeAreaView>
      <FilterPanel />
    </>
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
  logsContainer: {
    padding: 20,
    gap: 16,
  },
  emptyState: {
    margin: 20,
    padding: 40,
    borderRadius: 16,
    alignItems: 'center',
  },
  emptyStateText: {
    textAlign: 'center',
    opacity: 0.7,
  },
  workoutCard: {
    borderRadius: 16,
    padding: 16,
    paddingBottom: 48,
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
  workoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  workoutInfo: {
    flex: 1,
  },
  workoutName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  workoutDate: {
    fontSize: 14,
    opacity: 0.6,
  },
  workoutType: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginLeft: 12,
  },
  workoutTypeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  workoutDetails: {
    gap: 8,
  },
  workoutDescription: {
    fontSize: 14,
    opacity: 0.8,
  },
  workoutResult: {
    fontSize: 14,
    fontWeight: '500',
  },
  exerciseDetails: {
    flexDirection: 'row',
    gap: 16,
  },
  exerciseDetail: {
    fontSize: 14,
    opacity: 0.8,
  },
  notes: {
    fontSize: 14,
    fontStyle: 'italic',
    opacity: 0.7,
    marginTop: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
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
  workoutActions: {
    flexDirection: 'row',
    gap: 12,
    marginRight: 12,
  },
  actionButton: {
    padding: 4,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    borderRadius: 16,
    marginLeft: 20,
    marginRight: 20,
    padding: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  modalText: {
    textAlign: 'center',
    marginBottom: 24,
    opacity: 0.8,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 16,
    width: '100%',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  confirmDeleteButton: {
    backgroundColor: '#ff4444',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButtonText: {
    color: '#ffffff',
  },
  cardContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  cardDeleteButton: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 68, 68, 0.2)',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  filterButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  filterSection: {
    marginBottom: 24,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  filterOptionText: {
    fontSize: 14,
  },
  applyButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  applyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  filterPanelContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    zIndex: 10000,
    elevation: 10000,
  },
  filterPanelOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    flex: 1,
  },
  filterPanelContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingTop: 12,
    maxHeight: '80%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.25,
        shadowRadius: 5,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  filterPanelHandle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  bottomSpacer: {
    height: 100,
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
  noDataText: {
    textAlign: 'center',
    opacity: 0.7,
    fontSize: 14,
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
}); 