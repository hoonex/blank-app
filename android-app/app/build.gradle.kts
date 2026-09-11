plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.plugin.compose")
}

val flowVersionCode = System.getenv("FLOW_VERSION_CODE")?.toIntOrNull() ?: 1
val flowVersionName = System.getenv("FLOW_VERSION_NAME") ?: "0.1.0-dev"
val expectedSigner = System.getenv("FLOW_EXPECTED_SIGNER_SHA256") ?: ""
val releaseKeyStore = System.getenv("ANDROID_KEYSTORE_PATH")

android {
    namespace = "io.github.hoonex.flow"
    compileSdk = 37

    defaultConfig {
        applicationId = "io.github.hoonex.flow"
        minSdk = 28
        targetSdk = 36
        versionCode = flowVersionCode
        versionName = flowVersionName
        buildConfigField("String", "UPDATE_SIGNER_SHA256", "\"$expectedSigner\"")
        buildConfigField("String", "GITHUB_REPOSITORY", "\"hoonex/blank-app\"")
    }

    signingConfigs {
        if (!releaseKeyStore.isNullOrBlank()) {
            create("release") {
                storeFile = file(releaseKeyStore)
                storePassword = System.getenv("ANDROID_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("ANDROID_KEY_ALIAS")
                keyPassword = System.getenv("ANDROID_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        getByName("release") {
            signingConfigs.findByName("release")?.let { signingConfig = it }
            isMinifyEnabled = false
            isShrinkResources = false
        }
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

kotlin {
    jvmToolchain(17)
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2026.08.00")
    implementation(composeBom)
    androidTestImplementation(composeBom)

    implementation("androidx.core:core-ktx:1.19.0")
    implementation("androidx.activity:activity-compose:1.13.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.10.0")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.animation:animation")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.glance:glance-appwidget:1.2.0")

    debugImplementation("androidx.compose.ui:ui-tooling")
    testImplementation("junit:junit:4.13.2")
}
