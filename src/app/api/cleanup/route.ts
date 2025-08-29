import { NextResponse } from 'next/server';
import { deleteExpiredNotes } from '@/lib/cleanup';

// cleanup job scheduling
let cleanupInterval: NodeJS.Timeout | null = null;
let recoveryTimeout: NodeJS.Timeout | null = null;

// clears all cleanup timers
function cleanupTimers() {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
  if (recoveryTimeout) {
    clearTimeout(recoveryTimeout);
    recoveryTimeout = null;
  }
}

// starts the background cleanup job
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
      cleanupTimers();
      recoveryTimeout = setTimeout(startCleanupJob, 60000); // try again in 1 minute
    }
  }, 5 * 60 * 1000); // 5 minutes
  
  console.log('Cleanup job started');
}

// start the cleanup job when this module is loaded
startCleanupJob();

// cleanup timers on process exit (may not work in serverless)
process.on('exit', cleanupTimers);
process.on('SIGINT', cleanupTimers);
process.on('SIGTERM', cleanupTimers);

export async function POST() {
  try {
    // manually trigger cleanup job
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