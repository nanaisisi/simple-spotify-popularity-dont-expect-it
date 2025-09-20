console.log("=== Script.js loaded ===");

const loginBtn = document.getElementById("login-btn");

console.log("=== DOM Elements Check ===");
console.log("loginBtn element:", loginBtn);

// ログイン関数
function handleLogin() {
  window.location.href = "/login";
}

// 楽曲情報を取得する関数
async function getCurrentTrack() {
  try {
    const response = await fetch("/api/current-track");
    if (response.ok) {
      const trackData = await response.json();
      updateTrackDisplay(trackData);
    } else {
      console.log("楽曲情報を取得できませんでした");
    }
  } catch (error) {
    console.error("楽曲情報の取得中にエラーが発生しました:", error);
  }
}

// 楽曲情報を表示する関数
function updateTrackDisplay(trackData) {
  const trackDisplay = document.getElementById("track-display");
  const trackName = document.getElementById("track-name");
  const artistName = document.getElementById("artist-name");
  const albumName = document.getElementById("album-name");
  const trackPopularity = document.getElementById("track-popularity");
  const albumPopularity = document.getElementById("album-popularity");
  const artistPopularity = document.getElementById("artist-popularity");

  if (trackData.trackName) {
    trackDisplay.style.display = "block";
    trackName.textContent = trackData.trackName;
    artistName.textContent = trackData.artistName || "Unknown Artist";
    albumName.textContent = trackData.albumName || "Unknown Album";

    trackPopularity.textContent = `楽曲: ${trackData.popularity || "--"}/100`;
    albumPopularity.textContent = `アルバム: ${
      trackData.albumPopularity || "--"
    }/100`;
    artistPopularity.textContent = `アーティスト: ${
      trackData.artistPopularity || "--"
    }/100`;
  } else {
    trackDisplay.style.display = "none";
  }
}

// 定期的に楽曲情報を更新
setInterval(getCurrentTrack, 5000); // 5秒ごと
