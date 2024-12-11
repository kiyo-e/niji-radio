import { Layout } from '../components/Layout'
import type { FC } from 'hono/jsx'

export const NijiRadioPage: FC = () => {
  const currentTime = '' // 必要なら実際の時刻をReactで管理してください
  const initialComments: { timestamp: string; text: string }[] = [] // 必要に応じてコメントを取得

  const scriptContent = `
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = \`\${wsProtocol}//\${window.location.host}/music\`;
    const socket = new WebSocket(wsUrl);

    let audio;
    let userInteracted = false;
    let currentTrackDuration = 0;
    let trackStartTime = 0;

    function formatTime(milliseconds) {
        const totalSeconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return \`\${String(minutes).padStart(2, '0')}:\${String(seconds).padStart(2, '0')}\`;
    }

    function updateTimes() {
        if (currentTrackDuration > 0) {
            const now = Date.now();
            const elapsedTime = now - trackStartTime;
            const remainingTime = Math.max(0, currentTrackDuration - elapsedTime);

            const remainingElem = document.getElementById('remaining-time');
            if (remainingElem) {
              remainingElem.textContent = formatTime(remainingTime);
            }

            const nextTrackElem = document.getElementById('next-track-time');
            if (nextTrackElem) {
              const nextTrackTime = new Date(trackStartTime + currentTrackDuration);
              nextTrackElem.textContent =
                  nextTrackTime.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
            }
        }
    }

    // ページロード時に常に updateTimes を定期実行
    setInterval(updateTimes, 1000); // 変更点: ここに setInterval を移動

    let playing = false;

    const playButton = document.getElementById('playPauseButton');
    if (playButton) {
      playButton.addEventListener('click', () => {
          userInteracted = true;
          if (playing) {
              if (audio) {
                  audio.pause();
              }
              playing = false;
              playButton.innerHTML = \`
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-12 h-12 text-white">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                </svg>\`;
          } else {
              socket.send(JSON.stringify({ type: 'requestSync' }));
          }
      });
    }

    socket.addEventListener('open', () => {
        console.log('WebSocket connection opened');
    });

    socket.addEventListener('message', (event) => {
        const data = JSON.parse(event.data);

        if (data.type === 'sync') {
            const elapsedTime = data.elapsedTime;
            const trackUrl = data.trackUrl;
            if (trackUrl) {
                trackStartTime = Date.now() - elapsedTime;
                currentTrackDuration = data.duration;
                playAudioFrom(trackUrl, elapsedTime);

                if (userInteracted) {
                    playing = true;
                    playButton.innerHTML = \`
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                        stroke-width="1.5" stroke="currentColor" class="w-12 h-12 text-white">
                        <path stroke-linecap="round" stroke-linejoin="round"
                          d="M5.25 5.25v13.5m13.5-13.5v13.5" />
                      </svg>\`;
                } else {
                    playing = false;
                    playButton.innerHTML = \`
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                        stroke-width="1.5" stroke="currentColor" class="w-12 h-12 text-white">
                        <path stroke-linecap="round" stroke-linejoin="round"
                          d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                      </svg>\`;
                }
            }
        }

        if (data.type === 'changeTrack') { // 修正ポイント: changeTrackイベントの処理
            const trackUrl = data.trackUrl;
            if (trackUrl) {
                trackStartTime = Date.now();
                currentTrackDuration = data.duration;
                if (playing) { // 再生中の場合のみオーディオを再生
                    playAudioFrom(trackUrl, 0);

                    if (userInteracted) {
                        playing = true;
                        playButton.innerHTML = \`
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                            stroke-width="1.5" stroke="currentColor" class="w-12 h-12 text-white">
                            <path stroke-linecap="round" stroke-linejoin="round"
                              d="M5.25 5.25v13.5m13.5-13.5v13.5" />
                          </svg>\`;
                    } else {
                        playing = false;
                        playButton.innerHTML = \`
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                            stroke-width="1.5" stroke="currentColor" class="w-12 h-12 text-white">
                            <path stroke-linecap="round" stroke-linejoin="round"
                              d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125
                              1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0
                              01-1.667-.985V5.653z" />
                          </svg>\`;
                    }
                }
                // playingがfalseの場合、オーディオは再生せず、残り時間と次の曲は更新される
            } else {
                if (audio) {
                    audio.pause();
                    audio.src = '';
                }
                currentTrackDuration = 0;
                const remainingElem = document.getElementById('remaining-time');
                if (remainingElem) remainingElem.textContent = '--:--';
                const nextTrackElem = document.getElementById('next-track-time');
                if (nextTrackElem) nextTrackElem.textContent = '--:--';

                playing = false;
                playButton.innerHTML = \`
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                    stroke-width="1.5" stroke="currentColor" class="w-12 h-12 text-white">
                    <path stroke-linecap="round" stroke-linejoin="round"
                      d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125
                      1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0
                      01-1.667-.985V5.653z" />
                  </svg>\`;
            }
        }

    });

    socket.addEventListener('error', (error) => {
        console.error('WebSocket error:', error);
    });

    function playAudioFrom(trackUrl, elapsedTime) {
        if (!audio) {
            audio = new Audio();
            audio.preload = 'auto';
            audio.addEventListener('error', (error) => {
                console.error('Audio error:', error);
            });
        } else {
            audio.pause();
            audio.src = '';
            audio.load();
        }

        audio.addEventListener('loadedmetadata', () => {
            audio.currentTime = elapsedTime / 1000;
        });

        audio.addEventListener('canplay', () => {
            if (userInteracted && playing) { // 修正ポイント: 'playing' が true の場合のみ再生
                audio.play().catch((error) => {
                    console.error('Audio play failed:', error);
                });
            } else {
                console.log('Waiting for user interaction to start playback');
            }
        });

        audio.src = trackUrl;
        audio.load();
    }
  `;

  return (
    <Layout>
    <div>
      {/* tailwindデザイン */}
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-orange-100 via-purple-100 to-blue-100 p-4">
        <div className="max-w-4xl w-full mx-auto p-6 bg-white/90 backdrop-blur shadow-lg rounded-lg flex flex-col items-center space-y-6">
          <h1 className="text-2xl md:text-3xl font-bold text-center mb-4 bg-gradient-to-r from-orange-500 to-blue-500 bg-clip-text text-transparent">
            ななみとほのかの<br />
            クリエイティブテクノロジーニュース
          </h1>
          {/* 横並びコンテナ: md以上の画面で左右等間隔 */}
          <div className="flex flex-col md:flex-row items-center justify-evenly w-full gap-4">
            <div className="flex flex-col items-center">
              <div className="relative w-24 h-24 md:w-32 md:h-32 rounded-full overflow-hidden bg-orange-200">
                <img src="/assets/c1.jpg" alt="nanami" className="object-cover w-full h-full" />
              </div>
              <p className="mt-2 font-semibold text-orange-600">ななみ</p>
            </div>

            <div className="flex flex-col items-center md:items-center">
              <button id="playPauseButton" className="w-16 h-16 md:w-24 md:h-24 rounded-full bg-gradient-to-r from-orange-400 to-blue-400 hover:from-orange-500 hover:to-blue-500 shadow-md flex items-center justify-center">
                {/* 再生ボタンアイコン(初期状態) */}
                <svg className="w-8 h-8 md:w-12 md:h-12 text-white" />
              </button>
              <div className="mt-4 text-center">
                <p className="text-sm text-gray-600">現在の時刻</p>
                <p className="text-lg md:text-2xl font-mono">{currentTime}</p>
                <p className="text-sm text-gray-600 mt-2">残り時間: <span id="remaining-time">--:--</span></p>
                <p className="text-sm text-gray-600 mt-1">次の曲: <span id="next-track-time">--:--</span></p>
              </div>
            </div>

            <div className="flex flex-col items-center">
              <div className="relative w-24 h-24 md:w-32 md:h-32 rounded-full overflow-hidden bg-blue-200">
                <img src="/assets/c2.jpg" alt="honoka" className="object-cover w-full h-full" />
              </div>
              <p className="mt-2 font-semibold text-blue-600">ほのか</p>
            </div>
          </div>
        </div>
      </div>
      {/* スクリプト挿入 */}
      <script dangerouslySetInnerHTML={{ __html: scriptContent }} />
    </div>
    </Layout>
  )
}