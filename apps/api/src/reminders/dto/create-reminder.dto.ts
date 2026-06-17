import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from "class-validator";

export class CreateReminderDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsString()
  @IsOptional()
  body?: string;

  @IsEnum(["NONE", "NOTE", "CANVAS", "CANVAS_NODE"])
  @IsOptional()
  targetType?: "NONE" | "NOTE" | "CANVAS" | "CANVAS_NODE";

  @IsString()
  @IsOptional()
  targetNoteId?: string;

  @IsString()
  @IsOptional()
  targetCanvasId?: string;

  @IsString()
  @IsOptional()
  targetNodeId?: string;

  @IsEnum(["TIME", "LOCATION"])
  triggerType!: "TIME" | "LOCATION";

  // --- TIME trigger ---
  @ValidateIf((o: CreateReminderDto) => o.triggerType === "TIME")
  @IsDateString()
  fireAt?: string;

  @IsString()
  @IsOptional()
  timezone?: string;

  @IsEnum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"])
  @IsOptional()
  recurrence?: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

  // --- LOCATION trigger ---
  @ValidateIf((o: CreateReminderDto) => o.triggerType === "LOCATION")
  @IsLatitude()
  lat?: number;

  @ValidateIf((o: CreateReminderDto) => o.triggerType === "LOCATION")
  @IsLongitude()
  lng?: number;

  @ValidateIf((o: CreateReminderDto) => o.triggerType === "LOCATION")
  @IsInt()
  radiusM?: number;

  @IsString()
  @IsOptional()
  locationName?: string;

  @IsBoolean()
  @IsOptional()
  onLeave?: boolean;
}
