# Mkulima Agrovet POS

## Web + Mobile (Android/APK) are one codebase

The Android app is a [Capacitor](https://capacitorjs.com/) wrapper around the
same React app in `src/`. It does **not** have its own UI code — the APK is
just `dist/` (the web build) copied into
`android/app/src/main/assets/public`.

**Whenever you make a UI change (components, styles, pages), it applies to
both the web app and the APK automatically via the shared `src/` code.**
However, the Android project ships a *pre-built copy* of `dist/`, so after
any UI change you must rebuild and re-sync so the APK reflects it:

```bash
npm run build        # builds src/ -> dist/
npx cap sync android # copies dist/ -> android/app/src/main/assets/public
```

Do this in the same change as the UI edit — don't leave the Android copy
stale. If a change affects layout/responsiveness, consider how it looks on
both a desktop browser viewport and a phone-sized viewport (the APK runs at
phone widths), since both share the same CSS.
