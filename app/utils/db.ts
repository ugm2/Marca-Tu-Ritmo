import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

let dbInstance: SQLite.SQLiteDatabase | null = null;

const getDb = async () => {
  if (!dbInstance) {
    console.log('Opening database...');
    try {
      // Use openDatabaseAsync for both web and native
      dbInstance = await SQLite.openDatabaseAsync('workouts.db');
      console.log('Database opened successfully');
      
      // Initialize database tables if they don't exist
      const createWorkoutsTable = `
        CREATE TABLE IF NOT EXISTS workouts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          date TEXT NOT NULL,
          type TEXT NOT NULL,
          description TEXT,
          result TEXT,
          weight TEXT,
          reps TEXT,
          notes TEXT
        );
      `;
      
      await dbInstance.execAsync(createWorkoutsTable);
      console.log('Tables initialized successfully');
    } catch (error) {
      console.error('Error opening database:', error);
      throw error;
    }
  }
  return dbInstance;
};

export interface Exercise {
  id?: number;
  type: 'exercise';
  name: string;
  weight?: string;
  reps?: string;
  notes?: string;
  date: string;
}

export interface WOD {
  id?: number;
  type: 'wod';
  name: string;
  description?: string;
  result?: string;
  notes?: string;
  date: string;
}

export type WorkoutLog = Exercise | WOD;

export const getAllLogs = async (): Promise<WorkoutLog[]> => {
  try {
    const db = await getDb();
    if (!db) throw new Error('Database not initialized');
    
    console.log('Fetching all logs...');
    
    // First verify table exists and has records
    const tableCheck = await db.getAllAsync('SELECT name FROM sqlite_master WHERE type="table" AND name="workouts";');
    console.log('Table check:', JSON.stringify(tableCheck));
    
    const countCheck = await db.getAllAsync('SELECT COUNT(*) as count FROM workouts;');
    console.log('Record count:', JSON.stringify(countCheck));
    
    const result = await db.getAllAsync<{
      id: number;
      name: string;
      date: string;
      type?: string;
      description?: string;
      result?: string;
      weight?: string;
      reps?: string;
      notes?: string;
    }>('SELECT * FROM workouts ORDER BY date DESC;');
    
    console.log('Raw database results:', JSON.stringify(result));
    
    return result.map(log => ({
      ...log,
      id: Number(log.id),
      type: log.type as 'wod' | 'exercise' || (log.description ? 'wod' : 'exercise')
    }));
  } catch (error) {
    console.error('Error in getAllLogs:', error);
    throw error;
  }
};

