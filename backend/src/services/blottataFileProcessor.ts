import { google, drive_v3 } from "googleapis";
import { Logger } from "../utils/logger";
import type { Channel } from "../types/channel";
import { blottataPublisherService } from "./blottataPublisherService";
import { generateYoutubeTitleAndDescription } from "./youtubeTitleDescriptionGenerator";
import { getDriveClient } from "./googleDrive";
import { normalizeYoutubeTitle } from "../utils/youtubeTitleNormalizer";
import { logError } from "./errorLogger";

interface ProcessedFile {
  fileId: string;
  fileName: string;
  success: boolean;
  publishedPlatforms: string[];
  errors: string[];
}

/**
 * Очищает ID папки Google Drive от параметров URL (например, ?hl=ru)
 */
function cleanFolderId(folderId: string): string {
  if (!folderId) return folderId;
  // Удаляем параметры URL, если они есть
  // Например: "1BBP3gnYws01siBUs0GQeIYx2j8Nm8Jvy?hl=ru" -> "1BBP3gnYws01siBUs0GQeIYx2j8Nm8Jvy"
  const questionMarkIndex = folderId.indexOf('?');
  if (questionMarkIndex !== -1) {
    return folderId.substring(0, questionMarkIndex);
  }
  return folderId;
}

/**
 * Предварительная проверка файла перед отправкой в Blottata
 * Проверяет существование файла, его размер и тип
 */
async function validateFileBeforeBlottata(params: {
  fileMeta: any;
  fileId: string;
  channelId: string;
  channelName: string;
  userId: string;
}): Promise<{ valid: boolean; reason?: string }> {
  const { fileMeta, fileId, channelId, channelName, userId } = params;

  // Проверка 1: Файл не найден
  if (!fileMeta || !fileMeta.id) {
    const reason = "Файл не найден в Google Drive";
    Logger.warn("[BlottataPrecheck] Invalid media for channel", {
      channelId,
      fileId,
      reason,
      meta: fileMeta
    });

        await logError({
          userId,
          channelId,
          channelName,
          source: "blotato_publish",
          severity: "warning",
          code: "INVALID_MEDIA_BEFORE_BLOTTATA",
          message: "Файл на Google Drive не подходит для публикации (не найден). Проверьте ссылку и заново сгенерируйте видео.",
          details: {
            fileId,
            fileName: fileMeta?.name || "unknown",
            reason: "file_not_found",
            driveWebViewLink: fileMeta?.webViewLink,
            platforms: [] // Платформы будут определены позже, если файл пройдёт проверку
          }
        });

    return { valid: false, reason };
  }

  // Проверка 2: Пустой файл
  const fileSize = fileMeta.size ? Number(fileMeta.size) : 0;
  if (!fileSize || fileSize === 0) {
    const reason = "Файл пустой (размер 0 байт)";
    Logger.warn("[BlottataPrecheck] Invalid media for channel", {
      channelId,
      fileId,
      reason,
      size: fileSize,
      meta: fileMeta
    });

        await logError({
          userId,
          channelId,
          channelName,
          source: "blotato_publish",
          severity: "warning",
          code: "INVALID_MEDIA_BEFORE_BLOTTATA",
          message: "Файл на Google Drive не подходит для публикации (пустой файл). Проверьте ссылку и заново сгенерируйте видео.",
          details: {
            fileId,
            fileName: fileMeta.name || "unknown",
            mimeType: fileMeta.mimeType,
            size: fileSize,
            reason: "empty_file",
            driveWebViewLink: fileMeta.webViewLink,
            platforms: [] // Платформы будут определены позже, если файл пройдёт проверку
          }
        });

    return { valid: false, reason };
  }

  // Проверка 3: Это не видео
  const mimeType = fileMeta.mimeType || "";
  if (!mimeType.startsWith("video/")) {
    const reason = `Файл не является видео: ${mimeType}`;
    Logger.warn("[BlottataPrecheck] Invalid media for channel", {
      channelId,
      fileId,
      reason,
      mimeType,
      meta: fileMeta
    });

        await logError({
          userId,
          channelId,
          channelName,
          source: "blotato_publish",
          severity: "warning",
          code: "INVALID_MEDIA_BEFORE_BLOTTATA",
          message: "Файл на Google Drive не подходит для публикации (не видео). Проверьте ссылку и заново сгенерируйте видео.",
          details: {
            fileId,
            fileName: fileMeta.name || "unknown",
            mimeType,
            size: fileSize,
            reason: "not_video",
            driveWebViewLink: fileMeta.webViewLink,
            platforms: [] // Платформы будут определены позже, если файл пройдёт проверку
          }
        });

    return { valid: false, reason };
  }

  // Все проверки пройдены
  Logger.info("[BlottataPrecheck] File validation passed", {
    channelId,
    fileId,
    fileName: fileMeta.name,
    mimeType,
    size: fileSize
  });

  return { valid: true };
}

