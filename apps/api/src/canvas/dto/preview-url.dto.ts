import { IsUrl } from "class-validator";

/**
 * The preview endpoint previously took a raw `@Body("url") url: string` with no validation
 * at all, so anything reaching the fetcher was unvetted.
 */
export class PreviewUrlDto {
  @IsUrl({ protocols: ["http", "https"], require_protocol: true })
  url!: string;
}
