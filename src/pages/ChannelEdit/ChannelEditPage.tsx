import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Save, X, Plus, Trash2, Play } from "lucide-react";
import { useAuthStore } from "../../stores/authStore";
import { useChannelStore } from "../../stores/channelStore";
import type {
  Channel,
  SupportedPlatform,
  SupportedLanguage,
  ChannelAutoSendSchedule,
  ChannelPreferences
} from "../../domain/channel";
import PreferencesVariantsEditor from "../../components/PreferencesVariantsEditor";
import { validatePreferences } from "../../utils/preferencesUtils";
import { testBlottata } from "../../api/blottata";
import { getTelegramStatus } from "../../api/telegramIntegration";
import Accordion from "../../components/Accordion";
import { fetchScheduleSettings, getMinIntervalForTime, type ScheduleSettings } from "../../api/scheduleSettings";

const PLATFORMS: { value: SupportedPlatform; label: string }[] = [
  { value: "YOUTUBE_SHORTS", label: "YouTube Shorts" },
  { value: "TIKTOK", label: "TikTok" },
  { value: "INSTAGRAM_REELS", label: "Instagram Reels" },
  { value: "VK_CLIPS", label: "VK Клипы" }
];

const LANGUAGES: { value: SupportedLanguage; label: string }[] = [
  { value: "ru", label: "Русский" },
  { value: "en", label: "English" },
  { value: "kk", label: "Қазақша" }
];

const DURATIONS = [8, 15, 30, 60];

const TONES = [
  "Юмор",
  "Серьёзно",
  "Дерзко",
  "Детское",
  "Образовательное",
  "Вдохновляющее",
  "Развлекательное",
  "Профессиональное"
];

// Валидация URL
const isValidUrl = (url: string | null | undefined): boolean => {
  if (!url || url.trim() === "") {
    return true; // Пустые значения разрешены
  }
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === "http:" || urlObj.protocol === "https:";
  } catch {
    return false;
  }
};

