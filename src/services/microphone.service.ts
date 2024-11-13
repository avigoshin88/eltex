import { Nullable } from "../types/global";
import { EventBus } from "./event-bus.service";
import { Logger } from "./logger/logger.service";

export class MicrophoneService {
  private logger: Logger;
  private localStream: MediaStream | null = null;
  private audioTransceiver: RTCRtpTransceiver | null = null;
  private isMicEnabled: boolean = false;
  private hasAccessToMic: boolean = false;
  private currentDeviceId: string | null = null;
  private isMicOn = false;
  private isPushToTalk = false;
  private pressTimer: Nullable<number> = null;
  private PRESS_THRESHOLD = 500;

  private eventBus!: EventBus;

  constructor(id: string) {
    this.logger = new Logger(id, "MicrophoneService");
    this.eventBus = EventBus.getInstance(id);
  }

  public async enableMicrophone(
    peerConnection: RTCPeerConnection,
    deviceId: string | null = null
  ): Promise<void> {
    this.logger.log("debug", "Пробуем подключить микрофон");

    try {
      const constraints: MediaStreamConstraints = {
        audio: deviceId ? { deviceId: { exact: deviceId } } : true,
      };

      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      this.currentDeviceId = deviceId || (await this.getDefaultDeviceId());

      this.logger.log(
        "debug",
        `Планируем использовать микрофон с id ${deviceId}`
      );

      const audioTrack = this.localStream.getAudioTracks()[0];
      audioTrack.enabled = false;

      if (this.audioTransceiver) {
        this.audioTransceiver.sender.replaceTrack(audioTrack);
        this.audioTransceiver.direction = "sendrecv";
      } else {
        this.audioTransceiver = peerConnection.addTransceiver(audioTrack, {
          direction: "sendrecv",
          sendEncodings: [],
        });
      }

      this.hasAccessToMic = true;
    } catch (error) {
      this.logger.error(
        "debug",
        "Не удалось получить доступ к микрофону:",
        error
      );

      if (this.audioTransceiver) {
        this.audioTransceiver.direction = "recvonly";
      } else {
        this.audioTransceiver = peerConnection.addTransceiver("audio", {
          direction: "recvonly",
          sendEncodings: [],
        });
      }

      this.hasAccessToMic = false;

      this.close();
    }

    this.listenForDeviceChanges(peerConnection);
  }

  public muteMicrophone(): void {
    this.logger.log("debug", "Ставим микрофон на мьют");

    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = false;
      });

      if (this.audioTransceiver) {
        this.audioTransceiver.direction = "recvonly";
      }

      this.isMicEnabled = false;
      this.eventBus.emit("change-mic-state", this.isMicEnabled);
    }
  }

  public unmuteMicrophone(): void {
    this.logger.log("debug", "Включаем звук микрофона");

    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = true;
      });

      if (this.audioTransceiver) {
        this.audioTransceiver.direction = "sendrecv";
      }

      this.isMicEnabled = true;
      this.eventBus.emit("change-mic-state", this.isMicEnabled);
    }
  }

  public pushToTalk(isPressed: boolean): void {
    if (isPressed) {
      this.logger.log("debug", "Включаем режим Push2Talk");

      this.unmuteMicrophone();
      this.eventBus.emit("push2Talk", true);
    } else {
      this.logger.log("debug", "Выключаем режим Push2Talk");

      this.muteMicrophone();
      this.eventBus.emit("push2Talk", true);
    }
  }

  private async onDeviceChange(peerConnection: RTCPeerConnection) {
    this.logger.log("debug", "Пробуем переключиться на новый микрофон");

    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioDevices = devices.filter(
      (device) => device.kind === "audioinput"
    );

    this.logger.log("debug", "Устройства ввода аудио изменены:", audioDevices);

    const newDevice = audioDevices.find(
      (device) => device.deviceId !== this.currentDeviceId
    );

    if (newDevice) {
      if (navigator.mediaDevices) {
        navigator.mediaDevices.ondevicechange = null;
      }

      this.logger.log(
        "debug",
        "Переключаемся на новое устройство:",
        newDevice.label
      );
      await this.enableMicrophone(peerConnection, newDevice.deviceId);
    }
  }

  private listenForDeviceChanges(peerConnection: RTCPeerConnection): void {
    this.logger.log("debug", "Подписываемся на изменение устройства ввода");

    if (navigator.mediaDevices) {
      navigator.mediaDevices.ondevicechange = () =>
        this.onDeviceChange(peerConnection);
    }
  }

  private async getDefaultDeviceId(): Promise<string | null> {
    this.logger.log("debug", "Ищем устройство ввода по умолчанию");

    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioDevices = devices.filter(
      (device) => device.kind === "audioinput"
    );
    return audioDevices.length > 0 ? audioDevices[0].deviceId : null;
  }

  public get isMicrophoneEnabled(): boolean {
    return this.isMicEnabled;
  }

  public get hasAccessToMicrophone(): boolean {
    return this.hasAccessToMic;
  }

  public async receiveOnlyAudio(
    peerConnection: RTCPeerConnection
  ): Promise<void> {
    this.logger.log(
      "debug",
      "Подготавливаем аудио трансивер только на получение аудио"
    );

    if (!this.audioTransceiver) {
      this.audioTransceiver = peerConnection.addTransceiver("audio", {
        direction: "recvonly",
        sendEncodings: [],
      });
    } else {
      this.audioTransceiver.direction = "recvonly";
    }

    this.isMicEnabled = false;
    this.hasAccessToMic = false;
  }

  public toggleMic() {
    if (this.isMicOn) {
      this.muteMicrophone();
      this.isMicOn = false;
      this.logger.log("debug", "Микрофон выключен");
    } else {
      this.unmuteMicrophone();
      this.isMicOn = true;
      this.logger.log("debug", "Микрофон включен");
    }
  }

  public startPushToTalk() {
    this.isPushToTalk = true;
    this.pushToTalk(true);
    this.logger.log("debug", "Рация: микрофон включен");
  }

  public stopPushToTalk() {
    this.isPushToTalk = false;
    this.pushToTalk(false);
    this.logger.log("debug", "Рация: микрофон выключен");
  }

  private onMouseDown() {
    if (!this.hasAccessToMic) return;

    this.pressTimer = setTimeout(() => {
      this.startPushToTalk();
    }, this.PRESS_THRESHOLD);
  }

  private onMouseUp() {
    if (!this.hasAccessToMic) return;

    if (this.pressTimer) {
      clearTimeout(this.pressTimer);
    }

    if (this.isPushToTalk) {
      this.stopPushToTalk();
    } else {
      this.toggleMic();
    }
  }

  private onMouseLeave() {
    if (!this.hasAccessToMic) return;

    if (this.pressTimer) {
      clearTimeout(this.pressTimer);
    }

    if (this.isPushToTalk) {
      this.stopPushToTalk();
    }
  }

  public get prepareButtonCallbacks() {
    return {
      mousedown: this.onMouseDown.bind(this),
      mouseup: this.onMouseUp.bind(this),
      mouseleave: this.onMouseLeave.bind(this),
    };
  }

  public close(): void {
    this.logger.log(
      "debug",
      "Очищаем сервис, останавливаем работу с устройствами ввода, убираем подписки"
    );
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
      this.isMicEnabled = false;
      this.hasAccessToMic = false;
    }

    if (this.audioTransceiver) {
      this.audioTransceiver.stop();
      this.audioTransceiver = null;
    }

    if (navigator.mediaDevices) {
      navigator.mediaDevices.ondevicechange = null;
    }
  }
}
