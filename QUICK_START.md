# Быстрый старт 🚀

## Для новичков

Самый простой способ запустить проект:

```bash
./start.sh
```

Скрипт проверит зависимости и предложит выбрать режим запуска.

## Для опытных пользователей

### Production режим
```bash
docker-compose up -d --build
```
- Frontend: http://localhost:3000
- Backend: http://localhost:5141

### Development режим (hot-reload)
```bash
docker-compose -f docker-compose.dev.yml up --build
```
- Frontend: http://localhost:5173
- Backend: http://localhost:5141

## Остановка

```bash
docker-compose down
```

## Полезные команды

```bash
# Логи
docker-compose logs -f

# Статус контейнеров
docker-compose ps

# Пересборка
docker-compose up --build --force-recreate
```

## Проблемы?

1. Проверьте, что Docker запущен
2. Проверьте, что порты 3000/5173 и 5141 свободны
3. Посмотрите логи: `docker-compose logs`
4. Полная документация: [DOCKER_SETUP.md](DOCKER_SETUP.md)

## Первый запуск

1. Откройте http://localhost:3000 (или :5173 для dev)
2. Введите свое имя
3. Создайте комнату
4. Поделитесь кодом приглашения с друзьями
5. Общайтесь в чате!

---

📖 [Полная документация](README.md) | 🐳 [Docker подробности](DOCKER_SETUP.md)

