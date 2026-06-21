package com.deranjer.nodeira.data.net

import com.deranjer.nodeira.data.AuthStorage
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.serialization.json.Json
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory

/**
 * Builds [NodeiraApi] instances. The server URL is user-configurable at runtime, so the
 * Retrofit instance is (re)built per base URL and cached. The bearer token is read lazily
 * from [AuthStorage] on each request, so it's always current after login/logout.
 */
class NetworkModule(private val auth: AuthStorage) {

    private val json = Json {
        ignoreUnknownKeys = true
        explicitNulls = false
        // Send fields that equal their default (e.g. triggerType="TIME") — the server
        // requires them. Combined with explicitNulls=false, null fields are still omitted.
        encodeDefaults = true
    }

    private val _unauthorized = MutableSharedFlow<Unit>(extraBufferCapacity = 1)
    /** Emits when a request gets a 401 (expired/invalid token); the UI routes to login. */
    val unauthorized: SharedFlow<Unit> = _unauthorized

    private val authInterceptor = Interceptor { chain ->
        val token = auth.token
        val request = if (!token.isNullOrBlank()) {
            chain.request().newBuilder()
                .header("Authorization", "Bearer $token")
                .build()
        } else {
            chain.request()
        }
        val response = chain.proceed(request)
        if (response.code == 401 && !token.isNullOrBlank()) {
            auth.clearSession()
            _unauthorized.tryEmit(Unit)
        }
        response
    }

    private val client: OkHttpClient = OkHttpClient.Builder()
        .addInterceptor(authInterceptor)
        .addInterceptor(
            HttpLoggingInterceptor().apply { level = HttpLoggingInterceptor.Level.BASIC },
        )
        .build()

    private val cache = mutableMapOf<String, NodeiraApi>()

    /** Returns an API bound to `<serverUrl>/api/v1/`. */
    fun apiFor(serverUrl: String): NodeiraApi {
        val base = serverUrl.trimEnd('/') + "/api/v1/"
        return cache.getOrPut(base) {
            Retrofit.Builder()
                .baseUrl(base)
                .client(client)
                .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
                .build()
                .create(NodeiraApi::class.java)
        }
    }
}
