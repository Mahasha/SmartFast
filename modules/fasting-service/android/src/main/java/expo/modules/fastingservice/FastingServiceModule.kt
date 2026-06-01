package expo.modules.fastingservice

import android.content.Context
import android.content.Intent
import androidx.core.content.ContextCompat
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * JS bridge for the fasting foreground service.
 *
 * Exposes three synchronous functions to TypeScript (via src/native/FastingService.ts):
 *  - start(startTimeMillis, goalTimeMillis, planName)
 *  - update(startTimeMillis, goalTimeMillis, planName)
 *  - stop()
 *
 * JS numbers arrive as Double; epoch-millis are integral and exact below 2^53,
 * so toLong() is lossless here.
 */
class FastingServiceModule : Module() {
  private val context: Context
    get() = appContext.reactContext?.applicationContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("FastingService")

    Function("start") { startTimeMillis: Double, goalTimeMillis: Double, planName: String ->
      sendCommand(FastingForegroundService.ACTION_START, startTimeMillis, goalTimeMillis, planName)
    }

    Function("update") { startTimeMillis: Double, goalTimeMillis: Double, planName: String ->
      sendCommand(FastingForegroundService.ACTION_UPDATE, startTimeMillis, goalTimeMillis, planName)
    }

    Function("stop") {
      // Plain startService (not startForegroundService): stop is always invoked
      // while the app is foregrounded, and the service stops itself immediately
      // without promoting to foreground.
      val intent = Intent(context, FastingForegroundService::class.java).apply {
        action = FastingForegroundService.ACTION_STOP
      }
      context.startService(intent)
    }
  }

  private fun sendCommand(action: String, start: Double, goal: Double, name: String) {
    val intent = Intent(context, FastingForegroundService::class.java).apply {
      this.action = action
      putExtra(FastingForegroundService.EXTRA_START, start.toLong())
      putExtra(FastingForegroundService.EXTRA_GOAL, goal.toLong())
      putExtra(FastingForegroundService.EXTRA_NAME, name)
    }
    ContextCompat.startForegroundService(context, intent)
  }
}
