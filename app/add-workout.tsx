import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity, TextInput, Switch, Platform, Modal, FlatList, KeyboardAvoidingView, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '../components/ThemedText';
import { ThemedView } from '../components/ThemedView';
import Colors from '../constants/Colors';
import { useColorScheme } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Exercise, WOD, addExercise, addWOD, updateWOD, updateExercise } from '../app/utils/db';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { Ionicons } from '@expo/vector-icons';

const WORKOUT_TYPES = [
  'AMRAP',
  'EMOM',
  'For Time',
  'Chipper',
  'TABATA',
  'RFT',
  'Death by',
  'AFAP',
  'Other'
];

export default function AddWorkoutScreen() {
  const params = useLocalSearchParams();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [isWOD, setIsWOD] = useState(params.workoutType === 'wod');
  
  // Common fields
  const [name, setName] = useState(params.name as string || '');
  const [selectedDate, setSelectedDate] = useState(params.date ? new Date(params.date as string) : new Date());
  const [isDatePickerVisible, setDatePickerVisible] = useState(false);
  const [notes, setNotes] = useState(params.notes as string || '');

  // Exercise fields
  const [weight, setWeight] = useState(params.weight as string || '');
  const [reps, setReps] = useState(params.reps as string || '');

  // WOD fields
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [isTypePickerVisible, setTypePickerVisible] = useState(false);
  const [customType, setCustomType] = useState('');
  const [description, setDescription] = useState(params.description as string || '');
  const [result, setResult] = useState(params.result as string || '');

  const scrollViewRef = useRef<ScrollView>(null);

  const [focusedField, setFocusedField] = useState<string | null>(null);

  const handleFocus = (field: string) => setFocusedField(field);
  const handleBlur = () => setFocusedField(null);

  useEffect(() => {
    if (params.editMode === 'true' && params.workoutType === 'wod' && params.type) {
      // Handle WOD type parsing
      const types = (params.type as string).split(' + ');
      const standardTypes = types.filter(t => WORKOUT_TYPES.includes(t));
      const customTypes = types.filter(t => !WORKOUT_TYPES.includes(t));
      
      if (standardTypes.length > 0) {
        setSelectedTypes(standardTypes);
      }
      
      if (customTypes.length > 0) {
        if (!selectedTypes.includes('Other')) {
          setSelectedTypes(prev => [...prev, 'Other']);
        }
        setCustomType(customTypes.join(' + '));
      }
    }
  }, []); // Run only once on mount

  // Update title based on edit mode
  const screenTitle = params.editMode === 'true' ? 'Edit Workout' : 'Add Workout';

  const showDatePicker = () => {
    setDatePickerVisible(true);
  };

  const hideDatePicker = () => {
    setDatePickerVisible(false);
  };

  const handleConfirm = (date: Date) => {
    setSelectedDate(date);
    hideDatePicker();
  };

  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0].split('-').reverse().join('/');
  };

  const toggleWorkoutType = (type: string) => {
    setSelectedTypes(prev => {
      if (prev.includes(type)) {
        return prev.filter(t => t !== type);
      } else {
        return [...prev, type];
      }
    });
  };

  const getDisplayType = () => {
    if (selectedTypes.length === 0) return '';
    const types = selectedTypes.filter(t => t !== 'Other');
    if (selectedTypes.includes('Other')) {
      types.push(customType);
    }
    return types.filter(Boolean).join(' + ');
  };

  const handleSubmit = async () => {
    try {
      const workoutData = {
        ...(params.workoutId ? { id: Number(params.workoutId) } : {}),
        name,
        date: selectedDate.toISOString().split('T')[0],
        notes,
      };

      if (isWOD) {
        const wodData = {
          ...workoutData,
          type: 'wod' as const,
          description,
          result,
        };
        if (params.editMode === 'true' && 'id' in wodData) {
          await updateWOD(wodData);
        } else {
          await addWOD(wodData);
        }
      } else {
        const exerciseData = {
          ...workoutData,
          type: 'exercise' as const,
          weight,
          reps,
        };
        if (params.editMode === 'true' && 'id' in exerciseData) {
          await updateExercise(exerciseData);
        } else {
          await addExercise(exerciseData);
        }
      }
      router.back();
    } catch (error) {
      console.error('Error saving workout:', error);
    }
  };

  const renderDateInput = () => {
    if (Platform.OS === 'web') {
      return (
        <input
          type="date"
          value={selectedDate.toISOString().split('T')[0]}
          onChange={(e) => setSelectedDate(new Date(e.target.value))}
          style={{
            fontSize: 16,
            padding: 12,
            borderRadius: 8,
            border: '1px solid rgba(0,0,0,0.1)',
            backgroundColor: 'transparent',
            color: colors.text,
            width: '100%',
            marginTop: 8,
            outline: 'none',
          }}
        />
      );
    }

    return (
      <>
        <TouchableOpacity
          onPress={showDatePicker}
          style={[styles.input, styles.dateInput]}
        >
          <ThemedText style={styles.dateText}>{formatDate(selectedDate)}</ThemedText>
          <Ionicons name="calendar-outline" size={24} color={colors.text} />
        </TouchableOpacity>
        <DateTimePickerModal
          isVisible={isDatePickerVisible}
          mode="date"
          onConfirm={handleConfirm}
          onCancel={hideDatePicker}
          maximumDate={new Date()}
          date={selectedDate}
        />
      </>
    );
  };

  const renderTypeInput = () => {
    return (
      <>
        <TouchableOpacity
          onPress={() => setTypePickerVisible(true)}
          style={[styles.input, styles.typeInput]}
        >
          <ThemedText style={[styles.typeText, !getDisplayType() && styles.placeholder]}>
            {getDisplayType() || 'Select workout type(s)'}
          </ThemedText>
          <Ionicons name="chevron-down" size={24} color={colors.text} />
        </TouchableOpacity>

        <Modal
          visible={isTypePickerVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setTypePickerVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <ThemedView style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <ThemedText style={styles.modalTitle}>Select Workout Types</ThemedText>
                <TouchableOpacity onPress={() => setTypePickerVisible(false)}>
                  <ThemedText style={[styles.modalDone, { color: colors.primary }]}>Done</ThemedText>
                </TouchableOpacity>
              </View>

              <FlatList
                data={WORKOUT_TYPES}
                keyExtractor={(item) => item}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.typeOption}
                    onPress={() => toggleWorkoutType(item)}
                  >
                    <View style={styles.typeRow}>
                      <ThemedText style={styles.typeOptionText}>{item}</ThemedText>
                      {selectedTypes.includes(item) && (
                        <Ionicons name="checkmark" size={24} color={colors.primary} />
                      )}
                    </View>
                    {item === 'Other' && selectedTypes.includes('Other') && (
                      <TextInput
                        style={[styles.input, { marginTop: 8 }]}
                        value={customType}
                        onChangeText={setCustomType}
                        placeholder="Enter custom type"
                        placeholderTextColor={colors.tabIconDefault}
                      />
                    )}
                  </TouchableOpacity>
                )}
              />
            </ThemedView>
          </View>
        </Modal>
      </>
    );
  };

  const handleInputFocus = (y: number) => {
    scrollViewRef.current?.scrollTo({
      y: y,
      animated: true
    });
  };

  return (
    <KeyboardAvoidingView
      behavior="padding"
      style={{ flex: 1 }}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
          <ScrollView 
            style={styles.scrollView} 
            showsVerticalScrollIndicator={false}
            contentInsetAdjustmentBehavior="automatic"
          >
            <View style={styles.header}>
              <TouchableOpacity onPress={() => router.back()}>
                <ThemedText style={styles.cancelButton}>Cancel</ThemedText>
              </TouchableOpacity>
              <ThemedText style={styles.title}>{screenTitle}</ThemedText>
              <TouchableOpacity onPress={handleSubmit}>
                <ThemedText style={[styles.saveButton, { color: colors.primary }]}>Save</ThemedText>
              </TouchableOpacity>
            </View>

            <ThemedView style={styles.form}>
              <View style={styles.formRow}>
                <ThemedText style={styles.label}>Workout Type</ThemedText>
                <View style={styles.typeSwitch}>
                  <ThemedText>Exercise</ThemedText>
                  <Switch
                    value={isWOD}
                    onValueChange={setIsWOD}
                    trackColor={{ false: colors.secondary, true: colors.primary }}
                    ios_backgroundColor={colors.secondary}
                  />
                  <ThemedText>WOD</ThemedText>
                </View>
              </View>

              <View style={styles.formRow}>
                <ThemedText style={styles.label}>Name</ThemedText>
                <TextInput
                  style={[styles.input, { color: colors.text }, focusedField === 'name' && styles.focusedInput]}
                  value={name}
                  onChangeText={setName}
                  placeholder="Workout name"
                  placeholderTextColor={colors.tabIconDefault}
                  onFocus={() => { handleFocus('name'); handleInputFocus(100); }}
                  onBlur={handleBlur}
                />
              </View>

              <View style={styles.formRow}>
                <ThemedText style={styles.label}>Date</ThemedText>
                {renderDateInput()}
              </View>

              {isWOD ? (
                <>
                  <View style={styles.formRow}>
                    <ThemedText style={styles.label}>Type</ThemedText>
                    {renderTypeInput()}
                  </View>

                  <View style={styles.formRow}>
                    <ThemedText style={styles.label}>Description</ThemedText>
                    <TextInput
                      style={[styles.input, styles.textArea, { color: colors.text }, focusedField === 'description' && styles.focusedInput]}
                      value={description}
                      onChangeText={setDescription}
                      placeholder="Workout description"
                      placeholderTextColor={colors.tabIconDefault}
                      multiline
                      numberOfLines={4}
                      onFocus={() => { handleFocus('description'); handleInputFocus(300); }}
                      onBlur={handleBlur}
                    />
                  </View>

                  <View style={styles.formRow}>
                    <ThemedText style={styles.label}>Result</ThemedText>
                    <TextInput
                      style={[styles.input, { color: colors.text }, focusedField === 'result' && styles.focusedInput]}
                      value={result}
                      onChangeText={setResult}
                      placeholder="Time/Rounds/Score"
                      placeholderTextColor={colors.tabIconDefault}
                      onFocus={() => { handleFocus('result'); handleInputFocus(400); }}
                      onBlur={handleBlur}
                    />
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.formRow}>
                    <ThemedText style={styles.label}>Weight</ThemedText>
                    <TextInput
                      style={[styles.input, { color: colors.text }, focusedField === 'weight' && styles.focusedInput]}
                      value={weight}
                      onChangeText={setWeight}
                      placeholder="Weight (e.g., 70kg)"
                      placeholderTextColor={colors.tabIconDefault}
                      keyboardType="numeric"
                      onFocus={() => { handleFocus('weight'); handleInputFocus(300); }}
                      onBlur={handleBlur}
                    />
                  </View>

                  <View style={styles.formRow}>
                    <ThemedText style={styles.label}>Reps</ThemedText>
                    <TextInput
                      style={[styles.input, { color: colors.text }, focusedField === 'reps' && styles.focusedInput]}
                      value={reps}
                      onChangeText={setReps}
                      placeholder="Reps (e.g., 3x10)"
                      placeholderTextColor={colors.tabIconDefault}
                      onFocus={() => { handleFocus('reps'); handleInputFocus(400); }}
                      onBlur={handleBlur}
                    />
                  </View>
                </>
              )}

              <View style={styles.formRow}>
                <ThemedText style={styles.label}>Notes</ThemedText>
                <TextInput
                  style={[styles.input, styles.textArea, { color: colors.text }, focusedField === 'notes' && styles.focusedInput]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Additional notes"
                  placeholderTextColor={colors.tabIconDefault}
                  multiline
                  numberOfLines={4}
                  onFocus={() => { handleFocus('notes'); handleInputFocus(500); }}
                  onBlur={handleBlur}
                />
              </View>
            </ThemedView>
          </ScrollView>
        </SafeAreaView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  cancelButton: {
    fontSize: 17,
  },
  saveButton: {
    fontSize: 17,
    fontWeight: '600',
  },
  form: {
    margin: 20,
    padding: 20,
    borderRadius: 12,
  },
  formRow: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    fontWeight: '500',
  },
  typeSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  dateInput: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  typeInput: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  typeText: {
    fontSize: 16,
  },
  placeholder: {
    color: '#999',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalDone: {
    fontSize: 17,
    fontWeight: '600',
  },
  typeOption: {
    paddingVertical: 12,
  },
  typeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  typeOptionText: {
    fontSize: 16,
  },
  focusedInput: {
    borderColor: Colors.light.primary,
    borderWidth: 2,
  },
}); 