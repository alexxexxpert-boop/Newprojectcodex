#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
#  Кибер СЕО — установка одной командой (Ubuntu/Debian VPS или ПК)
#
#  Запуск:
#    curl -fsSL https://raw.githubusercontent.com/alexxexxpert-boop/Newprojectcodex/claude/project-without-n8n-hgIsT/install.sh | bash
#
#  Скрипт сам: поставит Node.js 20, скачает проект, спросит ключи,
#  проверит соединение с WordPress и LLM, предложит запуск.
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail

REPO_URL="https://github.com/alexxexxpert-boop/Newprojectcodex.git"
BRANCH="claude/project-without-n8n-hgIsT"
INSTALL_DIR="$HOME/kyber-seo"

bold() { printf "\033[1m%s\033[0m\n" "$*"; }
step() { printf "\n\033[1;34m▶ %s\033[0m\n" "$*"; }

bold "═══════════════════════════════════════════"
bold " Кибер СЕО & GEO — автоустановка"
bold "═══════════════════════════════════════════"

# ─── 1. Базовые пакеты ───────────────────────────────────────────────
step "Проверяю git и curl..."
if ! command -v git >/dev/null 2>&1 || ! command -v curl >/dev/null 2>&1; then
  echo "Ставлю git/curl (нужны права sudo)..."
  sudo apt-get update -qq && sudo apt-get install -y -qq git curl
fi
echo "  ✅ git и curl на месте"

# ─── 2. Node.js 20+ ─────────────────────────────────────────────────
step "Проверяю Node.js..."
NEED_NODE=1
if command -v node >/dev/null 2>&1; then
  NODE_MAJOR=$(node -v | sed 's/v\([0-9]*\).*/\1/')
  if [ "$NODE_MAJOR" -ge 20 ]; then
    NEED_NODE=0
    echo "  ✅ Node.js $(node -v) подходит"
  fi
fi
if [ "$NEED_NODE" = "1" ]; then
  echo "Ставлю Node.js 20 (NodeSource, нужны права sudo)..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y -qq nodejs
  echo "  ✅ Установлен Node.js $(node -v)"
fi

# ─── 3. Скачиваю проект ──────────────────────────────────────────────
step "Скачиваю проект в $INSTALL_DIR..."
if [ -d "$INSTALL_DIR/.git" ]; then
  git -C "$INSTALL_DIR" fetch origin "$BRANCH" && git -C "$INSTALL_DIR" checkout "$BRANCH" && git -C "$INSTALL_DIR" pull origin "$BRANCH"
  echo "  ✅ Проект обновлён"
else
  git clone --branch "$BRANCH" --depth 1 "$REPO_URL" "$INSTALL_DIR"
  echo "  ✅ Проект скачан"
fi

cd "$INSTALL_DIR/automation"

# ─── 4. Зависимости ─────────────────────────────────────────────────
step "Ставлю зависимости (npm install)..."
npm install --no-audit --no-fund --loglevel=error
echo "  ✅ Зависимости установлены"

# ─── 5. Ключи → .env ─────────────────────────────────────────────────
if [ -f .env ]; then
  step ".env уже существует — оставляю как есть"
else
  step "Настройка ключей (вставляй и жми Enter)"
  echo ""
  echo "── WordPress (presswall-presswall.ru) ──"
  read -r -p "Логин админки WordPress: " WP_USER
  echo "Application Password (создаётся: Пользователи → профиль → Пароли приложений)"
  read -r -p "Application Password (формат: xxxx xxxx xxxx ...): " WP_PASS
  echo ""
  echo "── OpenRouter (openrouter.ai → Keys) ──"
  read -r -p "OpenRouter API ключ (sk-or-...): " OR_KEY
  echo ""
  echo "── Fal.ai для картинок — НЕОБЯЗАТЕЛЬНО (Enter чтобы пропустить) ──"
  read -r -p "Fal.ai ключ (или Enter): " FAL_KEY

  cat > .env <<ENVEOF
# Сгенерировано install.sh $(date +%Y-%m-%d)
WP_API_URL=https://presswall-presswall.ru/wp-json/wp/v2
WP_USERNAME=${WP_USER}
WP_APP_PASSWORD=${WP_PASS}

LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=${OR_KEY}
OPENROUTER_MODEL=anthropic/claude-3.5-sonnet
OPENROUTER_REFERER=https://presswall-presswall.ru
OPENROUTER_TITLE=PressWall SEO

FAL_AI_KEY=${FAL_KEY}
FAL_AI_MODEL=fal-ai/flux/schnell
FAL_AI_IMAGE_SIZE=landscape_16_9

PERPLEXITY_API_KEY=
SEMRUSH_API_KEY=

QUEUE_MODE=file
PUBLISH_STATUS=draft
POLL_INTERVAL_MINUTES=5

NEXT_PUBLIC_SITE_URL=https://presswall-presswall.ru
NEXTJS_REVALIDATE_SECRET=
DRY_RUN=false
ENVEOF
  chmod 600 .env
  echo "  ✅ .env создан (статьи будут уходить в ЧЕРНОВИКИ — безопасно)"
fi

# ─── 6. Проверка соединений ──────────────────────────────────────────
step "Проверяю WordPress и LLM-ключ..."
if npm run --silent check; then
  CHECK_OK=1
else
  CHECK_OK=0
fi

# ─── 7. Очередь и запуск ─────────────────────────────────────────────
mkdir -p queue
if [ ! -f queue/keywords.txt ]; then
  cat > queue/keywords.txt <<'QEOF'
# Очередь статей — одна тема на строку. Строки с # игнорируются.
# Раскомментируй пример или добавь свои темы:
# как выбрать пресс-волл для мероприятия
QEOF
  echo "  ✅ Создан файл очереди: queue/keywords.txt"
fi

bold ""
bold "═══════════════════════════════════════════"
if [ "$CHECK_OK" = "1" ]; then
  bold " ✅ ВСЁ ГОТОВО"
else
  bold " ⚠️ Установка завершена, но проверка ключей не прошла."
  bold "    Исправь .env (nano .env) и запусти: npm run check"
fi
bold "═══════════════════════════════════════════"
echo ""
echo "Дальше:"
echo "  1. Добавь темы:        nano $INSTALL_DIR/automation/queue/keywords.txt"
echo "  2. Разовый прогон:     cd $INSTALL_DIR/automation && npm run once"
echo "  3. Или постоянно:      npm start   (каждые 5 минут проверяет очередь)"
echo ""
echo "Статьи появятся в админке WordPress как ЧЕРНОВИКИ."
echo "Когда проверишь качество — поменяй PUBLISH_STATUS=publish в .env"
