package com.deranjer.nodeira.data.net

import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * REST surface mirroring `apps/web/src/lib/api.ts`. Paths are relative to the
 * `<server>/api/v1/` base URL configured in [NetworkModule]. Grown as native screens land.
 */
interface NodeiraApi {

    @GET("setup/status")
    suspend fun setupStatus(): SetupStatus

    @POST("auth/login")
    suspend fun login(@Body body: LoginRequest): AuthResponse

    @GET("notes")
    suspend fun getNotes(@Query("vaultId") vaultId: String? = null): List<NoteDto>

    @POST("notes")
    suspend fun createNote(@Body body: CreateNoteBody): NoteDto

    // The app could create and read notes but never rename, pin, move or remove one — the
    // only way to delete a note from a phone was to open the editor WebView.
    @PATCH("notes/{id}")
    suspend fun updateNote(@Path("id") id: String, @Body body: UpdateNoteBody): NoteDto

    @DELETE("notes/{id}")
    suspend fun deleteNote(@Path("id") id: String)

    @GET("vaults")
    suspend fun getVaults(): List<VaultDto>

    @GET("folders")
    suspend fun getFolders(@Query("vaultId") vaultId: String? = null): List<FolderDto>

    @POST("folders")
    suspend fun createFolder(@Body body: CreateFolderBody): FolderDto

    @DELETE("folders/{id}")
    suspend fun deleteFolder(@Path("id") id: String)

    @GET("reminders")
    suspend fun getReminders(): List<ReminderDto>

    @POST("reminders")
    suspend fun createReminder(@Body body: CreateReminderBody): ReminderDto

    @PATCH("reminders/{id}")
    suspend fun updateReminder(@Path("id") id: String, @Body body: CreateReminderBody): ReminderDto

    @DELETE("reminders/{id}")
    suspend fun deleteReminder(@Path("id") id: String)

    @GET("notes/graph")
    suspend fun getGraph(): List<GraphLink>

    @GET("canvases")
    suspend fun getCanvases(): List<CanvasDto>

    @POST("canvases")
    suspend fun createCanvas(@Body body: CreateCanvasBody): CanvasDto

    @PATCH("canvases/{id}")
    suspend fun updateCanvas(@Path("id") id: String, @Body body: UpdateCanvasBody): CanvasDto

    @DELETE("canvases/{id}")
    suspend fun deleteCanvas(@Path("id") id: String)

    @GET("trash")
    suspend fun getTrash(@Query("vaultId") vaultId: String? = null): List<TrashItemDto>

    @POST("trash/{type}/{id}/restore")
    suspend fun restoreTrashItem(@Path("type") type: String, @Path("id") id: String)

    @DELETE("trash/{type}/{id}")
    suspend fun purgeTrashItem(@Path("type") type: String, @Path("id") id: String)
}
