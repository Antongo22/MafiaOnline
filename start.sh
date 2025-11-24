#!/bin/bash

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🎮 Запуск игры в Мафию..."
echo ""

# Проверка Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker не установлен!${NC}"
    echo "Установите Docker с https://www.docker.com/get-started"
    exit 1
fi

# Проверка Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose не установлен!${NC}"
    echo "Установите Docker Compose с https://docs.docker.com/compose/install/"
    exit 1
fi

echo -e "${GREEN}✅ Docker и Docker Compose установлены${NC}"
echo ""

# Меню выбора режима
echo "Выберите режим запуска:"
echo "1) Production (оптимизированная сборка)"
echo "2) Development (с hot-reload для разработки)"
echo ""
read -p "Введите номер (1 или 2): " mode

case $mode in
    1)
        echo ""
        echo -e "${YELLOW}🔨 Собираем и запускаем в Production режиме...${NC}"
        docker-compose up --build -d
        
        echo ""
        echo -e "${GREEN}✅ Приложение запущено!${NC}"
        echo ""
        echo "🌐 Frontend: http://localhost:3000"
        echo "🔌 Backend API: http://localhost:5141"
        echo ""
        echo "Для просмотра логов: docker-compose logs -f"
        echo "Для остановки: docker-compose down"
        ;;
    2)
        echo ""
        echo -e "${YELLOW}🔨 Собираем и запускаем в Development режиме...${NC}"
        docker-compose -f docker-compose.dev.yml up --build
        ;;
    *)
        echo -e "${RED}❌ Неверный выбор!${NC}"
        exit 1
        ;;
esac

