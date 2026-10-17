package expo.modules.solardurablebackup

import android.app.backup.BackupManager
import android.content.ContentUris
import android.content.ContentValues
import android.content.Context
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONArray
import java.io.File

private const val BACKUP_FILE_NAME = "solar-calculator-backup.json"
private const val DOCUMENTS_SUBDIR = "Calculadora Solar/Backups"
private const val DOCUMENTS_RELATIVE = "Documents/Calculadora Solar/Backups/"
private const val LEGACY_RELATIVE_PATH = "Download/SolarCalculator/"
private const val LEGACY_ROOT_FOLDER = "CalculadoraSolar_Backups"
private const val LEGACY_DOCUMENTS_RELATIVE = "Documents/CalculadoraSolar_Backups/"
private const val LEGACY_DOWNLOADS_RELATIVE = "Download/CalculadoraSolar_Backups/"

class SolarDurableBackupModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SolarDurableBackup")

    Function("requestSystemBackup") {
      val context = appContext.reactContext ?: return@Function false
      BackupManager(context).dataChanged()
      true
    }

    Function("writePublicBackup") { json: String ->
      val context = appContext.reactContext ?: return@Function "interno"
      writePublic(context, json)
    }

    Function("readPublicBackup") {
      val context = appContext.reactContext ?: return@Function null
      readPublic(context)
    }

    Function("writeRootBackup") { json: String, fileName: String ->
      val context = appContext.reactContext ?: return@Function "interno"
      writeRootFolder(context, json, fileName)
    }

    Function("readRootBackups") {
      val context = appContext.reactContext ?: return@Function "[]"
      readRootBackups(context)
    }

    Function("readDedicatedBackup") {
      val context = appContext.reactContext ?: return@Function null
      readDedicated(context)
    }
  }
}

private data class Candidate(val modified: Long, val savedAt: String, val json: String)

private fun writePublic(context: Context, json: String): String {
  return writeDedicated(context, json, BACKUP_FILE_NAME)
}

private enum class MediaStoreKind {
  DOWNLOADS,
  FILES,
}

private fun writeRootFolder(context: Context, json: String, fileName: String): String {
  return writeDedicated(context, json, fileName)
}

private fun writeDedicated(context: Context, json: String, fileName: String): String {
  val safeName = safeJsonName(fileName)
  val documentsOk = writePlainDir(
    Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOCUMENTS),
    DOCUMENTS_SUBDIR,
    safeName,
    json,
  ) || writeMediaStore(context, MediaStoreKind.FILES, DOCUMENTS_RELATIVE, safeName, json)
  return if (documentsOk) "documentos" else "interno"
}

private fun safeJsonName(fileName: String): String {
  val base = fileName.substringAfterLast('/').substringAfterLast('\\').trim()
  val cleaned = base.replace(Regex("[^A-Za-z0-9._-]"), "-")
  val named = if (cleaned.endsWith(".json", ignoreCase = true)) cleaned else "$cleaned.json"
  return named.ifBlank { BACKUP_FILE_NAME }
}

private fun writePlainDir(parent: File?, folderName: String, fileName: String, json: String): Boolean {
  if (parent == null) return false
  return try {
    val dir = File(parent, folderName)
    if (!dir.exists() && !dir.mkdirs()) return false
    File(dir, fileName).writeText(json, Charsets.UTF_8)
    true
  } catch (_: Exception) {
    false
  }
}

