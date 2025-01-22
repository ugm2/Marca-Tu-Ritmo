import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

let dbInstance: SQLite.SQLiteDatabase | null = null;

const getDb = async () => {
  if (!dbInstance) {
    console.log('Opening database...');
    try {
      dbInstance = await SQLite.openDatabaseAsync('workouts.db');
      console.log('Database opened successfully');
    } catch (error) {
      console.error('Error opening database:', error);
      throw error;
    }
  }
  return dbInstance;
};

export const backupDatabase = async (): Promise<string> => {
  try {
    console.log('Creating database backup...');
    const db = await getDb();
    if (!db) throw new Error('Database not initialized');

    // Get all data
    const data = await db.getAllAsync('SELECT * FROM workouts');
    
    // Create backup in app documents
    const FileSystem = require('expo-file-system');
    const backupFileName = `workouts_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const backupPath = `${FileSystem.documentDirectory}${backupFileName}`;
    
    await FileSystem.writeAsStringAsync(backupPath, JSON.stringify(data));
    console.log('Backup created successfully at:', backupPath);
    
    return backupPath;
  } catch (error) {
    console.error('Error creating backup:', error);
    throw error;
  }
};

export const restoreFromBackup = async (backupPath: string): Promise<void> => {
  try {
    console.log('Restoring from backup:', backupPath);
    const FileSystem = require('expo-file-system');
    
    // Read backup file
    const backupContent = await FileSystem.readAsStringAsync(backupPath);
    const backupData = JSON.parse(backupContent);
    
    // Reset database to clean state
    await resetDatabase();
    const db = await getDb();
    if (!db) throw new Error('Database not initialized');
    
    // Restore data
    for (const record of backupData) {
      await db.runAsync(
        'INSERT INTO workouts (id, name, date, type, description, result, weight, reps, distance, time, measurement_type, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          record.id,
          record.name,
          record.date,
          record.type,
          record.description || '',
          record.result || '',
          record.weight || '',
          record.reps || '',
          record.distance || '',
          record.time || '',
          record.measurement_type || '',
          record.notes || ''
        ]
      );
    }
    
    console.log('Database restored successfully');
  } catch (error) {
    console.error('Error restoring backup:', error);
    throw error;
  }
};

export const migrateDatabase = async () => {
  let backupPath: string | null = null;
  try {
    // Create backup before migration
    backupPath = await backupDatabase();
    
    const db = await getDb();
    if (!db) throw new Error('Database not initialized');

    // Create table if it doesn't exist
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS workouts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        date TEXT NOT NULL,
        type TEXT NOT NULL,
        description TEXT,
        result TEXT,
        weight TEXT,
        reps TEXT,
        distance TEXT,
        time TEXT,
        measurement_type TEXT,
        notes TEXT
      )
    `);

    // Check if measurement_type column exists
    const tableInfo = await db.execAsync(
      "PRAGMA table_info(workouts)"
    ) as unknown as [{ rows: { _array: Array<{ name: string }> } }] | null;
    
    if (!tableInfo?.[0]?.rows?._array) {
      console.log('Table info not available');
      return;
    }

    const hasColumn = tableInfo[0].rows._array.some((row: { name: string }) => row.name === 'measurement_type');
    if (!hasColumn) {
      console.log('Adding measurement_type column...');
      // Add measurement_type column if it doesn't exist
      await db.execAsync(
        `ALTER TABLE workouts ADD COLUMN measurement_type TEXT`
      );

      // Update existing exercise records with appropriate measurement_type
      await db.execAsync(`
        UPDATE workouts 
        SET measurement_type = CASE
          WHEN weight IS NOT NULL AND reps IS NOT NULL THEN 'weight_reps'
          WHEN time IS NOT NULL AND distance IS NOT NULL THEN 'distance_time'
          WHEN time IS NOT NULL THEN 'time_only'
          WHEN reps IS NOT NULL THEN 'reps_only'
          ELSE 'weight_reps'
        END
        WHERE type = 'exercise'
      `);
    } else {
      console.log('measurement_type column already exists');
    }

    // Validate migration
    const validation = await validateMigration();
    if (!validation.success) {
      throw new Error(`Migration validation failed: ${validation.error}`);
    }

    console.log('Database migration completed and validated successfully');
  } catch (error) {
    console.error('Error during database migration:', error);
    
    // Attempt rollback if we have a backup
    if (backupPath) {
      console.log('Rolling back to backup...');
      await restoreFromBackup(backupPath);
    }
    
    throw error;
  }
};

