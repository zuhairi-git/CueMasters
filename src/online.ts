import QRCode from 'qrcode';
import jsQR from 'jsqr';

export class OnlineGame {
  seat: number | undefined;
  playerId = '';
  peerId = '';
  peerName = 'Player';
  name = 'Player';
  connected = false;
  active = false;
  onPaired: (resume?: unknown) => void = () => {};
  onProfile = () => {};
  onTimeout: (turn: number) => void = () => {};
  private clockRemaining = 30000;
  private clockReceivedAt = 0;
  private clockRunning = false;
  onState: (state: unknown) => void = () => {};
  onInput: (input: unknown) => void = () => {};
  onEnded: (winner?: number) => void = () => {};
  onDeparture = () => {};
  departureDeadline?: number;
  private acknowledgeLeave?: () => void;
  private socket?: WebSocket;
  private connection?: Promise<void>;
  private dialog = document.querySelector<HTMLDialogElement>('#online')!;
  private message = document.querySelector<HTMLElement>('#onlineStatus')!;
  private opponentId = document.querySelector<HTMLInputElement>('#opponentId')!;
  private qr = document.querySelector<HTMLCanvasElement>('#inviteQr')!;
  private link = document.querySelector<HTMLAnchorElement>('#inviteLink')!;
  private stream?: MediaStream;
  private scanFrame = 0;
  private scanGeneration = 0;

