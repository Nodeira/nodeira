import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { execSync } from "child_process";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const adapter = new PrismaPg({
      connectionString: process.env["DATABASE_URL"],
    });
    super({ adapter });
  }

  async onModuleInit() {
    this.logger.log("Connecting to the database...");
    await this.$connect();

    if (process.env["NODE_ENV"] === "test") {
      this.logger.log("Skipping migrations in test environment.");
    } else {
      this.logger.log("Running database migrations...");
      try {
        execSync("npx prisma migrate deploy", { stdio: "inherit" });
        this.logger.log("Database migrations completed successfully.");
      } catch (error) {
        if (process.env["NODE_ENV"] !== "development") throw error;
        this.logger.warn("Migration failed in development — DB may not be ready yet.");
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
