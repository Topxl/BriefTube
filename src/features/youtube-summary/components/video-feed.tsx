"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PlayIcon, ExternalLinkIcon } from "@/lib/icons";
import type { ProcessedVideo } from "@/lib/supabase/client";

export function VideoFeed({ videos }: { videos: ProcessedVideo[] }) {
  if (videos.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Summaries</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground py-8 text-center">
            No videos processed yet. Subscribe to channels and new videos will
            appear here!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Summaries</CardTitle>
        <CardDescription>
          Latest AI-generated summaries from your subscribed channels
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {videos.map((video) => (
            <div
              key={video.id}
              className="hover:bg-muted/50 flex items-start justify-between rounded-lg border p-4 transition-colors"
            >
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="line-clamp-2 font-medium">
                    {video.video_title}
                  </h3>
                  {video.transcript_source && (
                    <Badge variant="outline" className="text-xs">
                      {video.transcript_source}
                    </Badge>
                  )}
                </div>

                {video.summary && (
                  <p className="text-muted-foreground line-clamp-2 text-sm">
                    {video.summary}
                  </p>
                )}

                <div className="text-muted-foreground flex items-center gap-4 text-xs">
                  <span>{video.source_language?.toUpperCase()}</span>
                  {video.summary_length && (
                    <span>{video.summary_length} characters</span>
                  )}
                  {video.processed_at && (
                    <span>
                      {new Date(video.processed_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>

              <div className="ml-4 flex gap-2">
                {video.audio_url && (
                  <Button size="sm" variant="default" asChild>
                    <a
                      href={video.audio_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <PlayIcon className="mr-1 h-4 w-4" />
                      Audio
                    </a>
                  </Button>
                )}
                {video.video_url && (
                  <Button size="sm" variant="outline" asChild>
                    <a
                      href={video.video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLinkIcon className="mr-1 h-4 w-4" />
                      Video
                    </a>
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
