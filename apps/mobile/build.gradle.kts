// Top-level build file. Plugin versions are declared here and applied per-module.
plugins {
    id("com.android.application") version "8.11.1" apply false
    id("org.jetbrains.kotlin.android") version "2.1.21" apply false
    // Compose compiler is a Kotlin compiler plugin (version tracks Kotlin) since Kotlin 2.0.
    id("org.jetbrains.kotlin.plugin.compose") version "2.1.21" apply false
    id("org.jetbrains.kotlin.plugin.serialization") version "2.1.21" apply false
}
