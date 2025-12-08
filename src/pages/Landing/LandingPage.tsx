import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { 
  Sparkles, 
  Wand2, 
  Calendar, 
  Zap, 
  Shield, 
  Bot, 
  PlayCircle,
  CheckCircle2,
  ArrowRight,
  MessageSquare,
  FolderOpen,
  Timer,
  Target,
  TrendingUp,
  Users,
  Settings,
  Video,
  Brain,
  Rocket,
  Infinity
} from "lucide-react";
import SEOHead from "../../components/SEOHead";

const LandingPage = () => {
  const [isVisible, setIsVisible] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsVisible(true);
    
    // Intersection Observer для анимаций при скролле
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("fade-in-up");
          }
        });
      },
      { threshold: 0.1 }
    );

    const elements = document.querySelectorAll(".scroll-animate");
    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "ShortsAI Studio",
    description: "Автоматизация генерации сценариев и видео-контента для YouTube Shorts, TikTok и Instagram Reels",
    url: "https://shortsai.ru",
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "RUB"
    },
    featureList: [
      "Генерация сценариев на базе продвинутого AI",
      "Автоматизация публикаций по расписанию",
      "Интеграции Telegram + Google Drive",
      "Работа без лимитов OpenAI"
    ]
  };

  return (
    <>
      <SEOHead
        title="ShortsAI Studio — автоматизация сценариев и генерация роликов"
        description="Генерация сценариев и автоматическая публикация контента для YouTube Shorts, TikTok и Reels. Интеграция Telegram, Google Drive, AI-сценарист и умная автоматизация."
        keywords="shorts ai, генерация сценариев shorts, автоматизация контента, ai videos, tiktok сценарии, youtube shorts автоматизация"
        structuredData={structuredData}
      />
      
      <div className="min-h-screen bg-[#0a0a0f] text-white overflow-x-hidden">
        {/* Hero-блок с премиальным дизайном */}
        <section 
          ref={heroRef}
          className="relative min-h-screen flex items-center justify-center overflow-hidden border-b border-white/5"
        >
          {/* Анимированный фон с градиентами */}
          <div className="absolute inset-0 wave-bg" />
          <div className="absolute inset-0 bg-gradient-to-br from-purple-950/20 via-blue-950/20 to-pink-950/20" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(139,92,246,0.1),transparent_70%)]" />
          
          {/* Светящиеся орбы */}
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-[100px] animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-pink-500/20 rounded-full blur-[100px] animate-pulse delay-1000" />
          <div className="absolute top-1/2 right-1/3 w-72 h-72 bg-cyan-500/15 rounded-full blur-[80px] animate-pulse delay-500" />

          <div className="relative z-10 mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
            <div className={`text-center transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
              {/* Badge */}
              <div className="mb-8 inline-flex items-center gap-2 rounded-full glass px-6 py-3 text-sm font-medium text-purple-300 neon-glow border border-purple-500/30">
                <Sparkles size={18} className="animate-pulse" />
                <span>ShortsAI Studio</span>
              </div>
              
              {/* Главный заголовок */}
              <h1 className="mb-6 text-5xl font-extrabold leading-tight tracking-tight sm:text-6xl md:text-7xl lg:text-8xl">
                <span className="block text-white mb-2">Автогенерация сценариев</span>
                <span className="block gradient-text">для Shorts, TikTok и Reels</span>
              </h1>
              
              {/* Подзаголовок */}
              <p className="mx-auto mb-12 max-w-3xl text-xl sm:text-2xl text-slate-300 leading-relaxed">
                Создавайте и запускайте генерацию роликов с помощью нейросети, автоматически публикуйте их и управляйте десятками каналов из одного пространства.
              </p>
              
              {/* CTA кнопки */}
              <div className="flex flex-col items-center justify-center gap-6 sm:flex-row">
                <Link
                  to="/auth"
                  className="group relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 px-10 py-5 text-lg font-bold text-white transition-all duration-300 neon-glow-hover hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/50"
                  style={{ backgroundSize: "200% 200%" }}
                >
                  <span className="relative z-10 flex items-center gap-3">
                    Начать бесплатно
                    <ArrowRight size={24} className="transition-transform group-hover:translate-x-2" />
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity animate-shimmer" style={{ backgroundSize: "200% 200%", animation: "gradient-shift 3s ease infinite" }} />
                </Link>
                <a
                  href="#features"
                  className="group rounded-2xl glass border border-white/20 px-10 py-5 text-lg font-semibold text-white transition-all duration-300 hover:border-purple-500/50 hover:bg-white/5 hover:scale-105"
                >
                  <span className="flex items-center gap-3">
                    Узнать больше
                    <ArrowRight size={24} className="transition-transform group-hover:translate-x-2" />
                  </span>
                </a>
              </div>

              {/* Декоративный элемент - AI волна */}
              <div className="mt-20 flex items-center justify-center">
                <div className="relative w-full max-w-4xl h-32 overflow-hidden rounded-2xl glass border border-purple-500/20">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex gap-2">
                      {[...Array(20)].map((_, i) => (
                        <div
                          key={i}
                          className="w-1 bg-gradient-to-t from-purple-500 to-pink-500 rounded-full"
                          style={{
                            height: `${Math.random() * 60 + 20}px`,
                            animation: `float ${2 + Math.random() * 2}s ease-in-out infinite`,
                            animationDelay: `${i * 0.1}s`
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Блок "Что делает приложение" - премиальные карточки */}
        <section 
          id="features" 
          ref={featuresRef}
          className="relative px-4 py-24 sm:px-6 lg:px-8 lg:py-32"
        >
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-purple-950/5 to-transparent" />
          
          <div className="relative z-10 mx-auto max-w-7xl">
            <div className="mb-16 text-center scroll-animate">
              <h2 className="mb-6 text-4xl font-bold text-white sm:text-5xl lg:text-6xl">
                Что делает приложение
              </h2>
              <p className="mx-auto max-w-2xl text-xl text-slate-400">
                Полный цикл создания и публикации контента в одном инструменте
              </p>
            </div>
            
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  icon: Brain,
                  title: "Генерация сценариев на базе продвинутого AI",
                  description: "Умная нейросеть создаёт уникальные сценарии с учётом ваших настроек канала",
                  gradient: "from-purple-500/20 to-pink-500/20",
                  borderColor: "border-purple-500/30",
                  iconColor: "text-purple-400"
                },
                {
                  icon: Settings,
                  title: "Полный контроль тона, длительности, стиля",
                  description: "Настройте каждый канал под свою аудиторию и нишу",
                  gradient: "from-blue-500/20 to-cyan-500/20",
                  borderColor: "border-blue-500/30",
                  iconColor: "text-blue-400"
                },
                {
                  icon: Calendar,
                  title: "Автоматизация публикаций по расписанию",
                  description: "Установите расписание и забудьте о ручной публикации контента",
                  gradient: "from-emerald-500/20 to-teal-500/20",
                  borderColor: "border-emerald-500/30",
                  iconColor: "text-emerald-400"
                },
                {
                  icon: Video,
                  title: "Экспорт в YouTube, TikTok, Instagram",
                  description: "Один клик — и контент готов к публикации на любой платформе",
                  gradient: "from-red-500/20 to-orange-500/20",
                  borderColor: "border-red-500/30",
                  iconColor: "text-red-400"
                },
                {
                  icon: Bot,
                  title: "Интеграции Telegram + Google Drive",
                  description: "Автоматическая загрузка видео в облако и отправка через бота",
                  gradient: "from-indigo-500/20 to-purple-500/20",
                  borderColor: "border-indigo-500/30",
                  iconColor: "text-indigo-400"
                },
                {
                  icon: Infinity,
                  title: "Работаем без лимитов OpenAI",
                  description: "Используйте собственный API-ключ без ограничений сервиса",
                  gradient: "from-amber-500/20 to-yellow-500/20",
                  borderColor: "border-amber-500/30",
                  iconColor: "text-amber-400"
                }
              ].map((feature, index) => (
                <div
                  key={index}
                  className="premium-card scroll-animate glass-strong rounded-3xl p-8 border border-white/10"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className={`mb-6 inline-flex rounded-2xl bg-gradient-to-br ${feature.gradient} p-4 ${feature.iconColor} border ${feature.borderColor}`}>
                    <feature.icon size={32} className="neon-glow" />
                  </div>
                  <h3 className="mb-3 text-2xl font-bold text-white">
                    {feature.title}
                  </h3>
                  <p className="text-slate-400 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Блок "Почему это лучше ручной работы" */}
        <section className="relative border-y border-white/5 bg-gradient-to-br from-slate-950/50 via-purple-950/20 to-slate-950/50 px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(139,92,246,0.1),transparent_50%)]" />
          
          <div className="relative z-10 mx-auto max-w-7xl">
            <div className="mb-16 text-center scroll-animate">
              <h2 className="mb-6 text-4xl font-bold text-white sm:text-5xl lg:text-6xl">
                Почему это лучше ручной работы
              </h2>
              <p className="mx-auto max-w-2xl text-xl text-slate-400">
                Экономьте время и масштабируйте производство контента
              </p>
            </div>
            
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  icon: TrendingUp,
                  title: "10× быстрее",
                  description: "Чем писать сценарии самому. Генерация за секунды вместо часов",
                  color: "purple"
                },
                {
                  icon: Target,
                  title: "Стабильное качество",
                  description: "AI поддерживает единый стиль и тон для всех ваших каналов",
                  color: "blue"
                },
                {
                  icon: Timer,
                  title: "Контент по расписанию",
                  description: "Публикации выходят строго в запланированное время, без задержек",
                  color: "emerald"
                },
                {
                  icon: Users,
                  title: "Десятки каналов без команды",
                  description: "Управляйте множеством каналов самостоятельно, без найма контент-менеджеров",
                  color: "pink"
                },
                {
                  icon: Shield,
                  title: "Приватное хранение",
                  description: "Все данные хранятся безопасно в Firebase, только у вас",
                  color: "cyan"
                },
                {
                  icon: Zap,
                  title: "Без ограничений",
                  description: "Используйте свой API-ключ OpenAI без лимитов сервиса",
                  color: "amber"
                }
              ].map((benefit, index) => {
                const colorClasses: Record<string, { bg: string; text: string; border: string }> = {
                  purple: { bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/20" },
                  blue: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20" },
                  emerald: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" },
                  pink: { bg: "bg-pink-500/10", text: "text-pink-400", border: "border-pink-500/20" },
                  cyan: { bg: "bg-cyan-500/10", text: "text-cyan-400", border: "border-cyan-500/20" },
                  amber: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20" }
                };
                const colors = colorClasses[benefit.color] || colorClasses.purple;
                
                return (
                  <div
                    key={index}
                    className="scroll-animate premium-card glass rounded-2xl p-8 border border-white/10"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <div className={`mb-6 inline-flex rounded-xl ${colors.bg} p-4 ${colors.text} border ${colors.border}`}>
                      <benefit.icon size={32} />
                    </div>
                    <h3 className="mb-3 text-xl font-bold text-white">
                      {benefit.title}
                    </h3>
                    <p className="text-slate-400 leading-relaxed">
                      {benefit.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Блок "Как это работает в 3 шага" */}
        <section className="relative px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-950/5 to-transparent" />
          
          <div className="relative z-10 mx-auto max-w-7xl">
            <div className="mb-16 text-center scroll-animate">
              <h2 className="mb-6 text-4xl font-bold text-white sm:text-5xl lg:text-6xl">
                Как это работает в 3 шага
              </h2>
              <p className="mx-auto max-w-2xl text-xl text-slate-400">
                Начните создавать контент уже через несколько минут
              </p>
            </div>
            
            <div className="grid gap-12 sm:grid-cols-3">
              {[
                {
                  step: "1",
                  title: "Создайте канал и настройте параметры",
                  description: "Выберите платформу, язык, длительность, тон и аудиторию. Настройте расписание публикаций.",
                  icon: Settings,
                  gradient: "from-purple-500 to-pink-500"
                },
                {
                  step: "2",
                  title: "Запустите генерацию сценариев",
                  description: "Один клик — и AI создаст уникальный сценарий с учётом всех ваших настроек канала.",
                  icon: Sparkles,
                  gradient: "from-blue-500 to-cyan-500"
                },
                {
                  step: "3",
                  title: "Автоматизация публикует ролики по расписанию",
                  description: "Система автоматически загружает видео в Google Drive и отправляет через Telegram бота.",
                  icon: Rocket,
                  gradient: "from-emerald-500 to-teal-500"
                }
              ].map((step, index) => (
                <div
                  key={index}
                  className="scroll-animate relative text-center"
                  style={{ animationDelay: `${index * 0.2}s` }}
                >
                  <div className="mb-8 relative">
                    <div className={`mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br ${step.gradient} text-4xl font-bold text-white shadow-lg neon-glow`}>
                      {step.step}
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className={`h-24 w-24 rounded-full bg-gradient-to-br ${step.gradient} opacity-20 blur-2xl animate-pulse`} />
                    </div>
                  </div>
                  <div className="mb-6 inline-flex rounded-2xl glass p-4 border border-white/10 neon-glow">
                    <step.icon 
                      size={40} 
                      className={
                        index === 0 ? "text-purple-400" : 
                        index === 1 ? "text-blue-400" : 
                        "text-emerald-400"
                      } 
                    />
                  </div>
                  <h3 className="mb-4 text-2xl font-bold text-white">
                    {step.title}
                  </h3>
                  <p className="text-slate-400 leading-relaxed">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA-блок - мощный призыв */}
        <section className="relative border-y border-white/5 bg-gradient-to-r from-purple-950/30 via-pink-950/30 to-purple-950/30 px-4 py-24 sm:px-6 lg:px-8 lg:py-32 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(139,92,246,0.2),transparent_70%)]" />
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-purple-600/10 via-transparent to-pink-600/10" />
          
          <div className="relative z-10 mx-auto max-w-4xl text-center">
            <h2 className="mb-6 text-4xl font-bold text-white sm:text-5xl lg:text-6xl">
              Готовы начать создавать контент быстрее?
            </h2>
            <p className="mb-12 text-xl text-slate-300">
              Присоединяйтесь к создателям контента, которые уже экономят часы каждый день
            </p>
            <Link
              to="/auth"
              className="group relative inline-flex items-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 px-12 py-6 text-xl font-bold text-white transition-all duration-300 neon-glow-hover hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/50"
              style={{ backgroundSize: "200% 200%" }}
            >
              <span className="relative z-10 flex items-center gap-3">
                Попробовать сейчас
                <ArrowRight size={28} className="transition-transform group-hover:translate-x-2" />
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity" style={{ backgroundSize: "200% 200%", animation: "gradient-shift 3s ease infinite" }} />
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-white/5 bg-slate-950 px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <div className="mb-6 flex items-center gap-3">
                  <Sparkles size={28} className="text-purple-400" />
                  <span className="text-xl font-bold text-white">ShortsAI Studio</span>
                </div>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Автоматизация генерации контента для Shorts, TikTok и Reels
                </p>
              </div>
              
              <div>
                <h4 className="mb-4 text-sm font-semibold text-white uppercase tracking-wider">Правовая информация</h4>
                <ul className="space-y-3">
                  <li>
                    <Link to="/privacy" className="text-sm text-slate-400 transition hover:text-purple-400">
                      Политика конфиденциальности
                    </Link>
                  </li>
                </ul>
              </div>
              
              <div>
                <h4 className="mb-4 text-sm font-semibold text-white uppercase tracking-wider">Контакты</h4>
                <ul className="space-y-3">
                  <li>
                    <a href="https://t.me/shortsai" target="_blank" rel="noopener noreferrer" className="text-sm text-slate-400 transition hover:text-purple-400 flex items-center gap-2">
                      <MessageSquare size={16} />
                      Telegram канал
                    </a>
                  </li>
                </ul>
              </div>
              
              <div>
                <h4 className="mb-4 text-sm font-semibold text-white uppercase tracking-wider">Документация</h4>
                <ul className="space-y-3">
                  <li>
                    <a href="https://github.com/hotwellkz/p015" target="_blank" rel="noopener noreferrer" className="text-sm text-slate-400 transition hover:text-purple-400">
                      GitHub
                    </a>
                  </li>
                </ul>
              </div>
            </div>
            
            <div className="mt-12 border-t border-white/5 pt-8 text-center text-sm text-slate-500">
              <p>© {new Date().getFullYear()} ShortsAI Studio. Все права защищены.</p>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
};

export default LandingPage;
