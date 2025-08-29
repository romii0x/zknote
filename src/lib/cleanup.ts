import { executeQuery } from './db';

export interface CleanupMetrics {
  success: boolean;
  deletedCount: number;
  error?: string;
}

// removes expired notes from database
export async function deleteExpiredNotes(): Promise<CleanupMetrics> {
  try {
    // delete expired notes
    const result = await executeQuery(
      'DELETE FROM notes WHERE expires_at <= NOW()'
    );
    
    const deletedCount = result.rowCount ?? 0;
    
    if (deletedCount > 0) {
      console.log(`Cleaned up ${deletedCount} expired notes`);
    }
    
    return {
      success: true,
      deletedCount
    };
  } catch (error) {
    console.error('Cleanup job failed:', error);
    return {
      success: false,
      deletedCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
} 