/**
 * BINANCE WEBSOCKET CLIENT - Real L2 Data
 * Provides real-time CVD (Cumulative Volume Delta) from trade-by-trade data
 */

interface CVDData {
  symbol: string;
  cvd5m: number; // 0-100 (bullish %)
  cvd15m: number;
  buyVol5m: number;
  sellVol5m: number;
  buyVol15m: number;
  sellVol15m: number;
  lastUpdate: number;
}

interface Trade {
  price: string;
  qty: string;
  time: number;
  isBuyerMaker: boolean;
}

class BinanceWebSocketClient {
  private ws: WebSocket | null = null;
  private cvdBuffer: Map<string, Trade[]> = new Map();
  private readonly BUFFER_SIZE_5M = 300; // ~300 trades in 5m (avg)
  private readonly BUFFER_SIZE_15M = 900;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private readonly MAX_RECONNECT_DELAY = 30000;

  // Connect to WebSocket for multiple symbols
  connect(symbols: string[], onCVDUpdate: (symbol: string, cvd: CVDData) => void) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    const streams = symbols.map(s => `${s.toLowerCase()}usdt@trade`).join('/');
    const url = `wss://stream.binance.com:9443/ws/${streams}`;

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log('[BinanceWS] Connected');
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.e === 'trade') {
          this.handleTrade(data, onCVDUpdate);
        }
      } catch (err) {
        console.error('[BinanceWS] Parse error:', err);
      }
    };

    this.ws.onerror = (err) => {
      console.error('[BinanceWS] Error:', err);
    };

    this.ws.onclose = () => {
      console.log('[BinanceWS] Disconnected, reconnecting...');
      this.scheduleReconnect(symbols, onCVDUpdate);
    };
  }

  private handleTrade(trade: any, onCVDUpdate: (symbol: string, cvd: CVDData) => void) {
    const symbol = trade.s.replace('USDT', '');
    const tradeData: Trade = {
      price: trade.p,
      qty: trade.q,
      time: trade.T,
      isBuyerMaker: trade.m,
    };

    // Get or init buffer
    let buffer = this.cvdBuffer.get(symbol);
    if (!buffer) {
      buffer = [];
      this.cvdBuffer.set(symbol, buffer);
    }

    // Add trade and trim buffer
    buffer.push(tradeData);
    if (buffer.length > this.BUFFER_SIZE_15M) {
      buffer.shift();
    }

    // Calculate CVD every 10 trades
    if (buffer.length % 10 === 0) {
      const cvd = this.calculateCVD(symbol, buffer);
      onCVDUpdate(symbol, cvd);
    }
  }

  private calculateCVD(symbol: string, buffer: Trade[]): CVDData {
    const now = Date.now();
    const fiveMinAgo = now - 5 * 60 * 1000;
    const fifteenMinAgo = now - 15 * 60 * 1000;

    // Filter trades by time
    const trades5m = buffer.filter(t => t.time >= fiveMinAgo);
    const trades15m = buffer.filter(t => t.time >= fifteenMinAgo);

    // Calculate buy/sell volumes in USD (price * qty)
    // isBuyerMaker=false → buyer is aggressive taker = BUY
    // isBuyerMaker=true → seller is aggressive taker = SELL
    const buyVol5m = trades5m.filter(t => !t.isBuyerMaker).reduce((sum, t) => sum + parseFloat(t.qty) * parseFloat(t.price), 0);
    const sellVol5m = trades5m.filter(t => t.isBuyerMaker).reduce((sum, t) => sum + parseFloat(t.qty) * parseFloat(t.price), 0);
    const buyVol15m = trades15m.filter(t => !t.isBuyerMaker).reduce((sum, t) => sum + parseFloat(t.qty) * parseFloat(t.price), 0);
    const sellVol15m = trades15m.filter(t => t.isBuyerMaker).reduce((sum, t) => sum + parseFloat(t.qty) * parseFloat(t.price), 0);

    const total5m = buyVol5m + sellVol5m;
    const total15m = buyVol15m + sellVol15m;

    return {
      symbol,
      cvd5m: total5m > 0 ? (buyVol5m / total5m) * 100 : 50,
      cvd15m: total15m > 0 ? (buyVol15m / total15m) * 100 : 50,
      buyVol5m,
      sellVol5m,
      buyVol15m,
      sellVol15m,
      lastUpdate: now,
    };
  }

  private scheduleReconnect(symbols: string[], onCVDUpdate: (symbol: string, cvd: CVDData) => void) {
    const delay = Math.min(1000 * Math.pow(2, this.cvdBuffer.size || 1), this.MAX_RECONNECT_DELAY);
    this.reconnectTimeout = setTimeout(() => {
      this.connect(symbols, onCVDUpdate);
    }, delay);
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.cvdBuffer.clear();
  }

  // Get current CVD for a symbol (from buffer)
  getCurrentCVD(symbol: string): CVDData | null {
    const buffer = this.cvdBuffer.get(symbol);
    if (!buffer || buffer.length === 0) return null;
    return this.calculateCVD(symbol, buffer);
  }
}

// Singleton instance
let wsClient: BinanceWebSocketClient | null = null;

export function getBinanceWS(): BinanceWebSocketClient {
  if (!wsClient) {
    wsClient = new BinanceWebSocketClient();
  }
  return wsClient;
}

export function initializeBinanceWS(symbols: string[]): BinanceWebSocketClient {
  const client = getBinanceWS();
  client.connect(symbols, (symbol, cvd) => {
    // Update global cache (could use Redis/DB in production)
    if (typeof global !== 'undefined') {
      (global as any).__binanceCVD = (global as any).__binanceCVD || {};
      (global as any).__binanceCVD[symbol] = cvd;
    }
  });
  return client;
}

export function getCachedCVD(symbol: string): CVDData | null {
  if (typeof global !== 'undefined' && (global as any).__binanceCVD) {
    return (global as any).__binanceCVD[symbol] || null;
  }
  return null;
}

export type { CVDData, Trade };
