-- FastTrack Initial Schema Migration
-- Creates all tables, indexes, RLS policies, and seeds predefined fasting plans.
-- Requirements: 26.1, 26.2, 26.3, 26.4, 26.5, 26.6

-- ─── Profiles ────────────────────────────────────────────────────────────────

CREATE TABLE profiles (
  "userId"              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  "displayName"         TEXT NOT NULL DEFAULT '',
  email                 TEXT NOT NULL DEFAULT '',
  "selectedPlanId"      TEXT NOT NULL DEFAULT 'plan-16-8',
  "unitPreference"      TEXT NOT NULL DEFAULT 'metric' CHECK ("unitPreference" IN ('metric', 'imperial')),
  "themePreference"     TEXT NOT NULL DEFAULT 'system' CHECK ("themePreference" IN ('light', 'dark', 'system')),
  "onboardingCompleted" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt"           TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Fasting Plans ───────────────────────────────────────────────────────────

CREATE TABLE fasting_plans (
  "planId"            TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  "fastingHours"      NUMERIC NOT NULL,
  "eatingHours"       NUMERIC NOT NULL,
  description         TEXT NOT NULL DEFAULT '',
  "isPro"             BOOLEAN NOT NULL DEFAULT FALSE,
  "isCustom"          BOOLEAN NOT NULL DEFAULT FALSE,
  "createdByUserId"   UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Fasting Sessions ────────────────────────────────────────────────────────

CREATE TABLE fasting_sessions (
  "sessionId"              UUID PRIMARY KEY,
  "userId"                 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  "planId"                 TEXT NOT NULL,
  "startTime"              TIMESTAMPTZ NOT NULL,
  "endTime"                TIMESTAMPTZ NOT NULL,
  "actualEndTime"          TIMESTAMPTZ,
  status                   TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'COMPLETED', 'ENDED_EARLY', 'CANCELLED')),
  "durationFasted"         INTEGER,
  "timezoneOffsetMinutes"  INTEGER NOT NULL DEFAULT 0,
  "createdAt"              TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Daily Stats ─────────────────────────────────────────────────────────────

CREATE TABLE daily_stats (
  "statsId"                UUID PRIMARY KEY,
  "userId"                 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  "localDate"              DATE NOT NULL,
  "waterIntake"            NUMERIC,
  weight                   NUMERIC,
  calories                 NUMERIC,
  steps                    INTEGER,
  "timezoneOffsetMinutes"  INTEGER NOT NULL DEFAULT 0,
  "createdAt"              TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT daily_stats_user_date_unique UNIQUE ("userId", "localDate")
);

-- ─── Streaks ─────────────────────────────────────────────────────────────────

CREATE TABLE streaks (
  "streakId"               UUID PRIMARY KEY,
  "userId"                 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  "currentStreak"          INTEGER NOT NULL DEFAULT 0,
  "longestStreak"          INTEGER NOT NULL DEFAULT 0,
  "lastStreakDate"         DATE,
  "sessionCountSnapshot"   INTEGER NOT NULL DEFAULT 0,
  "createdAt"              TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Notification Preferences ────────────────────────────────────────────────

CREATE TABLE notification_preferences (
  "prefId"                  UUID PRIMARY KEY,
  "userId"                  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  "fastingMilestones"       BOOLEAN NOT NULL DEFAULT TRUE,
  "waterReminders"          BOOLEAN NOT NULL DEFAULT TRUE,
  "waterReminderInterval"   INTEGER NOT NULL DEFAULT 120,
  "weighInReminder"         BOOLEAN NOT NULL DEFAULT FALSE,
  "weighInReminderTime"     TEXT NOT NULL DEFAULT '08:00',
  "createdAt"               TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"               TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Subscription Status ─────────────────────────────────────────────────────

CREATE TABLE subscription_status (
  "subId"            UUID PRIMARY KEY,
  "userId"           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier               TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'pro_mock')),
  "expiryDate"       TIMESTAMPTZ,
  "trialStartDate"   TIMESTAMPTZ,
  "trialEndDate"     TIMESTAMPTZ,
  provider           TEXT NOT NULL DEFAULT 'local' CHECK (provider IN ('local', 'revenuecat', 'google_play')),
  "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX idx_fasting_sessions_user ON fasting_sessions ("userId");
CREATE INDEX idx_fasting_sessions_status ON fasting_sessions ("userId", status);
CREATE INDEX idx_daily_stats_user ON daily_stats ("userId");
CREATE INDEX idx_streaks_user ON streaks ("userId");
CREATE INDEX idx_notification_preferences_user ON notification_preferences ("userId");
CREATE INDEX idx_subscription_status_user ON subscription_status ("userId");

-- ═══════════════════════════════════════════════════════════════════════════════
-- Row Level Security (RLS) Policies
-- Requirement 26.2: Each user can only read and write their own data.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── Profiles RLS ────────────────────────────────────────────────────────────

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_select ON profiles
  FOR SELECT USING ("userId" = auth.uid());

CREATE POLICY profiles_insert ON profiles
  FOR INSERT WITH CHECK ("userId" = auth.uid());

CREATE POLICY profiles_update ON profiles
  FOR UPDATE USING ("userId" = auth.uid());

CREATE POLICY profiles_delete ON profiles
  FOR DELETE USING ("userId" = auth.uid());

-- ─── Fasting Plans RLS ───────────────────────────────────────────────────────
-- Predefined plans (createdByUserId IS NULL): globally readable by all authenticated users.
-- Custom plans: only visible and editable by their owner.
-- No user can INSERT/UPDATE/DELETE predefined plans.

ALTER TABLE fasting_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY fasting_plans_select ON fasting_plans
  FOR SELECT USING (
    "createdByUserId" IS NULL
    OR "createdByUserId" = auth.uid()
  );

CREATE POLICY fasting_plans_insert ON fasting_plans
  FOR INSERT WITH CHECK (
    "createdByUserId" = auth.uid()
  );

CREATE POLICY fasting_plans_update ON fasting_plans
  FOR UPDATE USING (
    "createdByUserId" = auth.uid()
  );

CREATE POLICY fasting_plans_delete ON fasting_plans
  FOR DELETE USING (
    "createdByUserId" = auth.uid()
  );

-- ─── Fasting Sessions RLS ────────────────────────────────────────────────────

ALTER TABLE fasting_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY fasting_sessions_select ON fasting_sessions
  FOR SELECT USING ("userId" = auth.uid());

CREATE POLICY fasting_sessions_insert ON fasting_sessions
  FOR INSERT WITH CHECK ("userId" = auth.uid());

CREATE POLICY fasting_sessions_update ON fasting_sessions
  FOR UPDATE USING ("userId" = auth.uid());

CREATE POLICY fasting_sessions_delete ON fasting_sessions
  FOR DELETE USING ("userId" = auth.uid());

-- ─── Daily Stats RLS ─────────────────────────────────────────────────────────

ALTER TABLE daily_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY daily_stats_select ON daily_stats
  FOR SELECT USING ("userId" = auth.uid());

CREATE POLICY daily_stats_insert ON daily_stats
  FOR INSERT WITH CHECK ("userId" = auth.uid());

CREATE POLICY daily_stats_update ON daily_stats
  FOR UPDATE USING ("userId" = auth.uid());

CREATE POLICY daily_stats_delete ON daily_stats
  FOR DELETE USING ("userId" = auth.uid());

-- ─── Streaks RLS ─────────────────────────────────────────────────────────────

ALTER TABLE streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY streaks_select ON streaks
  FOR SELECT USING ("userId" = auth.uid());

CREATE POLICY streaks_insert ON streaks
  FOR INSERT WITH CHECK ("userId" = auth.uid());

CREATE POLICY streaks_update ON streaks
  FOR UPDATE USING ("userId" = auth.uid());

CREATE POLICY streaks_delete ON streaks
  FOR DELETE USING ("userId" = auth.uid());

-- ─── Notification Preferences RLS ───────────────────────────────────────────

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY notification_preferences_select ON notification_preferences
  FOR SELECT USING ("userId" = auth.uid());

CREATE POLICY notification_preferences_insert ON notification_preferences
  FOR INSERT WITH CHECK ("userId" = auth.uid());

CREATE POLICY notification_preferences_update ON notification_preferences
  FOR UPDATE USING ("userId" = auth.uid());

CREATE POLICY notification_preferences_delete ON notification_preferences
  FOR DELETE USING ("userId" = auth.uid());

-- ─── Subscription Status RLS ─────────────────────────────────────────────────

ALTER TABLE subscription_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY subscription_status_select ON subscription_status
  FOR SELECT USING ("userId" = auth.uid());

CREATE POLICY subscription_status_insert ON subscription_status
  FOR INSERT WITH CHECK ("userId" = auth.uid());

CREATE POLICY subscription_status_update ON subscription_status
  FOR UPDATE USING ("userId" = auth.uid());

CREATE POLICY subscription_status_delete ON subscription_status
  FOR DELETE USING ("userId" = auth.uid());

-- ═══════════════════════════════════════════════════════════════════════════════
-- Seed Predefined Fasting Plans
-- Free plans: 12:12, 14:10, 16:8
-- Pro plans: 18:6, 20:4, 21:3, 22:2, 23:1, 24h, 36h, 48h
-- All predefined plans have createdByUserId = NULL
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO fasting_plans ("planId", name, "fastingHours", "eatingHours", description, "isPro", "isCustom", "createdByUserId", "createdAt")
VALUES
  ('plan-12-12', '12:12', 12, 12, 'A gentle introduction to intermittent fasting. Ideal for beginners with equal fasting and eating windows.', FALSE, FALSE, NULL, '2024-01-01T00:00:00.000Z'),
  ('plan-14-10', '14:10', 14, 10, 'A moderate fasting schedule that extends the overnight fast slightly. Great for those ready to move beyond 12:12.', FALSE, FALSE, NULL, '2024-01-01T00:00:00.000Z'),
  ('plan-16-8', '16:8', 16, 8, 'The most popular intermittent fasting method. A balanced approach suitable for experienced fasters.', FALSE, FALSE, NULL, '2024-01-01T00:00:00.000Z'),
  ('plan-18-6', '18:6', 18, 6, 'An advanced fasting schedule with a shorter eating window. Suited for those comfortable with longer fasts.', TRUE, FALSE, NULL, '2024-01-01T00:00:00.000Z'),
  ('plan-20-4', '20:4', 20, 4, 'Also known as the Warrior Diet. A challenging schedule with a very short eating window.', TRUE, FALSE, NULL, '2024-01-01T00:00:00.000Z'),
  ('plan-21-3', '21:3', 21, 3, 'A highly restrictive plan for experienced fasters. Requires careful meal planning within the 3-hour window.', TRUE, FALSE, NULL, '2024-01-01T00:00:00.000Z'),
  ('plan-22-2', '22:2', 22, 2, 'Near one-meal-a-day fasting. Only recommended for those with significant fasting experience.', TRUE, FALSE, NULL, '2024-01-01T00:00:00.000Z'),
  ('plan-23-1', '23:1', 23, 1, 'One meal a day (OMAD). An intense fasting protocol with a single daily eating opportunity.', TRUE, FALSE, NULL, '2024-01-01T00:00:00.000Z'),
  ('plan-24h', '24h', 24, 0, 'A full 24-hour extended fast. Suitable for experienced fasters looking to push their limits.', TRUE, FALSE, NULL, '2024-01-01T00:00:00.000Z'),
  ('plan-36h', '36h', 36, 0, 'An extended 36-hour fast spanning overnight into the next day. Requires preparation and experience.', TRUE, FALSE, NULL, '2024-01-01T00:00:00.000Z'),
  ('plan-48h', '48h', 48, 0, 'A two-day extended fast. The longest plan available in MVP. Only for very experienced fasters.', TRUE, FALSE, NULL, '2024-01-01T00:00:00.000Z');
