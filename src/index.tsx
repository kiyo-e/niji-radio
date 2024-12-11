import { Hono } from 'hono';
import { MusicSyncObject } from './MusicSyncObject';
import { NijiRadioPage } from './pages/NijiRadioPage'; // 追加
import { bearerAuth } from 'hono/bearer-auth'

// 環境変数の型定義
interface Env {
  MUSIC_SYNC: DurableObjectNamespace;
  R2: R2Bucket;
  TOKEN: string;
  ASSETS: Fetcher;
}

export { MusicSyncObject }; // Durable Object をエクスポート

const app = new Hono<{ Bindings: Env }>();

app.on(['GET', 'POST'], '/api/*', async (c, next) => {
    if (!c.env.TOKEN) {
        return await next();
    }
    const bearer = bearerAuth({ token: c.env.TOKEN })
    return bearer(c, next)
})

app.get('/', async (c) => {
    return c.html(<NijiRadioPage />);
});

app.get('/music', async (c) => {
    if (c.req.header('Upgrade') === 'websocket') {
        const id = c.env.MUSIC_SYNC.idFromName('music-sync');
        const obj = c.env.MUSIC_SYNC.get(id);
        return obj.fetch(c.req.raw);
    }
    return c.text('Not Found', 404);
});

app.post('/api/setPlaylist', async (c) => {
  const id = c.env.MUSIC_SYNC.idFromName('music-sync');
  const obj = c.env.MUSIC_SYNC.get(id);
  return obj.fetch(c.req.raw);
});

app.get('/api/getPlaylist', async (c) => {
  const id = c.env.MUSIC_SYNC.idFromName('music-sync');
  const obj = c.env.MUSIC_SYNC.get(id);
  return obj.fetch(c.req.raw);
});

app.post('/api/clearPlaylist', async (c) => {
  const id = c.env.MUSIC_SYNC.idFromName('music-sync');
  const obj = c.env.MUSIC_SYNC.get(id);
  return obj.fetch(c.req.raw);
});

// 新規エンドポイント: /uploadTrack
// JSON例: { "base64Mp3": "<base64-string>", "duration": 180000 }
app.post('/api/uploadTrack', async (c) => {
    const { base64Mp3, duration } = await c.req.json<{ base64Mp3: string, duration: number }>();

    if (!base64Mp3 || typeof duration !== 'number') {
        return c.text('Invalid request', 400);
    }

    // base64をデコード
    const binaryString = atob(base64Mp3);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }

    // R2に保存 (キーはUUIDなどでユニークに)
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    const fileKey = `${year}_${month}_${day}_${hour}_${crypto.randomUUID()}.mp3`;
    await c.env.R2.put(fileKey, bytes.buffer, {
        httpMetadata: { contentType: 'audio/mpeg' },
    });

    // 公開URLの作成
    const publicUrl = new URL(c.req.url);
    publicUrl.pathname = `/files/${fileKey}`;

    // /setPlaylist にPOSTして既存Playlistに追加をトリガー
    const trackData = [
        {
            url: publicUrl.toString(),
            duration: duration
        }
    ];


    const id = c.env.MUSIC_SYNC.idFromName('music-sync');
    const obj = c.env.MUSIC_SYNC.get(id);
    const setPlaylistRes = await obj.fetch(`${publicUrl.origin}/api/setPlaylist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(trackData),
    });

    if (!setPlaylistRes.ok) {
        return c.text('Failed to update playlist', 500);
    }

    return c.text('Track uploaded and playlist updated', 200);
});

// R2からファイルを返すエンドポイント
app.get('/files/:key', async (c) => {
    const key = c.req.param('key');
    const rangeHeader = c.req.header('Range');

    const obj = await c.env.R2.get(key);
    if (!obj) {
        return c.text('Not Found', 404);
    }

    const size = obj.size;

    if (rangeHeader) {
        // "Range: bytes=start-end"形式のヘッダーをパース
        const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
        if (match) {
            const start = parseInt(match[1], 10);
            const end = match[2] ? parseInt(match[2], 10) : size - 1;
            const length = end - start + 1;

            // 部分的にファイルを取得
            const partialObj = await c.env.R2.get(key, { range: { offset: start, length: length } });
            if (partialObj && partialObj.body) {
                return new Response(partialObj.body, {
                    status: 206,
                    headers: {
                        'Content-Type': 'audio/mpeg',
                        'Accept-Ranges': 'bytes',
                        'Content-Length': length.toString(),
                        'Content-Range': `bytes ${start}-${end}/${size}`
                    }
                });
            }
        }

        // Rangeがパースできなかった場合はフルコンテンツで返す
        return new Response(obj.body, {
            headers: {
                'Content-Type': 'audio/mpeg',
                'Accept-Ranges': 'bytes',
                'Content-Length': size.toString()
            }
        });
    } else {
        // Rangeヘッダーがない場合は、フルコンテンツで返す
        return new Response(obj.body, {
            headers: {
                'Content-Type': 'audio/mpeg',
                'Accept-Ranges': 'bytes',
                'Content-Length': size.toString()
            }
        });
    }
});

export default app;
