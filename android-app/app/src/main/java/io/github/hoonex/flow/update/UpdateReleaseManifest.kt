package io.github.hoonex.flow.update

import org.json.JSONObject

data class UpdateReleaseManifest(
    val schema: Int,
    val apkName: String,
    val apkSha256: String,
    val signerSha256: String,
    val versionName: String,
    val versionCode: Long,
    val sourceSha: String
)

fun parseUpdateReleaseManifest(raw: String): UpdateReleaseManifest {
    val json = JSONObject(raw)
    val schema = json.getInt("schema")
    require(schema == 1) { "unsupported release manifest schema" }
    val apkName = json.getString("apkName").trim()
    val apkSha256 = json.getString("apkSha256").normalizeUpdateHex()
    val signerSha256 = json.getString("signerSha256").normalizeUpdateHex()
    val versionName = json.getString("versionName").trim()
    val versionCode = json.getLong("versionCode")
    val sourceSha = json.getString("sourceSha").trim().lowercase()
    require(apkName.endsWith(".apk") && '/' !in apkName && '\\' !in apkName) { "invalid APK asset name" }
    require(apkSha256.length == 64 && apkSha256.all(Char::isHexDigit)) { "invalid APK checksum" }
    require(signerSha256.length == 64 && signerSha256.all(Char::isHexDigit)) { "invalid signer fingerprint" }
    require(versionName.isNotBlank() && versionCode > 0) { "invalid release version" }
    require(sourceSha.length == 40 && sourceSha.all(Char::isHexDigit)) { "invalid source commit" }
    return UpdateReleaseManifest(schema, apkName, apkSha256, signerSha256, versionName, versionCode, sourceSha)
}

internal fun String.normalizeUpdateHex() = replace(":", "").replace(" ", "").trim().uppercase()
