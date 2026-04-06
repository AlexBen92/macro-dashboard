import { NextRequest, NextResponse } from 'next/server';

// DefiLlama API - Open source DeFi data
// Documentation: https://defillama.com/docs/api

const DEFILLAMA_BASE_URL = 'https://api.llama.fi';

interface DefiProtocol {
  name: string;
  symbol: string;
  tvl: number;
  change_1h: number;
  change_1d: number;
  change_7d: number;
  chain: string;
  category: string;
}

interface DefiChain {
  name: string;
  tvl: number;
  change_1d: number;
  change_7d: number;
  tokenSymbol: string;
  gecko_id: string;
}

interface DefiYield {
  project: string;
  chain: string;
  token: string;
  tvlUsd: number;
  apy: number;
  apyBase: number;
  apyReward: number;
  pool: string;
  stablecoin: boolean;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const endpoint = searchParams.get('endpoint') || 'protocols';

  try {
    let data;

    switch (endpoint) {
      case 'protocols':
        // Fetch top DeFi protocols by TVL
        const protocolsResponse = await fetch(
          `${DEFILLAMA_BASE_URL}/protocols`,
          {
            next: { revalidate: 600 } // Cache for 10 minutes
          }
        );

        if (!protocolsResponse.ok) {
          throw new Error(`DefiLlama protocols error: ${protocolsResponse.statusText}`);
        }

        const protocolsData = await protocolsResponse.json();
        data = protocolsData
          ?.filter((p: any) => p.chain !== 'All')
          .slice(0, 50)
          .map((p: any) => ({
            name: p.name,
            symbol: p.symbol,
            tvl: p.tvl,
            change_1h: p.change_1h,
            change_1d: p.change_1d,
            change_7d: p.change_7d,
            chain: p.chain,
            category: p.category,
          })) || [];
        break;

      case 'chains':
        // Fetch TVL by chain
        const chainsResponse = await fetch(
          `${DEFILLAMA_BASE_URL}/v2/chains`,
          {
            next: { revalidate: 600 } // Cache for 10 minutes
          }
        );

        if (!chainsResponse.ok) {
          throw new Error(`DefiLlama chains error: ${chainsResponse.statusText}`);
        }

        const chainsData = await chainsResponse.json();
        data = chainsData
          ?.slice(0, 20)
          .map((chain: any) => ({
            name: chain.name,
            tvl: chain.tvl,
            change_1d: chain.change_1d,
            change_7d: chain.change_7d,
            tokenSymbol: chain.tokenSymbol,
            gecko_id: chain.gecko_id,
          })) || [];
        break;

      case 'yields':
        // Fetch top yield opportunities
        const minTvl = searchParams.get('min_tvl') || '1000000';
        const yieldsResponse = await fetch(
          `https://yields.llama.fi/pools?minTvl=${minTvl}`,
          {
            next: { revalidate: 60 } // Cache for 1 minute
          }
        );

        if (!yieldsResponse.ok) {
          throw new Error(`DefiLlama yields error: ${yieldsResponse.statusText}`);
        }

        const yieldsData = await yieldsResponse.json();
        data = yieldsData.data
          ?.filter((pool: any) => pool.stablecoin || pool.apy > 10)
          .sort((a: any, b: any) => b.apy - a.apy)
          .slice(0, 50)
          .map((pool: any) => ({
            project: pool.project,
            chain: pool.chain,
            token: pool.symbol,
            tvlUsd: pool.tvlUsd,
            apy: pool.apy,
            apyBase: pool.apyBase || 0,
            apyReward: pool.apyReward || 0,
            pool: pool.name || pool.pool,
            stablecoin: pool.stablecoin,
          })) || [];
        break;

      case 'protocol_tvl':
        // Fetch TVL history for specific protocol
        const protocol = searchParams.get('protocol');
        if (!protocol) {
          throw new Error('Protocol name required for protocol_tvl');
        }

        const tvlResponse = await fetch(
          `${DEFILLAMA_BASE_URL}/v2/historicalChainTvl/${encodeURIComponent(protocol)}`,
          {
            next: { revalidate: 3600 } // Cache for 1 hour
          }
        );

        if (!tvlResponse.ok) {
          throw new Error(`DefiLlama TVL error: ${tvlResponse.statusText}`);
        }

        const tvlData = await tvlResponse.json();
        data = tvlData || [];
        break;

      case 'bridge_volumes':
        // Fetch cross-chain bridge volumes
        const bridgeResponse = await fetch(
          `${DEFILLAMA_BASE_URL}/v2/bridges`,
          {
            next: { revalidate: 3600 } // Cache for 1 hour
          }
        );

        if (!bridgeResponse.ok) {
          throw new Error(`DefiLlama bridges error: ${bridgeResponse.statusText}`);
        }

        const bridgeData = await bridgeResponse.json();
        data = bridgeData?.bridges || [];
        break;

      default:
        throw new Error('Invalid endpoint');
    }

    return NextResponse.json({
      success: true,
      data,
      timestamp: Date.now(),
    });

  } catch (error) {
    console.error('DefiLlama API Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        fallbackData: generateFallbackData(endpoint),
      },
      { status: 200 }
    );
  }
}

// Generate fallback data when API fails
function generateFallbackData(endpoint: string) {
  if (endpoint === 'protocols') {
    const protocols = [
      'Lido', 'AAVE', 'MakerDAO', 'Uniswap', 'Compound',
      'Curve', 'JustLend', 'Aave V3', 'Rocket Pool', 'Spark'
    ];

    return protocols.map((name, i) => ({
      name,
      symbol: name.substring(0, 3).toUpperCase(),
      tvl: Math.random() * 30000000000 + 1000000000,
      change_1h: (Math.random() - 0.5) * 2,
      change_1d: (Math.random() - 0.5) * 10,
      change_7d: (Math.random() - 0.5) * 20,
      chain: ['Ethereum', 'Arbitrum', 'Solana', 'Base', 'Polygon'][i % 5],
      category: ['Lending', 'DEX', 'Liquid Staking', 'Yield', 'Bridge'][i % 5],
    }));
  }

  if (endpoint === 'chains') {
    const chains = [
      { name: 'Ethereum', tokenSymbol: 'ETH' },
      { name: 'Tron', tokenSymbol: 'TRX' },
      { name: 'BSC', tokenSymbol: 'BNB' },
      { name: 'Solana', tokenSymbol: 'SOL' },
      { name: 'Arbitrum', tokenSymbol: 'ETH' },
    ];

    return chains.map(chain => ({
      ...chain,
      tvl: Math.random() * 50000000000 + 10000000000,
      change_1d: (Math.random() - 0.5) * 5,
      change_7d: (Math.random() - 0.5) * 15,
      gecko_id: chain.name.toLowerCase(),
    }));
  }

  if (endpoint === 'yields') {
    const protocols = ['AAVE', 'Compound', 'Lido', 'Curve', 'Uniswap'];
    const chains = ['Ethereum', 'Arbitrum', 'Optimism', 'Polygon', 'Base'];

    return Array.from({ length: 20 }, (_, i) => ({
      project: protocols[i % protocols.length],
      chain: chains[i % chains.length],
      token: ['USDC', 'USDT', 'ETH', 'WBTC', 'DAI'][i % 5],
      tvlUsd: Math.random() * 1000000000 + 100000000,
      apy: Math.random() * 20 + 2,
      apyBase: Math.random() * 10 + 1,
      apyReward: Math.random() * 10,
      pool: `${protocols[i % protocols.length]} ${chains[i % chains.length]}`,
      stablecoin: i % 3 === 0,
    }));
  }

  return [];
}
