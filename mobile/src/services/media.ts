import { Directory, File, Paths } from 'expo-file-system';
export async function readBytes(uri: string): Promise<ArrayBuffer> {
  return new File(uri).arrayBuffer();
}
export async function saveLocalMedia(
  id: string,
  original: ArrayBuffer,
  preview: ArrayBuffer,
  extension: string,
): Promise<string> {
  const folder = new Directory(Paths.document, 'archive');
  folder.create({ idempotent: true, intermediates: true });
  new File(folder, `${id}.${extension}`).write(new Uint8Array(original));
  const file = new File(folder, `${id}-preview.jpg`);
  file.write(new Uint8Array(preview));
  return file.uri;
}
export async function resolvePhotoUri(uri: string): Promise<string> {
  return uri;
}
