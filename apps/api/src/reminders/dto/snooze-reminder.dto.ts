import { IsDateString } from "class-validator";

export class SnoozeReminderDto {
  /** ISO timestamp to re-fire the reminder at. */
  @IsDateString()
  until!: string;
}
