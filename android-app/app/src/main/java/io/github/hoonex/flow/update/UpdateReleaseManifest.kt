package io.github.hoonex.flow.update

data class UpdateReleaseManifest(
    val schema: Int,
    val apkName: String,
    val apkSha256: String,
    val signerSha256: String,
    val versionName: String,
    val versionCode: Long,
    val sourceSha: String
)

fun validateUpdateReleaseManifest(manifest: UpdateReleaseManifest): UpdateReleaseManifest {
    require(manifest.schema == 1) { "unsupported release manifest schema" }
    require(manifest.apkName.endsWith(".apk") && '/' !in manifest.apkName && '\\\\' !in manifest.apkName) { "invalid APK asset name" }
    require(manifest.apkSha256.length == 64 && manifest.apkSha256.all(Char::isHexDigit)) { "invalid APK checksum" }
    require(manifest.signerSha256.length == 64 && manifest.signerSha256.all(Char::isHexDigit)) { "invalid signer fingerprint" }
    require(manifest.versionName.isNotBlank() && manifest.versionCode > 0) { "invalid release version" }
    require(manifest.sourceSha.length == 40 && manifest.sourceSha.all(Char::isHexDigit)) { "invalid source commit" }
    return manifest
}

internal fun String.normalizeUpdateHex() = replace(":", "").replace(" ", "").trim().uppercase()
