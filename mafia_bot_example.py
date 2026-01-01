"""
Пример бота для управления игрой Мафия через API видеозвонков
Бот может управлять камерами и микрофонами игроков
"""

import requests
import time
from typing import List, Dict

class MafiaBot:
    def __init__(self, api_url: str = "https://calls.trexon.ru/api", api_key: str = "dev_key_12345"):
        self.api_url = api_url
        self.api_key = api_key
        self.headers = {
            "X-API-Key": api_key,
            "Content-Type": "application/json"
        }
        self.current_room = None
    
    def create_game(self, game_id: str) -> Dict:
        """Создать новую игру (комнату)"""
        print(f"🎮 Создание игры: {game_id}")
        
        response = requests.post(
            f"{self.api_url}/rooms",
            json={
                "name": game_id,
                "creator_name": "MafiaBot",  # Бот - создатель с правами управления
                "empty_timeout": 0,  # Комната не удаляется автоматически
                "max_participants": 0  # Без ограничений
            },
            headers=self.headers
        )
        
        if response.ok:
            self.current_room = game_id
            print(f"✅ Игра создана: {game_id}")
            return response.json()
        else:
            print(f"❌ Ошибка создания игры: {response.status_code}")
            return None
    
    def get_participants(self) -> List[Dict]:
        """Получить список участников в комнате"""
        if not self.current_room:
            print("❌ Нет активной игры")
            return []
        
        response = requests.get(
            f"{self.api_url}/participants/{self.current_room}",
            headers=self.headers
        )
        
        if response.ok:
            data = response.json()
            return data.get("participants", [])
        else:
            print(f"❌ Ошибка получения участников: {response.status_code}")
            return []
    
    def mute_audio(self, player_name: str, muted: bool = True):
        """Выключить/включить микрофон игрока"""
        if not self.current_room:
            print("❌ Нет активной игры")
            return False
        
        action = "Выключаю" if muted else "Включаю"
        print(f"🔇 {action} микрофон у {player_name}")
        
        response = requests.post(
            f"{self.api_url}/participants/{self.current_room}/mute-audio",
            json={
                "participant_identity": player_name,
                "muted": muted
            },
            headers=self.headers
        )
        
        if response.ok:
            print(f"✅ {player_name}: микрофон {'выключен' if muted else 'включен'}")
            return True
        else:
            print(f"❌ Ошибка: {response.status_code} - {response.text}")
            return False
    
    def mute_video(self, player_name: str, muted: bool = True):
        """Выключить/включить камеру игрока"""
        if not self.current_room:
            print("❌ Нет активной игры")
            return False
        
        action = "Выключаю" if muted else "Включаю"
        print(f"📹 {action} камеру у {player_name}")
        
        response = requests.post(
            f"{self.api_url}/participants/{self.current_room}/mute-video",
            json={
                "participant_identity": player_name,
                "muted": muted
            },
            headers=self.headers
        )
        
        if response.ok:
            print(f"✅ {player_name}: камера {'выключена' if muted else 'включена'}")
            return True
        else:
            print(f"❌ Ошибка: {response.status_code} - {response.text}")
            return False
    
    def mute_player(self, player_name: str, mute_audio: bool = True, mute_video: bool = False):
        """Заглушить микрофон или камеру игрока (старый метод для совместимости)"""
        success = True
        if mute_audio:
            success = success and self.mute_audio(player_name, True)
        if mute_video:
            success = success and self.mute_video(player_name, True)
        return success
    
    def unmute_audio(self, player_name: str):
        """Включить микрофон игрока"""
        if not self.current_room:
            print("❌ Нет активной игры")
            return False
        
        print(f"🔊 Включаю микрофон у {player_name}")
        
        response = requests.post(
            f"{self.api_url}/participants/{self.current_room}/unmute-audio",
            json={
                "participant_identity": player_name
            },
            headers=self.headers
        )
        
        if response.ok:
            print(f"✅ {player_name}: микрофон включен")
            return True
        else:
            print(f"❌ Ошибка: {response.status_code} - {response.text}")
            return False
    
    def unmute_video(self, player_name: str):
        """Включить камеру игрока"""
        if not self.current_room:
            print("❌ Нет активной игры")
            return False
        
        print(f"📹 Включаю камеру у {player_name}")
        
        response = requests.post(
            f"{self.api_url}/participants/{self.current_room}/unmute-video",
            json={
                "participant_identity": player_name
            },
            headers=self.headers
        )
        
        if response.ok:
            print(f"✅ {player_name}: камера включена")
            return True
        else:
            print(f"❌ Ошибка: {response.status_code} - {response.text}")
            return False
    
    def unmute_player(self, player_name: str):
        """Включить микрофон и камеру игрока"""
        success = True
        success = success and self.unmute_audio(player_name)
        success = success and self.unmute_video(player_name)
        return success
    
    def kick_player(self, player_name: str):
        """Выгнать игрока из комнаты"""
        if not self.current_room:
            print("❌ Нет активной игры")
            return False
        
        print(f"👋 Выгоняю {player_name} из игры")
        
        response = requests.post(
            f"{self.api_url}/participants/{self.current_room}/kick",
            json={
                "participant_identity": player_name
            },
            headers=self.headers
        )
        
        if response.ok:
            print(f"✅ {player_name} выгнан из игры")
            return True
        else:
            print(f"❌ Ошибка: {response.status_code}")
            return False
    
    def night_phase(self):
        """Ночная фаза - выключить всем камеры и микрофоны"""
        print("\n🌙 === НОЧЬ === 🌙")
        print("Все засыпают...")
        
        participants = self.get_participants()
        for participant in participants:
            name = participant.get("identity")
            if name and name != "MafiaBot":
                self.mute_player(name, mute_audio=True, mute_video=True)
        
        print("💤 Все спят\n")
    
    def day_phase(self):
        """Дневная фаза - разрешить всем включить камеры и микрофоны"""
        print("\n☀️ === ДЕНЬ === ☀️")
        print("Все просыпаются и могут обсуждать...")
        
        # Примечание: нельзя принудительно включить камеры
        # Игроки должны сами включить их в интерфейсе
        print("📢 Игроки могут включить камеры и микрофоны\n")
    
    def mafia_phase(self, mafia_players: List[str]):
        """Фаза мафии - разрешить мафии общаться"""
        print("\n🔪 === МАФИЯ СОВЕЩАЕТСЯ === 🔪")
        
        participants = self.get_participants()
        for participant in participants:
            name = participant.get("identity")
            if name and name != "MafiaBot":
                if name in mafia_players:
                    # Мафия может говорить
                    print(f"🔊 {name} (мафия) может говорить")
                else:
                    # Остальные молчат
                    self.mute_player(name, mute_audio=True, mute_video=True)
        
        print("🤫 Мирные жители спят\n")
    
    def voting_phase(self):
        """Фаза голосования - все могут говорить"""
        print("\n🗳️ === ГОЛОСОВАНИЕ === 🗳️")
        print("Все могут высказаться перед голосованием\n")
    
    def create_invite_link(self, player_name: str = None) -> str:
        """Создать ссылку-приглашение в комнату"""
        if not self.current_room:
            print("❌ Нет активной игры")
            return None
        
        print(f"🔗 Создание ссылки-приглашения для {player_name or 'гостя'}")
        
        response = requests.post(
            f"{self.api_url}/invites/create",
            json={
                "room_name": self.current_room,
                "participant_name": player_name,
                "can_publish": True,
                "can_subscribe": True,
                "can_publish_data": True
            },
            headers=self.headers
        )
        
        if response.ok:
            data = response.json()
            invite_url = data.get("invite_url")
            print(f"✅ Ссылка создана: {invite_url}")
            return invite_url
        else:
            print(f"❌ Ошибка создания ссылки: {response.status_code}")
            return None
    
    def delete_game(self):
        """Удалить игру"""
        if not self.current_room:
            print("❌ Нет активной игры")
            return False
        
        print(f"🗑️ Удаление игры: {self.current_room}")
        
        response = requests.delete(
            f"{self.api_url}/rooms/{self.current_room}",
            headers=self.headers
        )
        
        if response.ok:
            print(f"✅ Игра {self.current_room} удалена")
            self.current_room = None
            return True
        else:
            print(f"❌ Ошибка удаления: {response.status_code}")
            return False


