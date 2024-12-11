interface Track {
  url: string;
  duration: number;
}

export class MusicSyncObject {
  private state: DurableObjectState;
  private env: any;
  // private connections: WebSocket[]; // 不要：hibernation APIで不要となる
  private playlist: Track[];
  private currentTrackIndex: number;
  private startTime: number;
  private initializePromise: Promise<void>;
  private nextTrackTimeout?: ReturnType<typeof setTimeout>;

  constructor(state: DurableObjectState, env: any) {
    this.state = state;
    this.env = env;
    // this.connections = []; // 不要
    this.playlist = [];
    this.currentTrackIndex = 0;
    this.startTime = Date.now();
    this.initializePromise = this.initialize();
  }

  private async initialize(): Promise<void> {
    const storedStartTime = await this.state.storage.get('startTime') as number | null;
    const storedPlaylist = await this.state.storage.get('playlist') as Track[] | null;
    const storedCurrentTrackIndex = await this.state.storage.get('currentTrackIndex') as number | null;

    this.startTime = storedStartTime ?? Date.now();
    this.playlist = storedPlaylist ?? [];
    this.currentTrackIndex = storedCurrentTrackIndex ?? 0;
    this.state.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping','pong'));

    this.scheduleNextTrack();
  }

  async fetch(request: Request): Promise<Response> {
    await this.initializePromise;

    const url = new URL(request.url);
    if (url.pathname === '/api/setPlaylist' && request.method === 'POST') {
      const contentType = request.headers.get('Content-Type') || '';
      if (contentType.includes('application/json')) {
        const playlistData = await request.json() as Track[];
        if (Array.isArray(playlistData) && playlistData.every(track =>
          typeof track === 'object' &&
          typeof track.url === 'string' &&
          typeof track.duration === 'number'
        )) {
          await this.addToPlaylist(playlistData);
          return new Response('Tracks added to playlist', { status: 200 });
        } else {
          return new Response('Invalid playlist format', { status: 400 });
        }
      } else {
        return new Response('Invalid content type', { status: 400 });
      }
    } else if (url.pathname === '/api/getPlaylist' && request.method === 'GET') {
      const playlist = await this.getPlaylist();
      return new Response(JSON.stringify(playlist), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } else if (url.pathname === '/api/clearPlaylist' && request.method === 'POST') {
      await this.clearPlaylist();
      return new Response('Playlist cleared', { status: 200 });
    }

    // WebSocket接続の場合
    if (request.headers.get('Upgrade') === 'websocket') {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      // Hibernation APIに対応するために、Durable Object側のWebSocketは
      // acceptWebSocketを用いて受け入れます。
      this.state.acceptWebSocket(server);

      // ここで現在のtrack情報を送信します
      const elapsedTime = Date.now() - this.startTime;
      const currentTrack = this.playlist[this.currentTrackIndex] || null;

      server.send(JSON.stringify({
        type: 'sync',
        elapsedTime,
        trackUrl: currentTrack ? currentTrack.url : null,
        duration: currentTrack ? currentTrack.duration : null
      }));


      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response('Expected WebSocket', { status: 426 });
  }

  async getPlaylist(): Promise<Track[]> {
    await this.initializePromise;
    return this.playlist;
  }

  // これまではhandleWebSocketでaddEventListenerを登録していましたが、
  // Hibernation APIではwebSocketMessage, webSocketCloseなどのハンドラーメソッドを利用します。

  // クライアントがWebSocketメッセージを受け取った時に呼ばれるハンドラ
  async webSocketMessage(ws: WebSocket, message: string) {
    // ここで受信メッセージを処理します。
    // 現行コードでは特にクライアントからのメッセージ処理はしていませんが、
    // 必要に応じてメッセージパースなどを行います。
    const data = JSON.parse(message);

    if (data.type === 'requestSync') {
      const elapsedTime = Date.now() - this.startTime;
      const currentTrack = this.playlist[this.currentTrackIndex] || null;

      ws.send(JSON.stringify({
        type: 'sync',
        elapsedTime,
        trackUrl: currentTrack ? currentTrack.url : null,
        duration: currentTrack ? currentTrack.duration : null
      }));
    }

    // 必要なら状態に応じた処理をここで実装
  }

  // クライアントがWebSocketを閉じた時に呼ばれるハンドラ
  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean) {
    // 接続が閉じられた時の処理。現行コードではconnections配列から削除していましたが、
    // hibernationではthis.state.getWebSockets()からは自動的に外れるため、特別な処理は不要です。
    // 必要に応じて状態を更新したりログを残したりできます。
  }

  private broadcast(message: string): void {
    // すべてのWebSocket接続(hibernation APIの場合、this.state.getWebSockets()で取得)に対して送信
    const websockets = this.state.getWebSockets();
    for (const conn of websockets) {
      try {
        conn.send(message);
      } catch (e) {
        console.error('Failed to send message', e);
      }
    }
  }

  private async changeTrack(): Promise<void> {
    if (this.playlist.length < 10) {
      const finishedTrack = this.playlist.splice(this.currentTrackIndex, 1)[0];
      this.playlist.push(finishedTrack);
    } else {
      this.playlist.splice(this.currentTrackIndex, 1);
    }

    if (this.playlist.length === 0) {
      this.currentTrackIndex = 0;
      await this.state.storage.put('playlist', this.playlist);
      await this.state.storage.put('currentTrackIndex', this.currentTrackIndex);

      this.broadcast(JSON.stringify({
        type: 'changeTrack',
        trackUrl: null,
        duration: null
      }));
      return;
    }

    if (this.currentTrackIndex >= this.playlist.length) {
      this.currentTrackIndex = 0;
    }

    const newTrack = this.playlist[this.currentTrackIndex];
    this.startTime = Date.now();

    await this.state.storage.put('playlist', this.playlist);
    await this.state.storage.put('currentTrackIndex', this.currentTrackIndex);
    await this.state.storage.put('startTime', this.startTime);

    this.broadcast(JSON.stringify({
      type: 'changeTrack',
      trackUrl: newTrack.url,
      duration: newTrack.duration
    }));

    this.scheduleNextTrack();
  }

  private scheduleNextTrack(): void {
    if (this.playlist.length === 0) {
      return;
    }

    const currentTrack = this.playlist[this.currentTrackIndex];
    const trackDuration = currentTrack.duration;
    const elapsedTime = Date.now() - this.startTime;
    const timeUntilNextTrack = trackDuration - elapsedTime;
    const delay = timeUntilNextTrack > 0 ? timeUntilNextTrack : 0;

    if (this.nextTrackTimeout) {
      clearTimeout(this.nextTrackTimeout);
    }

    this.nextTrackTimeout = setTimeout(() => {
      this.changeTrack();
    }, delay);
  }

  async addToPlaylist(newTracks: Track[]): Promise<void> {
    this.playlist = [...this.playlist, ...newTracks];

    await this.state.storage.put('playlist', this.playlist);

    if (this.playlist.length === newTracks.length) {
      this.currentTrackIndex = 0;
      this.startTime = Date.now();
      await this.state.storage.put('currentTrackIndex', this.currentTrackIndex);
      await this.state.storage.put('startTime', this.startTime);

      const currentTrack = this.playlist[this.currentTrackIndex];
      this.broadcast(JSON.stringify({
        type: 'changeTrack',
        trackUrl: currentTrack.url,
        duration: currentTrack.duration
      }));
    }

    this.scheduleNextTrack();
  }

  async clearPlaylist(): Promise<void> {
    if (this.nextTrackTimeout) {
      clearTimeout(this.nextTrackTimeout);
    }

    this.playlist = [];
    this.currentTrackIndex = 0;

    await this.state.storage.put('playlist', this.playlist);
    await this.state.storage.put('currentTrackIndex', this.currentTrackIndex);

    this.broadcast(JSON.stringify({
      type: 'changeTrack',
      trackUrl: null,
      duration: null
    }));
  }

  async setPlaylist(playlist: Track[]): Promise<void> {
    this.playlist = playlist;
    this.currentTrackIndex = 0;
    this.startTime = Date.now();

    await this.state.storage.put('playlist', this.playlist);
    await this.state.storage.put('currentTrackIndex', this.currentTrackIndex);
    await this.state.storage.put('startTime', this.startTime);

    const currentTrack = this.playlist[this.currentTrackIndex];
    this.broadcast(JSON.stringify({
      type: 'changeTrack',
      trackUrl: currentTrack.url,
      duration: currentTrack.duration
    }));

    this.scheduleNextTrack();
  }
}