private fun writeMediaStore(
  context: Context,
  kind: MediaStoreKind,
  relativePath: String,
  fileName: String,
  json: String,
): Boolean {
  if (Build.VERSION.SDK_INT < 29) return false
  return try {
    val resolver = context.contentResolver
    val collection = collectionUri(kind)
    val selection = "${MediaStore.MediaColumns.DISPLAY_NAME}=? AND ${MediaStore.MediaColumns.RELATIVE_PATH}=?"
    val args = arrayOf(fileName, relativePath)
    val pending = ContentValues().apply {
      put(MediaStore.MediaColumns.DISPLAY_NAME, fileName)
      put(MediaStore.MediaColumns.MIME_TYPE, "application/json")
      put(MediaStore.MediaColumns.RELATIVE_PATH, relativePath)
      put(MediaStore.MediaColumns.IS_PENDING, 1)
    }
    val existing = resolver.query(
      collection,
      arrayOf(MediaStore.MediaColumns._ID),
      selection,
      args,
      null,
    )?.use { cursor ->
      if (!cursor.moveToFirst()) null
      else ContentUris.withAppendedId(collection, cursor.getLong(0))
    }
    val uri = if (existing == null) {
      resolver.insert(collection, pending)
    } else {
      resolver.update(existing, pending, null, null)
      existing
    } ?: return false
    resolver.openOutputStream(uri, "wt")?.use { stream ->
      stream.write(json.toByteArray(Charsets.UTF_8))
    } ?: return false
    val done = ContentValues().apply { put(MediaStore.MediaColumns.IS_PENDING, 0) }
    resolver.update(uri, done, null, null)
    true
  } catch (_: Exception) {
    false
  }
}

private fun collectionUri(kind: MediaStoreKind): Uri {
  val volume = MediaStore.VOLUME_EXTERNAL
  return if (kind == MediaStoreKind.DOWNLOADS) {
    MediaStore.Downloads.getContentUri(volume)
  } else {
    MediaStore.Files.getContentUri(volume)
  }
}

private fun readPublic(context: Context): String? {
  readDedicated(context)?.let { return it }
  readLegacyDownload()?.let { return it }
  readPlainFile(Environment.getExternalStorageDirectory(), LEGACY_ROOT_FOLDER, BACKUP_FILE_NAME)?.let { return it }
  readPlainFile(
    Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOCUMENTS),
    LEGACY_ROOT_FOLDER,
    BACKUP_FILE_NAME,
  )?.let { return it }
  readPlainFile(
    Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS),
    LEGACY_ROOT_FOLDER,
    BACKUP_FILE_NAME,
  )?.let { return it }
  if (Build.VERSION.SDK_INT < 29) return null
  return readMediaStoreFile(context, MediaStoreKind.DOWNLOADS, LEGACY_RELATIVE_PATH, BACKUP_FILE_NAME)
    ?: readMediaStoreFile(context, MediaStoreKind.FILES, LEGACY_DOCUMENTS_RELATIVE, BACKUP_FILE_NAME)
    ?: readMediaStoreFile(context, MediaStoreKind.DOWNLOADS, LEGACY_DOWNLOADS_RELATIVE, BACKUP_FILE_NAME)
}

private fun readDedicated(context: Context): String? {
  readPlainFile(
    Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOCUMENTS),
    DOCUMENTS_SUBDIR,
    BACKUP_FILE_NAME,
  )?.let { return it }
  if (Build.VERSION.SDK_INT < 29) return null
  return readMediaStoreFile(context, MediaStoreKind.FILES, DOCUMENTS_RELATIVE, BACKUP_FILE_NAME)
}

private fun readLegacyDownload(): String? {
  return try {
    val file = File(
      Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS),
      "SolarCalculator/$BACKUP_FILE_NAME",
    )
    if (!file.exists() || !file.canRead()) null else file.readText()
  } catch (_: Exception) {
    null
  }
}

private fun readMediaStoreFile(
  context: Context,
  kind: MediaStoreKind,
  relativePath: String,
  fileName: String,
): String? {
  return try {
    val resolver = context.contentResolver
    val collection = collectionUri(kind)
    val selection = "${MediaStore.MediaColumns.DISPLAY_NAME}=? AND ${MediaStore.MediaColumns.RELATIVE_PATH}=?"
    val args = arrayOf(fileName, relativePath)
    val uri = resolver.query(
      collection,
      arrayOf(MediaStore.MediaColumns._ID),
      selection,
      args,
      null,
    )?.use { cursor ->
      if (!cursor.moveToFirst()) null
      else ContentUris.withAppendedId(collection, cursor.getLong(0))
    } ?: return null
    resolver.openInputStream(uri)?.use { stream ->
      stream.readBytes().toString(Charsets.UTF_8)
    }
  } catch (_: Exception) {
    null
  }
}

