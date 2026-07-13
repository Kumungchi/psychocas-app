import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.daily(
  "operational data retention",
  { hourUTC: 2, minuteUTC: 35 },
  internal.retention.runOperationalCleanup,
);

export default crons;
