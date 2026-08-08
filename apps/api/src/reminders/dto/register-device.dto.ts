import { IsEnum, IsOptional, IsString } from "class-validator";

export class RegisterDeviceDto {
  // "ios" is retained only so an old client cannot 400; nothing ships for it.
  @IsEnum(["ios", "android", "desktop", "web"])
  platform!: "ios" | "android" | "desktop" | "web";

  @IsString()
  @IsOptional()
  name?: string;
}
