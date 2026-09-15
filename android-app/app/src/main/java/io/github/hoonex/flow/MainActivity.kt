package io.github.hoonex.flow

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import io.github.hoonex.flow.notification.UniversityNotification
import io.github.hoonex.flow.ui.FlowMode
import io.github.hoonex.flow.ui.FlowModeStore
import io.github.hoonex.flow.ui.FlowRoot
import io.github.hoonex.flow.ui.FlowTheme
import io.github.hoonex.flow.update.GitHubUpdateManager
import io.github.hoonex.flow.widget.FlowWidgetGalleryActivity
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    companion object {
        const val ACTION_OPEN_SCHOOL = "io.github.hoonex.flow.OPEN_SCHOOL"
        const val ACTION_OPEN_UNIVERSITY = "io.github.hoonex.flow.OPEN_UNIVERSITY"
        const val ACTION_OPEN_WIDGETS = "io.github.hoonex.flow.OPEN_WIDGETS"
    }

    private val notificationPermission = registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) UniversityNotification.enable(this)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        applyEntryIntent(intent)
        applyEdgeToEdgeAppearance()
        setContent {
            FlowTheme {
                FlowRoot(
                    enablePinnedNotification = ::enablePinnedNotification,
                    disablePinnedNotification = { UniversityNotification.disable(this) },
                    checkUpdate = { lifecycleScope.launch { GitHubUpdateManager.checkAndMaybeInstall(this@MainActivity, silent = false) } }
                )
            }
        }
        lifecycleScope.launch { GitHubUpdateManager.checkAndMaybeInstall(this@MainActivity, silent = true) }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        if (applyEntryIntent(intent) && intent.action != ACTION_OPEN_WIDGETS) recreate()
    }

    override fun onResume() {
        super.onResume()
        UniversityNotification.refresh(this)
        GitHubUpdateManager.resumeStagedInstall(this)
    }

    private fun applyEdgeToEdgeAppearance() {
        val isDark = (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
        val transparent = Color.TRANSPARENT
        enableEdgeToEdge(
            statusBarStyle = if (isDark) {
                SystemBarStyle.dark(transparent)
            } else {
                SystemBarStyle.light(transparent, transparent)
            },
            navigationBarStyle = if (isDark) {
                SystemBarStyle.dark(transparent)
            } else {
                SystemBarStyle.light(transparent, transparent)
            }
        )
    }

    private fun applyEntryIntent(intent: Intent?): Boolean {
        return when (intent?.action) {
            ACTION_OPEN_SCHOOL -> {
                FlowModeStore(this).save(FlowMode.SCHOOL)
                true
            }
            ACTION_OPEN_UNIVERSITY -> {
                FlowModeStore(this).save(FlowMode.UNIVERSITY)
                true
            }
            ACTION_OPEN_WIDGETS -> {
                startActivity(Intent(this, FlowWidgetGalleryActivity::class.java))
                true
            }
            else -> false
        }
    }

    private fun enablePinnedNotification() {
        if (
            Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
        } else {
            UniversityNotification.enable(this)
        }
    }
}
