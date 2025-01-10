import React, { useState, useCallback } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity, Platform, TextInput, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '../../components/ThemedText';
import { ThemedView } from '../../components/ThemedView';
import Colors from '../../constants/Colors';
import { useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Exercise, WOD, getAllLogs, deleteWOD, deleteExercise } from '../../app/utils/db';
import { useFocusEffect, useRouter } from 'expo-router';
import { format } from 'date-fns';
import { useSettings } from '../../contexts/SettingsContext';

type WorkoutLog = (Exercise | WOD) & { type: 'exercise' | 'wod' };

export default function LogsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<WorkoutLog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [selectedLog, setSelectedLog] = useState<WorkoutLog | null>(null);
  const { settings } = useSettings();
  const router = useRouter();

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
      setFilteredLogs(sortedLogs);
    } catch (error) {
      console.error('Error loading logs:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

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
    setFilteredLogs(filtered);
  }, [logs]);

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
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <ThemedText style={styles.title}>Workout Logs</ThemedText>
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
        </View>

        {filteredLogs.length === 0 ? (
          <ThemedView style={styles.emptyState}>
            <ThemedText style={styles.emptyStateText}>
              {searchQuery ? 'No workouts found matching your search.' : 'No workouts logged yet. Add your first workout using the + button!'}
            </ThemedText>
          </ThemedView>
        ) : (
          <View style={styles.logsContainer}>
            {filteredLogs.map((log, index) => (
              <WorkoutCard key={index} log={log} />
            ))}
          </View>
        )}
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
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
}); 