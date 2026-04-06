'use client';
import { useEffect, useState, useRef } from 'react';

interface HyperliquidWSData {
  coin: string;
  markPx: number;
  funding24h: number;
  openInterest: number;
  volume24h: number;
}

interface HyperliquidWSResponse {
  subscription: string;
  data: HyperliquidWSData[];
}

export function useHyperliquidWebSocket(symbols: string[] = ['BTC', 'ETH', 'SOL']) {
  const [data, setData] = useState<Record<string, HyperliquidWSData>>({});
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  useEffect(() => {
    const connect = () => {
      try {
        const ws = new WebSocket('wss://api.hyperliquid.xyz/ws');

        ws.onopen = () => {
          console.log('Hyperliquid WebSocket connected');
          setConnected(true);
          setError(null);

          // Subscribe to trades for specified symbols
          symbols.forEach(symbol => {
            ws.send(JSON.stringify({
              method: 'subscribe',
              subscription: {
                type: 'trade',
                coin: symbol,
              },
            }));
          });
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);

            if (message.data && Array.isArray(message.data)) {
              const newData = message.data.reduce((acc: Record<string, HyperliquidWSData>, item: HyperliquidWSData) => {
                acc[item.coin] = item;
                return acc;
              }, {});

              setData(prev => ({ ...prev, ...newData }));
            }
          } catch (err) {
            console.error('Error parsing WebSocket message:', err);
          }
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          setError('WebSocket connection error');
          setConnected(false);
        };

        ws.onclose = () => {
          console.log('WebSocket closed, reconnecting in 5s...');
          setConnected(false);
          reconnectTimeoutRef.current = setTimeout(connect, 5000);
        };

        wsRef.current = ws;
      } catch (err) {
        console.error('Error creating WebSocket:', err);
        setError('Failed to create WebSocket connection');
      }
    };

    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [symbols]);

  return { data, connected, error };
}
