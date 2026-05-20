import { IsString } from "class-validator";

export class SetContentDto {
  @IsString()
  content!: string;
}
