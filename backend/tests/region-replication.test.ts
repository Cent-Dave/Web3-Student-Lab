import {
  orderRegionsByPreference,
  parseRegions,
  resolveActiveRegionName,
} from '../src/config/region.config.js';
import { RegionReplicator, type RedisLike, type RegionClient } from '../src/cache/RegionReplicator.js';

/** Minimal in-memory Redis fake so replication is observable per region. */
function fakeClient(options: { status?: string; failGet?: boolean; failSet?: boolean } = {}) {
  const store = new Map<string, string>();
  return {
    store,
    status: options.status,
    async get(key: string): Promise<string | null> {
      if (options.failGet) throw new Error('region read down');
      return store.has(key) ? store.get(key)! : null;
    },
    async set(key: string, value: string): Promise<unknown> {
      if (options.failSet) throw new Error('region write down');
      store.set(key, value);
      return 'OK';
    },
    async del(key: string): Promise<unknown> {
      store.delete(key);
      return 1;
    },
  };
}

function regions(...clients: Array<{ name: string; client: RedisLike }>): RegionClient[] {
  return clients;
}

describe('region.config (pure)', () => {
  it('parses name@connection pairs, keeping @ inside connection strings', () => {
    const parsed = parseRegions({
      REDIS_REGIONS: 'us-east@redis://user:pw@cache-us:6379, eu-west@cache-eu:6380',
    } as NodeJS.ProcessEnv);
    expect(parsed).toEqual([
      { name: 'us-east', connection: 'redis://user:pw@cache-us:6379' },
      { name: 'eu-west', connection: 'cache-eu:6380' },
    ]);
  });

  it('returns [] when unset and skips malformed/duplicate entries', () => {
    expect(parseRegions({} as NodeJS.ProcessEnv)).toEqual([]);
    const parsed = parseRegions({
      REDIS_REGIONS: 'broken,@nohost,name@,us@h:1,us@h:2',
    } as NodeJS.ProcessEnv);
    expect(parsed).toEqual([{ name: 'us', connection: 'h:1' }]);
  });

  it('resolves the active region from env, else the first region', () => {
    const list = parseRegions({ REDIS_REGIONS: 'us@h:1,eu@h:2' } as NodeJS.ProcessEnv);
    expect(resolveActiveRegionName(list, { REDIS_ACTIVE_REGION: 'eu' } as NodeJS.ProcessEnv)).toBe('eu');
    expect(resolveActiveRegionName(list, { REDIS_ACTIVE_REGION: 'xx' } as NodeJS.ProcessEnv)).toBe('us');
    expect(resolveActiveRegionName([], {} as NodeJS.ProcessEnv)).toBeUndefined();
  });

  it('orders healthy regions with the active first', () => {
    const names = ['us', 'eu', 'ap'];
    expect(orderRegionsByPreference(names, 'eu', () => true)).toEqual(['eu', 'us', 'ap']);
    // active unhealthy -> excluded, first healthy replica leads
    expect(orderRegionsByPreference(names, 'eu', (n) => n !== 'eu')).toEqual(['us', 'ap']);
  });
});

describe('RegionReplicator', () => {
  it('synchronizes a key modified in one region across all replica regions', async () => {
    const us = fakeClient();
    const eu = fakeClient();
    const ap = fakeClient();
    const replicator = new RegionReplicator(
      regions({ name: 'us', client: us }, { name: 'eu', client: eu }, { name: 'ap', client: ap }),
      'us'
    );

    const result = await replicator.set('course:1', 'cached-value', 900);

    // Acceptance: keys modified in one region appear in every replica region.
    expect(us.store.get('course:1')).toBe('cached-value');
    expect(eu.store.get('course:1')).toBe('cached-value');
    expect(ap.store.get('course:1')).toBe('cached-value');
    expect(result.origin).toBe('us');
    expect(result.replicated.sort()).toEqual(['ap', 'eu', 'us']);
    expect(result.failed).toEqual([]);
  });

  it('still replicates to healthy regions when one replica is down', async () => {
    const us = fakeClient();
    const eu = fakeClient({ failSet: true });
    const replicator = new RegionReplicator(
      regions({ name: 'us', client: us }, { name: 'eu', client: eu }),
      'us'
    );

    const result = await replicator.set('k', 'v');
    expect(us.store.get('k')).toBe('v');
    expect(result.replicated).toContain('us');
    expect(result.failed).toContain('eu');
  });

  it('reads from the active region, falling back to a replica on miss/error', async () => {
    const us = fakeClient({ failGet: true }); // active region read fails
    const eu = fakeClient();
    eu.store.set('k', 'from-eu');
    const replicator = new RegionReplicator(
      regions({ name: 'us', client: us }, { name: 'eu', client: eu }),
      'us'
    );

    expect(await replicator.get('k')).toBe('from-eu');
    expect(await replicator.get('missing')).toBeNull();
  });

  it('skips regions whose connection is dead', async () => {
    const us = fakeClient({ status: 'end' }); // dead active region
    const eu = fakeClient();
    const replicator = new RegionReplicator(
      regions({ name: 'us', client: us }, { name: 'eu', client: eu }),
      'us'
    );

    const result = await replicator.set('k', 'v');
    expect(result.origin).toBe('eu'); // fell back to the healthy region
    expect(us.store.has('k')).toBe(false);
    expect(eu.store.get('k')).toBe('v');
  });

  it('deletes a key from every region', async () => {
    const us = fakeClient();
    const eu = fakeClient();
    us.store.set('k', 'v');
    eu.store.set('k', 'v');
    const replicator = new RegionReplicator(
      regions({ name: 'us', client: us }, { name: 'eu', client: eu }),
      'us'
    );

    const result = await replicator.del('k');
    expect(us.store.has('k')).toBe(false);
    expect(eu.store.has('k')).toBe(false);
    expect(result.deleted.sort()).toEqual(['eu', 'us']);
  });
});
