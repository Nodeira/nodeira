plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.kotlin.plugin.serialization")
}

// Release keystore is provided by CI via env (same key as the RN app → F-Droid upgrade
// continuity). Absent locally, so debug builds and unsigned release builds still work.
val releaseKeystore: String? = System.getenv("ANDROID_KEYSTORE_FILE")

android {
    namespace = "com.deranjer.nodeira"
    compileSdk = 36

    defaultConfig {
        // Reuse the existing RN app id so F-Droid treats this as an upgrade.
        applicationId = "com.deranjer.nodeira"
        minSdk = 24
        targetSdk = 36
        // Overridden by CI from the release tag; F-Droid needs a monotonic versionCode.
        versionCode = System.getenv("VERSION_CODE")?.toIntOrNull() ?: 1
        versionName = System.getenv("VERSION_NAME") ?: "0.1.0-dev"
    }

    signingConfigs {
        create("release") {
            if (releaseKeystore != null) {
                storeFile = file(releaseKeystore)
                storePassword = System.getenv("ANDROID_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("ANDROID_KEY_ALIAS")
                keyPassword = System.getenv("ANDROID_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            // R8 was off, so release APKs shipped every class and method name intact and
            // considerably larger than necessary. Resource shrinking rides along with it.
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
            // Sign with the release key when CI supplies it; otherwise leave unsigned.
            if (releaseKeystore != null) {
                signingConfig = signingConfigs.getByName("release")
            }
        }
    }

    compileOptions {
        // Allows java.time (Instant/ZonedDateTime/…) on minSdk 24 via desugaring.
        isCoreLibraryDesugaringEnabled = true
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
        // EditorWebViewActivity gates remote debugging and mixed content on BuildConfig.DEBUG.
        buildConfig = true
    }
}

dependencies {
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.3")

    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.webkit:webkit:1.12.1")
    // Keystore-backed preferences for the session JWT, which used to sit in plaintext.
    implementation("androidx.security:security-crypto:1.1.0-alpha06")
    // Provides the Material3 XML theme used as the activity base theme (see AndroidManifest).
    implementation("com.google.android.material:material:1.12.0")

    // Compose
    implementation(platform("androidx.compose:compose-bom:2024.12.01"))
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    debugImplementation("androidx.compose.ui:ui-tooling")

    // Lifecycle + navigation
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
    // ProcessLifecycleOwner — tells the app when it is foregrounded, which is when the
    // notifications socket should be connected.
    implementation("androidx.lifecycle:lifecycle-process:2.8.7")
    implementation("androidx.navigation:navigation-compose:2.8.5")

    // Periodic reminder sync, so reminders created on another client get an on-device alarm
    // even when the app is closed.
    implementation("androidx.work:work-runtime-ktx:2.10.0")

    // Networking
    implementation("com.squareup.retrofit2:retrofit:2.11.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")
    implementation("com.squareup.retrofit2:converter-kotlinx-serialization:2.11.0")

    // JVM unit tests. Added for the offline write queue: ConflictResolver decides whether a
    // queued change is applied, dropped or raised to the user, and getting that wrong loses
    // someone's work silently. It is pure Kotlin, so it needs no instrumentation.
    testImplementation("junit:junit:4.13.2")
}
