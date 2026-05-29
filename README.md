# Кибер СЕО & GEO

Полная система автоматической генерации SEO-контента — **без n8n**. Вместо n8n используется кастомный TypeScript сервис автоматизации.

## Структура проекта

```
├── nextjs/          # Next.js 14 фронтенд (App Router, TypeScript, Tailwind)
├── automation/      # Node.js сервис автоматизации (замена n8n)
├── infrastructure/  # Docker Compose + Nginx конфиги
└── wordpress/       # Хелперы для WordPress (functions.php)
```

---

## Быстрый старт

### 1. Клонируй репозиторий

```bash
git clone https://github.com/your-repo/newprojectcodex.git
cd newprojectcodex
```

### 2. Настрой переменные окружения

```bash
cp infrastructure/.env.example infrastructure/.env
# Заполни все значения в infrastructure/.env
```

### 3. Настрой WordPress

1. Установи WordPress на `https://api.example.com`
2. Скопируй содержимое `wordpress/functions.php` в functions.php своей темы
3. Установи плагин **Yoast SEO** (опционально, но рекомендуется)
4. Создай Application Password: **Пользователи → твой аккаунт → Пароли приложений**
5. Запомни этот пароль — он нужен для `WP_APP_PASSWORD`

### 4. Настрой Google Sheets

1. Создай Google Spreadsheet с двумя листами:
   - **Queue**: `A=Keyword | B=Status | C=Domain | D=PublishDate | E=Priority | F=Notes`
   - **Published**: `A=Keyword | B=URL | C=PublishDate | D=SEOScore | E=WordCount | F=Status`
2. Создай Service Account в Google Cloud Console
3. Дай сервисному аккаунту доступ на редактирование таблицы
4. Скопируй JSON ключ → заполни `GOOGLE_SERVICE_ACCOUNT_EMAIL` и `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`

### 5. Получи SSL сертификаты

```bash
# На сервере:
certbot certonly --standalone -d example.com -d api.example.com
```

### 6. Запусти через Docker Compose

```bash
cd infrastructure
docker compose --env-file .env up -d
```

---

## Сервис автоматизации (замена n8n)

### Пайплайн генерации статьи

```
Google Sheets (Queue)
  → Keyword Research (Semrush, опционально)
  → Topic Planning (Claude)
  → Section Research (Perplexity, опционально)
  → Section Writing (Claude)
  → Image Prompts (Claude)
  → Image Generation (Replicate, опционально)
  → Content Audit (Claude)
  → Compile HTML
  → Publish to WordPress REST API
  → Update Google Sheets (Published)
```

### Как добавить статью в очередь

Добавь строку в лист **Queue** своей Google таблицы:

| Keyword | Status | Domain | PublishDate | Priority | Notes |
|---------|--------|--------|-------------|----------|-------|
| Как зарабатывать на маркетплейсах | pending | example.com | 2026-01-05 | high | Для новичков |

Сервис подхватит её в течение 5 минут.

### Статусы в очереди

| Статус | Значение |
|--------|----------|
| `pending` | Ожидает обработки |
| `processing` | Сейчас генерируется |
| `done` | Опубликовано |
| `error` | Ошибка (см. логи) |

### Локальный запуск автоматизации

```bash
cd automation
cp .env.example .env
# Заполни .env
npm install
npm start
```

### Логи

```bash
# Docker:
docker compose logs -f automation

# Файл логов (внутри контейнера):
docker exec <container_id> cat /app/logs/automation.log
```

---

## Локальная разработка Next.js

```bash
cd nextjs
cp .env.example .env.local
# Укажи WP_API_URL, NEXT_PUBLIC_SITE_URL
npm install
npm run dev
# → http://localhost:3000
```

---

## Опциональные API

| API | Зачем | Без него |
|-----|-------|----------|
| Semrush | Связанные ключевые слова | Используется только seed keyword |
| Perplexity | Факты для каждого раздела | Раздел пишется без внешних данных |
| Replicate | Генерация картинок (Flux) | Статья без изображений |

---

## Стек технологий

| Часть | Технологии |
|-------|------------|
| Фронтенд | Next.js 14, React 18, TypeScript, Tailwind CSS |
| Автоматизация | Node.js 20, TypeScript, tsx, node-cron |
| AI | Claude (claude-sonnet-4-6), Perplexity sonar-pro |
| Картинки | Replicate flux-schnell |
| CMS | WordPress (headless) + REST API |
| Инфраструктура | Docker Compose, Nginx, Let's Encrypt |
| Очередь | Google Sheets API v4 |
