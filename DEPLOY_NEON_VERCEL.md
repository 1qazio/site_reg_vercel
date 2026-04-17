# Neon + Vercel: полная инструкция

Этот проект настроен так:

- фронтенд: статические файлы `index.html`, `script.js`, `style.css`
- бэкенд: Django API
- база данных: Neon Postgres
- хостинг: Vercel

Сайт после деплоя будет работать по одной ссылке Vercel и открываться на телефоне, ноутбуке и других устройствах. Все устройства будут видеть одни и те же бронирования, потому что данные хранятся в общей облачной базе Neon.

## 1. Что уже сделано в проекте

В проекте уже подготовлены:

- `api/index.py` — вход для Vercel Python Function
- `booking_api/` — Django API для бронирований
- `studio_backend/settings.py` — настройки Django
- `vercel.json` — маршрутизация Vercel
- `db-schema.sql` — схема базы данных для Neon
- `.env.example` — пример переменных окружения
- `requirements.txt` — зависимости Python

## 2. Создать базу в Neon

1. Зайди на сайт Neon: `https://console.neon.tech/`
2. Создай аккаунт или войди.
3. Нажми `Create project`.
4. Укажи имя проекта.
5. Выбери регион.
Лучше выбрать регион ближе к пользователям или к Vercel-региону.
6. Дождись создания проекта.

После создания Neon покажет строку подключения к базе.

Она будет похожа на такую:

```text
postgresql://neondb_owner:password@ep-something.eu-central-1.aws.neon.tech/neondb?sslmode=require
```

Сохрани эту строку. Она понадобится для Vercel.

## 3. Создать таблицы в Neon

1. Внутри проекта Neon открой SQL Editor.
2. Открой локально файл `db-schema.sql`.
3. Скопируй весь SQL из этого файла.
4. Вставь его в SQL Editor.
5. Нажми `Run`.

После этого в базе будут созданы:

- таблица `users`
- таблица `bookings`
- индексы
- ограничения на время
- защита от пересекающихся броней

## 4. Проверить локально перед Vercel

В PowerShell открой папку проекта:

```powershell
cd c:\Users\1qazw\Desktop\studi
```

Создай виртуальное окружение:

```powershell
python -m venv .venv
```

Активируй его:

```powershell
.venv\Scripts\activate
```

Установи зависимости:

```powershell
pip install -r requirements.txt
```

Создай файл `.env` рядом с `manage.py` и вставь:

```env
DJANGO_SECRET_KEY=change-this-secret-key
DJANGO_DEBUG=1
ALLOWED_HOSTS=127.0.0.1,localhost
TIME_ZONE=Europe/Moscow
DATABASE_URL=postgresql://neondb_owner:password@ep-something.aws.neon.tech/neondb?sslmode=require
```

Запусти локальный сервер:

```powershell
python manage.py runserver
```

Открой в браузере:

```text
http://127.0.0.1:8000/index.html
```

Проверь:

- страница открывается
- можно ввести имя
- можно создать бронь
- можно удалить бронь

## 5. Загрузить проект в GitHub

Если проект еще не загружен в GitHub:

1. Создай новый репозиторий на GitHub.
2. В PowerShell выполни:

```powershell
cd c:\Users\1qazw\Desktop\studi
git init
git add .
git commit -m "Neon and Vercel setup"
git branch -M main
git remote add origin https://github.com/USERNAME/REPOSITORY.git
git push -u origin main
```

Важно:

- файл `.env` не должен попадать в GitHub
- для этого в проект уже добавлен `.gitignore`

## 6. Подключить проект к Vercel

1. Зайди на `https://vercel.com/`
2. Войди в аккаунт.
3. Нажми `Add New`
4. Выбери `Project`
5. Подключи GitHub, если Vercel попросит доступ.
6. Выбери свой репозиторий.
7. Нажми `Import`

Vercel увидит `vercel.json` и будет использовать его маршрутизацию:

- запросы `/api/...` пойдут в `api/index.py`
- статические файлы будут отдаваться напрямую
- остальные пути будут открывать `index.html`

## 7. Добавить переменные окружения в Vercel

Перед первым деплоем в настройках проекта Vercel добавь:

### `DJANGO_SECRET_KEY`

Любая длинная случайная строка.

Пример:

```text
my-super-secret-key-123456789
```

### `DJANGO_DEBUG`

```text
0
```

### `TIME_ZONE`

```text
Europe/Moscow
```

### `ALLOWED_HOSTS`

Для первого деплоя достаточно:

```text
.vercel.app
```

Если потом подключишь свой домен, можно так:

```text
.vercel.app,mydomain.com,www.mydomain.com
```

### `DATABASE_URL`

Сюда вставь строку подключения из Neon.

Пример:

```text
postgresql://neondb_owner:password@ep-something.eu-central-1.aws.neon.tech/neondb?sslmode=require
```

## 8. Запустить деплой

После добавления переменных:

1. Нажми `Deploy`
2. Дождись окончания сборки
3. Открой выданный адрес вида:

```text
https://your-project.vercel.app
```

## 9. Проверить после деплоя

После первого деплоя обязательно проверь:

1. Открывается ли главная страница
2. Работает ли ввод имени
3. Создается ли бронь
4. Удаляется ли бронь
5. Сохраняются ли данные после перезагрузки страницы
6. Видны ли те же данные на другом устройстве

Для проверки на другом устройстве:

1. Возьми ссылку Vercel
2. Открой ее на телефоне или другом компьютере
3. Убедись, что брони те же самые

## 10. Как обновлять сайт после изменений

Когда внесешь изменения в код:

```powershell
git add .
git commit -m "update"
git push
```

Vercel автоматически запустит новый деплой.

## 11. Если что-то не работает

### Страница открывается, но сервер недоступен

Проверь:

- создана ли база в Neon
- выполнен ли SQL из `db-schema.sql`
- правильно ли указан `DATABASE_URL`
- есть ли `.vercel.app` в `ALLOWED_HOSTS`

### Ошибка 500

Проверь:

- не сломан ли `DATABASE_URL`
- есть ли `sslmode=require`
- все ли env-переменные добавлены в Vercel

### Имя не сохраняется или бронь не создается

Проверь:

- таблицы точно созданы в Neon
- деплой действительно новый
- в Vercel нет ошибки выполнения функции

## 12. Где смотреть ошибки в Vercel

1. Открой проект в Vercel
2. Перейди в `Deployments`
3. Открой последний deployment
4. Посмотри `Build Logs`
5. Потом открой вкладку `Functions`
6. Найди ошибки API-запросов

## 13. Самое важное

Чтобы сайт точно заработал, должны быть выполнены все 5 условий:

1. В Neon создан проект
2. В Neon выполнен SQL из `db-schema.sql`
3. В Vercel добавлен правильный `DATABASE_URL`
4. В Vercel добавлен `ALLOWED_HOSTS=.vercel.app`
5. Проект задеплоен из актуального кода
