package io.github.hoonex.flow.update

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class UpdateReleaseManifestTest {
    private val sha = "A".repeat(64)
    private val source = "b".repeat(40)

    private fun manifest(
        schema: Int = 1,
        apkName: String = "Flow-Android-v0.1.123.apk",
        apkSha256: String = sha,
        signerSha256: String = sha,
        versionName: String = "0.1.123",
        versionCode: Long = 100123,
        sourceSha: String = source
    ) = UpdateReleaseManifest(schema, apkName, apkSha256, signerSha256, versionName, versionCode, sourceSha)

    @Test
    fun acceptsReleaseWorkflowContract() {
        val value = validateUpdateReleaseManifest(manifest())
        assertEquals("Flow-Android-v0.1.123.apk", value.apkName)
        assertEquals(100123L, value.versionCode)
        assertEquals(source, value.sourceSha)
    }

    @Test
    fun rejectsUnknownSchemaAndUnsafeAssetName() {
        assertThrows(IllegalArgumentException::class.java) { validateUpdateReleaseManifest(manifest(schema = 2)) }
        assertThrows(IllegalArgumentException::class.java) { validateUpdateReleaseManifest(manifest(apkName = "../Flow.apk")) }
        assertThrows(IllegalArgumentException::class.java) { validateUpdateReleaseManifest(manifest(apkName = "..\\\\Flow.apk")) }
    }

    @Test
    fun bindsManifestVersionToReleaseTag() {
        validateUpdateReleaseTag("android-v0.1.123", manifest())
        assertThrows(IllegalArgumentException::class.java) {
            validateUpdateReleaseTag("android-v0.1.124", manifest())
        }
        assertThrows(IllegalArgumentException::class.java) {
            validateUpdateReleaseTag("v0.1.123", manifest())
        }
    }

    @Test
    fun rejectsMalformedTrustMaterial() {
        assertThrows(IllegalArgumentException::class.java) { validateUpdateReleaseManifest(manifest(apkSha256 = "1234")) }
        assertThrows(IllegalArgumentException::class.java) { validateUpdateReleaseManifest(manifest(signerSha256 = "G".repeat(64))) }
        assertThrows(IllegalArgumentException::class.java) { validateUpdateReleaseManifest(manifest(versionCode = 0)) }
        assertThrows(IllegalArgumentException::class.java) { validateUpdateReleaseManifest(manifest(sourceSha = "short")) }
    }
}
