import { t } from './i18n';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { fetchOnlineProgress, getPlayerSecret, onlineMedalName, onlineMedals } from './circuit';

export type CircuitResult = { winner: number; firstWin: boolean };

export class OnlineGame {
  seat: number | undefined;
  playerId = '';
  peerId = '';
  peerName = 'Player';
  name = 'Player';
  connected = false;
  active = false;
  onPaired: (resume?: unknown, city?: string) => void = () => {};
  onCircuitResult: (result?: CircuitResult) => void = () => {};
  onCircuitSaveError = () => {};
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
  private secret = getPlayerSecret();
  private city?: string;
  private findButton = document.querySelector<HTMLButtonElement>('#findCityMatch')!;
  private medalRequest?: AbortController;

  constructor(private profileOnly = false) {
    try { this.name = localStorage.getItem('billiard-player-name') || 'Player'; this.playerId = localStorage.getItem('billiard-player-id') || ''; } catch {}
    const nameInput = document.querySelector<HTMLInputElement>('#profileName')!;
    nameInput.value = this.name;
    document.querySelector<HTMLElement>('#playerId')!.textContent = this.playerId || t('Generating ID…');
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
        else this.message.textContent = t('No readable QR code found. Try a clearer photo.');
      } catch { this.message.textContent = t('Unable to read that photo.'); }
      input.value = '';
    };
    this.dialog.addEventListener('close', () => {
      this.stopScanner();
      this.medalRequest?.abort();
    });
    window.addEventListener('pagehide', () => this.stopScanner());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.stopScanner(); });
    document.querySelector<HTMLButtonElement>('#openOnline')!.onclick = () => this.open();
    document.querySelector<HTMLButtonElement>('#hostOnline')!.onclick = () => { void this.host(); };
    document.querySelector<HTMLButtonElement>('#joinOnline')!.onclick = () => { void this.join(); };
    document.querySelector<HTMLButtonElement>('#copyInvite')!.onclick = async () => {
      try { await navigator.clipboard.writeText(this.link.href); this.message.textContent = t('Invite copied.'); }
      catch { this.message.textContent = t('Select the invite link to copy or share it.'); }
    };
    const id = new URL(location.href).searchParams.get('join');
    if (!profileOnly && id && /^[A-Fa-f0-9]{12}$/.test(id)) {
      this.opponentId.value = id.toUpperCase();
      this.open();
    }
  }

  open() {
    if (!this.dialog.open) this.dialog.showModal();
    void this.refreshMedals();
    if (this.profileOnly) return;
    void this.drawInvite();
    void this.connect().catch(() => {});
  }

  async refreshMedals() {
    if (!this.dialog.open) return;
    this.medalRequest?.abort();
    const pending = this.medalRequest = new AbortController();
    const section = document.querySelector<HTMLElement>('#onlineMedalSection')!;
    try {
      const progress = await fetchOnlineProgress(this.secret, pending.signal);
      if (pending.signal.aborted) return;
      const medals = onlineMedals(progress);
      const list = document.querySelector<HTMLUListElement>('#onlineMedals')!;
      list.replaceChildren(...medals.map(city => {
        const medal = document.createElement('li');
        const icon = document.createElement('span');
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = '★';
        medal.append(icon, onlineMedalName(city));
        return medal;
      }));
      section.hidden = medals.length === 0;
    } catch {
      if (!pending.signal.aborted) section.hidden = true;
    }
  }

  setCircuit(city?: { id: string; name: string }) {
    this.city = city?.id;
    document.querySelector<HTMLElement>('#casualInviteControls')!.hidden = Boolean(city) || this.profileOnly;
    document.querySelector<HTMLElement>('#onlineTitle')!.textContent = city ? t(city.name) + ' · ' + t('Online tournament') : t('Your player profile');
    this.findButton.hidden = !city;
    this.findButton.onclick = () => { void this.findMatch(); };
  }

  async findMatch() {
    this.findButton.disabled = true;
    try {
      await this.connect();
      if (!this.active && this.city) this.send({ type: 'city-queue', city: this.city });
    } catch {
      this.findButton.disabled = false;
    }
  }

  async initPlayerId() {
    if (this.playerId && /^[A-F0-9]{12}$/.test(this.playerId)) {
      document.querySelector<HTMLElement>('#playerId')!.textContent = this.playerId;
      void this.drawInvite();
      return;
    }
    const secret = this.secret;
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
    this.message.textContent = t('Connecting…');
    this.connection = new Promise<void>((resolve, reject) => {
      const secret = this.secret;
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
          this.message.textContent = this.city ? t('Ready to find an opponent.') : t('Create an invite, or enter the other player’s ID.');
          resolve();
          void this.drawInvite();
        } else if (data.type === 'waiting') {
          this.message.textContent = t('Waiting for your opponent to join…');
        } else if (data.type === 'city-waiting') {
          this.message.textContent = t('Waiting for another player to join this city…');
        } else if (data.type === 'paired') {
          this.departureDeadline = undefined;
          if (!data.resume) { this.clockRemaining = 30000; this.clockRunning = false; }
          this.active = true;
          this.seat = data.seat;
          this.peerId = data.peerId;
          this.peerName = data.peerName || 'Player';
          this.message.textContent = t('Connected to player {id}', { id: this.peerId });
          this.findButton.disabled = true;
          if (this.dialog.open) this.dialog.close();
          this.onPaired(data.resume ? data.state : undefined, data.city);
          if (data.result) this.onCircuitResult(data.result);
        } else if (data.type === 'circuit-result') {
          this.onCircuitResult(data.result);
        } else if (data.type === 'circuit-save-error') {
          this.onCircuitSaveError();
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
          this.message.textContent = t('Opponent left. Waiting for their timer to expire…');
          if (this.dialog.open) this.dialog.close();
          this.onDeparture();
        } else if (data.type === 'ended') {
          this.active = false;
          this.departureDeadline = undefined;
          if (data.winner === 0 || data.winner === 1) {
            this.seat = data.winner;
            this.peerName = data.peerName || 'Player';
          }
          this.message.textContent = t(data.message);
          if (data.result) this.onCircuitResult(data.result);
          this.onEnded(data.winner);
        } else if (data.type === 'left') {
          this.acknowledgeLeave?.();
        } else if (data.type === 'error') {
          this.findButton.disabled = this.active;
          this.message.textContent = t(data.message);
        }
      };
      socket.onclose = () => {
        clearTimeout(timeout);
        this.connected = false;
        this.connection = undefined;
        const wasActive = this.active;
        this.active = false;
        this.findButton.disabled = false;
        this.message.textContent = t('Connection closed. Reopen Online to reconnect.');
        if (wasActive) this.onEnded();
        reject(new Error('Online connection closed'));
      };
      socket.onerror = () => {
        this.message.textContent = t('Online service unavailable. Start the game server, then reopen Online.');
      };
    });
    return this.connection;
  }

  private async host() {
    try {
      await this.connect();
      if (this.active) { this.message.textContent = t('Leave the current online game before creating another invite.'); return; }
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
        ? t('For another device, open this game using your computer’s network address first, then create the invite again.')
        : t('Your opponent can scan this barcode / QR code with their phone camera, or open the invite link.');
    } catch { this.message.textContent = t('Unable to generate the barcode / QR code.'); }
  }

  private scanned(text: string) {
    let id = text.trim();
    if (!/^[A-Fa-f0-9]{12}$/.test(id)) {
      try {
        const url = new URL(text);
        if (url.origin !== location.origin) { this.message.textContent = t('This invite uses another game server. Open its invite link first.'); return; }
        id = url.searchParams.get('join') ?? '';
      } catch { id = ''; }
    }
    if (!/^[A-Fa-f0-9]{12}$/.test(id)) { this.message.textContent = t('That QR code is not a player invite.'); return; }
    this.stopScanner();
    this.opponentId.value = id.toUpperCase();
    void this.join();
  }

  private async startScanner() {
    if (!navigator.mediaDevices?.getUserMedia) {
      this.message.textContent = t('Camera scanning needs HTTPS or localhost. Use a QR photo or enter the player ID.');
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
      this.message.textContent = t('Point the camera at the other player’s QR code.');
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
    } catch { this.stopScanner(); this.message.textContent = t('Camera unavailable or permission denied. Use a QR photo or enter the player ID.'); }
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
    if (!/^[A-F0-9]{12}$/.test(id)) { this.message.textContent = t('Enter a 12-character player ID.'); return; }
    try {
      await this.connect();
      if (this.active) { this.message.textContent = t('Leave your current game before joining another.'); return; }
      this.message.textContent = t('Joining player {id}…', { id });
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
    this.message.textContent = t('Left the online game.');
  }

  remainingMs() {
    return Math.max(0, this.clockRemaining - (this.clockRunning && this.active ? performance.now() - this.clockReceivedAt : 0));
  }

  send(data: unknown) {
    if (this.socket?.readyState === WebSocket.OPEN && this.socket.bufferedAmount < 64000) this.socket.send(JSON.stringify(data));
  }
}