const validateMigration = async () => {
  try {
    const db = await getDb();
    if (!db) throw new Error('Database not initialized');

    // Check if all required columns exist
    const tableInfo = await db.execAsync("PRAGMA table_info(workouts)") as unknown as [{ rows: { _array: Array<{ name: string }> } }];
    const requiredColumns = ['id', 'name', 'date', 'type', 'measurement_type'];
    
    for (const column of requiredColumns) {
      if (!tableInfo[0].rows._array.some(row => row.name === column)) {
        return { success: false, error: `Required column '${column}' is missing` };
      }
    }

    // Check if all exercise records have a valid measurement_type
    const invalidRecords = await db.getAllAsync(
      "SELECT id FROM workouts WHERE type = 'exercise' AND (measurement_type IS NULL OR measurement_type NOT IN ('weight_reps', 'time_only', 'distance_time', 'reps_only'))"
    );

    if (invalidRecords.length > 0) {
      return { 
        success: false, 
        error: `Found ${invalidRecords.length} exercise records with invalid measurement_type` 
      };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
};

export const initializeDatabase = async () => {
  try {
    const db = await getDb();
    if (!db) throw new Error('Database not initialized');

    // First, check if we need to migrate
    const tableInfo = await db.execAsync(
      "PRAGMA table_info(workouts)"
    ) as unknown as [{ rows: { _array: Array<{ name: string }> } }] | null;
    
    const columns = tableInfo?.[0]?.rows?._array?.map(row => row.name) || [];
    const needsMigration = !columns.includes('measurement_type') || 
                          !columns.includes('distance') || 
                          !columns.includes('time');

    if (needsMigration) {
      console.log('Database needs migration...');
      
      // 1. Backup existing data
      type OldWorkoutRecord = {
        id: number;
        name: string;
        date: string;
        type: 'exercise' | 'wod';
        description?: string;
        result?: string;
        weight?: string;
        reps?: string;
        distance?: string;
        time?: string;
        notes?: string;
      };

      const existingData = await db.getAllAsync<OldWorkoutRecord>('SELECT * FROM workouts');
      console.log(`Backing up ${existingData.length} records`);

      // 2. Drop the existing table
      await db.execAsync('DROP TABLE IF EXISTS workouts');

      // 3. Create the new table with all required columns
      await db.execAsync(`
        CREATE TABLE workouts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          date TEXT NOT NULL,
          type TEXT NOT NULL,
          description TEXT,
          result TEXT,
          weight TEXT,
          reps TEXT,
          distance TEXT,
          time TEXT,
          measurement_type TEXT,
          notes TEXT
        )
      `);

      // 4. Reinsert the data with appropriate measurement_type
      for (const record of existingData) {
        if (record.type === 'exercise') {
          // Determine measurement_type based on existing data
          let measurement_type = 'reps_only'; // default
          if (record.weight && record.weight !== '' && record.reps && record.reps !== '') {
            measurement_type = 'weight_reps';
          } else if (record.time && record.time !== '' && record.distance && record.distance !== '') {
            measurement_type = 'distance_time';
          } else if (record.time && record.time !== '') {
            measurement_type = 'time_only';
          }

          await db.runAsync(
            'INSERT INTO workouts (id, name, date, type, description, result, weight, reps, distance, time, measurement_type, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
              record.id,
              record.name,
              record.date,
              'exercise',
              record.description || '',
              record.result || '',
              record.weight || '',
              record.reps || '',
              record.distance || '',
              record.time || '',
              measurement_type,
              record.notes || ''
            ]
          );
        } else {
          // WOD records
          await db.runAsync(
            'INSERT INTO workouts (id, name, date, type, description, result, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [
              record.id,
              record.name,
              record.date,
              'wod',
              record.description || '',
              record.result || '',
              record.notes || ''
            ]
          );
        }
      }

      console.log('Migration completed successfully');
    } else {
      console.log('Database schema is up to date');
    }

    return db;
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
};

export interface Exercise {
  id?: number;
  type: 'exercise';
  name: string;
  measurement_type: 'weight_reps' | 'time_only' | 'distance_time' | 'reps_only';
  weight?: string;
  reps?: string;
  distance?: string;
  time?: string;
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
      distance?: string;
      time?: string;
      measurement_type?: string;
      notes?: string;
    }>('SELECT * FROM workouts ORDER BY date DESC;');
    
    console.log('Raw database results:', JSON.stringify(result));
    
    return result.map(log => {
      const type = log.type as 'wod' | 'exercise' || (log.description ? 'wod' : 'exercise');
      
      if (type === 'wod') {
        return {
          ...log,
          id: Number(log.id),
          type: 'wod' as const,
          description: log.description || '',
          result: log.result || ''
        };
      } else {
        return {
          ...log,
          id: Number(log.id),
          type: 'exercise' as const,
          measurement_type: (log.measurement_type as Exercise['measurement_type']) || 'weight_reps',
          weight: log.weight || '',
          reps: log.reps || '',
          distance: log.distance || '',
          time: log.time || ''
        };
      }
    });
  } catch (error) {
    console.error('Error in getAllLogs:', error);
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
    
    // Check if record exists and get its current state
    const existing = await db.getAllAsync<{
      id: number;
      name: string;
      date: string;
      type: string;
      measurement_type?: Exercise['measurement_type'];
      weight?: string;
      reps?: string;
      distance?: string;
      time?: string;
      notes?: string;
    }>('SELECT * FROM workouts WHERE id = ?', [exercise.id]);
    
    if (existing.length === 0) {
      throw new Error(`No exercise found with id ${exercise.id}`);
    }

    // Handle measurement type changes and clean up fields
    let finalExercise = { ...exercise };
    const oldRecord = existing[0];

    // Determine the measurement type based on the data if not present
    const currentMeasurementType = oldRecord.measurement_type || (() => {
      if (oldRecord.weight && oldRecord.reps) return 'weight_reps';
      if (oldRecord.time && oldRecord.distance) return 'distance_time';
      if (oldRecord.time) return 'time_only';
      return 'reps_only';
    })();

    // If measurement type is changing, clean up fields
    if (currentMeasurementType !== exercise.measurement_type) {
      console.log(`Measurement type changing from ${currentMeasurementType} to ${exercise.measurement_type}`);
      if (exercise.measurement_type === 'reps_only') {
        finalExercise = {
          ...finalExercise,
          weight: '',
          distance: '',
          time: ''
        };
      } else if (exercise.measurement_type === 'time_only') {
        finalExercise = {
          ...finalExercise,
          weight: '',
          reps: '',
          distance: ''
        };
      } else if (exercise.measurement_type === 'distance_time') {
        finalExercise = {
          ...finalExercise,
          weight: '',
          reps: ''
        };
      } else if (exercise.measurement_type === 'weight_reps') {
        finalExercise = {
          ...finalExercise,
          distance: '',
          time: ''
        };
      }
    }
    
    console.log('Updating Exercise:', finalExercise);
    
    // Update the record
    await db.runAsync(
      `UPDATE workouts 
       SET name = ?, 
           date = ?, 
           type = ?, 
           measurement_type = ?,
           weight = ?,
           reps = ?,
           distance = ?,
           time = ?,
           notes = ?
       WHERE id = ?`,
      [
        finalExercise.name,
        finalExercise.date,
        'exercise',
        finalExercise.measurement_type,
        finalExercise.weight || '',
        finalExercise.reps || '',
        finalExercise.distance || '',
        finalExercise.time || '',
        finalExercise.notes || '',
        String(finalExercise.id)
      ]
    );

    // Verify the update
    const updated = await db.getAllAsync('SELECT * FROM workouts WHERE id = ?', [exercise.id]);
    console.log('Updated record:', JSON.stringify(updated));
    
    if (updated.length === 0) {
      throw new Error('Update verification failed - record not found after update');
    }
    
    console.log('Exercise updated successfully');
  } catch (error) {
    console.error('Error in updateExercise:', error);
    throw error;
  }
};

