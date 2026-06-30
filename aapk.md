# Mkulima Agrovet POS — Web to Android APK Conversion

## Overview

The Mkulima Agrovet POS is a React/TypeScript web application that was wrapped into a native Android APK using [Capacitor](https://capacitorjs.com/). There is **no separate mobile codebase** — the APK ships the same `dist/` output that the web app uses, loaded inside an Android WebView managed by Capacitor's bridge.

---

## Architecture

```
src/  (React + TypeScript)
  └─ vite build ──► dist/
                      └─ npx cap sync ──► android/app/src/main/assets/public/
                                              └─ APK (compiled by Gradle)
```

- **Web layer:** React 18 + Vite, compiled to static files in `dist/`
- **Bridge layer:** `@capacitor/core` exposes native device APIs to JavaScript
- **Native layer:** A single Android `MainActivity` (Java) extending Capacitor's `BridgeActivity`, hosting the WebView

---

## Tech Stack

| Layer | Tool / Version |
|-------|---------------|
| Frontend | React 18, TypeScript 5, Vite 5 |
| Mobile bridge | Capacitor 6 (`@capacitor/core`, `@capacitor/android`) |
| Database (offline) | Dexie (IndexedDB) |
| Cloud sync | Supabase |
| Android SDK | `minSdk 22` (Android 5.1) · `compileSdk / targetSdk 34` |
| Build tools | Gradle + Android Gradle Plugin |

---

## Step-by-Step: How the Conversion Was Done

### 1. Install Capacitor

```bash
npm install @capacitor/core @capacitor/cli
```

### 2. Create `capacitor.config.ts`

```ts
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mkulima.agrovetpos',
  appName: 'Mkulima Agrovet POS',
  webDir: 'dist',            // Vite output directory
};

export default config;
```

`webDir: 'dist'` tells Capacitor where to find the compiled web assets.

### 3. Add the Android Platform

```bash
npm install @capacitor/android
npx cap add android
```

This creates the `android/` project — a standard Android Studio project with Capacitor's bridge wired in.

### 4. Add Required Capacitor Plugins

```bash
npm install @capacitor/camera @capacitor/filesystem @capacitor/share
```

These are referenced in `android/capacitor.settings.gradle` and included automatically by `cap sync`.

### 5. Build and Sync

```bash
npm run build        # TypeScript + Vite → dist/
npx cap sync android # copies dist/ → android assets, syncs plugins
```

Run both commands every time the UI changes — the APK will not reflect web changes otherwise.

---

## Android Project Structure

```
android/
├── app/
│   ├── build.gradle              # App-level Gradle config (applicationId, signingConfigs)
│   └── src/main/
│       ├── AndroidManifest.xml   # Permissions, activity declaration
│       ├── assets/public/        # Built web app (dist/ copied here by cap sync)
│       ├── java/com/mkulima/agrovetpos/
│       │   ├── MainActivity.java         # Entry point, registers custom plugins
│       │   └── ThermalPrinterPlugin.java # Custom native plugin for receipt printing
│       └── res/
│           ├── mipmap-*/         # App icons (all densities)
│           ├── drawable-*/       # Splash screen images (portrait + landscape, all densities)
│           └── values/
│               ├── strings.xml   # App name
│               └── styles.xml    # AppTheme (splash, no-action-bar)
├── variables.gradle              # Shared SDK/library version numbers
├── keystore.properties           # Signing config (references .jks file, not committed)
└── capacitor.settings.gradle     # Auto-generated plugin includes
```

---

## Custom Native Plugin: Thermal Printer

A custom Capacitor plugin (`ThermalPrinterPlugin.java`) was written to support receipt printing without relying on `window.print()`. It handles two printer backends:

1. **Built-in Sunmi printer** — binds to the Sunmi AIDL service (`woyou.aidlservice.jiuiv5`) present on Sunmi POS terminals (e.g. V2 Pro). Preferred when available.
2. **External Bluetooth thermal printer** — connects over Bluetooth SPP (serial), sends raw ESC/POS commands.

**JavaScript side** (`src/services/printer.ts`):

```ts
const ThermalPrinter = registerPlugin<ThermalPrinterPlugin>('ThermalPrinter');
```

The plugin is registered in `MainActivity.java`:

```java
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ThermalPrinterPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
```

**Print flow in the app:**
1. Check `Capacitor.isNativePlatform()` — skip native path in browser
2. Query `ThermalPrinter.isSupported()` — prefer built-in Sunmi printer
3. If no built-in printer, connect to a saved Bluetooth address and send ESC/POS
4. Fall back to `window.print()` if neither is available

---

## Android Manifest Permissions

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.BLUETOOTH" android:maxSdkVersion="30" />
<uses-permission android:name="android.permission.BLUETOOTH_ADMIN" android:maxSdkVersion="30" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
```

The `<queries>` block declares the Sunmi printer service package so Android 11+ allows binding to it:

```xml
<queries>
    <package android:name="woyou.aidlservice.jiuiv5" />
</queries>
```

---

## Legacy Browser Support

Older Android WebViews (Android 5–7, Chrome ~50–58) cannot parse ES modules or ES2020 syntax. The Vite config uses `@vitejs/plugin-legacy` to emit a transpiled fallback bundle:

```ts
legacy({
  targets: ['android >= 5', 'chrome >= 50', 'ios >= 10'],
  additionalLegacyPolyfills: ['regenerator-runtime/runtime'],
})
```

This means the APK works on `minSdkVersion 22` (Android 5.1) without runtime errors.

---

## Release Signing

A release keystore (`mkulima-release.jks`) was created and referenced in `android/keystore.properties`:

```
storeFile=mkulima-release.jks
storePassword=...
keyAlias=...
keyPassword=...
```

`build.gradle` reads this file at build time and applies the signing config to the `release` build type. The `.jks` file and `keystore.properties` are kept outside version control.

To build a signed release APK:

```bash
cd android
./gradlew assembleRelease
# Output: android/app/build/outputs/apk/release/app-release.apk
```

---

## PDF Downloads on Android

`window.URL.createObjectURL()` downloads don't work inside a Capacitor WebView. The app uses `@capacitor/filesystem` + `@capacitor/share` to write the PDF to the device's cache directory and then open the system share sheet, which allows saving to Downloads or sharing via other apps.

---

## Splash Screen & Icons

- Icons: placed in all `mipmap-*` density buckets (mdpi → xxxhdpi) in both `ic_launcher.png` and `ic_launcher_round.png` variants, plus an adaptive icon XML for API 26+
- Splash screen: landscape and portrait drawables in all density buckets; the `AppTheme.NoActionBarLaunch` theme (extending `Theme.SplashScreen`) displays it before the WebView loads

---

## Ongoing Workflow

After any UI change to `src/`:

```bash
npm run build
npx cap sync android
```

To open Android Studio for native changes:

```bash
npx cap open android
```

To run directly on a connected device:

```bash
npx cap run android
```
