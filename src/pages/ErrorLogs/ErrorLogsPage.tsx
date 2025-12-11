import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, X, AlertCircle, AlertTriangle, Info, RefreshCw, Trash2, ChevronDown, ChevronUp, Copy } from "lucide-react";
import { getErrorLogs, clearErrorLogs, type ErrorLog, type ErrorSource } from "../../api/errorLogs";
import { useToast } from "../../hooks/useToast";
import Toast from "../../components/Toast";

const SOURCE_LABELS: Record<ErrorSource, string> = {
  telegram_download: "Скачивание из Telegram",
  telegram_send: "Отправка в Telegram",
  google_drive_upload: "Загрузка на Google Drive",
  google_drive_auth: "Авторизация Google Drive",
  blotato_publish: "Публикация в соцсетях",
  schedule_runner: "Автоматический запуск",
  other: "Другое",
};

const SEVERITY_COLORS = {
  error: "bg-red-500/20 text-red-300 border-red-500/30",
  warning: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  info: "bg-blue-500/20 text-blue-300 border-blue-500/30",
};

const SEVERITY_ICONS = {
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

export default function ErrorLogsPage() {
  const navigate = useNavigate();
  const { toasts, showSuccess, showError, removeToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [filters, setFilters] = useState<{
    resolved?: boolean;
    source?: ErrorSource;
    channelId?: string;
  }>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [clearing, setClearing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const loadErrorLogs = async () => {
    setLoading(true);
    try {
      const result = await getErrorLogs({
        page,
        pageSize,
        ...filters,
      });
      setErrorLogs(result.items);
      setTotal(result.total);
    } catch (error: any) {
      console.error("Failed to load error logs:", error);
      
      // Специальная обработка ошибки индекса Firestore
      if (error.needsIndex) {
        const indexMessage =
          error.message ||
          "Для работы журнала ошибок требуется создать индекс в Firestore. " +
          "Обратитесь к администратору для создания индекса: " +
          "Collection: errorLogs, Fields: userId (Ascending), createdAt (Descending).";
        showError(indexMessage, 10000); // Показываем дольше для важного сообщения
      } else {
        // Обычная ошибка
        const errorMessage =
          error.message ||
          "Не удалось загрузить журнал ошибок. Проверьте подключение к серверу.";
        showError(errorMessage, 6000);
      }
      
      // Очищаем список при ошибке, чтобы не показывать устаревшие данные
      setErrorLogs([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadErrorLogs();
  }, [page, filters]);

  const handleClearErrors = async () => {
    setClearing(true);
    try {
      await clearErrorLogs({ mode: "all" });
      showSuccess("Все ошибки помечены как решённые", 3000);
      setShowClearConfirm(false);
      await loadErrorLogs();
    } catch (error: any) {
      console.error("Failed to clear error logs:", error);
      const errorMessage =
        error.message ||
        "Не удалось очистить ошибки. Проверьте подключение к серверу.";
      showError(errorMessage, 6000);
    } finally {
      setClearing(false);
    }
  };

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIds(newExpanded);
  };

  const copyDetails = (details: any) => {
    navigator.clipboard.writeText(JSON.stringify(details, null, 2));
    showSuccess("Детали ошибки скопированы в буфер обмена", 2000);
  };

  const filteredLogs = errorLogs.filter((log) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      log.channelName?.toLowerCase().includes(query) ||
      log.code.toLowerCase().includes(query) ||
      log.message.toLowerCase().includes(query)
    );
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Toast уведомления */}
      <div className="fixed left-0 right-0 top-0 z-[10002] pointer-events-none px-4 pt-4 sm:px-6 sm:pt-6">
        <div className="relative mx-auto max-w-md">
          {toasts.map((toast, index) => (
            <div
              key={toast.id}
              className="pointer-events-auto mb-2"
              style={{
                position: index === 0 ? "relative" : "absolute",
                top: index === 0 ? 0 : `${index * 80}px`,
                width: "100%",
                transition: "top 0.2s ease-out",
              }}
            >
              <Toast toast={toast} onClose={removeToast} />
            </div>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/channels")}
              className="rounded-xl border border-white/10 bg-slate-800/60 px-4 py-2 text-sm text-slate-300 transition hover:border-white/20 hover:bg-slate-800/80 hover:text-white"
            >
              <ArrowLeft size={16} className="inline mr-2" />
              Назад
            </button>
            <div>
              <h1 className="text-3xl font-bold text-white">Журнал ошибок</h1>
              <p className="mt-2 text-sm text-slate-400">
                Здесь сохраняются ошибки скачивания из Telegram, загрузки в Google Drive и автопубликации.
              </p>
            </div>
          </div>
        </div>

        {/* Фильтры и управление */}
        <div className="mb-6 rounded-xl border border-white/10 bg-slate-900/80 p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap gap-3">
              {/* Поиск */}
              <input
                type="text"
                placeholder="Поиск по каналу, коду или сообщению..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 min-w-[200px] rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm text-white placeholder-slate-400 focus:border-brand/40 focus:outline-none"
              />

              {/* Фильтр по источнику */}
              <select
                value={filters.source || ""}
                onChange={(e) =>
                  setFilters({ ...filters, source: e.target.value as ErrorSource | undefined })
                }
                className="rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm text-white focus:border-brand/40 focus:outline-none"
              >
                <option value="">Все источники</option>
                {Object.entries(SOURCE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>

              {/* Фильтр по статусу */}
              <select
                value={filters.resolved === undefined ? "" : filters.resolved ? "true" : "false"}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    resolved: e.target.value === "" ? undefined : e.target.value === "true",
                  })
                }
                className="rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm text-white focus:border-brand/40 focus:outline-none"
              >
                <option value="">Все статусы</option>
                <option value="false">Активные</option>
                <option value="true">Решённые</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={loadErrorLogs}
                disabled={loading}
                className="flex items-center gap-2 rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm text-slate-300 transition hover:border-white/20 hover:bg-slate-800/80 hover:text-white disabled:opacity-50"
              >
                <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                Обновить
              </button>
              <button
                onClick={() => setShowClearConfirm(true)}
                className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-900/20 px-3 py-2 text-sm text-red-300 transition hover:border-red-500/50 hover:bg-red-900/30"
              >
                <Trash2 size={16} />
                Очистить ошибки
              </button>
            </div>
          </div>
        </div>

        {/* Подтверждение очистки */}
        {showClearConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="mx-4 w-full max-w-md rounded-xl border border-white/10 bg-slate-900 p-6">
              <h3 className="mb-4 text-lg font-semibold text-white">
                Очистить все ошибки?
              </h3>
              <p className="mb-6 text-sm text-slate-400">
                Все ошибки будут помечены как решённые. Это действие нельзя отменить.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="rounded-lg border border-white/10 bg-slate-800/60 px-4 py-2 text-sm text-slate-300 transition hover:bg-slate-800/80"
                >
                  Отмена
                </button>
                <button
                  onClick={handleClearErrors}
                  disabled={clearing}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                >
                  {clearing ? (
                    <>
                      <Loader2 size={16} className="inline mr-2 animate-spin" />
                      Очистка...
                    </>
                  ) : (
                    "Очистить"
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Список ошибок */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={32} className="animate-spin text-brand" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-slate-900/80 p-12 text-center">
            <AlertCircle size={48} className="mx-auto mb-4 text-slate-500" />
            <p className="text-lg font-semibold text-slate-300">Ошибок не найдено</p>
            <p className="mt-2 text-sm text-slate-400">
              {searchQuery || Object.keys(filters).length > 0
                ? "Попробуйте изменить фильтры"
                : "Все ошибки решены или их пока нет"}
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {filteredLogs.map((log) => {
                const SeverityIcon = SEVERITY_ICONS[log.severity];
                const isExpanded = expandedIds.has(log.id);

                return (
                  <div
                    key={log.id}
                    className="rounded-xl border border-white/10 bg-slate-900/80 p-4 transition hover:border-white/20"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="mb-2 flex items-center gap-3">
                          <SeverityIcon
                            size={20}
                            className={`${SEVERITY_COLORS[log.severity].split(" ")[1]}`}
                          />
                          <span
                            className={`rounded-full border px-2 py-0.5 text-xs font-medium ${SEVERITY_COLORS[log.severity]}`}
                          >
                            {log.severity === "error" ? "Ошибка" : log.severity === "warning" ? "Предупреждение" : "Информация"}
                          </span>
                          <span className="text-xs text-slate-400">
                            {SOURCE_LABELS[log.source]}
                          </span>
                          {log.resolved && (
                            <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-xs text-green-300">
                              Решено
                            </span>
                          )}
                        </div>
                        <div className="mb-2">
                          {log.channelName && (
                            <button
                              onClick={() => navigate(`/channels/${log.channelId}/edit`)}
                              className="text-sm font-medium text-brand hover:text-brand-light"
                            >
                              {log.channelName}
                            </button>
                          )}
                          <span className="ml-2 text-xs text-slate-400">
                            {formatDate(log.createdAt)}
                          </span>
                        </div>
                        <p className="mb-1 text-sm font-medium text-white">{log.message}</p>
                        <p className="text-xs text-slate-400">Код: {log.code}</p>
                      </div>
                      <button
                        onClick={() => toggleExpand(log.id)}
                        className="ml-4 rounded-lg border border-white/10 bg-slate-800/60 p-2 text-slate-400 transition hover:border-white/20 hover:text-white"
                      >
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </div>

                    {isExpanded && log.details && (
                      <div className="mt-4 rounded-lg border border-white/10 bg-slate-950/50 p-4">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-xs font-medium text-slate-400">
                            Технические детали
                          </span>
                          <button
                            onClick={() => copyDetails(log.details)}
                            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-400 transition hover:bg-slate-800/60 hover:text-white"
                          >
                            <Copy size={12} />
                            Копировать
                          </button>
                        </div>
                        <pre className="max-h-96 overflow-auto rounded bg-slate-900/50 p-3 text-xs text-slate-300">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Пагинация */}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm text-slate-300 transition hover:border-white/20 hover:bg-slate-800/80 disabled:opacity-50"
                >
                  Предыдущая
                </button>
                <span className="px-4 text-sm text-slate-400">
                  Страница {page} из {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm text-slate-300 transition hover:border-white/20 hover:bg-slate-800/80 disabled:opacity-50"
                >
                  Следующая
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}


