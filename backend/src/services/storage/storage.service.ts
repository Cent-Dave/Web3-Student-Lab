// @ts-nocheck
import { storageGcQueue, storagePinQueue } from './queue.js';
import { createStorageProvider } from './provider.js';
import { buildGatewayUrl, buildIpfsUri } from './utils.js';
import * as defaultRepository from './asset.repository.js';
import type {
  StoragePinRequest,
  StoragePinResult,
  StorageAssetKind,
  StorageProvider,
} from './types.js';

export interface StorageRepository {
  upsertStorageAsset: typeof defaultRepository.upsertStorageAsset;
  markAssetFailed: typeof defaultRepository.markAssetFailed;
  listUnreferencedAssets: typeof defaultRepository.listUnreferencedAssets;
  markAssetUnpinned: typeof defaultRepository.markAssetUnpinned;
  markAssetsUnreferenced: typeof defaultRepository.markAssetsUnreferenced;
}

export interface StorageServiceDependencies {
  provider?: StorageProvider;
  repository?: StorageRepository;
  pinQueue?: typeof storagePinQueue;
  gcQueue?: typeof storageGcQueue;
}

export class StorageService {
  private static instance: StorageService | null = null;
  private readonly provider: StorageProvider;
  private readonly repository: StorageRepository;
  private readonly pinQueue: typeof storagePinQueue;
  private readonly gcQueue: typeof storageGcQueue;

  constructor(dependencies: StorageServiceDependencies | StorageProvider = {}) {
    if (this.isStorageProvider(dependencies)) {
      this.provider = dependencies;
      this.repository = defaultRepository;
      this.pinQueue = storagePinQueue;
      this.gcQueue = storageGcQueue;
      return;
    }

    this.provider = dependencies.provider ?? createStorageProvider();
    this.repository = dependencies.repository ?? defaultRepository;
    this.pinQueue = dependencies.pinQueue ?? storagePinQueue;
    this.gcQueue = dependencies.gcQueue ?? storageGcQueue;
  }

  static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }

    return StorageService.instance;
  }

  async pinJsonNow(request: Omit<StoragePinRequest, 'mode'>): Promise<StoragePinResult> {
    const result = await this.provider.pinJson({
      content: request.content,
      name: request.name,
      metadata: request.metadata,
    });

    await this.persistResult(request, result);
    return result;
  }

  async pinFileNow(
    request: Omit<StoragePinRequest, 'mode' | 'content'> & { content: Buffer }
  ): Promise<StoragePinResult> {
    const result = await this.provider.pinFile({
      content: request.content,
      filename: request.filename || request.name,
      mimeType: request.mimeType || 'application/octet-stream',
      metadata: request.metadata,
    });

    await this.persistResult(request, result);
    return result;
  }

  async queueJsonPin(request: Omit<StoragePinRequest, 'mode'>): Promise<{ jobId?: string | number }> {
    const job = await this.pinQueue.add('pin-json', {
      ...request,
      mode: 'json',
    });
    return { jobId: job.id };
  }

  async queueFilePin(
    request: Omit<StoragePinRequest, 'mode' | 'content'> & { content: string }
  ): Promise<{ jobId?: string | number }> {
    const job = await this.pinQueue.add('pin-file', {
      ...request,
      mode: 'file',
      content: request.content,
    });
    return { jobId: job.id };
  }

  async queueGarbageCollection(retentionDays: number, dryRun = false): Promise<{ jobId?: string | number }> {
    const job = await this.gcQueue.add('gc', {
      retentionDays,
      dryRun,
    });
    return { jobId: job.id };
  }

  async releaseResource(resourceType: string, resourceId: string): Promise<void> {
    await this.repository.markAssetsUnreferenced(resourceType, resourceId);
  }

  async pinCertificateImage(request: {
    certificateId: string;
    content: Buffer;
    mimeType?: string;
  }): Promise<StoragePinResult> {
    return this.pinFileNow({
      resourceType: 'certificate',
      resourceId: request.certificateId,
      name: `certificate-image-${request.certificateId}`,
      kind: 'certificate-image',
      content: request.content,
      filename: `${request.certificateId}.svg`,
      mimeType: request.mimeType || 'image/svg+xml',
      metadata: {
        certificateId: request.certificateId,
        assetType: 'certificate-image',
      },
    });
  }

  async pinCertificateMetadata(request: {
    certificateId: string;
    content: Record<string, unknown>;
  }): Promise<StoragePinResult> {
    return this.pinJsonNow({
      resourceType: 'certificate',
      resourceId: request.certificateId,
      name: `certificate-metadata-${request.certificateId}`,
      kind: 'certificate-metadata',
      content: request.content,
      metadata: {
        certificateId: request.certificateId,
        assetType: 'certificate-metadata',
      },
    });
  }

  async pinProjectIdea(request: {
    projectId: string;
    content: Record<string, unknown>;
    queued?: boolean;
  }): Promise<StoragePinResult | { jobId?: string | number }> {
    if (request.queued) {
      return this.queueJsonPin({
        resourceType: 'project',
        resourceId: request.projectId,
        name: `project-idea-${request.projectId}`,
        kind: 'project-idea',
        content: request.content,
        metadata: {
          projectId: request.projectId,
          assetType: 'project-idea',
        },
      });
    }

    return this.pinJsonNow({
      resourceType: 'project',
      resourceId: request.projectId,
      name: `project-idea-${request.projectId}`,
      kind: 'project-idea',
      content: request.content,
      metadata: {
        projectId: request.projectId,
        assetType: 'project-idea',
      },
    });
  }

  private async persistResult(
    request: Omit<StoragePinRequest, 'mode'> & { content?: Buffer },
    result: StoragePinResult
  ): Promise<void> {
    await this.repository.upsertStorageAsset({
      resourceType: request.resourceType,
      resourceId: request.resourceId,
      name: request.name,
      kind: request.kind,
      provider: result.provider,
      cid: result.cid,
      ipfsUri: result.ipfsUri || buildIpfsUri(result.cid),
      gatewayUrl: result.gatewayUrl || buildGatewayUrl(result.cid),
      mimeType: request.mimeType ?? null,
      sizeBytes: result.sizeBytes ?? null,
      status: 'pinned',
      referenceCount: request.referenceCount ?? 1,
      metadata: request.metadata ?? null,
    });
  }

  private isStorageProvider(value: StorageServiceDependencies | StorageProvider): value is StorageProvider {
    return (
      typeof value === 'object' &&
      value !== null &&
      'pinJson' in value &&
      'pinFile' in value &&
      'unpin' in value
    );
  }
}

export const storageService = StorageService.getInstance();
