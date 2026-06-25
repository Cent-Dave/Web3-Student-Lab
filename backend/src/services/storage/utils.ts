import crypto from 'crypto';

export const canonicalizeJson = (value: unknown): string => {
  const sortValue = (input: unknown): unknown => {
    if (Array.isArray(input)) {
      return input.map(sortValue);
    }

    if (input && typeof input === 'object') {
      return Object.keys(input as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((acc, key) => {
          acc[key] = sortValue((input as Record<string, unknown>)[key]);
          return acc;
        }, {});
    }

    return input;
  };

  return JSON.stringify(sortValue(value));
};

export const buildGatewayUrl = (cid: string): string => {
  const baseUrl = (process.env.STORAGE_GATEWAY_BASE_URL || 'https://gateway.pinata.cloud/ipfs').replace(
    /\/+$/,
    ''
  );

  return `${baseUrl}/${cid}`;
};

export const buildIpfsUri = (cid: string): string => `ipfs://${cid}`;

export const createDeterministicCid = (input: string): string => {
  return `bafy${crypto.createHash('sha256').update(input).digest('hex').slice(0, 56)}`;
};