private fun readPlainFile(parent: File?, folderName: String, fileName: String): String? {
  if (parent == null) return null
  return try {
    val file = File(File(parent, folderName), fileName)
    if (!file.exists() || !file.canRead()) null else file.readText()
  } catch (_: Exception) {
    null
  }
}

private fun readRootBackups(context: Context): String {
  val found = mutableListOf<Candidate>()
  collectDirectory(
    File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOCUMENTS), DOCUMENTS_SUBDIR),
    found,
  )
  collectDirectory(File(Environment.getExternalStorageDirectory(), LEGACY_ROOT_FOLDER), found)
  collectDirectory(
    File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOCUMENTS), LEGACY_ROOT_FOLDER),
    found,
  )
  collectDirectory(
    File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), LEGACY_ROOT_FOLDER),
    found,
  )
  collectDirectory(
    File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), "SolarCalculator"),
    found,
  )
  if (Build.VERSION.SDK_INT >= 29) {
    collectMediaStore(context, MediaStoreKind.FILES, DOCUMENTS_RELATIVE, found)
    collectMediaStore(context, MediaStoreKind.FILES, LEGACY_DOCUMENTS_RELATIVE, found)
    collectMediaStore(context, MediaStoreKind.DOWNLOADS, LEGACY_DOWNLOADS_RELATIVE, found)
    collectMediaStore(context, MediaStoreKind.DOWNLOADS, LEGACY_RELATIVE_PATH, found)
  }
  val array = JSONArray()
  found
    .sortedWith(compareByDescending<Candidate> { it.savedAt }.thenByDescending { it.modified })
    .take(30)
    .forEach { array.put(it.json) }
  return array.toString()
}

private fun collectDirectory(dir: File?, into: MutableList<Candidate>) {
  if (dir == null || !dir.exists() || !dir.isDirectory) return
  val files = dir.listFiles() ?: return
  for (file in files) {
    if (!file.isFile || !file.name.endsWith(".json", ignoreCase = true)) continue
    try {
      if (!file.canRead() || file.length() <= 0L || file.length() > 2_000_000L) continue
      val text = file.readText()
      if (text.isBlank()) continue
      into.add(Candidate(file.lastModified(), savedAtOf(text), text))
    } catch (_: Exception) {
      // segue para o próximo arquivo
    }
  }
}

private fun collectMediaStore(
  context: Context,
  kind: MediaStoreKind,
  relativePath: String,
  into: MutableList<Candidate>,
) {
  try {
    val resolver = context.contentResolver
    val collection = collectionUri(kind)
    val trimmed = relativePath.trimEnd('/')
    val selection = "(${MediaStore.MediaColumns.RELATIVE_PATH}=? OR ${MediaStore.MediaColumns.RELATIVE_PATH}=?) AND ${MediaStore.MediaColumns.DISPLAY_NAME} LIKE ?"
    val args = arrayOf(relativePath, trimmed, "%solar-calculator-backup%")
    resolver.query(
      collection,
      arrayOf(MediaStore.MediaColumns._ID, MediaStore.MediaColumns.DATE_MODIFIED),
      selection,
      args,
      null,
    )?.use { cursor ->
      val idCol = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns._ID)
      val dateCol = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.DATE_MODIFIED)
      while (cursor.moveToNext()) {
        val uri = ContentUris.withAppendedId(collection, cursor.getLong(idCol))
        val modified = cursor.getLong(dateCol) * 1000L
        val text = resolver.openInputStream(uri)?.use { stream ->
          stream.readBytes().toString(Charsets.UTF_8)
        }
        if (!text.isNullOrBlank() && text.length <= 2_000_000) {
          into.add(Candidate(modified, savedAtOf(text), text))
        }
      }
    }
  } catch (_: Exception) {
    // coleção indisponível neste aparelho
  }
}

private fun savedAtOf(json: String): String {
  val marker = "\"savedAt\":\""
  val start = json.indexOf(marker)
  if (start < 0) return ""
  val from = start + marker.length
  val end = json.indexOf('"', from)
  if (end <= from) return ""
  return json.substring(from, end)
}
