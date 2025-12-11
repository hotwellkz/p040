/**
 * Типы источников ошибок
 */
export type ErrorSource =
  | "telegram_download"
  | "telegram_send"
  | "google_drive_upload"
  | "google_drive_auth"
  | "blotato_publish"
  | "schedule_runner"
  | "other";

/**
 * Уровень важности ошибки
 */
export type ErrorSeverity = "info" | "warning" | "error";

/**
 * Модель данных для логирования ошибок
 */
export interface ErrorLog {
  id: string; // ID в БД
  userId: string; // владелец, чтобы показывать только его ошибки
  channelId?: string; // на какой канал относится (если есть)
  channelName?: string;
  source: ErrorSource;
  severity: ErrorSeverity;
  code: string; // машинное имя ошибки (например, TELEGRAM_VIDEO_DOWNLOAD_FAILED)
  message: string; // короткое человекочитаемое описание (на русском)
  details?: any; // JSON с тех. деталями для отладки (stack, raw error, payload и т.д.)
  createdAt: string; // ISO-дата/время создания
  resolved: boolean; // помечена как решённая/очищенная
  resolvedAt?: string;
}

/**
 * Параметры для логирования ошибки
 */
export interface LogErrorOptions {
  userId: string;
  channelId?: string;
  channelName?: string;
  source: ErrorSource;
  severity?: ErrorSeverity;
  code: string;
  message: string;
  details?: any;
}

/**
 * Параметры для получения ошибок пользователя
 */
export interface GetErrorsParams {
  userId: string;
  limit?: number;
  offset?: number;
  filter?: {
    source?: ErrorSource;
    resolved?: boolean;
    channelId?: string;
  };
}



