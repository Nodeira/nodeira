# R8 keep rules.
#
# Minification was previously off, so none of this was needed and the placeholder here said
# so. With isMinifyEnabled = true these matter: Retrofit and kotlinx.serialization both rely
# on metadata that R8 strips by default, and losing it produces an APK that builds cleanly
# and then fails at runtime — the worst possible failure mode.

# ── kotlinx.serialization ────────────────────────────────────────────────────
# The compiler plugin generates a Companion.serializer() for every @Serializable class and
# looks it up reflectively. Without these, every DTO fails to deserialize.
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.**

-keepclassmembers class kotlinx.serialization.json.** {
    *** Companion;
}
-keepclasseswithmembers class kotlinx.serialization.json.** {
    kotlinx.serialization.KSerializer serializer(...);
}

-keep,includedescriptorclasses class com.deranjer.nodeira.**$$serializer { *; }
-keepclassmembers class com.deranjer.nodeira.** {
    *** Companion;
}
-keepclasseswithmembers class com.deranjer.nodeira.** {
    kotlinx.serialization.KSerializer serializer(...);
}

# ── Retrofit ─────────────────────────────────────────────────────────────────
# Service methods are parsed from annotations and generic return types at runtime, both of
# which R8 discards unless told otherwise.
-keepattributes Signature, Exceptions, RuntimeVisibleAnnotations, RuntimeVisibleParameterAnnotations
-keep,allowobfuscation interface com.deranjer.nodeira.data.net.NodeiraApi
-keep,allowobfuscation,allowshrinking interface retrofit2.Call
-keep,allowobfuscation,allowshrinking class retrofit2.Response
-keep,allowobfuscation,allowshrinking class kotlin.coroutines.Continuation

# Retrofit ships optional integrations for platforms we do not target.
-dontwarn retrofit2.**
-dontwarn org.codehaus.mojo.animal_sniffer.**

# ── OkHttp ───────────────────────────────────────────────────────────────────
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn org.conscrypt.**
-dontwarn org.bouncycastle.**
-dontwarn org.openjsse.**

# ── Compose ──────────────────────────────────────────────────────────────────
# The Compose compiler and R8 cooperate, so no broad keeps are needed; this only silences a
# warning about a desugared class R8 cannot see.
-dontwarn java.lang.invoke.StringConcatFactory
