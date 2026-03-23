"use client";

import * as React from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Music,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatTime } from "@/lib/utils";
import { AudioMetadata, extractAudioMetadata } from "@/lib/audio-metadata";

interface AudioPlayerProps {
  src: string;
  name: string;
}

export function AudioPlayer({ src, name }: AudioPlayerProps) {
  const audioRef = React.useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const [volume, setVolume] = React.useState(1);
  const [isMuted, setIsMuted] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);

  const [metadata, setMetadata] = React.useState<AudioMetadata | null>(null);

  React.useEffect(() => {
    let active = true;
    if (src) {
      extractAudioMetadata(src).then((data) => {
        if (active) setMetadata(data);
      });
    }
    return () => {
      active = false;
      if (metadata?.picture) {
        URL.revokeObjectURL(metadata.picture);
      }
    };
  }, [src]);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(console.error);
      }
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
      setIsLoading(false);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    setVolume(vol);
    if (audioRef.current) {
      audioRef.current.volume = vol;
      audioRef.current.muted = vol === 0;
      setIsMuted(vol === 0);
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      const newMuted = !isMuted;
      setIsMuted(newMuted);
      audioRef.current.muted = newMuted;
    }
  };

  const seekBy = (seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, Math.min(duration, audioRef.current.currentTime + seconds));
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto group">
      <div className="relative overflow-hidden rounded-xl bg-black/40 border border-white/10 backdrop-blur-xl shadow-xl h-28 flex items-center p-4 pr-6">
        {/* Poster / Side Art */}
        <div className="h-20 w-20 rounded-lg bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-white/5 flex items-center justify-center shrink-0 shadow-lg overflow-hidden relative">
          {metadata?.picture ? (
            <img src={metadata.picture} alt="Album art" className="h-full w-full object-cover" />
          ) : (
            <>
              <div className={`absolute inset-0 bg-violet-600/10 transition-opacity duration-1000 ${isPlaying ? 'opacity-100 animate-pulse' : 'opacity-0'}`} />
              <Music className={`h-8 w-8 text-violet-400/80 transition-transform duration-500 ${isPlaying ? 'scale-110 rotate-12' : 'scale-100'}`} />
            </>
          )}
        </div>

        {/* Info Area (Center) */}
        <div className="flex-1 min-w-0 px-6 flex flex-col justify-center">
          <h3 className="text-base font-semibold text-white truncate" title={metadata?.title || name}>
            {metadata?.title || name}
          </h3>
          <p className="text-white/40 text-xs mt-1 font-medium tracking-wide uppercase truncate">
            {metadata?.artist || "SerikaCloud Audio"}
          </p>
        </div>

        {/* Controls (Right) */}
        <div className="flex items-center gap-3 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-white/40 hover:text-white hover:bg-white/5 rounded-full transition-colors"
            onClick={() => seekBy(-10)}
          >
            <SkipBack className="h-5 w-5" />
          </Button>

          <Button
            variant="secondary"
            size="icon"
            className="h-12 w-12 bg-white text-black hover:bg-white/90 rounded-full shadow-lg transition-all active:scale-90"
            onClick={togglePlay}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-black" />
            ) : isPlaying ? (
              <Pause className="h-6 w-6 fill-black" />
            ) : (
              <Play className="h-6 w-6 fill-black ml-1" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-white/40 hover:text-white hover:bg-white/5 rounded-full transition-colors"
            onClick={() => seekBy(10)}
          >
            <SkipForward className="h-5 w-5" />
          </Button>

          {/* Volume mini-control */}
          <div className="flex items-center gap-2 ml-2 pl-4 border-l border-white/10">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-white/30 hover:text-white shrink-0"
              onClick={toggleMute}
            >
              {isMuted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </Button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-16 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-white/40 hover:accent-white transition-all"
            />
          </div>
        </div>

        {/* Progress Bar (Bottom) */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/5 hover:h-1.5 transition-all">
          <input
            type="range"
            min={0}
            max={duration || 0}
            value={currentTime}
            onChange={handleSeek}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          />
          <div 
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all duration-100"
            style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
          />
          {/* Time Tooltip on hover would go here, but keeping it simple as requested */}
          <div className="absolute -top-6 right-2 text-[10px] font-mono text-white/20 opacity-0 group-hover:opacity-100 transition-opacity">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        </div>

        <audio
          ref={audioRef}
          src={src}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
          autoPlay
        />
      </div>
    </div>
  );
}
