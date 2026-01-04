import { storage } from './firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

/**
 * Upload audio file to Firebase Storage
 * @param file - The audio file to upload
 * @param ambianceType - The type of ambiance (tavern, forest, etc.)
 * @returns The download URL of the uploaded file
 */
export async function uploadAmbianceAudio(
    file: File,
    ambianceType: string
): Promise<string> {
    try {
        // Create a reference to the file location
        const timestamp = Date.now();
        const fileName = `${ambianceType}-${timestamp}.${file.name.split('.').pop()}`;
        const storageRef = ref(storage, `audio/ambiance/${fileName}`);

        // Upload the file
        console.log(`[Storage] Uploading ${file.name} to ${fileName}...`);
        const snapshot = await uploadBytes(storageRef, file);

        // Get the download URL
        const downloadURL = await getDownloadURL(snapshot.ref);
        console.log(`[Storage] Upload complete. URL: ${downloadURL}`);

        return downloadURL;
    } catch (error) {
        console.error('[Storage] Upload failed:', error);
        throw error;
    }
}
