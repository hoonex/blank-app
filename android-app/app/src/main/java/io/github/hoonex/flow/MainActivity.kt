package io.github.hoonex.flow

import android.Manifest
import android.content.pm.PackageManager
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
import io.github.hoonex.flow.ui.FlowRoot
import io.github.hoonex.flow.ui.FlowTheme
import io.github.hoonex.flow.update.GitHubUpdateManager
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    private val notificationPermission = registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) UniversityNotification.enable(this)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge(statusBarStyle = SystemBarStyle.dark(android.graphics.Color.TRANSPARENT), navigationBarStyle = SystemBarStyle.dark(android.graphics.Color.TRANSPARENT))
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

    override fun onResume() {
        super.onResume()
        UniversityNotification.refresh(this)
        GitHubUpdateManager.resumeStagedInstall(this)
    }

    private fun enablePinnedNotification() {
        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
        } else UniversityNotification.enable(this)
    }
}
