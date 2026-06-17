import { PartialType } from "@nestjs/mapped-types";
import { CreateReminderDto } from "./create-reminder.dto.js";

export class UpdateReminderDto extends PartialType(CreateReminderDto) {}