  constructor() {
    try { this.name = localStorage.getItem('billiard-player-name') || 'Player'; this.playerId = localStorage.getItem('billiard-player-id') || ''; } catch {}
    const nameInput = document.querySelector<HTMLInputElement>('#profileName')!;
    nameInput.value = this.name;
    document.querySelector<HTMLElement>('#playerId')!.textContent = this.playerId || 'Generating ID…';
    void this.initPlayerId();
    nameInput.onchange = () => {
      this.name = nameInput.value.trim().slice(0, 24) || 'Player';
      nameInput.value = this.name;
      try { localStorage.setItem('billiard-player-name', this.name); } catch {}
      this.send({ type: 'profile', name: this.name });
      this.onProfile();
    };
    document.querySelector<HTMLButtonElement>('#scanInvite')!.onclick = () => { void this.startScanner(); };
    document.querySelector<HTMLButtonElement>('#stopScan')!.onclick = () => this.stopScanner();
    document.querySelector<HTMLInputElement>('#scanPhoto')!.onchange = async event => {
      const input = event.target as HTMLInputElement;
      const file = input.files?.[0];
      if (!file) return;
      try {
        const bitmap = await createImageBitmap(file);
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
        canvas.width = Math.round(bitmap.width * scale);
        canvas.height = Math.round(bitmap.height * scale);
        const context = canvas.getContext('2d', { willReadFrequently: true })!;
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close();
        const data = context.getImageData(0, 0, canvas.width, canvas.height);
        const result = jsQR(data.data, data.width, data.height);
        if (result) this.scanned(result.data);
        else this.message.textContent = 'No readable QR code found. Try a clearer photo.';
      } catch { this.message.textContent = 'Unable to read that photo.'; }
      input.value = '';
    };
    this.dialog.addEventListener('close', () => this.stopScanner());
    window.addEventListener('pagehide', () => this.stopScanner());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.stopScanner(); });
    document.querySelector<HTMLButtonElement>('#openOnline')!.onclick = () => this.open();
    document.querySelector<HTMLButtonElement>('#hostOnline')!.onclick = () => { void this.host(); };
    document.querySelector<HTMLButtonElement>('#joinOnline')!.onclick = () => { void this.join(); };
    document.querySelector<HTMLButtonElement>('#copyInvite')!.onclick = async () => {
      try { await navigator.clipboard.writeText(this.link.href); this.message.textContent = 'Invite copied.'; }
      catch { this.message.textContent = 'Select the invite link to copy or share it.'; }
    };
    const id = new URL(location.href).searchParams.get('join');
    if (id && /^[A-Fa-f0-9]{12}$/.test(id)) {
      this.opponentId.value = id.toUpperCase();
      this.open();
    }
  }

  open() {
    if (!this.dialog.open) this.dialog.showModal();
    void this.drawInvite();
    void this.connect().catch(() => {});
  }

  getSecret(): string {
    let secret = '';
    try {
      secret = localStorage.getItem('billiard-player-secret') ?? '';
      if (!/^[a-f0-9]{64}$/.test(secret)) {
        secret = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
        localStorage.setItem('billiard-player-secret', secret);
      }
    } catch {
      secret = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
    }
    return secret;
  }

  async initPlayerId() {
    if (this.playerId && /^[A-F0-9]{12}$/.test(this.playerId)) {
      document.querySelector<HTMLElement>('#playerId')!.textContent = this.playerId;
      void this.drawInvite();
      return;
    }
    const secret = this.getSecret();
    try {
      const data = new TextEncoder().encode(secret);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const id = hashArray.slice(0, 6).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
      this.playerId = id;
      try { localStorage.setItem('billiard-player-id', id); } catch {}
      document.querySelector<HTMLElement>('#playerId')!.textContent = id;
      void this.drawInvite();
    } catch {
      this.playerId = secret.slice(0, 12).toUpperCase();
      document.querySelector<HTMLElement>('#playerId')!.textContent = this.playerId;
      void this.drawInvite();
    }
  }

  private connect() {
    if (this.connected) return Promise.resolve();
    if (this.connection) return this.connection;
    this.message.textContent = 'Connecting…';
    this.connection = new Promise<void>((resolve, reject) => {
      const secret = this.getSecret();
      const socket = this.socket = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/play`);
      const timeout = window.setTimeout(() => socket.close(), 10000);
      socket.onopen = () => this.send({ type: 'register', secret, name: this.name });
      socket.onmessage = event => {
        let data;
        try { data = JSON.parse(event.data); } catch { return; }
        if (data.type === 'registered') {
          clearTimeout(timeout);
          this.connected = true;
          this.playerId = data.playerId;
          try { localStorage.setItem('billiard-player-id', this.playerId); } catch {}
          document.querySelector<HTMLElement>('#playerId')!.textContent = this.playerId;
          this.message.textContent = 'Create an invite, or enter the other player’s ID.';
          resolve();
          void this.drawInvite();
        } else if (data.type === 'waiting') {
          this.message.textContent = 'Waiting for your opponent to join…';
        } else if (data.type === 'paired') {
          this.departureDeadline = undefined;
          if (!data.resume) { this.clockRemaining = 30000; this.clockRunning = false; }
          this.active = true;
          this.seat = data.seat;
          this.peerId = data.peerId;
          this.peerName = data.peerName || 'Player';
          this.message.textContent = 'Connected to player ' + this.peerId;
          this.dialog.close();
          this.onPaired(data.resume ? data.state : undefined);
        } else if (data.type === 'state') this.onState(data.state);
        else if (data.type === 'clock') {
          if (typeof data.remaining === 'number' && Number.isFinite(data.remaining)) {
            this.clockRemaining = Math.max(0, Math.min(30000, data.remaining));
            this.clockReceivedAt = performance.now();
            this.clockRunning = data.running === true;
          }
        } else if (data.type === 'timeout') this.onTimeout(data.turn);
        else if (data.type === 'input') this.onInput(data.input);
        else if (data.type === 'profile') { this.peerName = data.name; this.onProfile(); }
        else if (data.type === 'departure') {
          this.active = false;
          this.seat = data.seat;
          this.peerName = data.peerName || 'Player';
          this.departureDeadline = performance.now() + data.remaining;
          this.message.textContent = 'Opponent left. Waiting for their timer to expire…';
          if (this.dialog.open) this.dialog.close();
          this.onDeparture();
        } else if (data.type === 'ended') {
          this.active = false;
          this.departureDeadline = undefined;
          if (data.winner === 0 || data.winner === 1) {
            this.seat = data.winner;
            this.peerName = data.peerName || 'Player';
          }
          this.message.textContent = data.message;
          this.onEnded(data.winner);
        } else if (data.type === 'left') {
          this.acknowledgeLeave?.();
        } else if (data.type === 'error') this.message.textContent = data.message;
      };
      socket.onclose = () => {
        clearTimeout(timeout);
        this.connected = false;
        this.connection = undefined;
        const wasActive = this.active;
        this.active = false;
        this.message.textContent = 'Connection closed. Reopen Online to reconnect.';
        if (wasActive) this.onEnded();
        reject(new Error('Online connection closed'));
      };
      socket.onerror = () => {
        this.message.textContent = 'Online service unavailable. Start the game server, then reopen Online.';
      };
    });
    return this.connection;
  }

  private async host() {
    try {
      await this.connect();
      if (this.active) { this.message.textContent = 'Leave the current online game before creating another invite.'; return; }
      this.send({ type: 'host' });
      await this.drawInvite();
    } catch {
      await this.drawInvite();
    }
  }

  private async drawInvite() {
    try {
      if (!this.playerId) return;
      const url = new URL(location.href);
      url.search = '';
      url.searchParams.set('join', this.playerId);
      this.link.href = url.href;
      this.link.textContent = url.href;
      await QRCode.toCanvas(this.qr, url.href, {
        width: 200,
        margin: 2,
        errorCorrectionLevel: 'M',
        color: {
          dark: '#0a1728',
          light: '#ffffff',
        },
      });
      document.querySelector<HTMLElement>('#invite')!.hidden = false;
      const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
      document.querySelector<HTMLElement>('#inviteNote')!.textContent = loopback
        ? 'For another device, open this game using your computer’s network address first, then create the invite again.'
        : 'Your opponent can scan this barcode / QR code with their phone camera, or open the invite link.';
    } catch { this.message.textContent = 'Unable to generate the barcode / QR code.'; }
  }

  private scanned(text: string) {
    let id = text.trim();
    if (!/^[A-Fa-f0-9]{12}$/.test(id)) {
      try {
        const url = new URL(text);
        if (url.origin !== location.origin) { this.message.textContent = 'This invite uses another game server. Open its invite link first.'; return; }
        id = url.searchParams.get('join') ?? '';
      } catch { id = ''; }
    }
    if (!/^[A-Fa-f0-9]{12}$/.test(id)) { this.message.textContent = 'That QR code is not a player invite.'; return; }
    this.stopScanner();
    this.opponentId.value = id.toUpperCase();
    void this.join();
  }

  private async startScanner() {
    if (!navigator.mediaDevices?.getUserMedia) {
      this.message.textContent = 'Camera scanning needs HTTPS or localhost. Use a QR photo or enter the player ID.';
      return;
    }
    this.stopScanner();
    const generation = this.scanGeneration;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 720 } }, audio: false });
      if (!this.dialog.open || generation !== this.scanGeneration) { stream.getTracks().forEach(track => track.stop()); return; }
      this.stream = stream;
      const video = document.querySelector<HTMLVideoElement>('#scanVideo')!;
      video.srcObject = stream;
      document.querySelector<HTMLElement>('#scanner')!.hidden = false;
      await video.play();
      this.message.textContent = 'Point the camera at the other player’s QR code.';
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d', { willReadFrequently: true })!;
      let lastScan = 0;
      const scan = (now: number) => {
        if (!this.stream) return;
        if (video.readyState >= 2 && now - lastScan > 150) {
          lastScan = now;
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          context.drawImage(video, 0, 0);
          const data = context.getImageData(0, 0, canvas.width, canvas.height);
          const result = jsQR(data.data, data.width, data.height);
          if (result) { this.scanned(result.data); if (!this.stream) return; }
        }
        this.scanFrame = requestAnimationFrame(scan);
      };
      this.scanFrame = requestAnimationFrame(scan);
    } catch { this.stopScanner(); this.message.textContent = 'Camera unavailable or permission denied. Use a QR photo or enter the player ID.'; }
  }

  private stopScanner() {
    this.scanGeneration++;
    cancelAnimationFrame(this.scanFrame);
    this.stream?.getTracks().forEach(track => track.stop());
    this.stream = undefined;
    document.querySelector<HTMLVideoElement>('#scanVideo')!.srcObject = null;
    document.querySelector<HTMLElement>('#scanner')!.hidden = true;
  }

  private async join() {
    const id = this.opponentId.value.trim().toUpperCase();
    if (!/^[A-F0-9]{12}$/.test(id)) { this.message.textContent = 'Enter a 12-character player ID.'; return; }
    try {
      await this.connect();
      if (this.active) { this.message.textContent = 'Leave your current game before joining another.'; return; }
      this.message.textContent = 'Joining player ' + id + '…';
      this.send({ type: 'join', playerId: id });
    } catch { /* Connection status is shown in the dialog. */ }
  }

  async leave(reconnect: boolean) {
    if (this.connection || reconnect) {
      await this.connect();
      const socket = this.socket;
      if (socket?.readyState !== WebSocket.OPEN) throw new Error('Could not reach the game server');
      await new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          this.acknowledgeLeave = undefined;
          reject(new Error('The game server did not acknowledge leaving'));
        }, 5000);
        this.acknowledgeLeave = () => {
          clearTimeout(timeout);
          this.acknowledgeLeave = undefined;
          resolve();
        };
        socket.send(JSON.stringify({ type: 'leave' }));
      });
    }
    this.active = false;
    this.seat = undefined;
    this.departureDeadline = undefined;
    this.message.textContent = 'Left the online game.';
  }

  remainingMs() {
    return Math.max(0, this.clockRemaining - (this.clockRunning && this.active ? performance.now() - this.clockReceivedAt : 0));
  }

  send(data: unknown) {
    if (this.socket?.readyState === WebSocket.OPEN && this.socket.bufferedAmount < 64000) this.socket.send(JSON.stringify(data));
  }
}
