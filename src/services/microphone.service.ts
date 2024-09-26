import { Logger } from "./logger/logger.service";

export class MicrophoneService {
  private logger = new Logger(MicrophoneService.name);
  private localStream: MediaStream | null = null;
  private audioTransceiver: RTCRtpTransceiver | null = null;
  private isMicEnabled: boolean = false;
  private hasAccessToMic: boolean = false;
  private currentDeviceId: string | null = null;
  private isMicOn = false;
  private isPushToTalk = false;
  private pressTimer: number | null = null;
  private PRESS_THRESHOLD = 500; // Время в мс для определения "долгого нажатия"

  constructor() {}

  // Запрашиваем доступ к микрофону с заданным устройством
  public async enableMicrophone(
    peerConnection: RTCPeerConnection,
    deviceId: string | null = null
  ): Promise<void> {
    try {
      // Запрашиваем доступ к микрофону с определенным устройством
      const constraints: MediaStreamConstraints = {
        audio: deviceId ? { deviceId: { exact: deviceId } } : true,
      };

      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      this.currentDeviceId = deviceId || (await this.getDefaultDeviceId());

      const audioTrack = this.localStream.getAudioTracks()[0];
      audioTrack.enabled = true;

      if (this.audioTransceiver) {
        this.audioTransceiver.sender.replaceTrack(audioTrack);
        this.audioTransceiver.direction = "sendrecv"; // Включаем отправку и прием
      } else {
        // Если трансивер еще не существует, создаем его
        this.audioTransceiver = peerConnection.addTransceiver("audio", {
          direction: "sendrecv",
        });

        const addTrack = () => {
          if (peerConnection.signalingState === "stable") {
            peerConnection.addTrack(audioTrack);
            peerConnection.removeEventListener(
              "connectionstatechange",
              addTrack
            );
          }
        };

        peerConnection.addEventListener("connectionstatechange", addTrack);
      }

      this.hasAccessToMic = true;
    } catch (error) {
      this.logger.error("Не удалось получить доступ к микрофону:", error);

      // Переключаем трансивер на только прием, если не удалось получить микрофон
      if (this.audioTransceiver) {
        this.audioTransceiver.direction = "recvonly"; // Только прием аудио
      } else {
        // Если трансивер еще не создан, создаем его для приема
        this.audioTransceiver = peerConnection.addTransceiver("audio", {
          direction: "recvonly",
        });
      }

      this.close();
    }

    this.listenForDeviceChanges(peerConnection); // Слушаем изменения устройств
  }

  // Отключение микрофона (мьют)
  public muteMicrophone(): void {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = false; // Отключаем трек
      });

      if (this.audioTransceiver) {
        this.audioTransceiver.direction = "recvonly"; // Оставляем только прием
      }

      this.isMicEnabled = false;
    }
  }

  // Включение микрофона (анмьют)
  public unmuteMicrophone(): void {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = true; // Включаем трек
      });

      if (this.audioTransceiver) {
        this.audioTransceiver.direction = "sendrecv"; // Включаем отправку и прием
      }

      this.isMicEnabled = true;
    }
  }

  // Новый метод для работы микрофона по принципу "рации"
  public pushToTalk(isPressed: boolean): void {
    if (isPressed) {
      this.unmuteMicrophone(); // Включаем микрофон при нажатии
    } else {
      this.muteMicrophone(); // Отключаем микрофон при отпускании
    }
  }

  // Обработка изменения доступных устройств (например, подключение нового микрофона)
  private listenForDeviceChanges(peerConnection: RTCPeerConnection): void {
    const onDeviceChange = async () => {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioDevices = devices.filter(
        (device) => device.kind === "audioinput"
      );

      this.logger.log("Устройства ввода аудио изменены:", audioDevices);

      // Находим новое устройство, которое отличается от текущего
      const newDevice = audioDevices.find(
        (device) => device.deviceId !== this.currentDeviceId
      );

      if (newDevice) {
        this.logger.log("Переключаемся на новое устройство:", newDevice.label);
        await this.enableMicrophone(peerConnection, newDevice.deviceId); // Переключаемся на новое устройство
      }

      navigator.mediaDevices.removeEventListener(
        "devicechange",
        onDeviceChange
      );
    };

    navigator.mediaDevices.addEventListener("devicechange", onDeviceChange);
  }

  // Получение устройства по умолчанию
  private async getDefaultDeviceId(): Promise<string | null> {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioDevices = devices.filter(
      (device) => device.kind === "audioinput"
    );
    return audioDevices.length > 0 ? audioDevices[0].deviceId : null;
  }

  // Проверка, включен ли микрофон
  public get isMicrophoneEnabled(): boolean {
    return this.isMicEnabled;
  }

  // Есть ли доступ к микрофону
  public get hasAccessToMicrophone(): boolean {
    return this.hasAccessToMic;
  }

  // Работа только на прием аудио
  public async receiveOnlyAudio(
    peerConnection: RTCPeerConnection
  ): Promise<void> {
    if (!this.audioTransceiver) {
      this.audioTransceiver = peerConnection.addTransceiver("audio", {
        direction: "recvonly",
      });
    } else {
      this.audioTransceiver.direction = "recvonly";
    }
    this.isMicEnabled = false;
  }

  // Функция для переключения состояния микрофона (короткое нажатие)
  public toggleMic() {
    if (this.isMicOn) {
      this.muteMicrophone();
      this.isMicOn = false;
      this.logger.log("Микрофон выключен");
    } else {
      this.unmuteMicrophone();
      this.isMicOn = true;
      this.logger.log("Микрофон включен");
    }
  }

  // Функции для режима рации
  public startPushToTalk() {
    this.isPushToTalk = true;
    this.pushToTalk(true); // Включаем микрофон
    this.logger.log("Рация: микрофон включен");
  }

  public stopPushToTalk() {
    this.isPushToTalk = false;
    this.pushToTalk(false); // Выключаем микрофон
    this.logger.log("Рация: микрофон выключен");
  }

  private onMouseDown() {
    if (!this.hasAccessToMic) return;

    // Запускаем таймер для определения долгого нажатия (режима рации)
    this.pressTimer = setTimeout(() => {
      this.startPushToTalk(); // Если удерживаем > 500 мс, включаем режим рации
    }, this.PRESS_THRESHOLD);
  }

  private onMouseUp() {
    if (!this.hasAccessToMic) return;

    if (this.pressTimer) {
      clearTimeout(this.pressTimer);
    }

    // Если это было долгое удержание, выключаем микрофон
    if (this.isPushToTalk) {
      this.stopPushToTalk(); // Завершаем режим рации
    } else {
      this.toggleMic(); // Если короткое нажатие, переключаем состояние микрофона
    }
  }

  private onMouseLeave() {
    if (!this.hasAccessToMic) return;

    if (this.pressTimer) {
      clearTimeout(this.pressTimer);
    }

    if (this.isPushToTalk) {
      this.stopPushToTalk(); // Если курсор вышел за пределы кнопки, завершаем режим рации
    }
  }

  public get prepareButtonCallbacks() {
    return {
      mousedown: this.onMouseDown.bind(this),
      mouseup: this.onMouseUp.bind(this),
      mouseleave: this.onMouseLeave.bind(this),
    };
  }

  // Завершение работы с микрофоном
  public close(): void {
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
      this.isMicEnabled = false;
      this.hasAccessToMic = false;

      if (this.audioTransceiver) {
        this.audioTransceiver.stop();
        this.audioTransceiver = null;
      }
    }
  }
}
