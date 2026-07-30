/**
 * Block Explorer Service — Hackathon Project Idea Generator backend.
 *
 * Provides ledger snapshots and transaction feeds for hackathon research using typed adapters.
 */

import cacheService from '../cache/CacheService.js';
import logger from '../utils/logger.js';
import {
  ExplorerAdapter,
  ExplorerAdapterError,
  ExplorerMode,
  ExplorerSnapshot,
  ExplorerTransaction,
  GetSnapshotOptions,
  TxStatus,
} from './adapters/blockExplorerAdapter.js';
import { getExplorerAdapter, resolveExplorerMode } from './adapters/explorerAdapterFactory.js';
import { LiveStellarExplorerAdapter } from './adapters/liveStellarExplorerAdapter.js';
import { SimulationExplorerAdapter } from './adapters/simulationExplorerAdapter.js';

export {
  ExplorerAdapter,
  ExplorerAdapterError,
  ExplorerMode,
  ExplorerSnapshot,
  ExplorerTransaction,
  GetSnapshotOptions,
  LiveStellarExplorerAdapter,
  SimulationExplorerAdapter,
  TxStatus,
};

export function filterTransactions(
  txs: ExplorerTransaction[],
  query: string
): ExplorerTransaction[] {
  const q = query.trim().toLowerCase();
  if (!q) return txs;
  return txs.filter(
    (tx) =>
      tx.hash.toLowerCase().includes(q) ||
      tx.operation.toLowerCase().includes(q) ||
      tx.source.toLowerCase().includes(q) ||
      tx.destination.toLowerCase().includes(q) ||
      tx.asset.toLowerCase().includes(q)
  );
}

export async function getExplorerSnapshot(
  options: GetSnapshotOptions = {}
): Promise<ExplorerSnapshot> {
  const limit = Math.min(options.limit ?? 25, 100);
  const seed = options.seed ?? Math.floor(Date.now() / 60_000);
  const resolvedMode = resolveExplorerMode(options);
  const cacheKey = `hackathon:explorer:${resolvedMode}:${seed}:${limit}`;

  const cached = await cacheService.get<ExplorerSnapshot>(cacheKey);
  if (cached) return cached;

  let adapter = getExplorerAdapter(options);

  try {
    const snapshot = await adapter.getSnapshot(options);
    await cacheService.set(cacheKey, snapshot, options.cacheTtl ?? 120);
    return snapshot;
  } catch (error: unknown) {
    // Operational signal fallback: if live adapter fails (network/timeout), attempt fallback to simulation if allowed or log structured telemetry
    const allowFallback = process.env.EXPLORER_FALLBACK_TO_SIMULATION === 'true' || options.useSimulation === true;
    if (resolvedMode === 'live' && allowFallback) {
      logger.warn('Live Stellar explorer fetch failed; falling back to simulation adapter', {
        error: error instanceof Error ? error.message : String(error),
        seed,
        limit,
      });
      const simAdapter = new SimulationExplorerAdapter();
      const fallbackSnapshot = await simAdapter.getSnapshot({ ...options, mode: 'simulation' });
      return fallbackSnapshot;
    }

    logger.error('Block explorer service error fetching snapshot', {
      mode: resolvedMode,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export function buildExplorerLink(
  hash: string,
  network: 'testnet' | 'public' = 'testnet'
): string {
  const segment = network === 'public' ? 'public' : 'testnet';
  return `https://stellar.expert/explorer/${segment}/tx/${hash}`;
}
