# Performance and Device Testing Notes

## Overview

This document outlines the performance testing approach for FastTrack on mid-range Android devices. These tests require physical devices or equivalent emulators and cannot be fully automated in a CI environment.

## Reference Devices

| Device | RAM | Chipset | Android Version |
|--------|-----|---------|-----------------|
| Samsung Galaxy A14 | 4 GB | Exynos 850 / Helio G80 | Android 13+ |
| Redmi Note 12 | 4 GB | Snapdragon 4 Gen 1 | Android 13+ |

These represent the target mid-range Android user base (3–4 GB RAM class).

---

## Performance Targets

### 28.1: Dashboard Render Time (< 2 seconds)

**What to test:**
- Cold start: Time from app launch to fasting dashboard fully interactive
- Warm start: Time from background resume to dashboard update complete
- Navigation: Time from tab switch to dashboard content visible

**How to test:**
1. Use React Native Performance Monitor (shake device → "Perf Monitor")
2. Use `performance.now()` markers in `useEffect` hooks on the Dashboard screen
3. Use Android Profiler in Android Studio for frame-by-frame analysis
4. Measure with Flipper performance plugin

**Expected results:**
- Cold start to interactive dashboard: < 2000ms
- Warm resume with session restore: < 500ms
- Tab navigation to dashboard: < 300ms

**Potential bottlenecks:**
- AsyncStorage reads on launch (active session, profile, streak, daily stats)
- Streak recomputation from full session history
- Circular timer SVG rendering

**Mitigation strategies:**
- Batch AsyncStorage reads using `multiGet`
- Short-circuit streak recomputation when cache is valid
- Use `React.memo` on expensive components
- Defer non-critical data loads (sync queue size, notification state)

---

### 28.2: Timer Updates at 1-Second Intervals Without Jank

**What to test:**
- Timer countdown updates smoothly every second
- No dropped frames during timer animation
- UI remains responsive while timer is running
- Timer accuracy over extended periods (1+ hours)

**How to test:**
1. Start a fast and observe timer for 5+ minutes
2. Use React Native Performance Monitor to check frame rate (target: 60 FPS)
3. Interact with other UI elements while timer runs (scroll, tap buttons)
4. Check for memory leaks during extended timer operation

**Expected results:**
- Consistent 60 FPS during timer updates
- No visible jank or stuttering in countdown
- Timer accuracy within ±1 second over 1 hour
- Memory usage stable (no growth over time)

**Implementation notes:**
- Timer uses `setInterval` with 1000ms interval
- Progress computed from system clock (not accumulated intervals)
- Timer tick persistence every 10 seconds (not every second) to reduce I/O
- `computeProgress` is a pure function — no side effects per tick

**Potential issues:**
- JavaScript timer drift (mitigated by clock-based computation)
- GC pauses causing frame drops
- AsyncStorage writes blocking the JS thread

---

### 28.3: Lazy-Loading of Learn and Recipe Content

**What to test:**
- Learn section list renders quickly with many articles
- Recipe section list renders quickly with many recipes
- Scrolling through content lists is smooth
- Detail screens load without delay

**How to test:**
1. Navigate to Learn tab and measure time to first content visible
2. Scroll through the full article list — check for jank
3. Navigate to Recipe tab and repeat
4. Open detail screens and measure load time

**Expected results:**
- Content list visible within 200ms of navigation
- Smooth scrolling at 60 FPS through all items
- Detail screen content visible within 100ms of tap
- No blank frames during scroll

**Implementation notes:**
- Content is bundled as static JSON (no network dependency)
- FlatList with `initialNumToRender` and `maxToRenderPerBatch` tuning
- Content loaded synchronously from bundled JSON (fast)
- Images use placeholder thumbnails (no network image loading in MVP)

**Optimization strategies:**
- Use `getItemLayout` for fixed-height items
- Implement `keyExtractor` with stable IDs
- Use `React.memo` for list item components
- Consider `windowSize` prop for memory management on low-RAM devices

---

### 28.4: Background Sync Does Not Cause UI Lag

**What to test:**
- Sync operations (push/pull) don't block the UI thread
- Timer continues smoothly during sync
- User can interact with the app during sync
- Large sync queues don't cause ANR (Application Not Responding)

**How to test:**
1. Queue multiple sync entries (5-10 records)
2. Trigger sync while timer is active
3. Monitor frame rate during sync operation
4. Test with slow network (throttled connection)
5. Test with sync errors and retries

**Expected results:**
- No frame drops during sync push/pull
- Timer updates uninterrupted during sync
- UI interactions (button taps, scrolling) responsive during sync
- No ANR warnings even with large queues

**Implementation notes:**
- Sync operations are `async` and non-blocking
- Sync errors are caught and logged — never thrown to UI
- Token refresh + retry happens in background
- Sync queue is processed sequentially but doesn't block renders

**Critical invariant:**
> Auth/RLS sync failures and notification failures must NEVER interrupt an active fasting timer.

---

## Manual Testing Checklist

### Pre-Release Device Testing

- [ ] Install release build on Samsung Galaxy A14
- [ ] Install release build on Redmi Note 12
- [ ] Cold start time < 2 seconds on both devices
- [ ] Timer runs smoothly for 30+ minutes without jank
- [ ] Navigate between all tabs while timer is active — no frame drops
- [ ] Scroll through Learn articles list — smooth scrolling
- [ ] Scroll through Recipes list — smooth scrolling
- [ ] Start a fast, background the app for 5 minutes, resume — timer correct
- [ ] Start a fast, kill the app, relaunch — session restored correctly
- [ ] Toggle airplane mode during active fast — timer unaffected
- [ ] Trigger sync with 10+ queued items — UI remains responsive
- [ ] Open notification settings, toggle all options — no lag
- [ ] Switch theme (light/dark) — immediate visual update
- [ ] Enter daily stats while timer is active — no interference

### Memory and Battery

- [ ] Monitor memory usage over 1-hour active session — no leaks
- [ ] Check battery drain during 1-hour active session — acceptable
- [ ] Verify no background wake-locks when app is backgrounded
- [ ] Check that notifications fire correctly from background

### Edge Cases

- [ ] Start fast with low storage (< 100MB free) — graceful handling
- [ ] Start fast with low battery (< 10%) — no special issues
- [ ] Rapid tab switching (10+ times quickly) — no crashes
- [ ] Rotate device during active timer — layout correct
- [ ] Split-screen mode with timer active — renders correctly

---

## Automated Performance Monitoring (Future)

For post-MVP, consider integrating:
- **React Native Performance** library for automated frame rate tracking
- **Sentry Performance** for real-user monitoring (RUM)
- **Firebase Performance Monitoring** for startup traces
- **Custom `PerformanceObserver`** for measuring specific operations

## Notes

- All performance targets assume release builds (not debug/development)
- Debug builds have significantly worse performance due to JS debugging overhead
- Hermes engine should be enabled for production builds (default in Expo SDK 49+)
- ProGuard/R8 minification should be enabled for Android release builds
