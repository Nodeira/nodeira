import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { NotificationDispatcherService } from "./notification-dispatcher.service.js";
import { RemindersService } from "./reminders.service.js";

const TICK_INTERVAL_MS = 60_000;

/**
 * Scans the DB once a minute for due TIME reminders and dispatches them. Because
 * state lives in PostgreSQL (not in-memory timers), this survives restarts with
 * no extra infrastructure. LOCATION reminders are handled on-device, not here.
 *
 * Uses a plain interval (via lifecycle hooks) rather than @nestjs/schedule to
 * avoid an extra dependency for a single periodic job.
 */
@Injectable()
export class ReminderSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReminderSchedulerService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    private readonly reminders: RemindersService,
    private readonly dispatcher: NotificationDispatcherService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.tick(), TICK_INTERVAL_MS);
    // Don't keep the event loop alive solely for the scheduler.
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Find due reminders and fire them. Guarded so ticks never overlap. */
  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const now = new Date();
      const due = await this.reminders.findDueTimeReminders(now);
      if (due.length === 0) return;

      this.logger.log(`Firing ${due.length} due reminder(s)`);
      for (const reminder of due) {
        try {
          await this.dispatcher.dispatch(reminder);
          await this.reminders.markFired(reminder, now);
        } catch (err) {
          this.logger.error(`Failed to fire reminder ${reminder.id}: ${(err as Error).message}`);
        }
      }
    } catch (err) {
      this.logger.error(`Reminder tick failed: ${(err as Error).message}`);
    } finally {
      this.running = false;
    }
  }
}