export const initDatabase = async () => {
  try {
    console.log('Initializing database...');
    const db = await getDb();
    
    const createWorkoutsTable = `
      CREATE TABLE IF NOT EXISTS workouts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        date TEXT NOT NULL,
        type TEXT NOT NULL,
        description TEXT,
        result TEXT,
        weight TEXT,
        reps TEXT,
        notes TEXT
      );
    `;

    await db.execAsync(createWorkoutsTable);
    console.log('Tables created successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
};

export const updateWOD = async (wod: WOD): Promise<void> => {
  if (!wod.id) throw new Error('Workout ID is required for update');

  try {
    const db = await getDb();
    if (!db) throw new Error('Database not initialized');
    
    // Check if record exists before update
    const existing = await db.getAllAsync('SELECT * FROM workouts WHERE id = ?', [wod.id]);
    console.log('Existing record before update:', JSON.stringify(existing));
    
    if (existing.length === 0) {
      throw new Error(`No WOD found with id ${wod.id}`);
    }
    
    console.log('Updating WOD:', wod);
    await db.runAsync(
      'UPDATE workouts SET name = ?, date = ?, type = ?, description = ?, result = ?, notes = ? WHERE id = ?',
      [
        wod.name,
        wod.date,
        'wod',
        wod.description || '',
        wod.result || '',
        wod.notes || '',
        wod.id
      ]
    );
    
    // Verify the update
    const updated = await db.getAllAsync('SELECT * FROM workouts WHERE id = ?', [wod.id]);
    console.log('Record after update:', JSON.stringify(updated));
    
    if (updated.length === 0) {
      throw new Error('Update verification failed - record not found after update');
    }
    
    console.log('WOD updated successfully');
  } catch (error) {
    console.error('Error in updateWOD:', error);
    throw error;
  }
};

export const updateExercise = async (exercise: Exercise): Promise<void> => {
  if (!exercise.id) throw new Error('Workout ID is required for update');

  try {
    const db = await getDb();
    if (!db) throw new Error('Database not initialized');
    
    // Check if record exists before update
    const existing = await db.getAllAsync('SELECT * FROM workouts WHERE id = ?', [exercise.id]);
    console.log('Existing record before update:', JSON.stringify(existing));
    
    if (existing.length === 0) {
      throw new Error(`No exercise found with id ${exercise.id}`);
    }
    
    console.log('Updating Exercise:', exercise);
    await db.runAsync(
      'UPDATE workouts SET name = ?, date = ?, type = ?, weight = ?, reps = ?, notes = ? WHERE id = ?',
      [
        exercise.name,
        exercise.date,
        'exercise',
        exercise.weight || '',
        exercise.reps || '',
        exercise.notes || '',
        exercise.id
      ]
    );
    
    // Verify the update
    const updated = await db.getAllAsync('SELECT * FROM workouts WHERE id = ?', [exercise.id]);
    console.log('Record after update:', JSON.stringify(updated));
    
    if (updated.length === 0) {
      throw new Error('Update verification failed - record not found after update');
    }
    
    console.log('Exercise updated successfully');
  } catch (error) {
    console.error('Error in updateExercise:', error);
    throw error;
  }
};

export const addWOD = async (wod: Omit<WOD, 'id'>): Promise<void> => {
  try {
    const db = await getDb();
    if (!db) throw new Error('Database not initialized');
    
    await db.runAsync(
      'INSERT INTO workouts (name, date, type, description, result, notes) VALUES (?, ?, ?, ?, ?, ?)',
      [
        wod.name,
        wod.date,
        'wod',
        wod.description || '',
        wod.result || '',
        wod.notes || ''
      ]
    );
    console.log('WOD added successfully');
  } catch (error) {
    console.error('Error in addWOD:', error);
    throw error;
  }
};

export const addExercise = async (exercise: Omit<Exercise, 'id'>): Promise<void> => {
  try {
    const db = await getDb();
    if (!db) throw new Error('Database not initialized');
    
    await db.runAsync(
      'INSERT INTO workouts (name, date, type, weight, reps, notes) VALUES (?, ?, ?, ?, ?, ?)',
      [
        exercise.name,
        exercise.date,
        'exercise',
        exercise.weight || '',
        exercise.reps || '',
        exercise.notes || ''
      ]
    );
    console.log('Exercise added successfully');
  } catch (error) {
    console.error('Error in addExercise:', error);
    throw error;
  }
};

export const deleteWOD = async (id: number): Promise<void> => {
  try {
    const db = await getDb();
    if (!db) throw new Error('Database not initialized');
    
    // Check if record exists before delete
    const existing = await db.getAllAsync('SELECT * FROM workouts WHERE id = ? AND type = ?', [id, 'wod']);
    console.log('Existing record before delete:', JSON.stringify(existing));
    
    if (existing.length === 0) {
      throw new Error(`No WOD found with id ${id}`);
    }
    
    await db.runAsync('DELETE FROM workouts WHERE id = ? AND type = ?', [id, 'wod']);
    console.log('WOD deleted successfully');
  } catch (error) {
    console.error('Error in deleteWOD:', error);
    throw error;
  }
};

export const deleteExercise = async (id: number): Promise<void> => {
  try {
    const db = await getDb();
    if (!db) throw new Error('Database not initialized');
    
    // Check if record exists before delete
    const existing = await db.getAllAsync('SELECT * FROM workouts WHERE id = ? AND type = ?', [id, 'exercise']);
    console.log('Existing record before delete:', JSON.stringify(existing));
    
    if (existing.length === 0) {
      throw new Error(`No exercise found with id ${id}`);
    }
    
    await db.runAsync('DELETE FROM workouts WHERE id = ? AND type = ?', [id, 'exercise']);
    console.log('Exercise deleted successfully');
  } catch (error) {
    console.error('Error in deleteExercise:', error);
    throw error;
  }
}; 