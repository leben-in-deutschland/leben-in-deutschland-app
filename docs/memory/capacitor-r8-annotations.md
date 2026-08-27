---
id: MEM-002
title: Preserve Capacitor Runtime Annotations
date: 2026-08-27
tags: [memory, android, capacitor, r8]
---

# Memory: Preserve Capacitor Runtime Annotations

## Lesson

Minified Android release builds must preserve Capacitor's runtime annotation
classes:

```proguard
-keep class com.getcapacitor.annotation.** { *; }
```

With Capacitor 7.6.8, the bundled consumer rules keep plugin classes but still
allow these annotation types to be renamed. Capacitor permission reflection
can then receive a null `CapacitorPlugin` annotation and crash in
`Bridge.getPermissionStates()`, including during
`LocalNotifications.checkPermissions()`.

## When To Apply

Keep this rule when upgrading Capacitor, changing R8/ProGuard configuration, or
regenerating the Android project. Verify changes with a minified release APK;
a working debug APK does not cover this failure mode.

See [`PLAN-003`](../plans/PLAN-003-capacitor-release-crash.md) for the
reproduction and verification evidence.
