import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity, TextInput, Switch, Platform, Modal, FlatList, KeyboardAvoidingView, Keyboard, TouchableWithoutFeedback, NativeSyntheticEvent, NativeScrollEvent, Animated, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '../components/ThemedText';
import { ThemedView } from '../components/ThemedView';
import Colors from '../constants/Colors';
import { useColorScheme } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Exercise, WOD, addExercise, addWOD, updateWOD, updateExercise } from '../app/utils/db';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { Ionicons } from '@expo/vector-icons';
import { FloatingLabelInput } from '@/components/FloatingLabelInput';

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

const MEASUREMENT_TYPES = [
  { id: 'weight_reps', label: 'Weight & Reps' },
  { id: 'time_only', label: 'Time Only' },
  { id: 'distance_time', label: 'Distance & Time' },
  { id: 'reps_only', label: 'Reps Only' }
] as const;

type MeasurementType = 'weight_reps' | 'time_only' | 'distance_time' | 'reps_only';

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
  const [measurementType, setMeasurementType] = useState<Exercise['measurement_type']>(
    params.measurement_type as Exercise['measurement_type'] || 'weight_reps'
  );
  const [weight, setWeight] = useState(params.weight as string || '');
  const [reps, setReps] = useState(params.reps as string || '');
  const [distance, setDistance] = useState(params.distance as string || '');
  const [time, setTime] = useState(params.time as string || '');

  // WOD fields
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [isTypePickerVisible, setTypePickerVisible] = useState(false);
  const [customType, setCustomType] = useState('');
  const [description, setDescription] = useState(params.description as string || '');
  const [result, setResult] = useState(params.result as string || '');

  const [scrollOffset, setScrollOffset] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);

  const [modalAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(0));

  const overlayBackgroundColor = modalAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['transparent', Platform.OS === 'ios' ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.5)'],
  });

  const [focusedField, setFocusedField] = useState<string | null>(null);

  // Add new state for actual modal visibility
  const [modalVisible, setModalVisible] = useState(false);

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

  useEffect(() => {
    if (isTypePickerVisible) {
      setModalVisible(true);
      slideAnim.setValue(0);
      modalAnim.setValue(0);
      Animated.parallel([
        Animated.timing(modalAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: false,
        }),
        Animated.timing(slideAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        })
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(modalAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: false,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        })
      ]).start(() => {
        setTimeout(() => {
          setModalVisible(false);
        }, 50);
      });
    }
  }, [isTypePickerVisible]);

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
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const toggleWorkoutType = (type: string) => {
    if (type === selectedTypes[0]) {
      setSelectedTypes([]);
      if (type === 'Other') {
        setCustomType('');
      }
    } else {
      setSelectedTypes([type]);
      if (type !== 'Other') {
        setCustomType('');
      }
    }
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
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a workout name');
      return;
    }

    // Debug logging
    console.log('Submit params:', {
      id: params.id,
      editMode: params.editMode,
      workoutType: params.workoutType
    });

    if (isWOD) {
      // Handle WOD submission
      const workout: WOD = {
        name,
        type: 'wod',
        date: selectedDate.toISOString(),
        notes: notes || '',
        description: description || '',
        result: result || '',
      };

      try {
        if (params.id) {
          console.log('Updating WOD with ID:', params.id);
          await updateWOD({ ...workout, id: parseInt(params.id as string) });
        } else {
          console.log('Adding new WOD');
          await addWOD(workout);
        }
        router.back();
      } catch (error) {
        console.error('Error saving WOD:', error);
        Alert.alert('Error', 'Failed to save workout');
      }
    } else {
      // Handle Exercise submission
      const exercise: Exercise = {
        name,
        type: 'exercise',
        measurement_type: measurementType,
        weight: weight || undefined,
        reps: reps || undefined,
        time: time ? timeToSeconds(time).toString() : undefined,
        distance: distance || undefined,
        notes: notes || '',
        date: selectedDate.toISOString(),
      };

      try {
        if (params.id) {
          console.log('Updating Exercise with ID:', params.id);
          await updateExercise({ ...exercise, id: parseInt(params.id as string) });
        } else {
          console.log('Adding new Exercise');
          await addExercise(exercise);
        }
        router.back();
      } catch (error) {
        console.error('Error saving exercise:', error);
        Alert.alert('Error', 'Failed to save workout');
      }
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
            padding: 16,
            borderRadius: 8,
            border: 'none',
            backgroundColor: colors.background,
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
          <Ionicons name="calendar-outline" size={20} color={colors.tabIconDefault} />
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
          <ThemedText style={[styles.typeText, getDisplayType() && { color: colors.text }]}>
            {getDisplayType() || 'Select workout type(s)'}
          </ThemedText>
          <Ionicons name="chevron-down" size={20} color={colors.tabIconDefault} />
        </TouchableOpacity>

        <Modal
          visible={modalVisible}
          transparent
          animationType="none"
          onRequestClose={() => setTypePickerVisible(false)}
        >
          <View style={styles.modalContainer}>
            <Animated.View 
              style={[
                styles.modalOverlay,
                { backgroundColor: overlayBackgroundColor }
              ]} 
            />
            <Animated.View 
              style={[
                styles.modalContent,
                { 
                  backgroundColor: colors.background,
                  transform: [{
                    translateY: slideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [600, 0]
                    })
                  }],
                  opacity: slideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 1]
                  })
                }
              ]}
            >
              <View style={styles.modalHeader}>
                <ThemedText style={styles.modalTitle}>Select Workout Type</ThemedText>
                <TouchableOpacity onPress={() => setTypePickerVisible(false)}>
                  <ThemedText style={[styles.modalDone, { color: colors.primary }]}>Done</ThemedText>
                </TouchableOpacity>
              </View>

              <FlatList
                style={styles.typeList}
                data={WORKOUT_TYPES}
                keyExtractor={(item) => item}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.typeOption}
                    onPress={() => toggleWorkoutType(item)}
                  >
                    <View style={styles.typeRow}>
                      <ThemedText style={[
                        styles.typeOptionText,
                        selectedTypes.includes(item) && { color: colors.primary }
                      ]}>
                        {item}
                      </ThemedText>
                      {selectedTypes.includes(item) && (
                        <Ionicons name="checkmark" size={22} color={colors.primary} />
                      )}
                    </View>
                    {item === 'Other' && selectedTypes.includes('Other') && (
                      <FloatingLabelInput
                        label=""
                        style={[styles.input, { marginTop: 8 }]}
                        value={customType}
                        onChangeText={setCustomType}
                        placeholder="Custome Type"
                        placeholderTextColor={colors.tabIconDefault}
                      />
                    )}
                  </TouchableOpacity>
                )}
              />
            </Animated.View>
          </View>
        </Modal>
      </>
    );
  };

  const handleInputFocus = (fieldName: string, scrollPosition: number) => {
    setFocusedField(fieldName);
    scrollViewRef.current?.scrollTo({ y: scrollPosition, animated: true });
  };

  const handleKeyboardDismiss = () => {
    setFocusedField(null); // Remove highlight on keyboard dismiss
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setScrollOffset(event.nativeEvent.contentOffset.y);
  };

  useEffect(() => {
    const keyboardHideListener = Keyboard.addListener('keyboardDidHide', handleKeyboardDismiss);
    return () => {
      keyboardHideListener.remove();
    };
  }, []);

  const renderExerciseFields = () => {
    return (
      <>
        <View style={styles.formRow}>
          <TextInput
            style={[
              styles.input,
              { color: Colors[colorScheme ?? 'light'].text },
              focusedField === 'weight' && styles.focusedInput
            ]}
            placeholder="Weight"
            placeholderTextColor={colors.tabIconDefault}
            value={weight}
            onChangeText={setWeight}
            keyboardType="decimal-pad"
            onFocus={() => handleInputFocus('weight', 100)}
            onBlur={() => setFocusedField(null)}
          />
        </View>

        <View style={styles.formRow}>
          <TextInput
            style={[
              styles.input,
              { color: Colors[colorScheme ?? 'light'].text },
              focusedField === 'reps' && styles.focusedInput
            ]}
            placeholder="Reps"
            placeholderTextColor={colors.tabIconDefault}
            value={reps}
            onChangeText={setReps}
            keyboardType="number-pad"
            onFocus={() => handleInputFocus('reps', 200)}
            onBlur={() => setFocusedField(null)}
          />
        </View>

        <View style={styles.formRow}>
          <TextInput
            style={[
              styles.input,
              { color: Colors[colorScheme ?? 'light'].text },
              focusedField === 'time' && styles.focusedInput
            ]}
            placeholder="Time (mm:ss)"
            placeholderTextColor={colors.tabIconDefault}
            value={time}
            onChangeText={setTime}
            onFocus={() => handleInputFocus('time', 300)}
            onBlur={() => setFocusedField(null)}
          />
        </View>

        <View style={styles.formRow}>
          <TextInput
            style={[
              styles.input,
              { color: Colors[colorScheme ?? 'light'].text },
              focusedField === 'distance' && styles.focusedInput
            ]}
            placeholder="Distance"
            placeholderTextColor={colors.tabIconDefault}
            value={distance}
            onChangeText={setDistance}
            keyboardType="decimal-pad"
            onFocus={() => handleInputFocus('distance', 400)}
            onBlur={() => setFocusedField(null)}
          />
        </View>
      </>
    );
  };

  // Add this helper function
  const determineMeasurementType = (weight: string, reps: string, time: string, distance: string): string => {
    const hasWeight = weight.trim() !== '';
    const hasReps = reps.trim() !== '';
    const hasTime = time.trim() !== '';
    const hasDistance = distance.trim() !== '';

    if (hasWeight && hasReps) return 'weight_reps';
    if (hasTime && hasDistance) return 'distance_time';
    if (hasTime && !hasDistance) return 'time_only';
    if (hasReps && !hasWeight) return 'reps_only';
    return '';
  };

  const timeToSeconds = (time: string): number => {
    if (!time) return 0;
    const [minutes = '0', seconds = '0'] = time.split(':').map(part => part.trim());
    const mins = parseInt(minutes);
    const secs = parseInt(seconds);
    if (isNaN(mins) || isNaN(secs)) return 0;
    console.log('Converting time:', time, 'to seconds:', mins * 60 + secs);
    return mins * 60 + secs;
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
          <ScrollView
            style={styles.scrollView}
            ref={scrollViewRef}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={false}
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

            <ThemedView style={[styles.form, { backgroundColor: colors.background }]}>
              {/* Common Fields */}
              <View style={styles.formRow}>
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
                <FloatingLabelInput
                  label="Workout Name"
                  style={[
                    styles.input,
                    { color: Colors[colorScheme ?? 'light'].text },
                    focusedField === 'name' && styles.focusedInput
                  ]}
                  value={name}
                  onChangeText={setName}
                  placeholderTextColor={colors.tabIconDefault}
                  onFocus={() => handleInputFocus('name', 100)}
                  onBlur={() => setFocusedField(null)}
                />
              </View>

              <View style={styles.formRow}>
                {renderDateInput()}
              </View>

              {isWOD ? (
                <>
                  <View style={styles.formRow}>
                    {renderTypeInput()}
                  </View>

                  <View style={styles.formRow}>
                    <FloatingLabelInput
                      label="Workout Description"
                      style={[
                        styles.input,
                        styles.textArea,
                        { color: Colors[colorScheme ?? 'light'].text },
                        focusedField === 'description' && styles.focusedInput
                      ]}
                      value={description}
                      onChangeText={setDescription}
                      placeholderTextColor={colors.tabIconDefault}
                      multiline
                      textAlignVertical="top"
                      onFocus={() => handleInputFocus('description', 300)}
                      onBlur={() => setFocusedField(null)}
                    />
                  </View>

                  <View style={styles.formRow}>
                    <FloatingLabelInput
                      label="Workout Result"
                      style={[
                        styles.input,
                        { color: Colors[colorScheme ?? 'light'].text },
                        focusedField === 'result' && styles.focusedInput
                      ]}
                      value={result}
                      onChangeText={setResult}
                      placeholderTextColor={colors.tabIconDefault}
                      onFocus={() => handleInputFocus('result', 400)}
                      onBlur={() => setFocusedField(null)}
                    />
                  </View>
                </>
              ) : (
                <>
                  {renderExerciseFields()}
                </>
              )}

              <View style={styles.formRow}>
                <FloatingLabelInput
                  label="Additional Notes"
                  style={[
                    styles.input,
                    styles.textArea,
                    { color: Colors[colorScheme ?? 'light'].text },
                    focusedField === 'notes' && styles.focusedInput
                  ]}
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  numberOfLines={4}
                  onFocus={() => handleInputFocus('notes', 500)}
                  onBlur={() => setFocusedField(null)}
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
    padding: 16,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
  },
  cancelButton: {
    fontSize: 17,
  },
  saveButton: {
    fontSize: 17,
    fontWeight: '600',
  },
  form: {
    paddingTop: 16,
  },
  formRow: {
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  label: {
    fontSize: 15,
    marginBottom: 12,
    fontWeight: '500',
    opacity: 0.8,
    letterSpacing: 0.3,
  },
  typeSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginTop: 12,
    paddingVertical: 8,
  },
  input: {
    fontSize: 17,
    padding: 0,
    paddingVertical: 8,
    borderBottomWidth: Platform.OS === 'ios' ? 0.33 : 0.5,
    borderBottomColor: 'rgba(128,128,128,0.3)',
  },
  dateInput: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  dateText: {
    fontSize: 17,
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: 'top',
    paddingTop: 8,
    borderBottomWidth: Platform.OS === 'ios' ? 0.33 : 0.5,
    borderBottomColor: 'rgba(128,128,128,0.2)',
  },
  typeInput: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  typeText: {
    fontSize: 17,
    color: Colors.light.tabIconDefault,
  },
  modalContainer: {
    flex: 1,
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
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
    paddingBottom: 12,
    borderBottomWidth: Platform.OS === 'ios' ? 0.33 : 0.5,
    borderBottomColor: 'rgba(128,128,128,0.2)',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  modalDone: {
    fontSize: 17,
    fontWeight: '600',
  },
  typeList: {
    flexGrow: 0,
  },
  typeOption: {
    paddingVertical: 14,
    borderBottomWidth: Platform.OS === 'ios' ? 0.33 : 0.5,
    borderBottomColor: 'rgba(128,128,128,0.2)',
  },
  typeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 22,
  },
  typeOptionText: {
    fontSize: 17,
  },
  focusedInput: {
    borderBottomColor: Colors.light.primary,
    borderBottomWidth: Platform.OS === 'ios' ? 0.5 : 1,
  },
  measurementTypeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  measurementTypeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(128,128,128,0.1)',
  },
  measurementTypeText: {
    fontSize: 14,
    fontWeight: '500',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  halfInput: {
    flex: 1,
  },
  errorText: {
    color: 'red',
    marginTop: 8,
    textAlign: 'center',
  },
}); 