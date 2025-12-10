import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { confirmGoogleDriveCode } from "../../api/googleDriveIntegration";

const GoogleDriveCallbackPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get("code");
      const errorParam = searchParams.get("error");

      if (errorParam) {
        setStatus("error");
        setError(`Ошибка авторизации: ${errorParam}`);
        return;
      }

      if (!code) {
        setStatus("error");
        setError("Код авторизации не получен");
        return;
      }

      try {
        const result = await confirmGoogleDriveCode(code);
        setStatus("success");
        
        // Проверяем, открыто ли это окно в popup (из мастера)
        const isPopup = window.opener && window.opener !== window;
        const isWizard = sessionStorage.getItem("wizard_google_drive_step") === "true";
        const returnTo = sessionStorage.getItem("googleDriveReturnTo") || "/settings";
        
        sessionStorage.removeItem("googleDriveReturnTo");
        sessionStorage.removeItem("wizard_google_drive_step");
        
        if (isPopup && isWizard) {
          // Отправляем сообщение родительскому окну (мастеру)
          window.opener?.postMessage(
            {
              type: "GOOGLE_DRIVE_CONNECTED",
              email: result.email
            },
            window.location.origin
          );
          
          // Закрываем popup через 1 секунду
          setTimeout(() => {
            window.close();
          }, 1000);
        } else {
          // Обычный редирект для страницы настроек или редактирования канала
          setTimeout(() => {
            if (returnTo.startsWith("/channels/") && returnTo.includes("/edit")) {
              navigate(`${returnTo}?integration_refreshed=googleDrive`, { replace: true });
            } else {
              navigate(returnTo, { replace: true });
            }
          }, 2000);
        }
      } catch (err: any) {
        setStatus("error");
        const errorMsg = err.message || "Не удалось подключить Google Drive";
        setError(errorMsg);
        
        // Если это popup, отправляем сообщение об ошибке
        const isPopup = window.opener && window.opener !== window;
        if (isPopup) {
          window.opener?.postMessage(
            {
              type: "GOOGLE_DRIVE_ERROR",
              message: errorMsg
            },
            window.location.origin
          );
          
          setTimeout(() => {
            window.close();
          }, 2000);
        }
      }
    };

    void handleCallback();
  }, [searchParams, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-white/10 bg-slate-900/60 p-8">
        {status === "loading" && (
          <>
            <div className="flex items-center justify-center">
              <Loader2 className="h-12 w-12 animate-spin text-brand-light" />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-semibold">Подключение Google Drive...</h2>
              <p className="mt-2 text-sm text-slate-400">
                Пожалуйста, подождите
              </p>
            </div>
          </>
        )}

        {status === "success" && (
          <>
            <div className="flex items-center justify-center">
              <CheckCircle2 className="h-12 w-12 text-green-400" />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-semibold">Google Drive подключён</h2>
              <p className="mt-2 text-sm text-slate-400">
                Вы будете перенаправлены на страницу настроек...
              </p>
            </div>
          </>
        )}

        {status === "error" && (
          <>
            <div className="flex items-center justify-center">
              <XCircle className="h-12 w-12 text-red-400" />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-semibold">Ошибка подключения</h2>
              <div className="mt-4 rounded-lg border border-red-500/30 bg-red-900/20 p-4">
                <p className="text-sm text-red-300">{error}</p>
              </div>
              <button
                onClick={() => navigate("/settings")}
                className="mt-6 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand/90"
              >
                Вернуться в настройки
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default GoogleDriveCallbackPage;


