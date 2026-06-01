package expo.modules.fastingservice

import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.core.app.ServiceCompat

/**
 * Foreground service that hosts a single ongoing NotificationCompat notification
 * with the OS-native chronometer. The visible clock ticks once per second
 * rendered by SystemUI — there is NO JS timer and no wakelock for ticking.
 *
 * The fast's correctness never depends on this service: progress is derived from
 * session.startTime in JS. If the OS kills the process, the timer is recomputed
 * and the notification re-posted on next launch/foreground/boot. This service is
 * purely the live, glanceable tile and a best-effort survival layer.
 */
class FastingForegroundService : Service() {

  companion object {
    const val ACTION_START = "expo.modules.fastingservice.action.START"
    const val ACTION_UPDATE = "expo.modules.fastingservice.action.UPDATE"
    const val ACTION_STOP = "expo.modules.fastingservice.action.STOP"

    const val EXTRA_START = "startMillis"
    const val EXTRA_GOAL = "goalMillis"
    const val EXTRA_NAME = "planName"

    const val NOTIFICATION_ID = 4117

    // Persisted so a sticky restart or a post-reboot BootReceiver can rebuild
    // the tile without the original Intent extras.
    const val PREFS = "fasting_fgs"
    const val KEY_ACTIVE = "active"
    const val KEY_START = "startMillis"
    const val KEY_GOAL = "goalMillis"
    const val KEY_NAME = "planName"
  }

  private val handler = Handler(Looper.getMainLooper())
  private var flipRunnable: Runnable? = null

  private var startMillis: Long = 0L
  private var goalMillis: Long = 0L
  private var planName: String = ""

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_STOP) {
      stopEverything()
      return START_NOT_STICKY
    }

    val params = resolveParams(intent)
    if (params == null) {
      // Nothing active to show — never linger as an empty foreground service.
      stopEverything()
      return START_NOT_STICKY
    }

    startMillis = params.first
    goalMillis = params.second
    planName = params.third
    persist()

    NotificationFactory.ensureChannel(this)
    val notification = NotificationFactory.build(this, startMillis, goalMillis, planName)
    val type = if (Build.VERSION.SDK_INT >= 34) {
      ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
    } else {
      0
    }
    ServiceCompat.startForeground(this, NOTIFICATION_ID, notification, type)

    scheduleGoalFlip()

    // START_STICKY: if killed, the OS recreates us with a null Intent; we then
    // rebuild from PREFS (see resolveParams).
    return START_STICKY
  }

  /** Resolves params from the Intent first, then from persisted prefs. */
  private fun resolveParams(intent: Intent?): Triple<Long, Long, String>? {
    if (intent != null && intent.hasExtra(EXTRA_START)) {
      val s = intent.getLongExtra(EXTRA_START, 0L)
      val g = intent.getLongExtra(EXTRA_GOAL, 0L)
      val n = intent.getStringExtra(EXTRA_NAME) ?: ""
      if (s > 0L && g > 0L) return Triple(s, g, n)
    }
    val prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    if (prefs.getBoolean(KEY_ACTIVE, false)) {
      val s = prefs.getLong(KEY_START, 0L)
      val g = prefs.getLong(KEY_GOAL, 0L)
      val n = prefs.getString(KEY_NAME, "") ?: ""
      if (s > 0L && g > 0L) return Triple(s, g, n)
    }
    return null
  }

  private fun persist() {
    getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
      .putBoolean(KEY_ACTIVE, true)
      .putLong(KEY_START, startMillis)
      .putLong(KEY_GOAL, goalMillis)
      .putString(KEY_NAME, planName)
      .apply()
  }

  private fun clearPersisted() {
    getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
      .putBoolean(KEY_ACTIVE, false)
      .apply()
  }

  /**
   * Schedules the single countdown -> count-up flip at the goal instant. No
   * per-second work; one Handler post. If the device is dozing the flip may be
   * late, but the app's update()/recovery calls re-post the correct phase on
   * next foreground, and build() is always phase-correct for the current time.
   */
  private fun scheduleGoalFlip() {
    cancelFlip()
    val delay = goalMillis - System.currentTimeMillis()
    if (delay > 0L) {
      val r = Runnable { repost() }
      flipRunnable = r
      handler.postDelayed(r, delay)
    }
  }

  private fun repost() {
    NotificationFactory.ensureChannel(this)
    val notification = NotificationFactory.build(this, startMillis, goalMillis, planName)
    val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    nm.notify(NOTIFICATION_ID, notification)
  }

  private fun cancelFlip() {
    flipRunnable?.let { handler.removeCallbacks(it) }
    flipRunnable = null
  }

  private fun stopEverything() {
    cancelFlip()
    clearPersisted()
    ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
    stopSelf()
  }

  override fun onDestroy() {
    cancelFlip()
    super.onDestroy()
  }
}
