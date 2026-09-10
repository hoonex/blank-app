package io.github.hoonex.flow.notification

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import io.github.hoonex.flow.MainActivity
import io.github.hoonex.flow.data.UniversityStore
import io.github.hoonex.flow.data.classMoment
import java.time.LocalDateTime
import java.time.ZoneId

object UniversityNotification {
    private const val CHANNEL = "flow_university_live"
    private const val ID = 2101

    fun refresh(context: Context) {
        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return
        createChannel(context)
        val store = UniversityStore(context)
        val university = store.loadUniversity()
        val timetable = store.loadTimetable()
        val now = LocalDateTime.now()
        val moment = timetable?.classMoment(now)

        val title: String
        val text: String
        val targetMinutes: Int?
        when {
            moment?.current != null -> {
                val item = moment.current
                title = "수업 중 · ${item.subject.name}"
                text = listOf(item.time.end + " 종료", item.time.place.ifBlank { item.subject.place }, item.subject.professor)
                    .filter { it.isNotBlank() }.joinToString(" · ")
                targetMinutes = item.time.endMinutes
            }
            moment?.next != null -> {
                val item = moment.next
                title = "다음 수업 · ${item.subject.name}"
                text = listOf(item.time.start + " 시작", item.time.place.ifBlank { item.subject.place }, item.subject.professor)
                    .filter { it.isNotBlank() }.joinToString(" · ")
                targetMinutes = item.time.startMinutes
            }
            timetable != null -> {
                title = "오늘 수업 없음"
                text = university?.name ?: "Flow University"
                targetMinutes = null
            }
            else -> {
                title = "Flow University"
                text = "시간표를 가져오면 다음 수업을 고정 알림으로 보여줍니다."
                targetMinutes = null
            }
        }

        val tapIntent = PendingIntent.getActivity(
            context,
            0,
            Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val builder = NotificationCompat.Builder(context, CHANNEL)
            .setSmallIcon(android.R.drawable.ic_menu_my_calendar)
            .setContentTitle(title)
            .setContentText(text)
            .setContentIntent(tapIntent)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setCategory(NotificationCompat.CATEGORY_STATUS)
            .setPriority(NotificationCompat.PRIORITY_LOW)

        targetMinutes?.let { minute ->
            val target = now.toLocalDate().atStartOfDay().plusMinutes(minute.toLong())
            val millis = target.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
            if (millis > System.currentTimeMillis()) {
                builder.setWhen(millis).setUsesChronometer(true).setChronometerCountDown(true).setShowWhen(true)
            }
        }

        NotificationManagerCompat.from(context).notify(ID, builder.build())
    }

    fun disable(context: Context) {
        NotificationManagerCompat.from(context).cancel(ID)
    }

    private fun createChannel(context: Context) {
        val manager = context.getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(
            NotificationChannel(CHANNEL, "University live", NotificationManager.IMPORTANCE_LOW).apply {
                description = "현재 수업과 다음 수업을 계속 표시합니다."
                setSound(null, null)
                enableVibration(false)
            }
        )
    }
}
