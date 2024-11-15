# WebRTC Плеер

## Установка зависимостей

`yarn install`

## Команды

- Запуск в режиме разработки – 
  `yarn dev`
- Сборка для production –
  `yarn build`

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
      id="1"
      mode="live"
      camera_name="camera_name"
      ice_servers="stun:evi-webrtc.eltex-co.ru:3478"
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
  id="1"
  mode="live"
  camera_name="camera_name1"
  ice_servers="stun:evi-webrtc.eltex-co.ru:3478"
></video-player>
...
<video-player
  id="16"
  mode="live"
  camera_name="camera_name16"
  ice_servers="stun:evi-webrtc.eltex-co.ru:3478"
></video-player>
```

Для запуска плеера требуется произвести обмен sdp offers.
Подробный пример можно найти в `index.html`.

Список доступных событий:

Принимающие:

- `meta` – передает meta, каждый раз когда она обновляется
- `mode-changed` – режим изменен – вернет новый режим
- `local-description` – принимает сгенерированный внутри плеера local sdp offer/answer
- `ice-candidate` – принимает ice candidate
- `peerconnection-status"` – принимает статусы peerconnection

Отправляющие:

- `reinit-connection` – инициализация нового подключения после первого запуска (например при переключении со STUN на TURN)
- `request-local-description` – запрос локального офера (для TURN)
- `remote-description"` – отправка remote sdp offer, сгенерированного уровнем выше

**Все события формируются следующим видом**: `<event-name>-<id>`

Если вы указали атрибут id = 1, то события будут ```<event-name>-1``` или например ```meta-1```.

Атрибут ```id`` – должен быть уникальным!

## Стилизация

Основная стилизация элементов доступна через css классы:

- `.video-player`
- `.video-player__container`
- `.video-player__video-element`
- `.video-player__placeholder-container`
- `.video-player__placeholder-text`
- `.video-player__controls__container`
- `.video-player__controls__button`
- `.video-player__timeline`
- `.video-player__timeline__range`
- `.video-player__timeline__range[data-type="data"]`
- `.video-player__timeline__range[data-type="break"]`
- `.video-player__timeline__period`
- `.video-player__timeline__period_with_text`
- `.video-player__timeline__period__text`
- `.video-player__timeline__track`
- `.video-player__timeline__export-marker`
- `.video-player__timeline__export-marker_start`
- `.video-player__timeline__export-marker_end`

Изменение статик файлов (пока только иконки) доступно через замену соответствующих файлов в папке `./public`

## Логгирование

У элемента есть опциональный атрибут `log_level`, отвечающий за уровень логирования. Возможные варианты:
- info
- debug
- trace
По умолчанию используется `info`, значение можно менять "на ходу"