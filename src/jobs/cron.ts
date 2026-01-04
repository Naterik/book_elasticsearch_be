import cron from "node-cron";
import { processOverdueLoans } from "services/loan.service";

/**
 * Initialize Cron Jobs
 * Scheduled tasks for the application
 */
export const initCronJobs = () => {
  // 1. Overdue Loan Check
  // Schedule: 00:00 (Midnight) every day
  // Timezone: Asia/Ho_Chi_Minh
  cron.schedule(
    "0 0 * * *",
    async () => {
      console.log("⏰ [Cron] Triggered daily overdue loan check...");
      await processOverdueLoans();
    },
    {
      timezone: "Asia/Ho_Chi_Minh",
    }
  );

  console.log(
    "✅ [Cron] Scheduled Job: Daily Overdue Check (00:00 Asia/Ho_Chi_Minh)"
  );
};
