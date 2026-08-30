/** Worker: surface edge 2D hors du main thread. Fallback synchrone côté page. */
import { edgeSurface } from './leverage-optimizer';
import type { MarketCalib } from './monte-carlo';
import type { FtmoSpec } from '../ftmo';

self.onmessage = (e: MessageEvent) => {
  const { spec, calib, nSims, nLambda, lambdaMax } = e.data as {
    spec: FtmoSpec;
    calib: MarketCalib;
    nSims: number;
    nLambda: number;
    lambdaMax: number;
  };
  const surface = edgeSurface(spec, calib, { nSims, nLambda, lambdaMax });
  (self as unknown as Worker).postMessage(surface);
};
