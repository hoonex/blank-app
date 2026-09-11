package io.github.hoonex.flow.update

import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import io.github.hoonex.flow.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest

object GitHubUpdateManager {
    private const val PREFS = "flow-update-v1"
    private const val STAGED = "staged_apk"

    suspend fun checkAndMaybeInstall(activity: Activity, silent: Boolean = true): String = withContext(Dispatchers.IO) {
        if (BuildConfig.UPDATE_SIGNER_SHA256.isBlank()) return@withContext "preview updater disabled"
        runCatching {
            val releases = JSONArray(getText("https://api.github.com/repos/${BuildConfig.GITHUB_REPOSITORY}/releases?per_page=20"))
            var release: JSONObject? = null
            for (i in 0 until releases.length()) {
                val item = releases.getJSONObject(i)
                if (!item.optBoolean("draft") && item.optString("tag_name").startsWith("android-v")) {
                    release = item
                    break
                }
            }
            val chosen = release ?: return@runCatching "no android release"
            val assets = chosen.getJSONArray("assets")
            val manifestAsset = (0 until assets.length()).map { assets.getJSONObject(it) }
                .firstOrNull { it.optString("name") == "flow-android-release.json" }
                ?: return@runCatching "release manifest missing"
            val manifest = JSONObject(getText(manifestAsset.getString("browser_download_url")))
            val remoteCode = manifest.getLong("versionCode")
            if (remoteCode <= BuildConfig.VERSION_CODE.toLong()) return@runCatching "up to date"
            val apkName = manifest.getString("apkName")
            val apkAsset = (0 until assets.length()).map { assets.getJSONObject(it) }
                .firstOrNull { it.optString("name") == apkName }
                ?: error("APK asset missing")
            val expectedSha = manifest.getString("apkSha256").normalizeHex()
            val expectedSigner = manifest.getString("signerSha256").normalizeHex()
            if (expectedSigner != BuildConfig.UPDATE_SIGNER_SHA256.normalizeHex()) error("release signer lineage mismatch")
            val updateDir = File(activity.filesDir, "updates").apply { mkdirs() }
            val apk = File(updateDir, apkName)
            download(apkAsset.getString("browser_download_url"), apk)
            if (sha256(apk) != expectedSha) error("APK checksum mismatch")
            verifyArchive(activity, apk, remoteCode, expectedSigner)
            activity.getSharedPreferences(PREFS, Activity.MODE_PRIVATE).edit().putString(STAGED, apk.absolutePath).apply()
            activity.runOnUiThread { requestInstall(activity, apk) }
            "install requested"
        }.getOrElse {
            if (!silent) it.message ?: "update failed" else "update check failed"
        }
    }

    @Suppress("DEPRECATION")
    fun resumeStagedInstall(activity: Activity) {
        val prefs = activity.getSharedPreferences(PREFS, Activity.MODE_PRIVATE)
        val path = prefs.getString(STAGED, null) ?: return
        val apk = File(path)
        if (!apk.isFile) {
            prefs.edit().remove(STAGED).apply()
            return
        }

        val pm = activity.packageManager
        val info = if (Build.VERSION.SDK_INT >= 33) {
            pm.getPackageArchiveInfo(apk.absolutePath, PackageManager.PackageInfoFlags.of(PackageManager.GET_SIGNING_CERTIFICATES.toLong()))
        } else {
            pm.getPackageArchiveInfo(apk.absolutePath, PackageManager.GET_SIGNING_CERTIFICATES)
        }
        val cert = info?.signingInfo?.apkContentsSigners?.firstOrNull()
        val signer = cert?.let {
            MessageDigest.getInstance("SHA-256").digest(it.toByteArray()).joinToString("") { byte -> "%02X".format(byte) }
        }
        val validNewer = info != null &&
            info.packageName == BuildConfig.APPLICATION_ID &&
            info.longVersionCode > BuildConfig.VERSION_CODE.toLong() &&
            signer?.normalizeHex() == BuildConfig.UPDATE_SIGNER_SHA256.normalizeHex()

        if (!validNewer) {
            prefs.edit().remove(STAGED).apply()
            apk.delete()
            return
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !pm.canRequestPackageInstalls()) return
        requestInstall(activity, apk)
    }

    private fun requestInstall(activity: Activity, apk: File) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !activity.packageManager.canRequestPackageInstalls()) {
            activity.startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${activity.packageName}")))
            return
        }
        val uri = FileProvider.getUriForFile(activity, "${activity.packageName}.files", apk)
        activity.startActivity(
            Intent(Intent.ACTION_VIEW, uri)
                .setDataAndType(uri, "application/vnd.android.package-archive")
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        )
    }

    @Suppress("DEPRECATION")
    private fun verifyArchive(activity: Activity, apk: File, expectedCode: Long, expectedSigner: String) {
        val pm = activity.packageManager
        val info = if (Build.VERSION.SDK_INT >= 33) {
            pm.getPackageArchiveInfo(apk.absolutePath, PackageManager.PackageInfoFlags.of(PackageManager.GET_SIGNING_CERTIFICATES.toLong()))
        } else {
            pm.getPackageArchiveInfo(apk.absolutePath, PackageManager.GET_SIGNING_CERTIFICATES)
        } ?: error("invalid APK")
        if (info.packageName != BuildConfig.APPLICATION_ID) error("package mismatch")
        if (info.longVersionCode != expectedCode || info.longVersionCode <= BuildConfig.VERSION_CODE) error("version mismatch")
        val cert = info.signingInfo?.apkContentsSigners?.firstOrNull() ?: error("APK signer missing")
        val signer = MessageDigest.getInstance("SHA-256").digest(cert.toByteArray()).joinToString("") { "%02X".format(it) }
        if (signer.normalizeHex() != expectedSigner.normalizeHex()) error("APK signer mismatch")
    }

    private fun getText(url: String): String {
        val c = (URL(url).openConnection() as HttpURLConnection).apply {
            connectTimeout = 10_000
            readTimeout = 20_000
            setRequestProperty("Accept", "application/vnd.github+json")
            setRequestProperty("User-Agent", "Flow-Android-Updater")
        }
        if (c.responseCode !in 200..299) error("HTTP ${c.responseCode}")
        return c.inputStream.bufferedReader().use { it.readText() }
    }

    private fun download(url: String, target: File) {
        val c = (URL(url).openConnection() as HttpURLConnection).apply {
            connectTimeout = 10_000
            readTimeout = 30_000
            setRequestProperty("User-Agent", "Flow-Android-Updater")
        }
        if (c.responseCode !in 200..299) error("APK HTTP ${c.responseCode}")
        c.inputStream.use { input -> target.outputStream().use { output -> input.copyTo(output) } }
    }

    private fun sha256(file: File): String {
        val digest = MessageDigest.getInstance("SHA-256")
        file.inputStream().use { input ->
            val buffer = ByteArray(64 * 1024)
            while (true) {
                val count = input.read(buffer)
                if (count <= 0) break
                digest.update(buffer, 0, count)
            }
        }
        return digest.digest().joinToString("") { "%02X".format(it) }
    }

    private fun String.normalizeHex() = replace(":", "").replace(" ", "").trim().uppercase()
}
