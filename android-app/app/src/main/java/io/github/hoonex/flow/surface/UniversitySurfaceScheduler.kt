package io.github.hoonex.flow.surface

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import androidx.glance.appwidget.updateAll
import io.github.hoonex.flow.data.UniversityStore
import io.github.hoonex.flow.data.nextBoundary
import io.github.hoonex.flow.notification.UniversityNotification
import io.github.hoonex.flow.widget.UniversityWidget
import io.github.hoonex.flow.widget.UniversityWidgetReceiver
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import java.time.LocalDateTime
import java.time.ZoneId

object UniversitySurfaceScheduler {
    private const val REQUEST_CODE = 4102

    fun scheduleNext(context: Context, now: LocalDateTime = LocalDateTime.now()) {
        val appContext = context.applicationContext
        val alarmManager = appContext.getSystemService(AlarmManager::class.java)
        val pendingIntent = refreshIntent(appContext)
        val hasWidget = AppWidgetManager.getInstance(appContext)
            .getAppWidgetIds(ComponentName(appContext, UniversityWidgetReceiver::class.java))
            .isNotEmpty()
        if (!hasWidget && !UniversityNotification.isEnabled(appContext)) {
            alarmManager.cancel(pendingIntent)
            return
        }

        val boundary = UniversityStore(appContext).loadTimetable()?.nextBoundary(now)
        if (boundary == null) {
            alarmManager.cancel(pendingIntent)
            return
        }
        val triggerAt = boundary.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
        alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent)
    }

    private fun refreshIntent(context: Context): PendingIntent = PendingIntent.getBroadcast(
        context,
        REQUEST_CODE,
        Intent(context, UniversitySurfaceRefreshReceiver::class.java),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
}

class UniversitySurfaceRefreshReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val pendingResult = goAsync()
        val appContext = context.applicationContext
        CoroutineScope(SupervisorJob() + Dispatchers.Default).launch {
            try {
                UniversityWidget().updateAll(appContext)
                UniversityNotification.refresh(appContext)
                UniversitySurfaceScheduler.scheduleNext(appContext)
            } finally {
                pendingResult.finish()
            }
        }
    }
}