const ChannelEditPage = () => {
  const { channelId } = useParams<{ channelId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore((state) => ({ user: state.user }));
  const { channels, fetchChannels, updateChannel } = useChannelStore(
    (state) => ({
      channels: state.channels,
      fetchChannels: state.fetchChannels,
      updateChannel: state.updateChannel
    })
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [channel, setChannel] = useState<Channel | null>(null);
  const [urlErrors, setUrlErrors] = useState<{
    youtube?: string;
    tiktok?: string;
    instagram?: string;
  }>({});
  const [preferencesValid, setPreferencesValid] = useState(true);
  const [testingBlottata, setTestingBlottata] = useState(false);
  const [blottataTestResult, setBlottataTestResult] = useState<string | null>(null);
  const [telegramStatus, setTelegramStatus] = useState<{ status: string } | null>(null);
  const [telegramStatusLoading, setTelegramStatusLoading] = useState(true);
  const [scheduleSettings, setScheduleSettings] = useState<ScheduleSettings | null>(null);

  useEffect(() => {
    if (!user?.uid || !channelId) {
      navigate("/channels", { replace: true });
      return;
    }

    const loadChannel = async () => {
      setLoading(true);
      try {
        await fetchChannels(user.uid);
        const found = channels.find((c) => c.id === channelId);
        if (found) {
          setChannel(found);
        } else {
          setError("Канал не найден");
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Ошибка при загрузке канала"
        );
      } finally {
        setLoading(false);
      }
    };

    void loadChannel();
  }, [user?.uid, channelId, navigate, fetchChannels]);

  // Загружаем статус Telegram интеграции
  useEffect(() => {
    const loadTelegramStatus = async () => {
      if (!user?.uid) {
        setTelegramStatusLoading(false);
        return;
      }
      
      try {
        setTelegramStatusLoading(true);
        const status = await getTelegramStatus();
        console.log("ChannelEditPage: Telegram status loaded", {
          status: status?.status,
          phoneNumber: status?.phoneNumber,
          lastError: status?.lastError
        });
        setTelegramStatus(status);
      } catch (err: any) {
        console.error("ChannelEditPage: Failed to load Telegram status", {
          error: err?.message || String(err),
          userId: user?.uid
        });
        // Если интеграция не найдена или ошибка, считаем что не привязан
        setTelegramStatus({ status: "not_connected" });
      } finally {
        setTelegramStatusLoading(false);
      }
    };
    
    void loadTelegramStatus();
  }, [user?.uid]);

  useEffect(() => {
    if (channels.length > 0 && channelId) {
      const found = channels.find((c) => c.id === channelId);
      if (found) {
        // Убеждаемся, что generationMode и новые поля установлены (для старых каналов)
        setChannel({
          ...found,
          generationMode: found.generationMode || "script",
          generationTransport: found.generationTransport || "telegram_global",
          telegramSyntaxPeer: found.telegramSyntaxPeer && found.telegramSyntaxPeer.trim() !== '' 
            ? found.telegramSyntaxPeer 
            : '@syntxaibot',
          youtubeUrl: found.youtubeUrl || null,
          tiktokUrl: found.tiktokUrl || null,
          instagramUrl: found.instagramUrl || null,
          googleDriveFolderId: found.googleDriveFolderId,
          autoSendEnabled: found.autoSendEnabled || false,
          timezone: found.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
          autoSendSchedules: found.autoSendSchedules || [],
          autoDownloadToDriveEnabled: found.autoDownloadToDriveEnabled || false,
          autoDownloadDelayMinutes: found.autoDownloadDelayMinutes ?? 10,
          uploadNotificationEnabled: found.uploadNotificationEnabled || false,
          uploadNotificationChatId: found.uploadNotificationChatId ?? "",
          blotataEnabled: found.blotataEnabled || false,
          driveInputFolderId: found.driveInputFolderId,
          driveArchiveFolderId: found.driveArchiveFolderId,
          blotataApiKey: found.blotataApiKey,
          blotataYoutubeId: found.blotataYoutubeId || null,
          blotataTiktokId: found.blotataTiktokId || null,
          blotataInstagramId: found.blotataInstagramId || null,
          blotataFacebookId: found.blotataFacebookId || null,
          blotataFacebookPageId: found.blotataFacebookPageId || null,
          blotataThreadsId: found.blotataThreadsId || null,
          blotataTwitterId: found.blotataTwitterId || null,
          blotataLinkedinId: found.blotataLinkedinId || null,
          blotataPinterestId: found.blotataPinterestId || null,
          blotataPinterestBoardId: found.blotataPinterestBoardId || null,
          blotataBlueskyId: found.blotataBlueskyId || null
        });
        setLoading(false);
      }
    }
  }, [channels, channelId]);

  const validateUrls = (): boolean => {
    const errors: {
      youtube?: string;
      tiktok?: string;
      instagram?: string;
    } = {};

    if (!isValidUrl(channel?.youtubeUrl)) {
      errors.youtube = "Введите корректный URL (должен начинаться с http:// или https://)";
    }
    if (!isValidUrl(channel?.tiktokUrl)) {
      errors.tiktok = "Введите корректный URL (должен начинаться с http:// или https://)";
    }
    if (!isValidUrl(channel?.instagramUrl)) {
      errors.instagram = "Введите корректный URL (должен начинаться с http:// или https://)";
    }

    setUrlErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user?.uid || !channel) {
      return;
    }

    if (!channel.name.trim()) {
      setError("Название канала обязательно");
      return;
    }

    if (!validateUrls()) {
      setError("Проверьте корректность введённых URL");
      return;
    }

    // Валидация preferences
    const preferencesValidation = validatePreferences(channel.preferences);
    if (!preferencesValidation.valid) {
      setError(preferencesValidation.error || "Проверьте настройки пожеланий");
      return;
    }

    // Валидация расписания автоотправки
    if (channel.autoSendEnabled) {
      if (!channel.timezone || channel.timezone.trim() === "") {
        setError("Укажите временную зону для автоотправки");
        return;
      }

      const schedules = channel.autoSendSchedules || [];
      for (const schedule of schedules) {
        if (!schedule.time || !schedule.time.match(/^\d{2}:\d{2}$/)) {
          setError("Укажите корректное время в формате HH:MM для всех расписаний");
          return;
        }

        if (!schedule.daysOfWeek || schedule.daysOfWeek.length === 0) {
          setError("Выберите хотя бы один день недели для всех расписаний");
          return;
        }

        if (schedule.promptsPerRun < 1 || schedule.promptsPerRun > 10) {
          setError("Количество промптов за запуск должно быть от 1 до 10");
          return;
        }
      }
    }

    // Валидация настроек Telegram интеграции
    if (channel.generationTransport === "telegram_user") {
      // Используем значение по умолчанию, если поле пустое
      const syntaxPeer = channel.telegramSyntaxPeer || '@syntxaibot';
      if (!syntaxPeer || syntaxPeer.trim() === "") {
        setError("Для использования личного Telegram аккаунта необходимо указать username или ID чата Syntax");
        return;
      }
      
      // Проверяем статус Telegram интеграции
      if (!telegramStatusLoading && telegramStatus?.status !== "active") {
        setError("Для использования личного Telegram аккаунта необходимо привязать Telegram в настройках профиля");
        return;
      }
    }

    // Валидация настроек Blottata
    if (channel.blotataEnabled) {
      if (!channel.driveInputFolderId || channel.driveInputFolderId.trim() === "") {
        setError("Для автопубликации через Blottata необходимо указать ID входной папки Google Drive");
        return;
      }
      if (!channel.driveArchiveFolderId || channel.driveArchiveFolderId.trim() === "") {
        setError("Для автопубликации через Blottata необходимо указать ID папки архива Google Drive");
        return;
      }
      if (!channel.blotataApiKey || channel.blotataApiKey.trim() === "") {
        setError("Для автопубликации через Blottata необходимо указать API ключ");
        return;
      }
      
      // Проверяем, что хотя бы один ID площадки заполнен
      const hasPlatformId = 
        channel.blotataYoutubeId ||
        channel.blotataTiktokId ||
        channel.blotataInstagramId ||
        channel.blotataFacebookId ||
        channel.blotataThreadsId ||
        channel.blotataTwitterId ||
        channel.blotataLinkedinId ||
        channel.blotataPinterestId ||
        channel.blotataBlueskyId;
      
      if (!hasPlatformId) {
        setError("Для автопубликации через Blottata необходимо указать хотя бы один ID площадки (YouTube, TikTok, Instagram и т.д.)");
        return;
      }
    }

    setSaving(true);
    setError(null);

    try {
      // Подготавливаем канал для сохранения: если telegramSyntaxPeer пустое при telegram_user, используем значение по умолчанию
      const channelToSave = {
        ...channel,
        telegramSyntaxPeer: channel.generationTransport === "telegram_user" && (!channel.telegramSyntaxPeer || channel.telegramSyntaxPeer.trim() === "")
          ? '@syntxaibot'
          : channel.telegramSyntaxPeer
      };
      
      await updateChannel(user.uid, channelToSave);
      navigate("/channels", { replace: true });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Ошибка при обновлении канала"
      );
      setSaving(false);
    }
  };

  const handleTestBlottata = async () => {
    if (!channel?.id || !user?.uid) {
      return;
    }

    setTestingBlottata(true);
    setBlottataTestResult(null);

    try {
      const result = await testBlottata(channel.id);
      setBlottataTestResult(result.message);
      
      if (result.success && result.result) {
        const platforms = result.result.publishedPlatforms.join(", ");
        setBlottataTestResult(
          `✅ Успешно! Опубликовано на: ${platforms || "нет платформ"}`
        );
      }
    } catch (error) {
      setBlottataTestResult(
        `❌ Ошибка: ${error instanceof Error ? error.message : "Неизвестная ошибка"}`
      );
    } finally {
      setTestingBlottata(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="flex items-center gap-3 text-slate-200">
          <Loader2 className="h-5 w-5 animate-spin text-brand-light" />
          Загрузка канала...
        </div>
      </div>
    );
  }

  if (!channel) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
        <div className="max-w-xl space-y-4 rounded-2xl border border-red-500/30 bg-red-900/20 p-8 text-center">
          <h1 className="text-2xl font-semibold text-red-200">
            Канал не найден
          </h1>
          <p className="text-red-300">{error || "Канал не существует"}</p>
          <button
            type="button"
            onClick={() => navigate("/channels")}
            className="mt-4 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-dark"
          >
            Вернуться к списку
          </button>
        </div>
      </div>
    );
  }

  // Функция для генерации summary канала
  const getChannelSummary = () => {
    if (!channel) return "";
    const parts: string[] = [];
    const platformLabel = PLATFORMS.find(p => p.value === channel.platform)?.label;
    const languageLabel = LANGUAGES.find(l => l.value === channel.language)?.label;
    if (platformLabel) parts.push(platformLabel);
    if (languageLabel) parts.push(languageLabel);
    if (channel.tone) parts.push(channel.tone);
    if (channel.audience) {
      const audiencePreview = channel.audience.split(/\s+/).slice(0, 3).join(" ");
      if (audiencePreview) parts.push(audiencePreview);
    }
    return parts.join(" • ") || "Настройки не заполнены";
  };

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1100px]">
        {/* Заголовок страницы */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white">Редактирование канала</h1>
          <p className="mt-2 text-sm text-slate-400">
            Настройте параметры канала и сценарии генерации контента
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="relative space-y-6 rounded-[20px] border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-brand/20 backdrop-blur-sm sm:p-8">
            {/* Sticky Header внутри формы */}
            <div className="sticky top-0 z-10 -mx-6 -mt-6 mb-6 flex items-center justify-between border-b border-white/10 bg-slate-900/95 px-6 py-4 backdrop-blur-md sm:-mx-8 sm:px-8">
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold text-white truncate">
                  {channel?.name || "Новый канал"}
                </h2>
                <p className="mt-1 text-xs text-slate-400 truncate">
                  {getChannelSummary()}
                </p>
              </div>
              <div className="flex items-center gap-3 sm:ml-4">
                <button
                  type="button"
                  onClick={() => navigate("/channels")}
                  className="rounded-xl border border-white/10 bg-slate-800/60 px-4 py-2 text-sm text-slate-300 transition-all duration-200 hover:border-white/20 hover:bg-slate-800/80 hover:text-white"
                >
                  <ArrowLeft size={16} className="inline mr-2" />
                  Назад
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-gradient-to-r from-brand to-brand/80 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand/30 transition-all duration-200 hover:from-brand/90 hover:to-brand/70 hover:shadow-xl hover:shadow-brand/40 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <>
                      <Loader2 size={16} className="inline mr-2 animate-spin" />
                      Сохранение...
                    </>
                  ) : (
                    <>
                      <Save size={16} className="inline mr-2" />
                      Сохранить
                    </>
                  )}
                </button>
              </div>
            </div>
            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-950/40 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            )}

            {/* Основные настройки канала - сворачиваемый блок */}
            <Accordion
              title="Основные настройки канала"
              defaultOpen={!channelId} // Развёрнуто при создании, свёрнуто при редактировании
              summary={(() => {
                if (!channel) return "";
                const parts: string[] = [];
                const platformLabel = PLATFORMS.find(p => p.value === channel.platform)?.label;
                const languageLabel = LANGUAGES.find(l => l.value === channel.language)?.label;
                if (platformLabel) parts.push(platformLabel);
                if (languageLabel) parts.push(languageLabel);
                if (channel.tone) parts.push(channel.tone);
                if (channel.audience) {
                  // Берём первые слова из описания аудитории
                  const audiencePreview = channel.audience.split(/\s+/).slice(0, 3).join(" ");
                  if (audiencePreview) parts.push(audiencePreview);
                }
                return parts.join(" • ") || "Настройки не заполнены";
              })()}
              className="border-0 bg-transparent"
            >
              <div className="space-y-6 pt-2">
                {/* Название канала - на всю ширину */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-200">
                    Название канала *
                  </label>
                  <input
                    type="text"
                    value={channel.name}
                    onChange={(e) =>
                      setChannel({ ...channel, name: e.target.value })
                    }
                    required
                    className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none transition-all duration-200 placeholder:text-slate-500 focus:border-brand focus:ring-2 focus:ring-brand/40 hover:border-white/20"
                    placeholder="Название канала"
                  />
                </div>

                {/* Платформа - на всю ширину */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-200">
                    Платформа *
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {PLATFORMS.map((platform) => (
                      <button
                        key={platform.value}
                        type="button"
                        onClick={() =>
                          setChannel({ ...channel, platform: platform.value })
                        }
                        className={`rounded-xl border px-4 py-3 text-left transition-all duration-200 ${
                          channel.platform === platform.value
                            ? "border-brand bg-brand/10 text-white shadow-md shadow-brand/20"
                            : "border-white/10 bg-slate-950/60 text-slate-300 hover:border-brand/40 hover:bg-slate-900/80"
                        }`}
                      >
                        {platform.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Двухколоночная раскладка для остальных полей */}
                <div className="grid gap-6 lg:grid-cols-2">
                  {/* Левая колонка */}
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-slate-200">
                        Язык *
                      </label>
                      <div className="grid gap-3">
                        {LANGUAGES.map((lang) => (
                          <button
                            key={lang.value}
                            type="button"
                            onClick={() =>
                              setChannel({ ...channel, language: lang.value })
                            }
                            className={`rounded-xl border px-4 py-3 text-center transition-all duration-200 ${
                              channel.language === lang.value
                                ? "border-brand bg-brand/10 text-white shadow-md shadow-brand/20"
                                : "border-white/10 bg-slate-950/60 text-slate-300 hover:border-brand/40 hover:bg-slate-900/80"
                            }`}
                          >
                            {lang.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-slate-200">
                        Длительность (сек) *
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        {DURATIONS.map((duration) => (
                          <button
                            key={duration}
                            type="button"
                            onClick={() =>
                              setChannel({
                                ...channel,
                                targetDurationSec: duration
                              })
                            }
                            className={`rounded-xl border px-4 py-3 text-center transition-all duration-200 ${
                              channel.targetDurationSec === duration
                                ? "border-brand bg-brand/10 text-white shadow-md shadow-brand/20"
                                : "border-white/10 bg-slate-950/60 text-slate-300 hover:border-brand/40 hover:bg-slate-900/80"
                            }`}
                          >
                            {duration} сек
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-slate-200">
                        Ниша / Тематика *
                      </label>
                      <input
                        type="text"
                        value={channel.niche}
                        onChange={(e) =>
                          setChannel({ ...channel, niche: e.target.value })
                        }
                        required
                        className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none transition-all duration-200 placeholder:text-slate-500 focus:border-brand focus:ring-2 focus:ring-brand/40 hover:border-white/20"
                        placeholder="Например: Технологии, Кулинария, Спорт"
                      />
                    </div>
                  </div>

                  {/* Правая колонка */}
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-slate-200">
                        Целевая аудитория *
                      </label>
                      <textarea
                        value={channel.audience}
                        onChange={(e) =>
                          setChannel({ ...channel, audience: e.target.value })
                        }
                        required
                        rows={4}
                        className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none transition-all duration-200 placeholder:text-slate-500 focus:border-brand focus:ring-2 focus:ring-brand/40 hover:border-white/20 resize-y"
                        placeholder="Опишите целевую аудиторию"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-slate-200">
                        Тон / Стиль *
                      </label>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {TONES.map((tone) => (
                          <button
                            key={tone}
                            type="button"
                            onClick={() => setChannel({ ...channel, tone })}
                            className={`rounded-xl border px-4 py-3 text-center transition-all duration-200 ${
                              channel.tone === tone
                                ? "border-brand bg-brand/10 text-white shadow-md shadow-brand/20"
                                : "border-white/10 bg-slate-950/60 text-slate-300 hover:border-brand/40 hover:bg-slate-900/80"
                            }`}
                          >
                            {tone}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-slate-200">
                        Запрещённые темы
                      </label>
                      <textarea
                        value={channel.blockedTopics}
                        onChange={(e) =>
                          setChannel({ ...channel, blockedTopics: e.target.value })
                        }
                        rows={4}
                        className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none transition-all duration-200 placeholder:text-slate-500 focus:border-brand focus:ring-2 focus:ring-brand/40 hover:border-white/20 resize-y"
                        placeholder="Темы, которые не должны появляться в сценариях"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </Accordion>

            {/* Блок логики генерации сценариев */}
            <div className="border-t border-white/10 pt-6">
              <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-400">
                Логика генерации сценариев
              </h3>
              <p className="mb-4 text-xs text-slate-500">
                Настройте режим выбора и варианты дополнительных пожеланий
              </p>
              <div className="space-y-2">
                <PreferencesVariantsEditor
                  preferences={channel.preferences}
                  onChange={(preferences: ChannelPreferences) => {
                    setChannel({ ...channel, preferences });
                  }}
                  onValidationChange={setPreferencesValid}
                />
              </div>
            </div>

            {/* Блок режима генерации */}
            <div className="border-t border-white/10 pt-6">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-200">
                  Режим генерации *
                </label>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <button
                    type="button"
                    onClick={() =>
                      setChannel({
                        ...channel,
                        generationMode: "script"
                      })
                    }
                    className={`rounded-xl border px-4 py-3 text-left transition-all duration-200 ${
                      (channel.generationMode || "script") === "script"
                        ? "border-brand bg-brand/10 text-white shadow-md shadow-brand/20"
                        : "border-white/10 bg-slate-950/60 text-slate-300 hover:border-brand/40 hover:bg-slate-900/80"
                    }`}
                  >
                    <div className="font-semibold">Сценарий</div>
                    <div className="mt-1 text-xs text-slate-400">
                      Только подробный сценарий
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setChannel({
                        ...channel,
                        generationMode: "prompt"
                      })
                    }
                    className={`rounded-xl border px-4 py-3 text-left transition-all duration-200 ${
                      channel.generationMode === "prompt"
                        ? "border-brand bg-brand/10 text-white shadow-md shadow-brand/20"
                        : "border-white/10 bg-slate-950/60 text-slate-300 hover:border-brand/40 hover:bg-slate-900/80"
                    }`}
                  >
                    <div className="font-semibold">Сценарий + промпт для видео</div>
                    <div className="mt-1 text-xs text-slate-400">
                      Сценарий + VIDEO_PROMPT для Sora/Veo
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setChannel({
                        ...channel,
                        generationMode: "video-prompt-only"
                      })
                    }
                    className={`rounded-xl border px-4 py-3 text-left transition-all duration-200 ${
                      channel.generationMode === "video-prompt-only"
                        ? "border-brand bg-brand/10 text-white shadow-md shadow-brand/20"
                        : "border-white/10 bg-slate-950/60 text-slate-300 hover:border-brand/40 hover:bg-slate-900/80"
                    }`}
                  >
                    <div className="font-semibold">Промпт для видео</div>
                    <div className="mt-1 text-xs text-slate-400">
                      Только VIDEO_PROMPT для Sora/Veo без текста сценария
                    </div>
                  </button>
                </div>
              </div>
            </div>

            {/* Блок источника отправки промптов */}
            <div className="border-t border-white/10 pt-6">
              <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-400">
                Источник отправки промптов
              </h3>
              <p className="mb-4 text-xs text-slate-500">
                Выберите, от какого аккаунта отправлять промпты в Syntax
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() =>
                    setChannel({
                      ...channel,
                      generationTransport: "telegram_global"
                    })
                  }
                  className={`rounded-xl border px-4 py-3 text-left transition-all duration-200 ${
                    (channel.generationTransport || "telegram_global") === "telegram_global"
                      ? "border-brand bg-brand/10 text-white shadow-md shadow-brand/20"
                      : "border-white/10 bg-slate-950/60 text-slate-300 hover:border-brand/40 hover:bg-slate-900/80"
                  }`}
                >
                  <div className="font-semibold">Telegram (общий аккаунт)</div>
                  <div className="mt-1 text-xs text-slate-400">
                    Использовать системный Telegram аккаунт
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setChannel({
                      ...channel,
                      generationTransport: "telegram_user"
                    })
                  }
                  className={`rounded-xl border px-4 py-3 text-left transition-all duration-200 ${
                    channel.generationTransport === "telegram_user"
                      ? "border-brand bg-brand/10 text-white shadow-md shadow-brand/20"
                      : "border-white/10 bg-slate-950/60 text-slate-300 hover:border-brand/40 hover:bg-slate-900/80"
                  }`}
                >
                  <div className="font-semibold">Telegram (мой аккаунт)</div>
                  <div className="mt-1 text-xs text-slate-400">
                    Отправлять от вашего личного Telegram
                  </div>
                </button>
              </div>

              {channel.generationTransport === "telegram_user" && (
                <div className="mt-4 space-y-3">
                  {/* Проверка статуса Telegram интеграции */}
                  {!telegramStatusLoading && telegramStatus?.status !== "active" && (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-900/20 p-3">
                      <div className="flex items-start gap-2">
                        <div className="flex-1">
                          <div className="font-medium text-amber-300">
                            ⚠️ Telegram не привязан
                          </div>
                          <p className="mt-1 text-sm text-amber-200/80">
                            Для использования вашего личного Telegram аккаунта необходимо привязать его в настройках профиля.
                          </p>
                          <button
                            type="button"
                            onClick={() => navigate("/settings")}
                            className="mt-2 rounded-lg bg-amber-500/20 px-3 py-1.5 text-sm font-medium text-amber-300 transition hover:bg-amber-500/30"
                          >
                            Привязать Telegram
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-200">
                      Username или ID чата Syntax *
                    </label>
                    <input
                      type="text"
                      value={channel.telegramSyntaxPeer || '@syntxaibot'}
                      onChange={(e) => {
                        const value = e.target.value.trim();
                        // Сохраняем значение, даже если оно пустое (пользователь может стереть)
                        // При сохранении пустое значение будет заменено на null
                        setChannel({
                          ...channel,
                          telegramSyntaxPeer: value === '' ? null : value
                        });
                      }}
                      placeholder="@SyntaxAI или 123456789"
                      className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none transition-all duration-200 placeholder:text-slate-500 focus:ring-2 focus:ring-brand/40 focus:border-brand hover:border-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={telegramStatusLoading || telegramStatus?.status !== "active"}
                    />
                    <p className="mt-1 text-xs text-slate-400">
                      Укажите username (например @SyntaxAI) или числовой ID чата
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Блок ссылок на соцсети */}
            <div className="border-t border-white/10 pt-6">
              <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-400">
                Ссылки на соцсети
              </h3>
              <p className="mb-4 text-xs text-slate-500">
                Укажите ссылки на ваши аккаунты в социальных сетях (опционально)
              </p>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-200">
                    YouTube канал (опционально)
                  </label>
                  <input
                    type="url"
                    value={channel.youtubeUrl || ""}
                    onChange={(e) => {
                      const value = e.target.value.trim() || null;
                      setChannel({ ...channel, youtubeUrl: value });
                      // Очищаем ошибку при изменении
                      if (urlErrors.youtube) {
                        setUrlErrors({ ...urlErrors, youtube: undefined });
                      }
                    }}
                    onBlur={() => {
                      if (channel.youtubeUrl && !isValidUrl(channel.youtubeUrl)) {
                        setUrlErrors({
                          ...urlErrors,
                          youtube:
                            "Введите корректный URL (должен начинаться с http:// или https://)"
                        });
                      }
                    }}
                    placeholder="https://www.youtube.com/@example"
                    className={`w-full rounded-xl border px-4 py-3 text-white outline-none transition-all duration-200 placeholder:text-slate-500 focus:ring-2 focus:ring-brand/40 ${
                      urlErrors.youtube
                        ? "border-red-500/50 bg-red-950/20 focus:border-red-500"
                        : "border-white/10 bg-slate-950/60 focus:border-brand hover:border-white/20"
                    }`}
                  />
                  {urlErrors.youtube && (
                    <p className="text-xs text-red-400">{urlErrors.youtube}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-200">
                    TikTok канал (опционально)
                  </label>
                  <input
                    type="url"
                    value={channel.tiktokUrl || ""}
                    onChange={(e) => {
                      const value = e.target.value.trim() || null;
                      setChannel({ ...channel, tiktokUrl: value });
                      // Очищаем ошибку при изменении
                      if (urlErrors.tiktok) {
                        setUrlErrors({ ...urlErrors, tiktok: undefined });
                      }
                    }}
                    onBlur={() => {
                      if (channel.tiktokUrl && !isValidUrl(channel.tiktokUrl)) {
                        setUrlErrors({
                          ...urlErrors,
                          tiktok:
                            "Введите корректный URL (должен начинаться с http:// или https://)"
                        });
                      }
                    }}
                    placeholder="https://www.tiktok.com/@example"
                    className={`w-full rounded-xl border px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:ring-2 focus:ring-brand/40 ${
                      urlErrors.tiktok
                        ? "border-red-500/50 bg-red-950/20 focus:border-red-500"
                        : "border-white/10 bg-slate-950/60 focus:border-brand"
                    }`}
                  />
                  {urlErrors.tiktok && (
                    <p className="text-xs text-red-400">{urlErrors.tiktok}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-200">
                    Instagram (опционально)
                  </label>
                  <input
                    type="url"
                    value={channel.instagramUrl || ""}
                    onChange={(e) => {
                      const value = e.target.value.trim() || null;
                      setChannel({ ...channel, instagramUrl: value });
                      // Очищаем ошибку при изменении
                      if (urlErrors.instagram) {
                        setUrlErrors({ ...urlErrors, instagram: undefined });
                      }
                    }}
                    onBlur={() => {
                      if (
                        channel.instagramUrl &&
                        !isValidUrl(channel.instagramUrl)
                      ) {
                        setUrlErrors({
                          ...urlErrors,
                          instagram:
                            "Введите корректный URL (должен начинаться с http:// или https://)"
                        });
                      }
                    }}
                    placeholder="https://www.instagram.com/example"
                    className={`w-full rounded-xl border px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:ring-2 focus:ring-brand/40 ${
                      urlErrors.instagram
                        ? "border-red-500/50 bg-red-950/20 focus:border-red-500"
                        : "border-white/10 bg-slate-950/60 focus:border-brand"
                    }`}
                  />
                  {urlErrors.instagram && (
                    <p className="text-xs text-red-400">{urlErrors.instagram}</p>
                  )}
                </div>
              </div>

              {/* Google Drive настройки */}
              <div className="mt-6 space-y-2">
                <label className="block text-sm font-medium text-slate-200">
                  Google Drive Folder ID (опционально)
                </label>
                <input
                  type="text"
                  value={channel.googleDriveFolderId || ""}
                  onChange={(e) =>
                    setChannel({
                      ...channel,
                      googleDriveFolderId: e.target.value.trim() || undefined
                    })
                  }
                  placeholder="Например: 1AbCdEfGhIjKlMnOpQrStUvWxYz"
                  className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-brand focus:ring-2 focus:ring-brand/40"
                />
                <p className="text-xs text-slate-400">
                  Укажите ID папки на Google Drive, в которую будут сохраняться
                  видео из SyntX для этого канала.
                </p>
              </div>
            </div>

            {/* Блок автоотправки в Syntx */}
            <div className="border-t border-white/10 pt-6">
              <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-400">
                Автоотправка в Syntx
              </h3>
              <p className="mb-4 text-xs text-slate-500">
                Настройте автоматическую генерацию и отправку промптов в Syntx-бот по расписанию.
              </p>

              {/* Переключатель включения автоотправки */}
              <div className="mb-6 flex items-center gap-3">
                <input
                  type="checkbox"
                  id="autoSendEnabled"
                  checked={channel.autoSendEnabled || false}
                  onChange={(e) =>
                    setChannel({
                      ...channel,
                      autoSendEnabled: e.target.checked
                    })
                  }
                  className="h-5 w-5 rounded border-white/20 bg-slate-950/60 text-brand focus:ring-2 focus:ring-brand/40"
                />
                <label
                  htmlFor="autoSendEnabled"
                  className="text-sm font-medium text-slate-200"
                >
                  Включить автоотправку в Syntx
                </label>
              </div>

              {channel.autoSendEnabled && (
                <>
                  {/* Выбор таймзоны */}
                  <div className="mb-6 space-y-2">
                    <label className="block text-sm font-medium text-slate-200">
                      Временная зона
                    </label>
                    <select
                      value={channel.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone}
                      onChange={(e) =>
                        setChannel({
                          ...channel,
                          timezone: e.target.value
                        })
                      }
                      className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/40"
                    >
                      <option value="Asia/Almaty">Asia/Almaty (Алматы)</option>
                      <option value="Europe/Moscow">Europe/Moscow (Москва)</option>
                      <option value="UTC">UTC</option>
                      <option value="America/New_York">America/New_York (Нью-Йорк)</option>
                      <option value="Europe/London">Europe/London (Лондон)</option>
                    </select>
                    <p className="text-xs text-slate-400">
                      Выберите временную зону для расписания. По умолчанию используется зона вашего браузера.
                    </p>
                  </div>

                  {/* Список расписаний */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-medium text-slate-200">
                        Расписание отправки
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const newSchedule: ChannelAutoSendSchedule = {
                            id: crypto.randomUUID(),
                            enabled: true,
                            daysOfWeek: [1, 2, 3, 4, 5], // Пн-Пт по умолчанию
                            time: "12:00",
                            promptsPerRun: 1
                          };
                          setChannel({
                            ...channel,
                            autoSendSchedules: [
                              ...(channel.autoSendSchedules || []),
                              newSchedule
                            ]
                          });
                        }}
                        className="flex items-center gap-2 rounded-xl border border-brand/40 bg-brand/10 px-3 py-2 text-sm font-medium text-brand transition hover:bg-brand/20"
                      >
                        <Plus size={16} />
                        Добавить расписание
                      </button>
                    </div>

                    {(channel.autoSendSchedules || []).length === 0 ? (
                      <p className="text-sm text-slate-400">
                        Нет настроенных расписаний. Нажмите "Добавить расписание", чтобы создать новое.
                      </p>
                    ) : (
                      channel.autoSendSchedules?.map((schedule, index) => (
                        <div
                          key={schedule.id}
                          className="rounded-2xl border border-white/10 bg-slate-900/50 shadow-lg shadow-black/20 p-4 transition-all duration-200 hover:border-white/20 hover:shadow-xl"
                        >
                          <div className="mb-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={schedule.enabled}
                                onChange={(e) => {
                                  const updated = [...(channel.autoSendSchedules || [])];
                                  updated[index] = {
                                    ...schedule,
                                    enabled: e.target.checked
                                  };
                                  setChannel({
                                    ...channel,
                                    autoSendSchedules: updated
                                  });
                                }}
                                className="h-4 w-4 rounded border-white/20 bg-slate-950/60 text-brand focus:ring-2 focus:ring-brand/40"
                              />
                              <span className="text-sm font-medium text-slate-200">
                                Расписание {index + 1}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const updated = channel.autoSendSchedules?.filter(
                                  (s) => s.id !== schedule.id
                                ) || [];
                                setChannel({
                                  ...channel,
                                  autoSendSchedules: updated
                                });
                              }}
                              className="rounded-lg p-1 text-red-400 transition-all duration-200 hover:bg-red-500/20 hover:text-red-300"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>

                          {/* Дни недели */}
                          <div className="mb-4">
                            <label className="mb-2 block text-xs font-medium text-slate-300">
                              Дни недели
                            </label>
                            <div className="flex flex-wrap gap-2">
                              {[
                                { value: 0, label: "Вс" },
                                { value: 1, label: "Пн" },
                                { value: 2, label: "Вт" },
                                { value: 3, label: "Ср" },
                                { value: 4, label: "Чт" },
                                { value: 5, label: "Пт" },
                                { value: 6, label: "Сб" }
                              ].map((day) => (
                                <button
                                  key={day.value}
                                  type="button"
                                  onClick={() => {
                                    const updated = [...(channel.autoSendSchedules || [])];
                                    const currentDays = updated[index].daysOfWeek || [];
                                    if (currentDays.includes(day.value)) {
                                      updated[index] = {
                                        ...schedule,
                                        daysOfWeek: currentDays.filter(
                                          (d) => d !== day.value
                                        )
                                      };
                                    } else {
                                      updated[index] = {
                                        ...schedule,
                                        daysOfWeek: [...currentDays, day.value]
                                      };
                                    }
                                    setChannel({
                                      ...channel,
                                      autoSendSchedules: updated
                                    });
                                  }}
                                  className={`rounded-lg px-3 py-1 text-xs font-medium transition ${
                                    schedule.daysOfWeek?.includes(day.value)
                                      ? "bg-brand text-white"
                                      : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                                  }`}
                                >
                                  {day.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Время и количество промптов */}
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                              <label className="mb-2 block text-xs font-medium text-slate-300">
                                Время (HH:MM)
                              </label>
                              <input
                                type="time"
                                value={schedule.time}
                                onChange={(e) => {
                                  const updated = [...(channel.autoSendSchedules || [])];
                                  updated[index] = {
                                    ...schedule,
                                    time: e.target.value
                                  };
                                  setChannel({
                                    ...channel,
                                    autoSendSchedules: updated
                                  });
                                }}
                                className="w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none transition-all duration-200 focus:border-brand focus:ring-2 focus:ring-brand/40 hover:border-white/20"
                              />
                            </div>
                            <div>
                              <label className="mb-2 block text-xs font-medium text-slate-300">
                                Количество промптов за запуск
                              </label>
                              <input
                                type="number"
                                min="1"
                                max="10"
                                value={schedule.promptsPerRun}
                                onChange={(e) => {
                                  const value = Math.max(
                                    1,
                                    Math.min(10, parseInt(e.target.value) || 1)
                                  );
                                  const updated = [...(channel.autoSendSchedules || [])];
                                  updated[index] = {
                                    ...schedule,
                                    promptsPerRun: value
                                  };
                                  setChannel({
                                    ...channel,
                                    autoSendSchedules: updated
                                  });
                                }}
                                className="w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none transition-all duration-200 focus:border-brand focus:ring-2 focus:ring-brand/40 hover:border-white/20"
                              />
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Блок автоматического скачивания в Google Drive */}
            <div className="border-t border-white/10 pt-6">
              <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-400">
                Автоматическое скачивание в Google Drive
              </h3>
              <p className="mb-4 text-xs text-slate-500">
                Настройте автоматическое скачивание видео из Telegram и загрузку в Google Drive после автогенерации промпта.
              </p>

              {/* Переключатель включения автоскачивания */}
              <div className="mb-6 flex items-center gap-3">
                <input
                  type="checkbox"
                  id="autoDownloadToDriveEnabled"
                  checked={channel.autoDownloadToDriveEnabled || false}
                  onChange={(e) =>
                    setChannel({
                      ...channel,
                      autoDownloadToDriveEnabled: e.target.checked
                    })
                  }
                  className="h-5 w-5 rounded border-white/20 bg-slate-950/60 text-brand focus:ring-2 focus:ring-brand/40"
                />
                <label
                  htmlFor="autoDownloadToDriveEnabled"
                  className="text-sm font-medium text-slate-200"
                >
                  Автоматически скачивать видео из Telegram и загружать в Google Drive после автогенерации
                </label>
              </div>

              {channel.autoDownloadToDriveEnabled && (
                <div className="space-y-4">
                  {/* Информация о задержке (вычисляется автоматически) */}
                  <div className="rounded-lg border border-white/10 bg-slate-900/40 p-4">
                    <div className="mb-2 text-sm font-medium text-slate-200">
                      Задержка перед скачиванием
                    </div>
                    <p className="mb-3 text-sm text-slate-300">
                      Задержка перед скачиванием вычисляется автоматически на основе расписания каналов.
                      Скачивание запускается примерно за 1 минуту до минимального интервала между публикациями в текущем диапазоне времени суток.
                    </p>
                    {scheduleSettings && (
                      <div className="mt-3 space-y-2 text-xs text-slate-400">
                        <div className="flex items-center justify-between">
                          <span>00:00–13:00:</span>
                          <span className="font-medium text-slate-300">
                            {(scheduleSettings.minInterval_00_13 ?? scheduleSettings.minIntervalMinutes ?? 11) - 1} мин
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>13:00–17:00:</span>
                          <span className="font-medium text-slate-300">
                            {(scheduleSettings.minInterval_13_17 ?? scheduleSettings.minIntervalMinutes ?? 11) - 1} мин
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>17:00–24:00:</span>
                          <span className="font-medium text-slate-300">
                            {(scheduleSettings.minInterval_17_24 ?? scheduleSettings.minIntervalMinutes ?? 11) - 1} мин
                          </span>
                        </div>
                      </div>
                    )}
                    <p className="mt-3 text-xs text-slate-400">
                      Изменить интервалы можно на странице{" "}
                      <button
                        type="button"
                        onClick={() => navigate("/channels/schedule")}
                        className="text-brand hover:text-brand/80 underline"
                      >
                        "Расписание каналов"
                      </button>
                      .
                    </p>
                  </div>

                  {/* Предупреждение о необходимости настройки Google Drive папки */}
                  {!channel.googleDriveFolderId && (
                    <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4">
                      <p className="text-sm text-yellow-200">
                        ⚠️ Для работы автоматического скачивания необходимо указать ID папки Google Drive выше.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Блок уведомлений */}
            <div className="border-t border-white/10 pt-6">
              <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-400">
                Уведомления
              </h3>
              <p className="mb-4 text-xs text-slate-500">
                Настройте уведомления в Telegram после успешной загрузки видео на Google Drive.
              </p>

              {/* Чекбокс включения уведомлений */}
              <div className="mb-4 flex items-center gap-3">
                <input
                  type="checkbox"
                  id="uploadNotificationEnabled"
                  checked={channel.uploadNotificationEnabled || false}
                  onChange={(e) =>
                    setChannel({
                      ...channel,
                      uploadNotificationEnabled: e.target.checked
                    })
                  }
                  className="h-5 w-5 rounded border-white/20 bg-slate-950/60 text-brand focus:ring-2 focus:ring-brand/40"
                />
                <label
                  htmlFor="uploadNotificationEnabled"
                  className="text-sm font-medium text-slate-200"
                >
                  Отправлять отчёт в Telegram после загрузки видео на Google Drive
                </label>
              </div>

              {/* Поле chatId */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-200">
                  Telegram chat ID для уведомлений (необязательно)
                </label>
                <input
                  type="text"
                  value={channel.uploadNotificationChatId || ""}
                  onChange={(e) =>
                    setChannel({
                      ...channel,
                      uploadNotificationChatId: e.target.value || ""
                    })
                  }
                  className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/40"
                  placeholder="Оставьте пустым, чтобы использовать основной чат SyntX"
                />
                <p className="text-xs text-slate-400">
                  Если поле пустое — будет использован тот же чат, что и для отправки промптов в SyntX.
                </p>
              </div>
            </div>

            {/* Блок автоматической публикации через Blottata */}
            <div className="border-t border-white/10 pt-6">
              <h3 className="mb-4 text-lg font-semibold text-white">
                Автоматическая публикация через Blottata
              </h3>
              <p className="mb-4 text-sm text-slate-400">
                Настройте автоматическую публикацию видео в социальные сети через Blottata API. 
                Файлы из указанной входной папки Google Drive будут автоматически публиковаться на выбранные платформы.
              </p>

              {/* Переключатель включения Blottata */}
              <div className="mb-6 flex items-center gap-3">
                <input
                  type="checkbox"
                  id="blotataEnabled"
                  checked={channel.blotataEnabled || false}
                  onChange={(e) =>
                    setChannel({
                      ...channel,
                      blotataEnabled: e.target.checked
                    })
                  }
                  className="h-5 w-5 rounded border-white/20 bg-slate-950/60 text-brand focus:ring-2 focus:ring-brand/40"
                />
                <label
                  htmlFor="blotataEnabled"
                  className="text-sm font-medium text-slate-200"
                >
                  Включить автоматическую публикацию через Blottata
                </label>
              </div>

              {channel.blotataEnabled && (
                <div className="space-y-4">
                  {/* ID входной папки Google Drive */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-200">
                      ID входной папки Google Drive *
                    </label>
                    <input
                      type="text"
                      value={channel.driveInputFolderId || ""}
                      onChange={(e) =>
                        setChannel({
                          ...channel,
                          driveInputFolderId: e.target.value.trim() || undefined
                        })
                      }
                      placeholder="Например: 1F1NzA7Z5XIVzVt4s4Zo1kZRVt-SXO000"
                      className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-brand focus:ring-2 focus:ring-brand/40"
                    />
                    <p className="text-xs text-slate-400">
                      Папка, где появляются готовые видео для этого канала. Система будет отслеживать новые файлы в этой папке.
                    </p>
                  </div>

                  {/* ID папки архива Google Drive */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-200">
                      ID папки архива Google Drive *
                    </label>
                    <input
                      type="text"
                      value={channel.driveArchiveFolderId || ""}
                      onChange={(e) =>
                        setChannel({
                          ...channel,
                          driveArchiveFolderId: e.target.value.trim() || undefined
                        })
                      }
                      placeholder="Например: 1O45ZqVwqqV5jMV83h_Y1JUZE89KaRic8"
                      className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-brand focus:ring-2 focus:ring-brand/40"
                    />
                    <p className="text-xs text-slate-400">
                      Папка, куда будут перемещаться файлы после успешной публикации.
                    </p>
                  </div>

                  {/* Blottata API Key */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-200">
                      Blottata API Key *
                    </label>
                    <input
                      type="password"
                      value={channel.blotataApiKey || ""}
                      onChange={(e) =>
                        setChannel({
                          ...channel,
                          blotataApiKey: e.target.value.trim() || undefined
                        })
                      }
                      placeholder="blt_..."
                      className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-brand focus:ring-2 focus:ring-brand/40"
                    />
                    <p className="text-xs text-slate-400">
                      API ключ для доступа к Blottata. Если не указан, будет использован ключ из настроек сервера.
                    </p>
                  </div>

                  {/* ID площадок */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-slate-200">
                      ID аккаунтов в Blottata (укажите хотя бы один)
                    </h4>
                    
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label className="block text-xs font-medium text-slate-300">
                          YouTube ID
                        </label>
                        <input
                          type="text"
                          value={channel.blotataYoutubeId || ""}
                          onChange={(e) =>
                            setChannel({
                              ...channel,
                              blotataYoutubeId: e.target.value.trim() || null
                            })
                          }
                          placeholder="Например: 2711"
                          className="w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-brand focus:ring-2 focus:ring-brand/40"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="block text-xs font-medium text-slate-300">
                          TikTok ID
                        </label>
                        <input
                          type="text"
                          value={channel.blotataTiktokId || ""}
                          onChange={(e) =>
                            setChannel({
                              ...channel,
                              blotataTiktokId: e.target.value.trim() || null
                            })
                          }
                          placeholder="Например: 22097"
                          className="w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-brand focus:ring-2 focus:ring-brand/40"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="block text-xs font-medium text-slate-300">
                          Instagram ID
                        </label>
                        <input
                          type="text"
                          value={channel.blotataInstagramId || ""}
                          onChange={(e) =>
                            setChannel({
                              ...channel,
                              blotataInstagramId: e.target.value.trim() || null
                            })
                          }
                          placeholder="Например: 3774"
                          className="w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-brand focus:ring-2 focus:ring-brand/40"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="block text-xs font-medium text-slate-300">
                          Facebook ID
                        </label>
                        <input
                          type="text"
                          value={channel.blotataFacebookId || ""}
                          onChange={(e) =>
                            setChannel({
                              ...channel,
                              blotataFacebookId: e.target.value.trim() || null
                            })
                          }
                          placeholder="Необязательно"
                          className="w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-brand focus:ring-2 focus:ring-brand/40"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="block text-xs font-medium text-slate-300">
                          Facebook Page ID
                        </label>
                        <input
                          type="text"
                          value={channel.blotataFacebookPageId || ""}
                          onChange={(e) =>
                            setChannel({
                              ...channel,
                              blotataFacebookPageId: e.target.value.trim() || null
                            })
                          }
                          placeholder="Необязательно"
                          className="w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-brand focus:ring-2 focus:ring-brand/40"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="block text-xs font-medium text-slate-300">
                          Threads ID
                        </label>
                        <input
                          type="text"
                          value={channel.blotataThreadsId || ""}
                          onChange={(e) =>
                            setChannel({
                              ...channel,
                              blotataThreadsId: e.target.value.trim() || null
                            })
                          }
                          placeholder="Необязательно"
                          className="w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-brand focus:ring-2 focus:ring-brand/40"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="block text-xs font-medium text-slate-300">
                          Twitter ID
                        </label>
                        <input
                          type="text"
                          value={channel.blotataTwitterId || ""}
                          onChange={(e) =>
                            setChannel({
                              ...channel,
                              blotataTwitterId: e.target.value.trim() || null
                            })
                          }
                          placeholder="Необязательно"
                          className="w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-brand focus:ring-2 focus:ring-brand/40"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="block text-xs font-medium text-slate-300">
                          LinkedIn ID
                        </label>
                        <input
                          type="text"
                          value={channel.blotataLinkedinId || ""}
                          onChange={(e) =>
                            setChannel({
                              ...channel,
                              blotataLinkedinId: e.target.value.trim() || null
                            })
                          }
                          placeholder="Необязательно"
                          className="w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-brand focus:ring-2 focus:ring-brand/40"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="block text-xs font-medium text-slate-300">
                          Pinterest ID
                        </label>
                        <input
                          type="text"
                          value={channel.blotataPinterestId || ""}
                          onChange={(e) =>
                            setChannel({
                              ...channel,
                              blotataPinterestId: e.target.value.trim() || null
                            })
                          }
                          placeholder="Необязательно"
                          className="w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-brand focus:ring-2 focus:ring-brand/40"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="block text-xs font-medium text-slate-300">
                          Pinterest Board ID
                        </label>
                        <input
                          type="text"
                          value={channel.blotataPinterestBoardId || ""}
                          onChange={(e) =>
                            setChannel({
                              ...channel,
                              blotataPinterestBoardId: e.target.value.trim() || null
                            })
                          }
                          placeholder="Необязательно"
                          className="w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-brand focus:ring-2 focus:ring-brand/40"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="block text-xs font-medium text-slate-300">
                          Bluesky ID
                        </label>
                        <input
                          type="text"
                          value={channel.blotataBlueskyId || ""}
                          onChange={(e) =>
                            setChannel({
                              ...channel,
                              blotataBlueskyId: e.target.value.trim() || null
                            })
                          }
                          placeholder="Необязательно"
                          className="w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-brand focus:ring-2 focus:ring-brand/40"
                        />
                      </div>
                    </div>

                    <p className="text-xs text-slate-400">
                      Укажите ID аккаунтов в Blottata для платформ, на которые нужно публиковать видео. 
                      Если ID не указан, публикация на эту платформу не будет выполняться.
                    </p>
                  </div>

                  {/* Кнопка тестирования */}
                  <div className="mt-6 space-y-2">
                    <button
                      type="button"
                      onClick={handleTestBlottata}
                      disabled={testingBlottata || !channel.driveInputFolderId || !channel.blotataApiKey}
                      className="flex items-center gap-2 rounded-xl border border-brand/50 bg-brand/10 px-4 py-2.5 text-sm font-medium text-brand transition hover:bg-brand/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {testingBlottata ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          Тестирование...
                        </>
                      ) : (
                        <>
                          <Play size={16} />
                          Протестировать Blottata автоматизацию
                        </>
                      )}
                    </button>
                    {blottataTestResult && (
                      <div
                        className={`rounded-lg border px-4 py-3 text-sm ${
                          blottataTestResult.startsWith("✅")
                            ? "border-green-500/30 bg-green-500/10 text-green-200"
                            : "border-red-500/30 bg-red-500/10 text-red-200"
                        }`}
                      >
                        {blottataTestResult}
                      </div>
                    )}
                    <p className="text-xs text-slate-400">
                      Протестирует обработку первого файла из входной папки. Файл будет обработан и опубликован на настроенные платформы.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-4 pt-4">
              <button
                type="button"
                onClick={() => navigate("/channels")}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/60 px-5 py-3 text-sm font-medium text-slate-300 transition hover:border-brand/40 hover:text-white"
              >
                <X size={16} />
                Отмена
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 hover:bg-brand-dark"
              >
                {saving ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Сохранение...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    Сохранить изменения
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChannelEditPage;
