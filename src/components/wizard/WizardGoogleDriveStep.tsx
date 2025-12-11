import { useState, useEffect, useRef } from "react";
import { Loader2, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import {
  getGoogleDriveStatus,
  getGoogleDriveAuthUrl,
  type GoogleDriveIntegrationStatus
} from "../../api/googleDriveIntegration";
import { FieldHelpIcon } from "../aiAssistant/FieldHelpIcon";

interface WizardGoogleDriveStepProps {
  onComplete: () => void;
  onSkip?: () => void;
}

export function WizardGoogleDriveStep({ onComplete, onSkip }: WizardGoogleDriveStepProps) {
  const [status, setStatus] = useState<GoogleDriveIntegrationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const popupRef = useRef<Window | null>(null);
  const checkIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    loadStatus();
    
    // Обработчик сообщений от popup-окна
    const handleMessage = (event: MessageEvent) => {
      // Проверяем origin для безопасности
      const allowedOrigins = [
        window.location.origin,
        import.meta.env.VITE_API_URL?.replace(/\/api$/, "") || "http://localhost:8080"
      ];
      
      if (!allowedOrigins.some(origin => event.origin.startsWith(origin))) {
        return;
      }

      if (event.data?.type === "GOOGLE_DRIVE_CONNECTED") {
        // Закрываем popup, если он ещё открыт
        if (popupRef.current && !popupRef.current.closed) {
          popupRef.current.close();
        }
        if (checkIntervalRef.current) {
          clearInterval(checkIntervalRef.current);
          checkIntervalRef.current = null;
        }
        
        // Обновляем статус и переходим к следующему шагу
        setTimeout(() => {
          void loadStatus();
        }, 500);
      } else if (event.data?.type === "GOOGLE_DRIVE_ERROR") {
        setError(event.data.message || "Не удалось подключить Google Drive");
        setConnecting(false);
        if (popupRef.current && !popupRef.current.closed) {
          popupRef.current.close();
        }
        if (checkIntervalRef.current) {
          clearInterval(checkIntervalRef.current);
          checkIntervalRef.current = null;
        }
      }
    };

    window.addEventListener("message", handleMessage);
    
    return () => {
      window.removeEventListener("message", handleMessage);
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
      if (popupRef.current && !popupRef.current.closed) {
        popupRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    // Если Google Drive уже подключен, автоматически переходим к следующему шагу
    if (status?.connected) {
      const timer = setTimeout(() => {
        onComplete();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [status?.connected, onComplete]);

  const loadStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const currentStatus = await getGoogleDriveStatus();
      setStatus(currentStatus);
    } catch (err: any) {
      setError(err.message || "Не удалось загрузить статус");
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      setConnecting(true);
      setError(null);
      
      const { authUrl } = await getGoogleDriveAuthUrl();
      
      // Сохраняем информацию о том, что мы в мастере
      sessionStorage.setItem("wizard_google_drive_step", "true");
      
      // Открываем popup для OAuth авторизации
      const width = 600;
      const height = 800;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      popupRef.current = window.open(
        authUrl,
        "googleDriveAuth",
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
      );

      if (!popupRef.current) {
        throw new Error("Не удалось открыть окно авторизации. Разрешите всплывающие окна в настройках браузера.");
      }

      // Проверяем, закрылось ли окно (пользователь может закрыть его вручную)
      checkIntervalRef.current = window.setInterval(() => {
        if (popupRef.current?.closed) {
          if (checkIntervalRef.current) {
            clearInterval(checkIntervalRef.current);
            checkIntervalRef.current = null;
          }
          // Если окно закрыто, но мы не получили сообщение об успехе, считаем что пользователь отменил
          setConnecting(false);
        }
      }, 500);
      
    } catch (err: any) {
      let errorMsg = err.message || "Не удалось получить URL авторизации";
      
      if (err.code === "ROUTE_NOT_FOUND" || err.message?.includes("404")) {
        errorMsg = "Маршрут не найден на сервере. Убедитесь, что backend сервер запущен.";
      }
      
      setError(errorMsg);
      setConnecting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-brand-light" />
      </div>
    );
  }

  const currentStatus = status?.connected ? "connected" : "not_connected";

  // Если уже подключен, показываем успешное сообщение
  if (currentStatus === "connected") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-900/20 p-4">
          <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          <div>
            <div className="font-medium text-white">✅ Google Drive успешно подключён</div>
            {status?.email && (
              <div className="text-sm text-slate-400">{status.email}</div>
            )}
          </div>
        </div>
        <p className="text-sm text-slate-400">Переходим к следующему шагу...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h3 className="text-base font-semibold md:text-lg">Подключение Google Drive</h3>
        <FieldHelpIcon
          fieldKey="wizard.google_drive_connection"
          page="wizard"
          channelContext={{
            step: "google_drive_connection",
            context: "wizard"
          }}
          label="Подключение Google Drive"
        />
      </div>
      <p className="text-xs text-slate-400 md:text-sm">
        Подключите Google Drive, чтобы система могла автоматически сохранять и забирать ваши видео.
      </p>

      {/* Статус интеграции */}
      <div className="rounded-lg border border-white/10 bg-slate-900/50 p-4">
        {status?.connected ? (
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            <div className="flex-1">
              <div className="font-medium text-white">Статус: подключен</div>
              {status.email && (
                <div className="text-sm text-slate-400">{status.email}</div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <XCircle className="h-5 w-5 text-slate-400" />
            <div className="font-medium text-white">Статус: не подключен</div>
          </div>
        )}
      </div>

      {/* Ошибки */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-900/20 p-3">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-400" />
          <div className="flex-1 text-sm text-red-300">{error}</div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-300"
          >
            ✕
          </button>
        </div>
      )}

      {/* Кнопка подключения */}
      {currentStatus === "not_connected" && (
        <div className="space-y-4">
          <button
            type="button"
            onClick={handleConnect}
            disabled={connecting}
            className="w-full rounded-lg bg-brand px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {connecting ? (
              <>
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                Подключение...
              </>
            ) : (
              "Подключить Google Drive"
            )}
          </button>
          
          {connecting && (
            <p className="text-xs text-slate-400 text-center">
              Откроется окно авторизации Google. После успешного подключения оно закроется автоматически.
            </p>
          )}
          
          {onSkip && (
            <button
              type="button"
              onClick={onSkip}
              disabled={connecting}
              className="w-full rounded-lg border border-white/20 bg-slate-800/50 px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-700/50 disabled:opacity-50"
            >
              Пропустить (можно подключить позже)
            </button>
          )}
        </div>
      )}

      {/* Если уже подключен, показываем кнопку управления */}
      {currentStatus === "connected" && (
        <div className="text-center">
          <p className="text-xs text-slate-400">
            Вы можете управлять интеграцией в{" "}
            <a
              href="/settings"
              target="_blank"
              className="text-brand hover:text-brand/80 underline"
            >
              настройках аккаунта
            </a>
          </p>
        </div>
      )}
    </div>
  );
}