# Пример использования
if __name__ == "__main__":
    # Создать бота
    bot = MafiaBot()
    
    # Создать игру
    game_id = "mafia-game-001"
    bot.create_game(game_id)
    
    # Создать ссылки-приглашения для игроков
    print("\n🔗 Создание ссылок-приглашений:")
    invite1 = bot.create_invite_link("Player1")
    invite2 = bot.create_invite_link("Player2")
    invite3 = bot.create_invite_link("Player3")
    
    print("\n📧 Отправьте эти ссылки игрокам:")
    print(f"Player1: {invite1}")
    print(f"Player2: {invite2}")
    print(f"Player3: {invite3}")
    
    print("\n⏳ Ожидание подключения игроков...")
    print("Игроки могут просто перейти по своим ссылкам\n")
    
    # Подождать пока игроки подключатся
    time.sleep(5)
    
    # Получить список игроков
    participants = bot.get_participants()
    print(f"\n👥 Подключено игроков: {len(participants)}")
    for p in participants:
        print(f"  - {p.get('identity')}")
    
    # Симуляция игры
    print("\n" + "="*50)
    print("🎮 НАЧАЛО ИГРЫ")
    print("="*50)
    
    # Ночь - все молчат и выключают камеры
    time.sleep(2)
    bot.night_phase()
    
    # Пример: выключить только звук у всех
    print("\n🔇 Выключаю звук у всех игроков...")
    for p in participants:
        name = p.get('identity')
        if name and name != "MafiaBot":
            bot.mute_audio(name, muted=True)
    
    # Мафия совещается (пример)
    time.sleep(5)
    mafia_players = ["Player1", "Player2"]  # Замените на реальных игроков-мафию
    
    # Включить звук только у мафии
    print("\n🔊 Включаю звук у мафии...")
    for player in mafia_players:
        bot.mute_audio(player, muted=False)
    
    bot.mafia_phase(mafia_players)
    
    # День - все могут говорить
    time.sleep(5)
    bot.day_phase()
    
    # Голосование
    time.sleep(10)
    bot.voting_phase()
    
    # Пример: выгнать игрока (если проголосовали)
    # bot.kick_player("Player3")
    
    # Конец игры
    print("\n" + "="*50)
    print("🏁 ИГРА ЗАВЕРШЕНА")
    print("="*50)
    
    # Удалить игру
    time.sleep(2)
    bot.delete_game()
