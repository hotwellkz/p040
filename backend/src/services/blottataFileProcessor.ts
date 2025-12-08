import { google, drive_v3 } from "googleapis";
import { Logger } from "../utils/logger";
import type { Channel } from "../types/channel";
import { blottataPublisherService } from "./blottataPublisherService";
import { generateYoutubeTitleAndDescription } from "./youtubeTitleDescriptionGenerator";
import { getDriveClient } from "./googleDrive";
import { normalizeYoutubeTitle } from "../utils/youtubeTitleNormalizer";

interface ProcessedFile {
  fileId: string;
  fileName: string;
  success: boolean;
  publishedPlatforms: string[];
  errors: string[];
}

/**
 * Обрабатывает файл из Google Drive: генерирует описание, публикует через Blottata, перемещает в архив
 */
export async function processBlottataFile(
  channel: Channel,
  fileId: string
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
      fileId
    });

    // 1. Получаем информацию о файле из Google Drive
    const drive = getDriveClient(true);
    const fileInfo = await drive.files.get({
      fileId,
      fields: "id, name, webContentLink, mimeType, parents"
    });

    result.fileName = fileInfo.data.name || "unknown";

    // Проверяем, что это видео
    const mimeType = fileInfo.data.mimeType || "";
    if (!mimeType.startsWith("video/")) {
      throw new Error(`File is not a video: ${mimeType}`);
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
    const publishResults = await blottataPublisherService.publishToAllPlatforms({
      channel,
      mediaUrl,
      description,
      title: normalizedTitle
    });

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

    // 5. Перемещаем файл в архивную папку
    if (channel.driveArchiveFolderId) {
      try {
        await moveFileToArchive(drive, fileId, channel.driveArchiveFolderId);
        Logger.info("BlottataFileProcessor: File moved to archive", {
          channelId: channel.id,
          fileId,
          archiveFolderId: channel.driveArchiveFolderId
        });
      } catch (moveError: any) {
        Logger.error("BlottataFileProcessor: Failed to move file to archive", {
          channelId: channel.id,
          fileId,
          error: moveError?.message || String(moveError)
        });
        // Не считаем это критической ошибкой, если публикация прошла успешно
        if (result.errors.length === 0) {
          result.errors.push(`Archive move failed: ${moveError?.message || "Unknown error"}`);
        }
      }
    } else {
      Logger.warn("BlottataFileProcessor: Archive folder not configured, file not moved", {
        channelId: channel.id,
        fileId
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
    Logger.error("BlottataFileProcessor: File processing failed", {
      channelId: channel.id,
      fileId,
      error: error?.message || String(error)
    });

    result.success = false;
    result.errors.push(error?.message || String(error));
    return result;
  }
}

/**
 * Перемещает файл из текущей папки в архивную папку
 */
async function moveFileToArchive(
  drive: drive_v3.Drive,
  fileId: string,
  archiveFolderId: string
): Promise<void> {
  try {
    // Получаем текущие родители файла
    const file = await drive.files.get({
      fileId,
      fields: "parents"
    });

    const previousParents = file.data.parents?.join(",") || "";

    // Перемещаем файл: удаляем старых родителей и добавляем архивную папку
    await drive.files.update({
      fileId,
      addParents: archiveFolderId,
      removeParents: previousParents,
      fields: "id, parents"
    });

    Logger.info("BlottataFileProcessor: File moved successfully", {
      fileId,
      archiveFolderId
    });
  } catch (error: any) {
    Logger.error("BlottataFileProcessor: Failed to move file", {
      fileId,
      archiveFolderId,
      error: error?.message || String(error)
    });
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

