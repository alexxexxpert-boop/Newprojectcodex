// Проверка окружения перед запуском: WordPress-доступ и LLM-ключ.
//   npm run check
import { config } from "./config.js";

let failed = false;

function ok(msg: string): void {
  console.log(`  ✅ ${msg}`);
}

function fail(msg: string): void {
  failed = true;
  console.log(`  ❌ ${msg}`);
}

function skip(msg: string): void {
  console.log(`  ⏭️  ${msg}`);
}

async function checkWordPress(): Promise<void> {
  console.log("\n[1/3] WordPress REST API");

  const credentials = `${config.wordpress.username}:${config.wordpress.appPassword}`;
  const auth = "Basic " + Buffer.from(credentials).toString("base64");

  try {
    const res = await fetch(`${config.wordpress.apiUrl}/users/me`, {
      headers: { Authorization: auth },
    });

    if (res.ok) {
      const me = (await res.json()) as { name?: string; id?: number };
      ok(`Авторизация работает — вошли как «${me.name ?? "?"}» (id ${me.id ?? "?"})`);
      ok(`Публикация будет идти на: ${config.wordpress.apiUrl}`);
    } else if (res.status === 401) {
      fail("401 Unauthorized — неверный логин или Application Password.");
      console.log("     Проверь: WP_APP_PASSWORD должен быть «паролем приложения»,");
      console.log("     а не обычным паролем от админки.");
    } else if (res.status === 403) {
      fail("403 Forbidden — плагин безопасности блокирует REST API или Basic auth.");
    } else {
      fail(`Неожиданный ответ: HTTP ${res.status}`);
    }
  } catch (err) {
    fail(`Сайт недоступен: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function checkLlm(): Promise<void> {
  console.log(`\n[2/3] LLM (${config.llm.provider}: ${config.llm.model})`);

  try {
    const { callLLM } = await import("./utils/llm.js");
    const reply = await callLLM("Отвечай одним словом.", "Скажи: ок", {
      maxTokens: 10,
      temperature: 0,
    });
    ok(`Ключ работает, модель ответила: «${reply.trim().slice(0, 30)}»`);
  } catch (err) {
    fail(`LLM не отвечает: ${err instanceof Error ? err.message : String(err)}`);
  }
}

function checkOptional(): void {
  console.log("\n[3/3] Опциональные сервисы");

  if (config.falAi.enabled) ok("Fal.ai настроен — картинки будут генерироваться");
  else skip("Fal.ai не настроен — статьи без картинок (это ок)");

  if (config.tavily.enabled) ok("Tavily настроен — research включён (бесплатно 1000/мес)");
  else if (config.perplexity.enabled) ok("Perplexity настроен — research включён");
  else skip("Research не настроен — статьи без внешних данных (это ок). Tavily бесплатно: tavily.com");

  if (config.semrush.enabled) ok("Semrush настроен");
  else skip("Semrush не настроен — только seed keyword (это ок)");

  console.log(`\n  Очередь: ${config.queue.mode === "file" ? `файл ${config.queue.file}` : "Google Sheets"}`);
  console.log(`  Режим публикации: ${config.automation.publishStatus}${config.automation.publishStatus === "draft" ? " (черновики — безопасно)" : " ⚠️ сразу на сайт!"}`);
}

async function main(): Promise<void> {
  console.log("══════════════════════════════════════════");
  console.log(" Кибер СЕО — проверка окружения");
  console.log("══════════════════════════════════════════");

  await checkWordPress();
  await checkLlm();
  checkOptional();

  console.log("\n══════════════════════════════════════════");
  if (failed) {
    console.log(" ❌ Есть проблемы — исправь и запусти npm run check снова");
    process.exit(1);
  }
  console.log(" ✅ Всё готово! Запускай: npm run once (разово) или npm start (постоянно)");
  process.exit(0);
}

void main();