// Helper function to check if a column exists in a table
const columnExists = async (db: SQLite.SQLiteDatabase, table: string, column: string): Promise<boolean> => {
  try {
    const tableInfo = await db.execAsync(
      `PRAGMA table_info("${table}")`
    ) as unknown as [{ rows: { _array: Array<{ name: string }> } }] | null;
    
    return !!tableInfo?.[0]?.rows?._array?.some((row: { name: string }) => row.name === column);
  } catch (error) {
    console.error('Error checking column existence:', error);
    return false;
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
    
    // Check if measurement_type column exists
    const hasColumn = await columnExists(db, 'workouts', 'measurement_type');
    
    if (!hasColumn) {
      // If column doesn't exist, use the old format
      await db.runAsync(
        'INSERT INTO workouts (name, date, type, weight, reps, distance, time, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [
          exercise.name,
          exercise.date,
          'exercise',
          exercise.weight || '',
          exercise.reps || '',
          exercise.distance || '',
          exercise.time || '',
          exercise.notes || ''
        ]
      );
    } else {
      // If column exists, use the new format
      await db.runAsync(
        'INSERT INTO workouts (name, date, type, measurement_type, weight, reps, distance, time, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          exercise.name,
          exercise.date,
          'exercise',
          exercise.measurement_type,
          exercise.weight || '',
          exercise.reps || '',
          exercise.distance || '',
          exercise.time || '',
          exercise.notes || ''
        ]
      );
    }
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

