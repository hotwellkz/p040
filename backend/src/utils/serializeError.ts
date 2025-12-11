/**
 * Сериализует ошибку для безопасного сохранения в БД
 * Извлекает только необходимые поля, исключая чувствительные данные
 */
export function serializeError(error: any): any {
  if (!error) {
    return null;
  }

  // Если это уже сериализованный объект
  if (typeof error === "object" && !error.stack && !error.message) {
    return error;
  }

  const serialized: any = {
    message: error?.message || String(error),
    name: error?.name,
    code: error?.code,
    className: error?.className,
    error_code: error?.error_code,
    error_message: error?.error_message,
  };

  // Добавляем stack только в development режиме или если это критично
  if (process.env.NODE_ENV === "development" || process.env.LOG_STACK_TRACES === "true") {
    serialized.stack = error?.stack;
  }

  // Обрабатываем HTTP ошибки
  if (error?.response) {
    serialized.response = {
      status: error.response.status,
      statusText: error.response.statusText,
      data: error.response.data,
    };
  }

  // Обрабатываем ошибки с полем errors (например, Google API)
  if (error?.errors) {
    serialized.errors = error.errors;
  }

  // Удаляем чувствительные данные
  const sensitiveKeys = ["password", "token", "secret", "key", "auth", "authorization"];
  const cleanObject = (obj: any): any => {
    if (typeof obj !== "object" || obj === null) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(cleanObject);
    }

    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      if (sensitiveKeys.some((sk) => lowerKey.includes(sk))) {
        cleaned[key] = "[REDACTED]";
      } else if (typeof value === "object" && value !== null) {
        cleaned[key] = cleanObject(value);
      } else {
        cleaned[key] = value;
      }
    }
    return cleaned;
  };

  return cleanObject(serialized);
}


