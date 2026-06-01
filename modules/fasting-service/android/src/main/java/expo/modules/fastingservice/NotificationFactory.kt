package expo.modules.fastingservice

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Builds the ongoing fasting notification with the native chronometer.
 *
 * - Before the goal: counts DOWN to the goal (`when = goal`, countDown = true).
 * - At/after the goal: counts UP total elapsed (`when = start`, countDown = false).
 *
 * The phase is chosen purely from the current time, so re-posting at any moment
 * (flip, foreground update, sticky restart, boot) always renders correctly.
 */
object NotificationFactory {
  private const val CHANNEL_ID = "fasting_ongoing"
  private const val CHANNEL_NAME = "Active Fast"

  fun ensureChannel(context: Context) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      if (nm.getNotificationChannel(CHANNEL_ID) == null) {
        val channel = NotificationChannel(
          CHANNEL_ID,
          CHANNEL_NAME,
          NotificationManager.IMPORTANCE_LOW
        ).apply {
          description = "Shows your in-progress fast with a live timer."
          setSound(null, null)
          enableVibration(false)
          setShowBadge(false)
          lockscreenVisibility = Notification.VISIBILITY_PUBLIC
        }
        nm.createNotificationChannel(channel)
      }
    }
  }

  fun build(context: Context, startMillis: Long, goalMillis: Long, planName: String): Notification {
    val beforeGoal = System.currentTimeMillis() < goalMillis
    val name = if (planName.isNotEmpty()) planName else "Fasting"

    val title: String
    val text: String
    if (beforeGoal) {
      title = name
      text = "Goal at " + formatTime(goalMillis)
    } else {
      title = "Goal reached — overtime"
      text = name
    }

    val builder = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(R.drawable.ic_stat_fasting)
      .setContentTitle(title)
      .setContentText(text)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setShowWhen(true)
      .setUsesChronometer(true)
      .setCategory(NotificationCompat.CATEGORY_STOPWATCH)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)

    launchIntent(context)?.let { builder.setContentIntent(it) }

    if (beforeGoal) {
      builder.setWhen(goalMillis)
      builder.setChronometerCountDown(true)
    } else {
      builder.setWhen(startMillis)
      builder.setChronometerCountDown(false)
    }

    return builder.build()
  }

  private fun launchIntent(context: Context): PendingIntent? {
    val intent = context.packageManager.getLaunchIntentForPackage(context.packageName)
      ?: return null
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    } else {
      PendingIntent.FLAG_UPDATE_CURRENT
    }
    return PendingIntent.getActivity(context, 0, intent, flags)
  }

  private fun formatTime(millis: Long): String {
    return SimpleDateFormat("h:mm a", Locale.getDefault()).format(Date(millis))
  }
}
