import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { TrashService } from "./trash.service.js";

const TICK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Once a day, permanently purges trash items past the 30-day retention window.
 *
 * Plain interval via lifecycle hooks rather than @nestjs/schedule, same reasoning as
 * ReminderSchedulerService: state lives in Postgres (deletedAt), so this survives
 * restarts with no extra infrastructure, and a daily cadence doesn't need a real
 * cron dependency for one job.
 */
@Injectable()
export class TrashPurgeSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TrashPurgeSchedulerService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(private readonly trash: TrashService) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.tick(), TICK_INTERVAL_MS);
    // Don't keep the event loop alive solely for the scheduler.
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Purge everything past the retention window. Guarded so ticks never overlap. */
  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const { notes, canvases, folders } = await this.trash.purgeExpired(RETENTION_MS);
      const total = notes + canvases + folders;
      if (total > 0) {
        this.logger.log(
          `Purged ${total} expired trash item(s) (${notes} notes, ${canvases} canvases, ${folders} folders)`,
        );
      }
    } catch (err) {
      this.logger.error(`Trash purge tick failed: ${(err as Error).message}`);
    } finally {
      this.running = false;
    }
  }
}
