import { db, isFirestoreAvailable } from "./firebaseAdmin";
import { Logger } from "../utils/logger";
import type { ErrorLog, LogErrorOptions, GetErrorsParams } from "../types/errorLog";
import { serializeError } from "../utils/serializeError";

/**
 * Логирует ошибку в базу данных
 * Не должен падать даже если сама запись ошибки не удалась
 */
export async function logError(options: LogErrorOptions): Promise<void> {
  try {
    if (!isFirestoreAvailable() || !db) {
      Logger.warn("Firestore is not available, cannot log error", {
        code: options.code,
        message: options.message,
      });
      return;
    }

    const errorLog: Omit<ErrorLog, "id"> = {
      userId: options.userId,
      channelId: options.channelId,
      channelName: options.channelName,
      source: options.source,
      severity: options.severity || "error",
      code: options.code,
      message: options.message,
      details: options.details ? serializeError(options.details) : undefined,
      createdAt: new Date().toISOString(),
      resolved: false,
    };

    // Сохраняем в коллекцию errorLogs
    await db.collection("errorLogs").add(errorLog);

    Logger.info("Error logged", {
      userId: options.userId,
      channelId: options.channelId,
      code: options.code,
      source: options.source,
    });
  } catch (error: any) {
    // Не падаем, если не удалось записать ошибку
    Logger.error("Failed to log error to database", {
      error: error?.message,
      code: options.code,
      userId: options.userId,
    });
  }
}

/**
 * Получает ошибки пользователя с фильтрацией и пагинацией
 * 
 * Упрощённая версия: использует только userId + createdAt для запроса к Firestore,
 * остальные фильтры (source, resolved, channelId) применяются в памяти.
 * 
 * ТРЕБУЕТСЯ ИНДЕКС В FIRESTORE:
 * Collection: errorLogs
 * Fields:
 *   - userId (Ascending)
 *   - createdAt (Descending)
 * 
 * Создать индекс:
 * 1. Откройте Firebase Console → Firestore Database → Indexes
 * 2. Нажмите "Create Index"
 * 3. Collection ID: errorLogs
 * 4. Добавьте поля: userId (Ascending), createdAt (Descending)
 * 5. Сохраните и дождитесь активации (обычно несколько минут)
 */
export async function getErrorsForUser(params: GetErrorsParams): Promise<{
  items: ErrorLog[];
  total: number;
}> {
  if (!isFirestoreAvailable() || !db) {
    throw new Error("Firestore is not available");
  }

  const { userId, limit = 20, offset = 0, filter } = params;

  // Максимальное количество записей для загрузки из Firestore
  // Загружаем больше, чем нужно, чтобы после фильтрации в памяти хватило на пагинацию
  const MAX_FETCH_LIMIT = 500;
  const fetchLimit = Math.min(MAX_FETCH_LIMIT, (offset + limit) * 3); // загружаем в 3 раза больше для запаса

  // Базовый запрос — только userId + createdAt (требует один индекс)
  let query: FirebaseFirestore.Query = db
    .collection("errorLogs")
    .where("userId", "==", userId)
    .orderBy("createdAt", "desc")
    .limit(fetchLimit);

  const snapshot = await query.get();

  // Преобразуем в массив ErrorLog
  let items: ErrorLog[] = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Omit<ErrorLog, "id">),
  }));

  // Применяем фильтры в памяти
  if (filter?.resolved !== undefined) {
    items = items.filter((item) => item.resolved === filter.resolved);
  }

  if (filter?.source) {
    items = items.filter((item) => item.source === filter.source);
  }

  if (filter?.channelId) {
    items = items.filter((item) => item.channelId === filter.channelId);
  }

  // Общее количество после фильтрации
  const total = items.length;

  // Применяем пагинацию
  const paginatedItems = items.slice(offset, offset + limit);

  return { items: paginatedItems, total };
}

/**
 * Помечает ошибки как решённые
 */
export async function markErrorsResolved(params: {
  userId: string;
  ids?: string[]; // если не указано — резолвим все нерешённые ошибки пользователя
}): Promise<void> {
  if (!isFirestoreAvailable() || !db) {
    throw new Error("Firestore is not available");
  }

  const { userId, ids } = params;
  const resolvedAt = new Date().toISOString();

  if (ids && ids.length > 0) {
    // Резолвим конкретные ошибки
    const batch = db.batch();
    for (const id of ids) {
      const errorRef = db.collection("errorLogs").doc(id);
      const errorDoc = await errorRef.get();

      // Проверяем, что ошибка принадлежит пользователю
      if (errorDoc.exists && errorDoc.data()?.userId === userId) {
        batch.update(errorRef, {
          resolved: true,
          resolvedAt,
        });
      }
    }
    await batch.commit();
  } else {
    // Резолвим все нерешённые ошибки пользователя
    const snapshot = await db
      .collection("errorLogs")
      .where("userId", "==", userId)
      .where("resolved", "==", false)
      .get();

    if (snapshot.empty) {
      return;
    }

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.update(doc.ref, {
        resolved: true,
        resolvedAt,
      });
    });
    await batch.commit();
  }

  Logger.info("Errors marked as resolved", {
    userId,
    count: ids?.length || "all",
  });
}

/**
 * Получает количество нерешённых ошибок пользователя
 * 
 * Упрощённая версия: использует только userId, фильтр по resolved применяется в памяти
 */
export async function getUnresolvedErrorCount(userId: string): Promise<number> {
  if (!isFirestoreAvailable() || !db) {
    return 0;
  }

  try {
    // Загружаем все ошибки пользователя (или ограничиваем разумным лимитом)
    const snapshot = await db
      .collection("errorLogs")
      .where("userId", "==", userId)
      .limit(1000) // разумный лимит для подсчёта
      .get();

    // Фильтруем нерешённые в памяти
    const unresolvedCount = snapshot.docs.filter(
      (doc) => !doc.data().resolved
    ).length;

    return unresolvedCount;
  } catch (error: any) {
    Logger.error("Failed to get unresolved error count", {
      error: error?.message,
      userId,
    });
    return 0;
  }
}


