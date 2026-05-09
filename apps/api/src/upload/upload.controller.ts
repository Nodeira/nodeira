import {
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { join } from "path";
import { randomUUID } from "crypto";
import { writeFile, mkdir } from "fs/promises";

// Maps image magic bytes to [mime, extension]. Order matters: JPEG check must
// come before any format that could share a prefix byte.
const MAGIC: Array<{ bytes: (number | null)[]; mime: string; ext: string }> = [
  { bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], mime: "image/png", ext: ".png" },
  { bytes: [0xff, 0xd8, 0xff], mime: "image/jpeg", ext: ".jpg" },
  { bytes: [0x47, 0x49, 0x46, 0x38, null, 0x61], mime: "image/gif", ext: ".gif" }, // null = 0x37 or 0x39
  {
    bytes: [0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x57, 0x45, 0x42, 0x50],
    mime: "image/webp",
    ext: ".webp",
  },
];

function detectImageType(buf: Buffer): { mime: string; ext: string } | undefined {
  for (const sig of MAGIC) {
    if (buf.length < sig.bytes.length) continue;
    if (sig.bytes.every((b, i) => b === null || buf[i] === b)) return sig;
  }
}

@UseGuards(JwtAuthGuard)
@Controller("upload")
export class UploadController {
  @Post()
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
    }),
  )
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException("No file uploaded");

    const detected = detectImageType(file.buffer);
    if (!detected) throw new BadRequestException("Only image files are allowed");

    const uploadsDir = join(process.cwd(), "uploads");
    await mkdir(uploadsDir, { recursive: true });
    const filename = `${randomUUID()}${detected.ext}`;
    await writeFile(join(uploadsDir, filename), file.buffer);

    return { url: `/uploads/${filename}` };
  }
}
