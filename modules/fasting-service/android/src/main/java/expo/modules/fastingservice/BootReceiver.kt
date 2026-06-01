package expo.modules.fastingservice

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.content.ContextCompat

/**
 * Re-establishes the ongoing fasting notification after a device reboot, if a
 * fast was active when the device powered down. Reads the persisted params the
 * service wrote to SharedPreferences (the receiver gets no Intent extras).
 *
 * On Samsung/Huawei this only fires if the user enabled auto-launch / removed
 * the app from sleeping/protected lists — see the in-app OEM guidance.
 */
class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val action = intent.action
    if (action != Intent.ACTION_BOOT_COMPLETED &&
      action != "android.intent.action.QUICKBOOT_POWERON"
    ) {
      return
    }

    val prefs = context.getSharedPreferences(
      FastingForegroundService.PREFS,
      Context.MODE_PRIVATE
    )
    if (!prefs.getBoolean(FastingForegroundService.KEY_ACTIVE, false)) {
      return
    }

    val serviceIntent = Intent(context, FastingForegroundService::class.java).apply {
      action = FastingForegroundService.ACTION_START
      putExtra(
        FastingForegroundService.EXTRA_START,
        prefs.getLong(FastingForegroundService.KEY_START, 0L)
      )
      putExtra(
        FastingForegroundService.EXTRA_GOAL,
        prefs.getLong(FastingForegroundService.KEY_GOAL, 0L)
      )
      putExtra(
        FastingForegroundService.EXTRA_NAME,
        prefs.getString(FastingForegroundService.KEY_NAME, "") ?: ""
      )
    }
    ContextCompat.startForegroundService(context, serviceIntent)
  }
}
