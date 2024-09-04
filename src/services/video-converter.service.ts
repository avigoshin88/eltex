export class VideoConverterService {
  convertMediaStreamToBlob(stream: MediaStream): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const options = { type: "video/mp2t" };

      const mediaRecorder = new MediaRecorder(stream);

      let chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (event) => {
        chunks.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, options);
        resolve(blob);
      };

      mediaRecorder.start(1000); 

      setTimeout(() => {
        mediaRecorder.stop();
      }, 10000); // Останавливаем запись через 10 секунд

      mediaRecorder.onerror = (error) => {
        console.error("Ошибка в MediaRecorder:", error);
        reject(error);
      };
    });
  }
}