/**
 * Обрабатывает файл из Google Drive: генерирует описание, публикует через Blottata, перемещает в архив
 * @param channel - Канал для публикации
 * @param fileId - ID файла в Google Drive
 * @param userId - ID владельца канала (для журнала ошибок)
 */
export async function processBlottataFile(
  channel: Channel,
  fileId: string,
  userId?: string
): Promise<ProcessedFile> {
  const result: ProcessedFile = {
    fileId,
    fileName: "",
    success: false,
    publishedPlatforms: [],
    errors: []
  };

  try {
    Logger.info("BlottataFileProcessor: Starting file processing", {
      channelId: channel.id,
      fileId,
      driveInputFolderId: channel.driveInputFolderId || "not set",
      driveArchiveFolderId: channel.driveArchiveFolderId || "not set",
      blotataEnabled: channel.blotataEnabled || false
    });

    // 1. Получаем информацию о файле из Google Drive с расширенными полями для предварительной проверки
    const drive = getDriveClient(true);
    const fileInfo = await drive.files.get({
      fileId,
      fields: "id, name, webContentLink, webViewLink, mimeType, size, createdTime, modifiedTime, parents"
    });

    result.fileName = fileInfo.data.name || "unknown";
    const fileMeta = fileInfo.data;

    // Предварительная проверка файла перед отправкой в Blottata
    const precheckResult = await validateFileBeforeBlottata({
      fileMeta,
      fileId,
      channelId: channel.id,
      channelName: channel.name,
      userId: userId || "unknown"
    });

    if (!precheckResult.valid) {
      // Файл не прошёл проверку - не вызываем Blottata
      const errorMessage = precheckResult.reason || "Файл не прошёл предварительную проверку";
      result.errors.push(errorMessage);
      Logger.warn("BlottataFileProcessor: File precheck failed, skipping Blottata", {
        channelId: channel.id,
        fileId,
        fileName: result.fileName,
        reason: precheckResult.reason
      });
      return result;
    }

    // 2. Получаем публичную ссылку на файл
    const mediaUrl = fileInfo.data.webContentLink;
    if (!mediaUrl) {
      throw new Error("File does not have webContentLink. Make sure the file is shared publicly.");
    }

    Logger.info("BlottataFileProcessor: File info retrieved", {
      channelId: channel.id,
      fileId,
      fileName: result.fileName,
      mediaUrl
    });

    // 3. Генерируем title и description через OpenAI с учетом языка канала
    const { title: generatedTitle, description } = await generateYoutubeTitleAndDescription(result.fileName, channel);
    
    // Нормализуем title перед публикацией (уже нормализован в generateYoutubeTitleAndDescription, но для надежности делаем еще раз)
    const normalizedTitle = normalizeYoutubeTitle(generatedTitle);

    Logger.info("BlottataFileProcessor: Title and description generated", {
      channelId: channel.id,
      fileId,
      titleLength: normalizedTitle.length,
      descriptionLength: description.length,
      title: normalizedTitle.substring(0, 50) + (normalizedTitle.length > 50 ? "..." : ""),
      description: description.substring(0, 50) + "..."
    });

    // 4. Публикуем на все настроенные платформы
    // Получаем список платформ для логирования ошибок
    const platforms: string[] = [];
    if (channel.blotataYoutubeId) platforms.push("youtube");
    if (channel.blotataTiktokId) platforms.push("tiktok");
    if (channel.blotataInstagramId) platforms.push("instagram");
    if (channel.blotataFacebookId) platforms.push("facebook");
    if (channel.blotataThreadsId) platforms.push("threads");
    if (channel.blotataTwitterId) platforms.push("twitter");
    if (channel.blotataLinkedinId) platforms.push("linkedin");
    if (channel.blotataPinterestId) platforms.push("pinterest");
    if (channel.blotataBlueskyId) platforms.push("bluesky");

    let publishResults;
    try {
      publishResults = await blottataPublisherService.publishToAllPlatforms({
        channel,
        mediaUrl,
        description,
        title: normalizedTitle
      });
    } catch (blottataError: any) {
      // Специальная обработка ошибки BLOTTATA_MEDIA_UPLOAD_FAILED
      const errorMessage = blottataError?.message || String(blottataError);
      const isMediaUploadError = 
        errorMessage.includes("BLOTTATA_MEDIA_UPLOAD_FAILED") ||
        errorMessage.includes("BLOTATA_MEDIA_UPLOAD_FAILED") ||
        errorMessage.includes("Failed to read media metadata") ||
        errorMessage.includes("Is the file accessible and a valid media file") ||
        blottataError?.response?.status === 500;

      if (isMediaUploadError && userId && userId !== "unknown") {
        Logger.error("[BlottataPublish] BLOTTATA_MEDIA_UPLOAD_FAILED for channel", {
          channelId: channel.id,
          fileId,
          fileName: result.fileName,
          error: errorMessage,
          status: blottataError?.response?.status,
          data: blottataError?.response?.data,
          platforms
        });

        await logError({
          userId,
          channelId: channel.id,
          channelName: channel.name,
          source: "blotato_publish",
          severity: "error",
          code: "BLOTTATA_MEDIA_UPLOAD_FAILED",
          message: "Blottata не смогла прочитать метаданные видео. Чаще всего это означает, что файл повреждён, пустой или временно недоступен. Попробуйте пересоздать видео и заново запустить автопубликацию.",
          details: {
            fileId,
            fileName: result.fileName,
            mimeType: fileMeta?.mimeType,
            size: fileMeta?.size,
            driveWebViewLink: fileMeta?.webViewLink,
            platforms,
            blottataRequestId: blottataError?.response?.data?.requestId || blottataError?.response?.data?.id,
            originalError: {
              message: errorMessage.substring(0, 500), // Ограничиваем длину
              status: blottataError?.response?.status,
              data: blottataError?.response?.data
            }
          }
        });
      }

      // Пробрасываем ошибку дальше
      throw blottataError;
    }

    // Анализируем результаты
    const successfulPlatforms: string[] = [];
    const errors: string[] = [];

    publishResults.forEach((result) => {
      if (result.success) {
        successfulPlatforms.push(result.platform);
      } else {
        errors.push(`${result.platform}: ${result.error || "Unknown error"}`);
      }
    });

    result.publishedPlatforms = successfulPlatforms;

    if (errors.length > 0) {
      result.errors = errors;
      Logger.warn("BlottataFileProcessor: Some platforms failed", {
        channelId: channel.id,
        fileId,
        errors
      });
    }

    // Если хотя бы одна платформа успешна, считаем операцию успешной
    result.success = successfulPlatforms.length > 0;

    if (!result.success) {
      throw new Error(`All platforms failed: ${errors.join("; ")}`);
    }

    // 5. Перемещаем файл из входной папки в архивную папку после успешной публикации
    const rawInputFolderId = channel.driveInputFolderId;
    const rawArchiveFolderId = channel.driveArchiveFolderId;

    // Очищаем folderId от параметров URL (например, ?hl=ru)
    const inputFolderId = rawInputFolderId ? cleanFolderId(rawInputFolderId) : undefined;
    const archiveFolderId = rawArchiveFolderId ? cleanFolderId(rawArchiveFolderId) : undefined;

    if (inputFolderId && archiveFolderId) {
      Logger.info("BlottataFileProcessor: Moving file to archive folder", {
        channelId: channel.id,
        fileId,
        fileName: result.fileName,
        inputFolderId,
        archiveFolderId,
        originalInputFolderId: rawInputFolderId,
        originalArchiveFolderId: rawArchiveFolderId
      });

      try {
        await moveFileToArchive(drive, fileId, inputFolderId, archiveFolderId);
        
        Logger.info("BlottataFileProcessor: File successfully moved to archive folder", {
          channelId: channel.id,
          fileId,
          fileName: result.fileName,
          inputFolderId,
          archiveFolderId
        });
      } catch (moveError: any) {
        Logger.error("BlottataFileProcessor: Failed to move file to archive folder", {
          channelId: channel.id,
          fileId,
          fileName: result.fileName,
          inputFolderId,
          archiveFolderId,
          error: moveError?.message || String(moveError),
          errorCode: moveError?.code,
          errorStack: moveError?.stack
        });
        // Не считаем это критической ошибкой, если публикация прошла успешно
        // Файл останется во входной папке и будет обработан снова при следующем цикле
        if (result.errors.length === 0) {
          result.errors.push(`Archive move failed: ${moveError?.message || "Unknown error"}`);
        }
      }
    } else {
      Logger.warn("BlottataFileProcessor: Archive folder is not configured for channel, skipping move", {
        channelId: channel.id,
        fileId,
        fileName: result.fileName,
        inputFolderId: inputFolderId || "not set",
        archiveFolderId: archiveFolderId || "not set",
        rawInputFolderId: rawInputFolderId || "not set",
        rawArchiveFolderId: rawArchiveFolderId || "not set",
        note: "File will remain in input folder and may be reprocessed"
      });
    }

    Logger.info("BlottataFileProcessor: File processing completed", {
      channelId: channel.id,
      fileId,
      success: result.success,
      publishedPlatforms: result.publishedPlatforms
    });

    return result;
  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    
    Logger.error("BlottataFileProcessor: File processing failed", {
      channelId: channel.id,
      fileId,
      error: errorMessage,
      userId: userId || "unknown"
    });

    // Если это не ошибка предварительной проверки (она уже залогирована),
    // и у нас есть userId, логируем в журнал ошибок
    if (
      userId &&
      userId !== "unknown" &&
      !errorMessage.includes("INVALID_MEDIA_BEFORE_BLOTTATA")
    ) {
      // Проверяем, не является ли это ошибкой BLOTTATA_MEDIA_UPLOAD_FAILED
      // (она уже обработана выше, но на всякий случай проверяем здесь тоже)
      const isMediaUploadError = 
        errorMessage.includes("BLOTTATA_MEDIA_UPLOAD_FAILED") ||
        errorMessage.includes("BLOTATA_MEDIA_UPLOAD_FAILED") ||
        errorMessage.includes("Failed to read media metadata");

      if (!isMediaUploadError) {
        // Логируем другие ошибки обработки файла
        await logError({
          userId,
          channelId: channel.id,
          channelName: channel.name,
          source: "blotato_publish",
          severity: "error",
          code: "BLOTTATA_FILE_PROCESSING_FAILED",
          message: `Ошибка при обработке файла для публикации через Blottata: ${errorMessage.substring(0, 200)}`,
          details: {
            fileId,
            fileName: result.fileName || "unknown",
            error: errorMessage.substring(0, 1000),
            errorStack: error?.stack?.substring(0, 2000)
          }
        });
      }
    }

    result.success = false;
    result.errors.push(errorMessage);
    return result;
  }
}

