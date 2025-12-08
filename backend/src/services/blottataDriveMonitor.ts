import { Logger } from "../utils/logger";
import { getDriveClient } from "./googleDrive";
import { processBlottataFile } from "./blottataFileProcessor";
import type { Channel } from "../types/channel";
import { db, isFirestoreAvailable } from "./firebaseAdmin";

/**
 * Хранилище обработанных файлов для предотвращения повторной обработки
 * Ключ: `${channelId}:${fileId}`
 * Значение: timestamp обработки
 */
const processedFiles = new Map<string, number>();

/**
 * Проверяет, был ли файл уже обработан
 */
async function isFileProcessed(channelId: string, fileId: string): Promise<boolean> {
  // Проверяем в памяти
  const memoryKey = `${channelId}:${fileId}`;
  if (processedFiles.has(memoryKey)) {
    return true;
  }

  // Проверяем в Firestore (для персистентности между перезапусками)
  if (isFirestoreAvailable() && db) {
    try {
      const processedRef = db
        .collection("blottataProcessedFiles")
        .doc(memoryKey);

      const doc = await processedRef.get();
      if (doc.exists) {
        // Обновляем кэш в памяти
        const data = doc.data();
        if (data?.processedAt) {
          processedFiles.set(memoryKey, data.processedAt);
          return true;
        }
      }
    } catch (error) {
      Logger.warn("blottataDriveMonitor: Failed to check Firestore for processed file", {
        channelId,
        fileId,
        error: error instanceof Error ? error.message : String(error)
      });
      // Продолжаем выполнение, если проверка не удалась
    }
  }

  return false;
}

/**
 * Помечает файл как обработанный
 */
