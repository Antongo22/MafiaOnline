.PHONY: help build up down restart logs clean dev-up dev-down dev-logs

help: ## Показать это сообщение помощи
	@echo "Доступные команды:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

build: ## Собрать Docker образы (production)
	docker-compose build

up: ## Запустить все сервисы (production)
	docker-compose up -d

down: ## Остановить все сервисы
	docker-compose down

restart: ## Перезапустить все сервисы (production)
	docker-compose restart

logs: ## Показать логи всех сервисов
	docker-compose logs -f

clean: ## Удалить все контейнеры, образы и volumes
	docker-compose down -v
	docker system prune -af

dev-build: ## Собрать Docker образы (development)
	docker-compose -f docker-compose.dev.yml build

dev-up: ## Запустить все сервисы (development с hot-reload)
	docker-compose -f docker-compose.dev.yml up

dev-down: ## Остановить dev сервисы
	docker-compose -f docker-compose.dev.yml down

dev-logs: ## Показать логи dev сервисов
	docker-compose -f docker-compose.dev.yml logs -f

dev-restart: ## Перезапустить dev сервисы
	docker-compose -f docker-compose.dev.yml restart

backend-logs: ## Показать логи backend
	docker-compose logs -f backend

frontend-logs: ## Показать логи frontend
	docker-compose logs -f frontend

ps: ## Показать статус контейнеров
	docker-compose ps

rebuild: down build up ## Пересобрать и перезапустить (production)

dev-rebuild: dev-down dev-build dev-up ## Пересобрать и перезапустить (development)

