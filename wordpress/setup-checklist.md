# WordPress: подключение автоматизации к presswall-presswall.ru

Цель: автоматизация публикует статьи **прямо в твой действующий WordPress**.

---

## Шаг 1. Включи Application Passwords (обычно уже включены)

WordPress 5.6+ имеет их по умолчанию. Проверь:

**Админка → Пользователи → твой профиль → Application Passwords (Пароли приложений)**

Если раздела нет — добавь в `functions.php` темы (см. `wordpress/functions.php`):

```php
add_filter('wp_is_application_passwords_available', '__return_true');
```

> Если сайт по HTTP (не HTTPS), Application Passwords отключены. Нужен SSL.

---

## Шаг 2. Создай Application Password

1. В том же разделе впиши имя: `SEO Automation`
2. Нажми **Add New Application Password**
3. Скопируй пароль вида `xxxx xxxx xxxx xxxx xxxx xxxx`
   (показывается один раз!)

---

## Шаг 3. Проверь, что REST API доступен

Открой в браузере:

```
https://presswall-presswall.ru/wp-json/wp/v2/posts?per_page=1
```

- ✅ Видишь JSON со статьёй → REST API работает
- ❌ 404 / пусто / редирект → REST API закрыт (плагин безопасности, .htaccess).
  Тогда разблокируй `/wp-json/` в настройках плагина безопасности.

Проверь, что можешь **создавать** посты (с твоими данными):

```bash
curl -X POST https://presswall-presswall.ru/wp-json/wp/v2/posts \
  -u "ТВОЙ_ЛОГИН:xxxx xxxx xxxx xxxx xxxx xxxx" \
  -H "Content-Type: application/json" \
  -d '{"title":"Тест API","content":"<p>Проверка</p>","status":"draft"}'
```

- ✅ Вернулся JSON с `"id"` и `"status":"draft"` → всё готово
- ❌ `401 Unauthorized` → проверь логин/пароль
- ❌ `403` → плагин безопасности блокирует REST или Application Passwords

После теста удали черновик в админке.

---

## Шаг 4. (Опционально) functions.php для Next.js-фронтенда

Нужно **только если** поднимаешь Next.js-витрину. Для публикации статей —
не требуется. Скопируй содержимое `wordpress/functions.php` в `functions.php`
своей темы (даёт `featured_image_url`, `reading_time`, CORS).

---

## Шаг 5. Заполни .env автоматизации

```bash
cd automation
cp .env.presswall.example .env
# впиши WP_APP_PASSWORD, WP_USERNAME, ключ LLM и данные Google Sheets
```

---

## Шаг 6. Запуск

```bash
# Сначала убедись что всё компилируется и логика цела:
npm run dry-run -- "тестовая тема"

# Потом боевой режим (статьи уходят в ЧЕРНОВИКИ — PUBLISH_STATUS=draft):
npm start
```

Добавь строку в лист **Queue** Google-таблицы со `Status=pending` —
через 5 минут черновик появится в админке presswall-presswall.ru.

Когда убедишься в качестве — поменяй `PUBLISH_STATUS=publish`.
