# Architecture

## Offline-First Design

FastTrack follows an offline-first architecture. All critical data (active sessions, daily stats, streaks) is persisted locally in AsyncStorage and synced to Supabase when connectivity is available. The fasting timer operates entirely from UTC timestamps and the device system clock, ensuring accuracy across app restarts, backgrounding, and reboots.

### Data Flow

```
User Action → Domain Service → AsyncStorage (immediate)
                             → Sync Queue → Supabase (when online)
```

- Local writes are always immediate and never blocked by network state
- The sync queue stores pending changes as `SyncQueueEntry` objects
- Push happens chronologically; pull merges with conflict resolution
- Sync failures are non-blocking — the timer and UI continue unaffected

## Timer Logic

The fasting timer is purely timestamp-based:

1. **Start**: Records `startTime` (now) and `endTime` (now + plan duration) in UTC ISO 8601
2. **Progress**: Computed as `(now - startTime) / (endTime - startTime)`, clamped to [0, 1]
3. **Completion**: Detected when `now >= endTime`
4. **Persistence**: Active session stored at `@fasttrack:activeSession` in AsyncStorage
5. **Recovery**: On app launch/foreground, reads stored session and recalculates from system clock

The timer never uses accumulated counters or stored elapsed values for display. All time calculations derive from the system clock and the stored UTC timestamps.

### Timer Tick Persistence

Every 10 seconds during an active session, the timer stores:
- `lastTimerCheckUtc` — current UTC time
- `lastKnownElapsedMs` — elapsed milliseconds since session start

These values are used exclusively for clock integrity detection, not for timer display.

## Sync Engine

### Queue Management

Changes are enqueued as `SyncQueueEntry` objects with:
- `recordType` (fasting_session, daily_stats, streak, notification_preference, profile)
- `operation` (CREATE or UPDATE)
- `payload` (the full record)
- `retryCount` (incremented on failure)

Duplicate entries for the same record are deduplicated (latest payload wins).

### Session-Aware Conflict Resolution

When local and remote fasting sessions conflict:

| Local | Remote | Resolution |
|-------|--------|-----------|
| Terminal | ACTIVE | Local wins (terminal is irreversible) |
| ACTIVE | Terminal | Remote wins |
| Terminal | Terminal | Latest `updatedAt` wins |
| ACTIVE | ACTIVE | Latest `updatedAt` wins; `startTime` protected (earliest preserved) |

Terminal statuses: COMPLETED, ENDED_EARLY, CANCELLED.

### Token Refresh and Retry

On auth/RLS/JWT rejection:
1. Attempt token refresh once via Supabase Auth
2. Retry the failed write once
3. If still failing, keep in queue and show non-blocking warning

Auth failures never interrupt the active timer.

## Streak Engine

### Qualifying Fast

A session qualifies for streak counting when:
- Status is COMPLETED or ENDED_EARLY (never CANCELLED)
- `durationFasted >= 0.9 * plan.fastingHours * 3600` (90% threshold)

### Streak Computation

- **Streak day**: Calendar day (device local timezone) with ≥1 qualifying fast
- **Current streak**: Consecutive streak days ending today or yesterday (grace period)
- **Grace period**: Streak stays alive through end of current day if yesterday had a qualifying fast
- **No premature increment**: Streak value doesn't increase until today's qualifying fast completes
- **Multiple fasts**: Same-day qualifying fasts count as a single streak day

### Short-Circuit Optimization

Before full recomputation, checks:
1. `cached.sessionCountSnapshot` matches `sessions.length`
2. `cached.updatedAt` matches max `updatedAt` across sessions
3. If any mismatch → full recompute from history

Correctness is prioritized over optimization.

## CLOCK_SUSPECT Behavior

### Detection

A forward clock jump is flagged when:
```
(wallClockDelta) - (expectedElapsedSinceLastCheck) > 10 minutes
```

Where:
- `wallClockDelta = now - lastTimerCheckUtc`
- `expectedElapsedSinceLastCheck = (now - startTime) - lastKnownElapsedMs`

### Behavior When Flagged

- Timer continues from original `startTime`/`endTime` (no auto-complete)
- Warning displayed to user
- Session marked with local-only `CLOCK_SUSPECT` flag in AsyncStorage
- CLOCK_SUSPECT session cannot become a Qualifying_Fast until user confirms the session summary
- Flag is NOT synced to Supabase (local-only)

### Backward Drift

If `lastTimerCheckUtc - now > 60 seconds`:
- Warning displayed
- Timer continues from original timestamps
- No CLOCK_SUSPECT flag (backward drift is less exploitable)

## FREE vs PRO_MOCK Gating

### Subscription Tiers

| Tier | Description | MVP Status |
|------|-------------|-----------|
| `free` | Default, limited features | Active |
| `pro_mock` | Full Pro access via local flag | Active (dev toggle) |
| `pro` | Real billing (unreachable in MVP) | Type exists, not produced |

### Feature Gating

All code paths treat `'pro'` and `'pro_mock'` identically via `hasProAccess(tier)`:
```typescript
function hasProAccess(tier: SubscriptionTier): boolean {
  return tier === 'pro' || tier === 'pro_mock';
}
```

### Pro-Gated Features

- PRO_PLANS (18:6 through 48h)
- CUSTOM_PLANS (user-defined fasting hours)
- EXTENDED_FASTS (plans ≥24h)
- DETAILED_ANALYTICS (Post-MVP)
- STREAK_INSIGHTS (Post-MVP)
- ACHIEVEMENT_BADGES (Post-MVP)

### Downgrade Handling

When switching from PRO_MOCK to FREE:
- If current plan is Pro-only → reverts to first free plan (12:12)
- If current plan is free → no change
- Custom plans → reverts to free plan
