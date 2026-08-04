import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  CheckCircle,
  Copy,
  FileText,
  GlobeSimple,
  ImageSquare,
  LinkSimple,
  ListMagnifyingGlass,
  MagicWand,
  MapPin,
  PencilSimple,
  Sparkle,
  WarningCircle,
} from "@phosphor-icons/react";

const steps = [
  {
    icon: ListMagnifyingGlass,
    title: "Обходим весь сайт",
    text: "Читаем карту сайта и собираем реальные товары, услуги, цены и фотографии.",
  },
  {
    icon: FileText,
    title: "Собираем SEO-запросы",
    text: "Подбираем ключевые фразы покупателей и распределяем их без переспама.",
  },
  {
    icon: PencilSimple,
    title: "Готовим объявления",
    text: "Пишем заголовок и описание, добавляем фото с сайта — останется проверить.",
  },
];

function Brand() {
  return (
    <div className="brand" aria-label="Avito Presswall AI">
      <span className="brand__mark"><MagicWand weight="bold" /></span>
      <span className="brand__name">Avito Presswall <b>AI</b></span>
      <span className="brand__divider" />
      <span className="brand__mode">Пошаговый помощник</span>
    </div>
  );
}

function Step({ number, icon: Icon, title, text }) {
  return (
    <article className="step">
      <span className="step__icon"><Icon weight="regular" /></span>
      <div>
        <h3>{number}. {title}</h3>
        <p>{text}</p>
      </div>
    </article>
  );
}

