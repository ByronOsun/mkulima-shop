import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

/**
 * Captures a photo with the device camera and returns it as a data URL
 * (e.g. for use as a product image). Works both in the native app (via the
 * device camera) and in a regular browser (via the file picker), since
 * @capacitor/camera ships a web implementation.
 */
export const capturePhoto = async (): Promise<string | null> => {
  const photo = await Camera.getPhoto({
    resultType: CameraResultType.DataUrl,
    source: CameraSource.Camera,
    quality: 70,
    width: 800,
  });

  return photo.dataUrl ?? null;
};