export const resetDatabase = async () => {
  try {
    console.log('Resetting database...');
    
    // Close existing connection if any
    if (dbInstance) {
      await dbInstance.closeAsync();
      dbInstance = null;
    }
    
    // Delete the database file
    if (Platform.OS !== 'web') {
      const FileSystem = require('expo-file-system');
      const dbPath = `${FileSystem.documentDirectory}SQLite/workouts.db`;
      await FileSystem.deleteAsync(dbPath, { idempotent: true });
    }
    
    // Get a new instance which will create a fresh database
    const db = await getDb();
    if (!db) throw new Error('Database not initialized');
    
    console.log('Database reset successfully');
    return db;
  } catch (error) {
    console.error('Error resetting database:', error);
    throw error;
  }
};

export const debugDatabase = async () => {
  try {
    const db = await getDb();
    if (!db) throw new Error('Database not initialized');

    // Get table structure
    const tableInfo = await db.execAsync("PRAGMA table_info(workouts)");
    console.log('Current table structure:', JSON.stringify(tableInfo, null, 2));

    // Get a sample record
    const sampleRecord = await db.getAllAsync('SELECT * FROM workouts LIMIT 1');
    console.log('Sample record:', JSON.stringify(sampleRecord, null, 2));

    return { tableInfo, sampleRecord };
  } catch (error) {
    console.error('Error in debugDatabase:', error);
    throw error;
  }
};

export default {
  getAllLogs,
  initializeDatabase,
  updateWOD,
  updateExercise,
  addWOD,
  addExercise,
  deleteWOD,
  deleteExercise,
  resetDatabase,
  backupDatabase,
  restoreFromBackup,
  debugDatabase
};