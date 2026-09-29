package io.github.hoonex.flow.update

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class UpdateReleaseManifestTest {
    private val sha = "A".repeat(64)
    private val source = "b".repeat(40)

    @Test
    fun parsesReleaseWorkflowSchema() {
        val manifest = parseUpdateReleaseManifest(
            """{"schema":1,"apkName":"Flow-Android-v0.1.123.apk","apkSha256":"$sha","signerSha256":"$sha","versionName":"0.1.123","versionCode":100123,"sourceSha":"$source"}"""
        )
        assertEquals("Flow-Android-v0.1.123.apk", manifest.apkName)
        assertEquals(100123L, manifest.versionCode)
        assertEquals(source, manifest.sourceSha)
    }

    @Test
    fun rejectsUnknownSchemaAndUnsafeAssetName() {
        assertThrows(IllegalArgumentException::class.java) {
            parseUpdateReleaseManifest(
                """{"schema":2,"apkName":"Flow.apk","apkSha256":"$sha","signerSha256":"$sha","versionName":"1","versionCode":2,"sourceSha":"$source"}"""
            )
        }
        assertThrows(IllegalArgumentException::class.java) {
            parseUpdateReleaseManifest(
                """{"schema":1,"apkName":"../Flow.apk","apkSha256":"$sha","signerSha256":"$sha","versionName":"1","versionCode":2,"sourceSha":"$source"}"""
            )
        }
    }

    @Test
    fun rejectsMalformedTrustMaterial() {
        assertThrows(IllegalArgumentException::class.java) {
            parseUpdateReleaseManifest(
                """{"schema":1,"apkName":"Flow.apk","apkSha256":"1234","signerSha256":"$sha","versionName":"1","versionCode":2,"sourceSha":"$source"}"""
            )
        }
        assertThrows(IllegalArgumentException::class.java) {
            parseUpdateReleaseManifest(
                """{"schema":1,"apkName":"Flow.apk","apkSha256":"$sha","signerSha256":"$sha","versionName":"1","versionCode":2,"sourceSha":"short"}"""
            )
        }
    }
}