async function markFileAsProcessed(channelId: string, fileId: string): Promise<void> {
  const memoryKey = `${channelId}:${fileId}`;
  const processedAt = Date.now();

  // Сохраняем в памяти
  processedFiles.set(memoryKey, processedAt);

  // Сохраняем в Firestore для персистентности
  if (isFirestoreAvailable() && db) {
    try {
      await db
        .collection("blottataProcessedFiles")
        .doc(memoryKey)
        .set({
          channelId,
          fileId,
          processedAt,
          processedAtISO: new Date(processedAt).toISOString()
        });
    } catch (error) {
      Logger.warn("blottataDriveMonitor: Failed to save processed file to Firestore", {
        channelId,
        fileId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

/**
 * Получает список новых файлов в папке Google Drive
 */
export async function getNewFilesInFolder(
  folderId: string,
  lastCheckTime?: number
): Promise<Array<{ id: string; name: string; createdTime: string; webContentLink?: string }>> {
  const drive = getDriveClient(true);

  try {
    const query = `'${folderId}' in parents and trashed = false and mimeType contains 'video/'`;
    
    const response = await drive.files.list({
      q: query,
      fields: "files(id, name, createdTime, webContentLink, mimeType)",
      orderBy: "createdTime desc",
      pageSize: 50
    });

    const files = (response.data.files || []).map((file) => ({
      id: file.id!,
      name: file.name || "unknown",
      createdTime: file.createdTime || new Date().toISOString(),
      webContentLink: file.webContentLink || undefined
    }));

    // Фильтруем по времени создания, если указано
    if (lastCheckTime) {
      return files.filter((file) => {
        const fileTime = new Date(file.createdTime).getTime();
        return fileTime > lastCheckTime;
      });
    }

    return files;
  } catch (error: any) {
    const errorCode = error?.code;
    const errorMessage = error?.message || String(error);
    
    Logger.error("blottataDriveMonitor: Failed to list files in folder", {
      folderId,
      error: errorMessage,
      code: errorCode,
      errorName: error?.name,
      errorStack: error?.stack
    });

    // Детализируем ошибки доступа к Google Drive
    if (errorCode === 404) {
      throw new Error(`GOOGLE_DRIVE_FOLDER_NOT_FOUND: Folder not found (ID: ${folderId}). Check folder ID.`);
    }
    if (errorCode === 403) {
      throw new Error(`GOOGLE_DRIVE_PERMISSION_DENIED: Access denied to folder (ID: ${folderId}). Check permissions.`);
    }
    
    throw error;
  }
}

/**
 * Обрабатывает новые файлы для канала
 */
export async function processNewFilesForChannel(channel: Channel): Promise<{
  processed: number;
  skipped: number;
  errors: number;
}> {
  const result = {
    processed: 0,
    skipped: 0,
    errors: 0
  };

  if (!channel.blotataEnabled || !channel.driveInputFolderId) {
    return result;
  }

  try {
    Logger.info("blottataDriveMonitor: Checking folder for new files", {
      channelId: channel.id,
      folderId: channel.driveInputFolderId
    });

    // Получаем список файлов в папке
    const files = await getNewFilesInFolder(channel.driveInputFolderId);

    Logger.info("blottataDriveMonitor: Found files in folder", {
      channelId: channel.id,
      folderId: channel.driveInputFolderId,
      filesCount: files.length
    });

    // Обрабатываем каждый файл
    for (const file of files) {
      // Проверяем, не был ли файл уже обработан
      if (await isFileProcessed(channel.id, file.id)) {
        Logger.info("blottataDriveMonitor: File already processed, skipping", {
          channelId: channel.id,
          fileId: file.id,
          fileName: file.name
        });
        result.skipped++;
        continue;
      }

      try {
        // Обрабатываем файл
        const processResult = await processBlottataFile(channel, file.id);

        if (processResult.success) {
          // Помечаем файл как обработанный
          await markFileAsProcessed(channel.id, file.id);
          result.processed++;

          Logger.info("blottataDriveMonitor: File processed successfully", {
            channelId: channel.id,
            fileId: file.id,
            fileName: file.name,
            publishedPlatforms: processResult.publishedPlatforms
          });
        } else {
          result.errors++;
          Logger.error("blottataDriveMonitor: File processing failed", {
            channelId: channel.id,
            fileId: file.id,
            fileName: file.name,
            errors: processResult.errors
          });
        }
      } catch (error: any) {
        result.errors++;
        Logger.error("blottataDriveMonitor: Error processing file", {
          channelId: channel.id,
          fileId: file.id,
          fileName: file.name,
          error: error?.message || String(error)
        });
      }
    }

    return result;
  } catch (error: any) {
    Logger.error("blottataDriveMonitor: Error checking folder", {
      channelId: channel.id,
      channelName: channel.name,
      folderId: channel.driveInputFolderId,
      error: error?.message || String(error),
      errorCode: error?.code,
      errorStack: error?.stack
    });
    // Не пробрасываем ошибку дальше, чтобы не блокировать обработку других каналов
    // Вместо этого возвращаем результат с ошибкой
    result.errors++;
    return result;
  }
}

/**
 * Получает все каналы с включенной Blottata автоматизацией
 */
export async function getChannelsWithBlottataEnabled(): Promise<Channel[]> {
  if (!isFirestoreAvailable() || !db) {
    Logger.warn("blottataDriveMonitor: Firestore is not available");
    return [];
  }

  const channels: Channel[] = [];

  try {
    // Используем Collection Group Query для поиска всех каналов
    const channelsSnapshot = await db.collectionGroup("channels").get();

    for (const doc of channelsSnapshot.docs) {
      const data = doc.data();
      
      // Проверяем, включена ли Blottata автоматизация
      if (data.blotataEnabled === true && data.driveInputFolderId) {
        const channel: Channel = {
          id: doc.id,
          ...data,
          createdAt: data.createdAt || { seconds: 0, nanoseconds: 0 },
          updatedAt: data.updatedAt || { seconds: 0, nanoseconds: 0 }
        } as Channel;

        channels.push(channel);
      }
    }

    Logger.info("blottataDriveMonitor: Found channels with Blottata enabled", {
      count: channels.length,
      channelIds: channels.map((c) => c.id)
    });

    return channels;
  } catch (error: any) {
    Logger.error("blottataDriveMonitor: Failed to get channels", {
      error: error?.message || String(error)
    });
    return [];
  }
}

/**
 * Основная функция мониторинга - проверяет все каналы с Blottata и обрабатывает новые файлы
 */
export async function processBlottataTick(): Promise<void> {
  const startTime = Date.now();
  Logger.info("blottataDriveMonitor: Starting Blottata monitoring tick", {
    timestamp: new Date().toISOString()
  });

  try {
    // Получаем все каналы с включенной Blottata
    const channels = await getChannelsWithBlottataEnabled();

    if (channels.length === 0) {
      Logger.info("blottataDriveMonitor: No channels with Blottata enabled");
      return;
    }

    Logger.info("blottataDriveMonitor: Processing channels", {
      channelsCount: channels.length
    });

    let totalProcessed = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    // Обрабатываем каждый канал
    for (const channel of channels) {
      try {
        Logger.info("blottataDriveMonitor: Starting processing for channel", {
          channelId: channel.id,
          channelName: channel.name,
          folderId: channel.driveInputFolderId
        });

        const result = await processNewFilesForChannel(channel);
        totalProcessed += result.processed;
        totalSkipped += result.skipped;
        totalErrors += result.errors;
        
        if (result.errors > 0) {
          Logger.warn("blottataDriveMonitor: Channel processing completed with errors", {
            channelId: channel.id,
            channelName: channel.name,
            folderId: channel.driveInputFolderId,
            processed: result.processed,
            skipped: result.skipped,
            errors: result.errors
          });
        } else if (result.processed > 0 || result.skipped > 0) {
          Logger.info("blottataDriveMonitor: Channel processing completed successfully", {
            channelId: channel.id,
            channelName: channel.name,
            processed: result.processed,
            skipped: result.skipped
          });
        }
      } catch (error: any) {
        totalErrors++;
        Logger.error("blottataDriveMonitor: Error processing channel (exception caught)", {
          channelId: channel.id,
          channelName: channel.name,
          folderId: channel.driveInputFolderId,
          error: error?.message || String(error),
          errorCode: error?.code,
          errorName: error?.name,
          errorStack: error?.stack
        });
      }
    }

    const duration = Date.now() - startTime;
    Logger.info("blottataDriveMonitor: Monitoring tick completed", {
      duration,
      channelsProcessed: channels.length,
      totalProcessed,
      totalSkipped,
      totalErrors
    });
  } catch (error: any) {
    Logger.error("blottataDriveMonitor: Error in monitoring tick", {
      error: error?.message || String(error),
      stack: error?.stack
    });
  }
}

