import { CheckCircle2, XCircle, Loader2, ExternalLink, HelpCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useIntegrationsStatus } from "../hooks/useIntegrationsStatus";
import { getGoogleDriveAuthUrl } from "../api/googleDriveIntegration";
import { SectionHelpButton } from "./aiAssistant/SectionHelpButton";
import { useState } from "react";

interface IntegrationsStatusBlockProps {
  onTelegramConnect?: () => void;
  onGoogleDriveConnect?: () => void;
}

export function IntegrationsStatusBlock({
  onTelegramConnect,
  onGoogleDriveConnect
}: IntegrationsStatusBlockProps) {
  const { status, refreshStatus } = useIntegrationsStatus();
  const navigate = useNavigate();
  const [connectingGoogleDrive, setConnectingGoogleDrive] = useState(false);

  const handleConnectTelegram = () => {
    if (onTelegramConnect) {
      onTelegramConnect();
    } else {
      // Открываем страницу настроек с фокусом на Telegram
      navigate("/settings");
    }
  };

  const handleConnectGoogleDrive = async () => {
    if (onGoogleDriveConnect) {
      onGoogleDriveConnect();
      return;
    }

    try {
      setConnectingGoogleDrive(true);
      const { authUrl } = await getGoogleDriveAuthUrl();
      // Открываем OAuth в новом окне или перенаправляем
      window.location.href = authUrl;
    } catch (error: any) {
      console.error("Failed to connect Google Drive:", error);
      alert(`Не удалось подключить Google Drive: ${error.message || "Неизвестная ошибка"}`);
      setConnectingGoogleDrive(false);
    }
  };

  const handleManageInSettings = (integration: "telegram" | "googleDrive") => {
    navigate("/settings");
  };

  return (
    <div className="space-y-4 rounded-xl border border-white/10 bg-slate-900/60 p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Статус интеграций
        </h3>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Telegram интеграция */}
        <div className="rounded-lg border border-white/10 bg-slate-950/60 p-4">
          <div className="mb-3 flex items-start justify-between">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold text-slate-200">Telegram</h4>
              <SectionHelpButton
                sectionKey="telegram_integration"
                sectionTitle="Telegram интеграция"
                currentStatus={status.telegram.connected ? "connected" : "not_connected"}
                context={{ phoneNumber: status.telegram.phoneNumber }}
              />
            </div>
            {status.telegram.loading ? (
              <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
            ) : status.telegram.connected ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            ) : (
              <XCircle className="h-5 w-5 text-red-400" />
            )}
          </div>

          {status.telegram.loading ? (
            <p className="text-xs text-slate-400">Загрузка статуса...</p>
          ) : status.telegram.connected ? (
            <>
              <p className="mb-2 text-sm font-medium text-emerald-300">
                ✅ Telegram подключён
              </p>
              {status.telegram.phoneNumber && (
                <p className="mb-3 text-xs text-slate-400">
                  {status.telegram.phoneNumber}
                </p>
              )}
              <button
                type="button"
                onClick={() => handleManageInSettings("telegram")}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-slate-800/50 px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-slate-700/50"
              >
                <ExternalLink className="h-3 w-3" />
                Управлять в настройках
              </button>
            </>
          ) : (
            <>
              <p className="mb-2 text-sm font-medium text-red-300">
                ❌ Telegram не подключён
              </p>
              <p className="mb-3 text-xs text-slate-400">
                Подключите Telegram, чтобы система могла отправлять промпты и сообщения от вашего имени
              </p>
              <button
                type="button"
                onClick={handleConnectTelegram}
                className="w-full rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand/90"
                aria-label="Подключить Telegram"
              >
                Подключить Telegram
              </button>
            </>
          )}
        </div>

        {/* Google Drive интеграция */}
        <div className="rounded-lg border border-white/10 bg-slate-950/60 p-4">
          <div className="mb-3 flex items-start justify-between">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold text-slate-200">Google Drive</h4>
              <SectionHelpButton
                sectionKey="google_drive_integration"
                sectionTitle="Google Drive интеграция"
                currentStatus={status.googleDrive.connected ? "connected" : "not_connected"}
                context={{ email: status.googleDrive.email }}
              />
            </div>
            {status.googleDrive.loading ? (
              <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
            ) : status.googleDrive.connected ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            ) : (
              <XCircle className="h-5 w-5 text-red-400" />
            )}
          </div>

          {status.googleDrive.loading ? (
            <p className="text-xs text-slate-400">Загрузка статуса...</p>
          ) : status.googleDrive.connected ? (
            <>
              <p className="mb-2 text-sm font-medium text-emerald-300">
                ✅ Google Drive подключён
              </p>
              {status.googleDrive.email && (
                <p className="mb-3 text-xs text-slate-400">
                  {status.googleDrive.email}
                </p>
              )}
              <button
                type="button"
                onClick={() => handleManageInSettings("googleDrive")}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-slate-800/50 px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-slate-700/50"
              >
                <ExternalLink className="h-3 w-3" />
                Управлять в настройках
              </button>
            </>
          ) : (
            <>
              <p className="mb-2 text-sm font-medium text-red-300">
                ❌ Google Drive не подключён
              </p>
              <p className="mb-3 text-xs text-slate-400">
                Нужен для автоматической загрузки и архивации видео на ваш диск
              </p>
              <button
                type="button"
                onClick={handleConnectGoogleDrive}
                disabled={connectingGoogleDrive}
                className="w-full rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Подключить Google Drive"
              >
                {connectingGoogleDrive ? (
                  <>
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                    Подключение...
                  </>
                ) : (
                  "Подключить Google Drive"
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}


