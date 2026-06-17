import { IsEnum, IsOptional, IsString } from "class-validator";

export class RegisterDeviceDto {
  @IsEnum(["ios", "android", "desktop", "web"])
  platform!: "ios" | "android" | "desktop" | "web";

  /** Expo push token for mobile devices; omit for WS-only clients (web/desktop). */
  @IsString()
  @IsOptional()
  pushToken?: string;

  @IsString()
  @IsOptional()
  name?: string;
}
