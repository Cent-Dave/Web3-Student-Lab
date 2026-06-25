import { describe, expect, it, jest, afterEach } from '@jest/globals';
import { StorageService } from '../src/services/storage/storage.service.js';
import { MockStorageProvider } from '../src/services/storage/providers/mock.provider.js';
import type { StorageServiceDependencies } from '../src/services/storage/storage.service.js';

const createRepository = (): NonNullable<StorageServiceDependencies['repository']> => ({
  upsertStorageAsset: jest.fn(),
  markAssetFailed: jest.fn(),
  listUnreferencedAssets: jest.fn(),
  markAssetUnpinned: jest.fn(),
  markAssetsUnreferenced: jest.fn(),
});

describe('storage service', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('pins JSON and persists the CID', async () => {
    const repository = createRepository();
    repository.upsertStorageAsset.mockResolvedValue({} as never);

    const storageService = new StorageService({
      provider: new MockStorageProvider(),
      repository,
    });

    const result = await storageService.pinJsonNow({
      resourceType: 'project',
      resourceId: 'project-1',
      name: 'example',
      kind: 'generic',
      content: { hello: 'world' },
    });

    expect(result.provider).toBe('mock');
    expect(repository.upsertStorageAsset).toHaveBeenCalledTimes(1);
  });

  it('pins files and persists the CID', async () => {
    const repository = createRepository();
    repository.upsertStorageAsset.mockResolvedValue({} as never);

    const storageService = new StorageService({
      provider: new MockStorageProvider(),
      repository,
    });

    const result = await storageService.pinFileNow({
      resourceType: 'certificate',
      resourceId: 'cert-1',
      name: 'cert.svg',
      kind: 'certificate-image',
      content: Buffer.from('<svg />'),
      mimeType: 'image/svg+xml',
    });

    expect(result.provider).toBe('mock');
    expect(repository.upsertStorageAsset).toHaveBeenCalledTimes(1);
  });

  it('queues pin and gc jobs', async () => {
    const storageService = new StorageService({
      provider: new MockStorageProvider(),
      repository: createRepository(),
    });

    const jsonJob = await storageService.queueJsonPin({
      resourceType: 'project',
      resourceId: 'project-1',
      name: 'example',
      kind: 'generic',
      content: { hello: 'world' },
    });

    const fileJob = await storageService.queueFilePin({
      resourceType: 'certificate',
      resourceId: 'cert-1',
      name: 'cert.svg',
      kind: 'certificate-image',
      content: Buffer.from('hello').toString('base64'),
      mimeType: 'image/svg+xml',
    });

    const gcJob = await storageService.queueGarbageCollection(7, true);

    expect(jsonJob.jobId).toEqual(expect.any(String));
    expect(fileJob.jobId).toEqual(expect.any(String));
    expect(gcJob.jobId).toEqual(expect.any(String));
  });
});
