import { SpotifyPlayer, TrackInfo } from "./spotify-player.ts";

export class UnifiedPlayer {
  constructor(private spotifyPlayer: SpotifyPlayer, private config: any) {}

  get currentSource(): string {
    return "Spotify";
  }

  async getCurrentlyPlaying(): Promise<TrackInfo | null> {
    return await this.spotifyPlayer.getCurrentlyPlaying();
  }
}
