# WebRTC Плеер

## Установка зависимостей

```yarn install```

## Команды

- Запуск в режиме разработки – 
  ```yarn dev```
- Сборка для production –
  ```yarn build```

## Интеграция

Собранный скрипт плеера подключить в html код доступным способом, плеер станет доступен после загрузки и исполнения скрипта.

После чего отрисовать плеер.

**Пример:**

```
<html lang="en">
  <head>
    ...
    <script src="./dist/video-player.js"></script>
  </head>

  <body>
    ...
    <video-player
      apiUrl="https://evi-webrtc.eltex-co.ru:18083"
      app="live"
      stream="test"
      iceServers="stun:evi-webrtc.eltex-co.ru:3478;stun:10.23.18.4:3478;stun:192.168.0.105:3478"
    />
  </body>
</html>
```

## Стилизация

Основная стилизация элементов доступна через css классы:

* ```.video-player-timeline```
* ```.video-player-timeline-range```

Изменение статик файлов (пока только иконки) доступно через замену соответствующих файлов в папке ```./public```