/**
 * Перемещает файл из входной папки в архивную папку Google Drive
 * Удаляет файл из входной папки и добавляет в архивную папку
 * Поддерживает как обычные папки, так и Shared Drives
 */
async function moveFileToArchive(
  drive: drive_v3.Drive,
  fileId: string,
  inputFolderId: string,
  archiveFolderId: string
): Promise<void> {
  // Параметры для поддержки Shared Drives (если используются)
  const driveParams = {
    supportsAllDrives: true,
    includeItemsFromAllDrives: true
  };

  try {
    Logger.info("BlottataFileProcessor: Getting file info before move", {
      fileId,
      inputFolderId,
      archiveFolderId
    });

    // Получаем текущие родители файла
    const file = await drive.files.get({
      fileId,
      fields: "id, name, parents",
      ...driveParams
    });

    const currentParents = file.data.parents || [];
    const fileName = file.data.name || "unknown";
    const isInInputFolder = currentParents.includes(inputFolderId);
    
    Logger.info("BlottataFileProcessor: File current parents", {
      fileId,
      fileName,
      currentParents,
      inputFolderId,
      archiveFolderId,
      isInInputFolder
    });
    
    // Перемещаем файл: удаляем входную папку из родителей (если файл там находится) и добавляем архивную папку
    let updateParams: any = {
      fileId,
      addParents: archiveFolderId,
      fields: "id, parents",
      ...driveParams
    };

    if (isInInputFolder) {
      // Файл находится во входной папке - удаляем его оттуда и добавляем в архивную
      updateParams.removeParents = inputFolderId;
      Logger.info("BlottataFileProcessor: Starting file move operation (remove from input, add to archive)", {
        fileId,
        fileName,
        inputFolderId,
        archiveFolderId,
        operation: "removeParents + addParents"
      });
    } else {
      // Файл не находится во входной папке - просто добавляем в архивную
      Logger.warn("BlottataFileProcessor: File is not in input folder, adding to archive anyway", {
        fileId,
        fileName,
        inputFolderId,
        archiveFolderId,
        currentParents,
        note: "File will be added to archive folder without removing from input folder"
      });
    }

    const updateResult = await drive.files.update(updateParams);

    const newParents = updateResult.data.parents || [];

    Logger.info("BlottataFileProcessor: File successfully moved from input folder to archive folder", {
      fileId,
      fileName,
      inputFolderId,
      archiveFolderId,
      previousParents: currentParents,
      newParents
    });
  } catch (error: any) {
    const errorCode = error?.code;
    const errorMessage = error?.message || String(error);
    
    Logger.error("BlottataFileProcessor: Failed to move file to archive", {
      fileId,
      inputFolderId,
      archiveFolderId,
      error: errorMessage,
      errorCode,
      errorName: error?.name,
      errorStack: error?.stack
    });

    // Детализируем ошибки доступа к Google Drive
    if (errorCode === 404) {
      throw new Error(`GOOGLE_DRIVE_FOLDER_NOT_FOUND: Folder not found (input: ${inputFolderId}, archive: ${archiveFolderId}). Check folder IDs.`);
    }
    if (errorCode === 403) {
      throw new Error(`GOOGLE_DRIVE_PERMISSION_DENIED: Access denied to folder (input: ${inputFolderId}, archive: ${archiveFolderId}). Check permissions.`);
    }
    
    throw error;
  }
}

/**
 * Скачивает файл из Google Drive (если нужен локальный доступ)
 */
export async function downloadFileFromDrive(
  fileId: string
): Promise<{ buffer: Buffer; mimeType: string; fileName: string }> {
  const drive = getDriveClient(true);

  // Получаем метаданные файла
  const fileInfo = await drive.files.get({
    fileId,
    fields: "id, name, mimeType"
  });

  const fileName = fileInfo.data.name || "file";
  const mimeType = fileInfo.data.mimeType || "application/octet-stream";

  // Скачиваем файл
  const response = await drive.files.get(
    {
      fileId,
      alt: "media"
    },
    {
      responseType: "arraybuffer"
    }
  );

  const buffer = Buffer.from(response.data as ArrayBuffer);

  Logger.info("BlottataFileProcessor: File downloaded", {
    fileId,
    fileName,
    size: buffer.length
  });

  return { buffer, mimeType, fileName };
}