function StartScreen({ onComplete }) {
  const [websiteUrl, setWebsiteUrl] = useState("https://presswall-presswall.ru");
  const [market, setMarket] = useState("Москва");
  const [phase, setPhase] = useState("idle");
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setError("");
    setPhase("loading");

    try {
      const response = await fetch("/v1/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ website_url: websiteUrl, market }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error("Проверьте адрес сайта и заполненные поля.");
      }
      if (payload.status === "failed") {
        throw new Error(
          payload.error ||
          "Не удалось прочитать этот сайт. Проверьте адрес или попробуйте другой сайт.",
        );
      }

      onComplete(payload);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Что-то пошло не так. Попробуйте ещё раз.",
      );
      setPhase("idle");
    }
  }

  return (
    <main className="start-page">
      <header className="topbar"><Brand /></header>

      <section className="hero">
        <div className="hero__content">
          <h1>
            <span>Объявления для Авито —</span>
            <br />
            <span>за несколько минут</span>
          </h1>

          <form className="start-form" onSubmit={submit}>
            <label>
              <span>Сайт компании</span>
              <span className="field">
                <GlobeSimple aria-hidden="true" />
                <input
                  aria-label="Сайт компании"
                  type="url"
                  value={websiteUrl}
                  onChange={(event) => setWebsiteUrl(event.target.value)}
                  placeholder="https://ваш-сайт.ru"
                  required
                />
              </span>
            </label>

            <label>
              <span>Город</span>
              <span className="field">
                <MapPin aria-hidden="true" />
                <input
                  aria-label="Город"
                  value={market}
                  onChange={(event) => setMarket(event.target.value)}
                  placeholder="Например, Москва"
                  minLength={2}
                  required
                />
              </span>
            </label>

            <button className="primary-button" type="submit" disabled={phase === "loading"}>
              {phase === "loading" ? (
                <>
                  <span className="spinner" />
                  Обходим страницы сайта…
                </>
              ) : (
                <>
                  <Sparkle weight="fill" />
                  Собрать товары и создать объявления
                </>
              )}
            </button>
          </form>

          {error && (
            <div className="error-message" role="alert">
              <WarningCircle weight="fill" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="hero__visual" aria-hidden="true">
          <img src="/assets/hero-office.png" alt="" />
        </div>
      </section>

      <section className="how-it-works" aria-labelledby="how-title">
        <h2 id="how-title">Как это работает</h2>
        <div className="steps">
          {steps.map((step, index) => (
            <Step key={step.title} number={index + 1} {...step} />
          ))}
        </div>
      </section>
    </main>
  );
}

function ResultScreen({ workflow, onRestart }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const selectedDraft = workflow.drafts[selectedIndex] || workflow.drafts[0];
  const selectedCatalog = workflow.catalog[selectedIndex] || workflow.catalog[0];

  const domain = useMemo(() => {
    try {
      return new URL(workflow.website_url).hostname.replace(/^www\./, "");
    } catch {
      return workflow.website_url;
    }
  }, [workflow.website_url]);

  async function copyDraft() {
    if (!selectedDraft) return;
    await navigator.clipboard.writeText(
      `${selectedDraft.title}\n\n${selectedDraft.description}`,
    );
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2200);
  }

  return (
    <main className="results-page">
      <header className="topbar topbar--results">
        <Brand />
        <button className="restart-link" type="button" onClick={onRestart}>
          <ArrowLeft /> Новый анализ
        </button>
      </header>

      <section className="result-heading">
        <div className="success-icon"><CheckCircle weight="fill" /></div>
        <div>
          <p className="eyebrow eyebrow--success">Анализ завершён</p>
          <h1>Готово — нашли {workflow.catalog.length} {workflow.catalog.length === 1 ? "предложение" : "предложений"}</h1>
          <p>{domain} · {workflow.market}</p>
        </div>
      </section>

      <section className="workspace">
        <aside className="service-list" aria-label="Найденные предложения">
          <h2>Товары и услуги</h2>
          <p>Выберите предложение, чтобы проверить текст, SEO-фразы и фотографии.</p>
          <div className="service-list__items">
            {workflow.catalog.map((item, index) => (
              <button
                className={index === selectedIndex ? "service-row is-selected" : "service-row"}
                key={`${item.name}-${index}`}
                type="button"
                onClick={() => setSelectedIndex(index)}
              >
                <span>{index + 1}</span>
                <strong>{item.name}</strong>
                {index === selectedIndex && <Check weight="bold" />}
              </button>
            ))}
          </div>
        </aside>

        <article className="draft-panel">
          <div className="draft-panel__header">
            <div>
              <p className="eyebrow">Готовое объявление</p>
              <h2>{selectedCatalog?.name || "Объявление"}</h2>
            </div>
            <span className="ready-badge"><CheckCircle weight="fill" /> Готово</span>
          </div>

          {selectedDraft ? (
            <>
              {selectedDraft.image_urls?.length > 0 && (
                <section className="source-photos" aria-labelledby="photos-title">
                  <div className="section-label">
                    <span id="photos-title"><ImageSquare weight="bold" /> Фотографии с сайта</span>
                    <small>{selectedDraft.image_urls.length} шт. · без генерации</small>
                  </div>
                  <div className="photo-strip">
                    {selectedDraft.image_urls.slice(0, 6).map((url, index) => (
                      <img
                        src={url}
                        alt={`${selectedCatalog?.name || "Товар"} — фото ${index + 1}`}
                        key={url}
                        loading="lazy"
                      />
                    ))}
                  </div>
                </section>
              )}
              <label className="draft-field">
                <span>Заголовок для Авито · до 50 символов</span>
                <input value={selectedDraft.title} readOnly />
              </label>
              {selectedDraft.alternate_titles?.length > 0 && (
                <div className="alternate-titles">
                  <span>Другие варианты:</span>
                  {selectedDraft.alternate_titles.map((title) => (
                    <small key={title}>{title}</small>
                  ))}
                </div>
              )}
              <label className="draft-field">
                <span>Описание</span>
                <textarea value={selectedDraft.description} readOnly rows={12} />
              </label>
              <section className="keywords-box" aria-labelledby="keywords-title">
                <div className="section-label">
                  <span id="keywords-title"><ListMagnifyingGlass weight="bold" /> Ключевые фразы</span>
                  <small>основные фразы уже естественно вписаны в текст</small>
                </div>
                <div className="keyword-chips">
                  {selectedDraft.keywords?.map((keyword) => (
                    <span key={keyword}>{keyword}</span>
                  ))}
                </div>
              </section>
              <a
                className="source-link"
                href={selectedDraft.source_url}
                target="_blank"
                rel="noreferrer"
              >
                <LinkSimple weight="bold" /> Открыть исходную страницу товара
              </a>
              <button className="primary-button copy-button" type="button" onClick={copyDraft}>
                {copied ? <CheckCircle weight="fill" /> : <Copy weight="bold" />}
                {copied ? "Скопировано" : "Скопировать объявление"}
              </button>
            </>
          ) : (
            <div className="empty-draft">Для этой услуги текст пока не создан.</div>
          )}
        </article>
      </section>
    </main>
  );
}

export function App() {
  const [workflow, setWorkflow] = useState(null);

  return workflow ? (
    <ResultScreen workflow={workflow} onRestart={() => setWorkflow(null)} />
  ) : (
    <StartScreen onComplete={setWorkflow} />
  );
}
