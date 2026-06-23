#!/usr/bin/env node
// Builds the debug APK for the native Android app, installs it on the running
// emulator/device, and launches it. Run with `pnpm run mobile:run`.
//
// Written in Node (not bash) on purpose: on Windows, package-script shells route a
// bare `bash` to WSL, which has neither the Windows env nor the Android SDK. Node is
// spawned as the host platform's node, so it sees ANDROID_HOME/LOCALAPPDATA and the
// Windows SDK directly. Works on Windows, macOS, and Linux.

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

const isWin = process.platform === "win32";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const mobileDir = join(root, "apps", "mobile");
const apk = join(mobileDir, "app", "build", "outputs", "apk", "debug", "app-debug.apk");
const appId = "com.deranjer.nodeira";

function fail(msg) {
  console.error(`error: ${msg}`);
  process.exit(1);
}

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { stdio: "inherit", ...opts });
  if (res.error) fail(`failed to run ${cmd}: ${res.error.message}`);
  if (res.status !== 0) process.exit(res.status ?? 1);
}

// Resolve adb from the SDK (PATH adb isn't assumed present).
function resolveAdb() {
  const exe = isWin ? "adb.exe" : "adb";
  const bases = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    isWin && process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, "Android", "Sdk") : null,
    join(homedir(), "Library", "Android", "sdk"), // macOS
    join(homedir(), "Android", "Sdk"), // Linux
  ].filter(Boolean);
  for (const base of bases) {
    const candidate = join(base, "platform-tools", exe);
    if (existsSync(candidate)) return candidate;
  }
  fail("adb not found. Set ANDROID_HOME or install the Android SDK platform-tools.");
}

const adb = resolveAdb();

// Make sure a device/emulator is actually connected.
const devices = spawnSync(adb, ["devices"], { encoding: "utf8" });
const hasDevice = (devices.stdout || "")
  .split("\n")
  .slice(1)
  .some((line) => /\tdevice\b/.test(line));
if (!hasDevice) {
  fail("no emulator/device detected. Start an emulator first (adb devices).");
}

console.log("Building debug APK...");
// Absolute path: cmd.exe doesn't search the cwd, and .bat needs a shell to launch.
// Pass the whole command as one string (empty args) to avoid DEP0190 under shell:true.
const gradlew = join(mobileDir, isWin ? "gradlew.bat" : "gradlew");
run(`"${gradlew}" assembleDebug`, [], { cwd: mobileDir, shell: true });

console.log("Installing on device...");
run(adb, ["install", "-r", apk]);

console.log(`Launching ${appId}...`);
run(adb, ["shell", "monkey", "-p", appId, "-c", "android.intent.category.LAUNCHER", "1"], {
  stdio: "ignore",
});

console.log("Done.");
