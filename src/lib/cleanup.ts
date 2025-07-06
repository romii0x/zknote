import { getDb } from './db';

export interface CleanupMetrics {
  success: boolean;
  deletedCount: number;
  error?: string;
}

export async function deleteExpiredNotes(): Promise<CleanupMetrics> {
  try {
    const db = await getDb();
    
    // delete expired notes
    const result = await db.run(
      'DELETE FROM notes WHERE expires_at <= datetime("now")'
    );
    
    const deletedCount = result.changes || 0;
    
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