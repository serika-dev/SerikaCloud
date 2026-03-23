import * as mm from "music-metadata-browser";

export interface AudioMetadata {
  title?: string;
  artist?: string;
  album?: string;
  picture?: string; // Data URL or Blob URL
}

export async function extractAudioMetadata(url: string): Promise<AudioMetadata | null> {
  try {
    // mm.fetchFromUrl automatically handles HTTP Range requests if the server supports them
    const metadata = await mm.fetchFromUrl(url, {
      skipPostHeaders: true, // Speed up by only reading headers
    });
    
    const { common } = metadata;
    
    let picture = undefined;
    if (common.picture && common.picture.length > 0) {
      const pic = common.picture[0];
      const blob = new Blob([pic.data as any], { type: pic.format });
      picture = URL.createObjectURL(blob);
    }

    return {
      title: common.title,
      artist: common.artist,
      album: common.album,
      picture: picture,
    };
  } catch (error) {
    console.error("Error extracting audio metadata:", error);
    return null;
  }
}
