# Setup Guide

## Быстрый старт (5 минут)

### 1. Клонирование

```bash
# Форкни репо на GitHub, затем:
git clone https://github.com/YOUR_USER/legal-telegram-digest.git
cd legal-telegram-digest
pnpm install
```

### 2. Настрой каналы

Отредактируй `data/channels.json`:

```json
{
  "site": {
    "title": "Юридический Telegram-дайджест",
    "description": "Описание сайта"
  },
  "categories": [],
  "channels": [
    {
      "channel": "your_channel",
      "title": "Your Channel",
      "category": "bankruptcy",
      "topics": ["bankruptcy", "courts"],
      "priorityBoost": 1.5,
      "enabled": true
    }
  ]
}
```

### 3. Первый fetch

```bash
pnpm run fetch
```

Проверь `data/posts.json` — должны появиться посты.

### 4. Локальный просмотр

```bash
pnpm run dev
pnpm run build
pnpm run preview
```

Открой локальный Astro dev server. Base path по умолчанию: `/legal-telegram-digest/`.

### 5. Деплой

Пуш в `main` — GitHub Pages задеплоится автоматически.

## Настройка GitHub

1. Сделай репо **публичным** (нужен для GitHub Pages)
2. `Settings → Pages → Source: GitHub Actions`
3. `Settings → Secrets → Actions`:

| Secret    | Обязательный | Описание                                            |
| --------- | ------------ | --------------------------------------------------- |
| `CHANNEL` | Нет          | Fallback username для legacy single-channel запуска |

Через 15 минут cron-джоба подхватит и обновит сайт.

## Настройка SourceCraft (опционально)

Зеркало на Яндекс-инфре. Если GitHub заблокируют — сайт останется доступным.

1. Зарегистрируйся на [sourcecraft.dev](https://sourcecraft.dev)
2. Создай **публичную организацию**
3. Создай **публичный репо** `transfer-channel-rss` в организации
4. Получи персональный токен (Settings → Tokens) со скоупом `repo:write`
5. Добавь GitHub Secrets:

| Secret              | Описание                                          |
| ------------------- | ------------------------------------------------- |
| `SOURCECRAFT_TOKEN` | Персональный токен                                |
| `SOURCECRAFT_REPO`  | `org/repo` (например `ndts/transfer-channel-rss`) |

URL зеркала: `https://<org>.sourcecraft.site/<repo>`

## Добавление каналов

1. Открой `data/channels.json`
2. Добавь объект канала в массив `channels`
3. Канал должен быть **публичным** и без "Restrict Saving Content"
4. Проверь доступность: `https://t.me/s/channel_name`
5. Запусти `pnpm run fetch` или подожди cron

## Кастомизация

### Base path

По умолчанию сайт на `/legal-telegram-digest/`. Изменить:

```bash
# astro.config.mjs
base: env.BASE_PATH || '/my-digest/',
```

### Количество постов на fetch

```bash
MAX_PAGES=10 pnpm run fetch  # 10 страниц истории (~150 постов/канал)
```

### Локальные команды

```bash
pnpm run fetch     # обновить data/posts.json и digest snapshots
pnpm run dev       # локальная разработка
pnpm run build     # статическая сборка
pnpm run preview   # просмотр собранного dist
pnpm run lint      # eslint
```

### Темы

Тёмная тема включается кнопкой 🌙 в шапке. CSS-переменные в `src/styles/app.css` секция `html[data-theme='dark']`.
