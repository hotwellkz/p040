import { useState, useEffect, useCallback } from "react";
import { getTelegramStatus, type TelegramIntegrationStatus } from "../api/telegramIntegration";
import { getGoogleDriveStatus, type GoogleDriveIntegrationStatus } from "../api/googleDriveIntegration";

export interface IntegrationsStatus {
  telegram: {
    connected: boolean;
    status: TelegramIntegrationStatus["status"];
    phoneNumber?: string;
    loading: boolean;
    error: string | null;
  };
  googleDrive: {
    connected: boolean;
    email?: string;
    loading: boolean;
    error: string | null;
  };
}

export function useIntegrationsStatus() {
  const [status, setStatus] = useState<IntegrationsStatus>({
    telegram: {
      connected: false,
      status: "not_connected",
      loading: true,
      error: null
    },
    googleDrive: {
      connected: false,
      loading: true,
      error: null
    }
  });

  const refreshStatus = useCallback(async () => {
    // Загружаем статус Telegram
    setStatus((prev) => ({
      ...prev,
      telegram: { ...prev.telegram, loading: true, error: null }
    }));

    try {
      const telegramStatus = await getTelegramStatus();
      setStatus((prev) => ({
        ...prev,
        telegram: {
          connected: telegramStatus.status === "active",
          status: telegramStatus.status,
          phoneNumber: telegramStatus.phoneNumber,
          loading: false,
          error: null
        }
      }));
    } catch (error: any) {
      setStatus((prev) => ({
        ...prev,
        telegram: {
          ...prev.telegram,
          loading: false,
          error: error.message || "Не удалось загрузить статус Telegram"
        }
      }));
    }

    // Загружаем статус Google Drive
    setStatus((prev) => ({
      ...prev,
      googleDrive: { ...prev.googleDrive, loading: true, error: null }
    }));

    try {
      const googleDriveStatus = await getGoogleDriveStatus();
      setStatus((prev) => ({
        ...prev,
        googleDrive: {
          connected: googleDriveStatus.connected,
          email: googleDriveStatus.email,
          loading: false,
          error: null
        }
      }));
    } catch (error: any) {
      setStatus((prev) => ({
        ...prev,
        googleDrive: {
          ...prev.googleDrive,
          loading: false,
          error: error.message || "Не удалось загрузить статус Google Drive"
        }
      }));
    }
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  return {
    status,
    refreshStatus
  };
}



