// Configuration file for the Spotify overlay application
import { parse as parseToml } from "https://deno.land/std@0.213.0/toml/mod.ts";

export interface Config {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  port: number;
  pollingInterval: number;
  // API rate limiting
  spotifyApiLimit: number;
  spotifyRateLimitWindow: number;
  // Warning settings
  loginWarningInterval: number;
  loginWarningMaxCount: number;
  // Polling intervals
  longPollingThreshold: number;
}

// Load configuration from TOML file with defaults
export function loadConfig(): Config {
  let configData: any = {};

  // Try to load config.toml file first, fallback to config_example.toml
  try {
    const tomlContent = Deno.readTextFileSync("config.toml");
    configData = parseToml(tomlContent);
  } catch (error) {
    try {
      const tomlContent = Deno.readTextFileSync("config_example.toml");
      configData = parseToml(tomlContent);
    } catch (exampleError) {
      // Use defaults
    }
  }

  // Extract values from TOML or use defaults
  const port = configData.server?.port || 8081;

  return {
    clientId: configData.spotify?.client_id || "",
    clientSecret: configData.spotify?.client_secret || "",
    redirectUri:
      configData.server?.redirect_uri || `http://127.0.0.1:${port}/callback`,
    port: port,
    pollingInterval: configData.server?.polling_interval || 5000,
    // API rate limiting
    spotifyApiLimit: configData.api?.spotify_api_limit || 30,
    spotifyRateLimitWindow: configData.api?.spotify_rate_limit_window || 60000,
    // Warning settings
    loginWarningInterval: configData.warnings?.login_warning_interval || 120000,
    loginWarningMaxCount: configData.warnings?.login_warning_max_count || 2,
    // Polling intervals
    longPollingThreshold: configData.polling?.long_polling_threshold || 30000,
  };
}

// Validate that required configuration is present
export function validateConfig(config: Config): void {
  if (!config.clientId) {
    throw new Error("SPOTIFY_CLIENT_ID environment variable is required");
  }
  if (!config.clientSecret) {
    throw new Error("SPOTIFY_CLIENT_SECRET environment variable is required");
  }
}
