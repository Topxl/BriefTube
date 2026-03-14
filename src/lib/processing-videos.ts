export type ProcessingVideo = {
  videoId: string;
  title: string;
  startedAt: number;
};

const KEY = "processingVideos";

export function getProcessingVideos(): ProcessingVideo[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as ProcessingVideo[];
  } catch {
    return [];
  }
}

export function addProcessingVideo(video: ProcessingVideo) {
  const list = getProcessingVideos().filter((v) => v.videoId !== video.videoId);
  localStorage.setItem(KEY, JSON.stringify([...list, video]));
  window.dispatchEvent(new Event("processingVideosChanged"));
}

export function removeProcessingVideo(videoId: string) {
  const list = getProcessingVideos().filter((v) => v.videoId !== videoId);
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new Event("processingVideosChanged"));
}
