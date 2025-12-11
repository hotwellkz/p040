import { Router } from "express";
import { authRequired } from "../middleware/auth";
import {
  getErrorsForUser,
  markErrorsResolved,
  getUnresolvedErrorCount,
} from "../services/errorLogger";
import { Logger } from "../utils/logger";
import type { ErrorSource } from "../types/errorLog";

const router = Router();

/**
 * GET /api/error-logs
 * Получает список ошибок пользователя с фильтрацией и пагинацией
 */
router.get("/", authRequired, async (req, res) => {
  try {
    const userId = req.user!.uid;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const offset = (page - 1) * pageSize;

    const filter: {
      source?: ErrorSource;
      resolved?: boolean;
      channelId?: string;
    } = {};

    if (req.query.resolved !== undefined) {
      filter.resolved = req.query.resolved === "true";
    }

    if (req.query.source) {
      filter.source = req.query.source as ErrorSource;
    }

    if (req.query.channelId) {
      filter.channelId = req.query.channelId as string;
    }

    const result = await getErrorsForUser({
      userId,
      limit: pageSize,
      offset,
      filter,
    });

    res.json({
      items: result.items,
      page,
      pageSize,
      total: result.total,
    });
  } catch (error: any) {
    Logger.error("Failed to get error logs", error);

    // Специальная обработка ошибки Firestore индекса
    // Код 9 = FAILED_PRECONDITION в gRPC/Firestore
    if (
      error?.code === 9 ||
      error?.code === "failed-precondition" ||
      error?.message?.includes("requires an index") ||
      error?.message?.includes("FAILED_PRECONDITION")
    ) {
      return res.status(503).json({
        error: "Index required",
        message:
          "Для запроса журнала ошибок требуется индекс Firestore. " +
          "Зайдите в консоль Firebase (Firestore Database → Indexes) и создайте составной индекс: " +
          "Collection: errorLogs, Fields: userId (Ascending), createdAt (Descending).",
        needsIndex: true,
        indexDetails: {
          collection: "errorLogs",
          fields: [
            { field: "userId", order: "ASCENDING" },
            { field: "createdAt", order: "DESCENDING" },
          ],
        },
      });
    }

    res.status(500).json({
      error: "Internal server error",
      message: error?.message || "Ошибка при получении списка ошибок",
    });
  }
});

/**
 * GET /api/error-logs/unresolved-count
 * Получает количество нерешённых ошибок пользователя (для бейджа)
 */
router.get("/unresolved-count", authRequired, async (req, res) => {
  try {
    const userId = req.user!.uid;
    const count = await getUnresolvedErrorCount(userId);

    res.json({ count });
  } catch (error: any) {
    Logger.error("Failed to get unresolved error count", error);
    res.status(500).json({
      error: "Internal server error",
      message: error?.message || "Ошибка при получении количества ошибок",
    });
  }
});

/**
 * POST /api/error-logs/clear
 * Помечает ошибки как решённые
 */
router.post("/clear", authRequired, async (req, res) => {
  try {
    const userId = req.user!.uid;
    const { mode = "all", ids } = req.body;

    if (mode === "all") {
      // Помечаем все ошибки как решённые
      await markErrorsResolved({ userId });
    } else if (mode === "byIds" && Array.isArray(ids) && ids.length > 0) {
      // Помечаем конкретные ошибки
      await markErrorsResolved({ userId, ids });
    } else {
      return res.status(400).json({
        error: "Invalid request",
        message: "Неверный формат запроса",
      });
    }

    res.json({ success: true });
  } catch (error: any) {
    Logger.error("Failed to clear error logs", error);
    res.status(500).json({
      error: "Internal server error",
      message: error?.message || "Ошибка при очистке ошибок",
    });
  }
});

export default router;


