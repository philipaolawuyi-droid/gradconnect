# GradConnect iPhone App Store and TestFlight Guide

GradConnect now includes a generated Capacitor iPhone project at `ios/App`. Its App Store bundle identifier is **`com.gradconnect.app`**, its display name is **GradConnect**, and it starts at version **1.0 (build 1)**.

The native launcher assets have been replaced with the verified GradConnect Art Deco graduation-cap emblem in black and gold. The same branded artwork has been packaged for the Android launcher-density assets and the iPhone App Icon asset catalog.

> The iPhone project is ready for a **macOS release-build machine**. An iPhone app cannot be archived or uploaded from this Linux environment because Apple requires Xcode for iOS app packaging and code signing.[1]

## What the owner needs

| Requirement | Purpose |
|---|---|
| Apple Developer Program membership | Enables signed builds, TestFlight, and App Store distribution.[1] |
| A Mac with a current version of Xcode | Opens, archives, validates, and uploads the iPhone project.[1] |
| App Store Connect access | Creates the app record, manages TestFlight, and submits the app for review.[2] |
| App privacy details and store screenshots | Required App Store Connect submission metadata. |

## Build and upload on macOS

1. Clone the GradConnect project on the Mac, run `pnpm install`, then run `pnpm mobile:sync:ios`.
2. Open `ios/App/App.xcodeproj` in Xcode.
3. Select the **App** target and set the Apple Developer Team under **Signing & Capabilities**. Keep the bundle identifier as `com.gradconnect.app` unless it has already been reserved by another app.
4. Choose a physical iPhone or a generic iOS device target, then select **Product → Archive**.
5. In Xcode Organizer, validate the archive and distribute it with **TestFlight & App Store**. Xcode uploads the build to App Store Connect.[1]

## Start with TestFlight

Create the GradConnect app record in App Store Connect before the first upload. When the build finishes processing, open the **TestFlight** tab, add internal testers, and then invite external testers or create a public testing link. Apple supports up to 100 internal testers and up to 10,000 external testers; the first external-testing build requires TestFlight review.[3]

Use this beta description:

> **GradConnect** helps SJCCC alumni share memories, find classmates, join events, and celebrate their graduating class. Please test sign-in, profile setup, the feed, directory search, connections, events, and superlatives.

## Submit to the App Store

After the TestFlight review, select the final build in App Store Connect and complete the current submission fields. Use the existing public privacy policy:

```text
https://gradconnect-jwn34xis.manus.space/privacy
```

Use the existing store listing copy and screenshots already kept in the GradConnect project. Ensure every age rating, app privacy, support contact, and review-information field reflects the real school or organization operating the app before submitting it to App Review.

## Updating the iPhone app

Before each upload, increase the Xcode build number and, when appropriate, the marketing version. Re-run `pnpm mobile:sync:ios`, archive again in Xcode, and upload the new build. App Store Connect uses the bundle identifier, version, and build string to associate the upload with GradConnect.[2]

## References

[1] [Apple Developer — Distributing your app for beta testing and releases](https://developer.apple.com/documentation/xcode/distributing-your-app-for-beta-testing-and-releases)

[2] [Apple Developer — Upload builds to App Store Connect](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds/)

[3] [Apple Developer — TestFlight](https://developer.apple.com/testflight/)
