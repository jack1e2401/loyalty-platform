import cron from "node-cron";
import { runScheduledTierResetForAllMerchants } from "../modules/loyalty/program/loyalty.tier-reset.js";

/** Schedules annual seasonal rank resets daily at 00:05 Asia/Ho_Chi_Minh time. */
export function startTierResetCron() {
  const task = cron.schedule(
    "5 0 * * *",
    () => {
      void runScheduledTierResetForAllMerchants()
        .then((outcomes) => {
          const ran = outcomes.filter((item) => item.status === "PROCESSED");
          if (ran.length > 0) {
            console.info("Scheduled seasonal tier reset completed:", ran);
          }
        })
        .catch((error: unknown) => {
          console.error("Scheduled seasonal tier reset job failed", error);
        });
    },
    { timezone: "Asia/Ho_Chi_Minh" },
  );
  return task;
}
