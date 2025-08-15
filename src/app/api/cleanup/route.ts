import { NextResponse } from 'next/server';
import { deleteExpiredNotes } from '@/lib/cleanup';

// cleanup scheduling (need a proper job scheduler in production)
let cleanupInterval: NodeJS.Timeout | null = null;

// start cleanup job if not already running
function startCleanupJob() {
  if (cleanupInterval) {
    return; // already running
  }
  
  // run cleanup every 5 minutes
  cleanupInterval = setInterval(async () => {
    try {
      const metrics = await deleteExpiredNotes();
      if (!metrics.success) {
        console.warn('Cleanup job completed with warnings:', metrics);
      }
    } catch (err) {
      console.error('Cleanup job failed critically:', err);
      
      // attempt to recover by resetting the job
      if (cleanupInterval) {
        clearInterval(cleanupInterval);
        cleanupInterval = null;
        setTimeout(startCleanupJob, 60000); // try again in 1 minute
      }
    }
  }, 5 * 60 * 1000); // 5 minutes
  
  console.log('Cleanup job started');
}

// start the cleanup job when this module is loaded
startCleanupJob();

export async function POST() {
  try {
    // manual cleanup trigger
    const metrics = await deleteExpiredNotes();
    
    return NextResponse.json({
      success: metrics.success,
      deletedCount: metrics.deletedCount,
      error: metrics.error
    });
  } catch (error) {
    console.error('Manual cleanup failed:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 