import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Capacitor mobile packaging configuration", () => {
  it("points native projects at the production web bundle and retains stable app identity", () => {
    const configPath = path.resolve(import.meta.dirname, "../capacitor.config.ts");
    const gradlePath = path.resolve(import.meta.dirname, "../android/app/build.gradle");
    const androidGitignorePath = path.resolve(import.meta.dirname, "../android/.gitignore");
    const iosInfoPath = path.resolve(import.meta.dirname, "../ios/App/App/Info.plist");
    const packagePath = path.resolve(import.meta.dirname, "../package.json");
    const lockfilePath = path.resolve(import.meta.dirname, "../pnpm-lock.yaml");
    const iosIconPath = path.resolve(import.meta.dirname, "../ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png");
    const config = fs.readFileSync(configPath, "utf-8");
    const gradle = fs.readFileSync(gradlePath, "utf-8");
    const androidGitignore = fs.readFileSync(androidGitignorePath, "utf-8");
    const iosInfo = fs.readFileSync(iosInfoPath, "utf-8");
    const packageJson = fs.readFileSync(packagePath, "utf-8");
    const lockfile = fs.readFileSync(lockfilePath, "utf-8");

    expect(config).toContain("appId: 'com.gradconnect.app'");
    expect(config).toContain("appName: 'GradConnect'");
    expect(config).toContain("webDir: 'dist/public'");
    expect(config).toContain("androidScheme: 'https'");
    expect(gradle).toContain("keystore.properties");
    expect(gradle).toContain("releaseSigningConfigured");
    expect(androidGitignore).toContain("keystore.properties");
    expect(androidGitignore).toContain("*.jks");
    expect(iosInfo).toContain("<string>GradConnect</string>");
    expect(iosInfo).toContain("NSCameraUsageDescription");
    expect(iosInfo).toContain("NSPhotoLibraryUsageDescription");
    expect(packageJson).toContain('"@capacitor/ios"');
    expect(packageJson).toContain('"mobile:sync:ios"');
    expect(packageJson).toContain('"mobile:icons"');
    expect(lockfile).toContain("'@capacitor/ios':");
    expect(lockfile).toContain("specifier: ^8.5.0");
    expect(fs.statSync(iosIconPath).size).toBeGreaterThan(10_000);
  });
});
