# Legal Telegram Digest

Юридический Telegram reader/digest на базе fork-подхода от `transfer-channel-rss`, адаптированный под **несколько публичных юрканалов** и legal-first ранжирование.

## Что делает

- парсит **публичные** Telegram-каналы через `https://t.me/s/<channel>`;
- не требует Telegram API и MTProto;
- собирает посты из нескольких каналов в локальный JSON-кэш;
- присваивает legal topics (`bankruptcy`, `arbitration`, `tax`, `courts`, `enforcement`, `compliance`, `ai_law`);
- сохраняет просмотры постов из Telegram Web Preview, если счётчик реально присутствует в HTML;
- считает вторичные сигналы ранжирования: реакции, охват, вовлечённость `reactions/views`;
- строит дайджесты `today` / `yesterday` / `week`;
- показывает web reader, hot posts, compare, stats и JSON digest endpoints.

## Основа

Проект основан на `transfer-channel-rss` (AGPL-3.0).
Дополнительные идеи по multi-channel digest взяты из `polyakov-claude-skills/plugins/telegram-channel-parser`.

Если проект будет публиковаться как derivative work, нужно соблюдать условия лицензии AGPL-3.0 и сохранять attribution upstream.

## Текущий статус

Рабочий fork-based v1 готов.
Проверено локально:

```bash
pnpm install
pnpm run fetch
pnpm run build
```

Последний validation run прошёл успешно на локальной сборке.

## Структура данных

- `data/channels.json` — site + категории + список каналов
- `data/posts.json` — нормализованные посты
- `data/new-posts.json` — новые посты последнего fetch
- `data/digests/*.json` — готовые digest snapshots

### Ограничение по Telegram-счётчикам

- просмотры постов сохраняются только когда Telegram Web Preview отдаёт `.tgme_widget_message_views`;
- если счётчика просмотров нет в HTML, проект не подставляет оценки и использует безопасный fallback только по реакциям;
- счётчик подписчиков пока не используется в аналитике: в web preview он оформлен как UI-метка и может отличаться по локали и типу страницы.

## Быстрый старт

```bash
cd /root/projects/legal-telegram-digest
cp .env.example .env
pnpm install
pnpm run fetch
pnpm run build
pnpm run preview
```

## Конфиг каналов

Основной конфиг: `data/channels.json`

Там можно:

- включать/выключать каналы через `enabled`
- задавать `category`, `group`, `topics`
- повышать вес канала через `priorityBoost`

Пример канала:

```json
{
  "channel": "pravoinf",
  "title": "Правовая информация",
  "category": "courts",
  "group": "public_sources",
  "topics": ["courts", "enforcement"],
  "priorityBoost": 2
}
```

## Маршруты интерфейса

- `/` — главная reader-страница
- `/digests/` — карточки дайджестов
- `/digests/today.json` — JSON дайджест за сегодня
- `/digests/week.json` — JSON дайджест за неделю
- `/hot/` — горячие посты
- `/compare/` — сравнение каналов
- `/stats/` — coverage statistics
- `/lite/` — компактный режим чтения

## Что осталось под пользователя

1. Подставить **список твоих юридических каналов** в `data/channels.json`
2. При необходимости поправить legal topic heuristics
3. Настроить deploy (GitHub Pages / SourceCraft)
4. Добавить бренд/домен/визуальные мелочи

## Практический workflow

```bash
# обновить кэш каналов
pnpm run fetch

# пересобрать reader
pnpm run build

# локально посмотреть
pnpm run preview
```

## Примечание

Текущий проект — pragmatic v1: сначала рабочий legal reader, потом тонкая доводка под конкретный список каналов Юрия.
