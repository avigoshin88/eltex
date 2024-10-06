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
      api_url="https://evi-webrtc.eltex-co.ru:18083"
      app="live"
      stream="test"
      ice_servers="stun:evi-webrtc.eltex-co.ru:3478;stun:10.23.18.4:3478;stun:192.168.0.105:3478"
    ></video-player>
  </body>
</html>
```

**Закрывающий тэг обязателен**

**Неправильно**
```
<video-player/>
```
**Правильно**
```
<video-player></video-player>
```

При одиночном тэге наблюдается ошибка:

Вместо

```
<video-player/>
<video-player/>
```

**получается**

```
<video-player>
  <video-player/>
</video-player>
```

Пример с множеством плееров:
```
<video-player
  api_url="https://evi-webrtc.eltex-co.ru:18083"
  app="live"
  stream="test"
  ice_servers="stun:evi-webrtc.eltex-co.ru:3478;stun:10.23.18.4:3478;stun:192.168.0.105:3478"
></video-player>

<video-player
  api_url="https://evi-webrtc.eltex-co.ru:18083"
  app="live"
  stream="test"
  ice_servers="stun:evi-webrtc.eltex-co.ru:3478;stun:10.23.18.4:3478;stun:192.168.0.105:3478"
></video-player>
```


## Стилизация

Основная стилизация элементов доступна через css классы:


* ```.video-player```
* ```.video-player__container```
* ```.video-player__controls__container```
* ```.video-player__controls__button```
* ```.video-player__timeline```
* ```.video-player__timeline__range```
* ```.video-player__timeline__range[data-type="data"]```
* ```.video-player__timeline__range[data-type="break"]```
* ```.video-player__timeline__period```
* ```.video-player__timeline__period_with_text```
* ```.video-player__timeline__period__text```
* ```.video-player__timeline__track```
* ```.video-player__timeline__export-marker```
* ```.video-player__timeline__export-marker_start```
* ```.video-player__timeline__export-marker_end```

Изменение статик файлов (пока только иконки) доступно через замену соответствующих файлов в папке ```./public```

## Логирование

Доступно 3 уровня логирования

1. info - ошибки
2. debug – ошибки и предупреждения
3. trace – ошибки, предупреждения и логи

уровень логирования можно поменять в `env`, на сборку это не влияет (в production всегда info)

```
...
VITE_LOGGER_LEVEL=trace
...
```