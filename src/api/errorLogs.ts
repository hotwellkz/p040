import { getAuthToken } from "../utils/auth";

const backendBaseUrl =
  (import.meta.env.VITE_BACKEND_URL as string | undefined) ||
  "http://localhost:8080";

export type ErrorSource =
  | "telegram_download"
  | "telegram_send"
  | "google_drive_upload"
  | "google_drive_auth"
  | "blotato_publish"
  | "schedule_runner"
  | "other";

export type ErrorSeverity = "info" | "warning" | "error";

export interface ErrorLog {
  id: string;
  userId: string;
  channelId?: string;
  channelName?: string;
  source: ErrorSource;
  severity: ErrorSeverity;
  code: string;
  message: string;
  details?: any;
  createdAt: string;
  resolved: boolean;
  resolvedAt?: string;
}

export interface GetErrorLogsParams {
  page?: number;
  pageSize?: number;
  resolved?: boolean;
  source?: ErrorSource;
  channelId?: string;
}

export interface GetErrorLogsResponse {
  items: ErrorLog[];
  page: number;
  pageSize: number;
  total: number;
}

export interface UnresolvedCountResponse {
  count: number;
}

/**
 * Обрабатывает сетевые ошибки и возвращает понятное сообщение
 */
function handleNetworkError(error: unknown): Error {
  if (error instanceof TypeError) {
    if (
      error.message.includes("Failed to fetch") ||
      error.message.includes("ERR_CONNECTION_REFUSED") ||
      error.message.includes("NetworkError") ||
      error.message.includes("network")
    ) {
      return new Error(
        "Не удалось подключиться к серверу. Проверьте, что backend запущен и доступен по адресу " +
          backendBaseUrl
      );
    }
  }
  
  if (error instanceof Error) {
    return error;
  }
  
  return new Error("Неизвестная ошибка при загрузке данных");
}

/**
 * Получает список ошибок пользователя
 */
export async function getErrorLogs(
  params: GetErrorLogsParams = {}
): Promise<GetErrorLogsResponse> {
  try {
    const token = await getAuthToken();
    const queryParams = new URLSearchParams();

    if (params.page !== undefined) {
      queryParams.append("page", params.page.toString());
    }
    if (params.pageSize !== undefined) {
      queryParams.append("pageSize", params.pageSize.toString());
    }
    if (params.resolved !== undefined) {
      queryParams.append("resolved", params.resolved.toString());
    }
    if (params.source) {
      queryParams.append("source", params.source);
    }
    if (params.channelId) {
      queryParams.append("channelId", params.channelId);
    }

    const response = await fetch(
      `${backendBaseUrl}/api/error-logs?${queryParams.toString()}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      let errorData: any = {};
      try {
        errorData = await response.json();
      } catch {
        // Если не удалось распарсить JSON, используем пустой объект
      }
      
      // Создаём объект ошибки с дополнительной информацией
      const error = new Error(
        errorData.message || "Не удалось получить список ошибок"
      ) as Error & { needsIndex?: boolean; indexDetails?: any };
      
      // Сохраняем информацию об ошибке индекса для фронтенда
      if (errorData.needsIndex) {
        error.needsIndex = true;
        error.indexDetails = errorData.indexDetails;
      }
      
      throw error;
    }

    return response.json();
  } catch (error) {
    // Если это уже наша ошибка с needsIndex, пробрасываем её дальше
    if (error instanceof Error && (error as any).needsIndex) {
      throw error;
    }
    throw handleNetworkError(error);
  }
}

/**
 * Получает количество нерешённых ошибок
 */
export async function getUnresolvedErrorCount(): Promise<number> {
  try {
    const token = await getAuthToken();

    const response = await fetch(`${backendBaseUrl}/api/error-logs/unresolved-count`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      let errorData: any = {};
      try {
        errorData = await response.json();
      } catch {
        // Если не удалось распарсить JSON, используем пустой объект
      }
      throw new Error(
        errorData.message || "Не удалось получить количество ошибок"
      );
    }

    const data: UnresolvedCountResponse = await response.json();
    return data.count;
  } catch (error) {
    // Для этой функции возвращаем 0 при ошибке, чтобы не ломать UI
    // (бейдж с количеством ошибок не критичен)
    console.error("Failed to get unresolved error count:", error);
    return 0;
  }
}

/**
 * Помечает ошибки как решённые
 */
export async function clearErrorLogs(params: {
  mode: "all" | "byIds";
  ids?: string[];
}): Promise<void> {
  try {
    const token = await getAuthToken();

    const response = await fetch(`${backendBaseUrl}/api/error-logs/clear`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      let errorData: any = {};
      try {
        errorData = await response.json();
      } catch {
        // Если не удалось распарсить JSON, используем пустой объект
      }
      throw new Error(errorData.message || "Не удалось очистить ошибки");
    }
  } catch (error) {
    throw handleNetworkError(error);
  }
}


