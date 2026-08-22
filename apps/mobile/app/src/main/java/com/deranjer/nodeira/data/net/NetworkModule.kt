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
import java.util.concurrent.TimeUnit

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

    /**
     * Used only for [NodeiraMoveApi]'s move-only bodies ([MoveNoteBody] etc.), which need
     * "no folder"/"vault root" sent as an explicit JSON `null` rather than an omitted key.
     * [json] above stays `explicitNulls = false` for everything else — flipping that
     * globally would make every existing partial-update call (rename, pin toggle, ...)
     * start sending its other, untouched nullable fields as explicit nulls too, and the
     * server treats a present `null` as "clear this field," not "leave it alone." See
     * [MoveNoteBody]'s doc comment.
     */
    private val moveJson = Json {
        ignoreUnknownKeys = true
        explicitNulls = true
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

    /**
     * Client for the /notifications WebSocket.
     *
     * Shares the connection pool with [client] but drops the auth interceptor — that socket
     * authenticates with a `?token=` query parameter, and a 401-triggered `clearSession()`
     * from a handshake would log the user out over what is only a notifications channel.
     *
     * `pingInterval` matters more than it looks: without keepalive frames, a mobile NAT or a
     * carrier proxy silently drops an idle socket, and the client goes on believing it is
     * connected while nothing arrives.
     */
    val webSocketClient: OkHttpClient = client.newBuilder()
        .apply { interceptors().clear() }
        .pingInterval(30, TimeUnit.SECONDS)
        .build()

    private val cache = mutableMapOf<String, NodeiraApi>()
    private val moveCache = mutableMapOf<String, NodeiraMoveApi>()

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

    /** Returns a [NodeiraMoveApi] bound to `<serverUrl>/api/v1/` — see [moveJson]. */
    fun moveApiFor(serverUrl: String): NodeiraMoveApi {
        val base = serverUrl.trimEnd('/') + "/api/v1/"
        return moveCache.getOrPut(base) {
            Retrofit.Builder()
                .baseUrl(base)
                .client(client)
                .addConverterFactory(moveJson.asConverterFactory("application/json".toMediaType()))
                .build()
                .create(NodeiraMoveApi::class.java)
        }
    }
}
