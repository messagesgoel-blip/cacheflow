import {
  aggregateFiles,
  filterByProvider,
  getDuplicatesOnly,
  getUniqueOnly,
  getProviderDistribution,
  type AggregatedFileItem,
  type FileMetadata
} from '../lib/fileAggregator';

// Mock providers for testing
const createMockProvider = (id: string, files: FileMetadata[]) => ({
  providerId: id as any,
  listFiles: jest.fn().mockResolvedValue(files)
});

describe('fileAggregator', () => {
  describe('aggregateFiles', () => {
    it('should merge files from multiple providers', async () => {
      const provider1Files: FileMetadata[] = [
        {
          id: '1',
          name: 'file1.txt',
          path: '/folder/file1.txt',
          size: 100,
          mimeType: 'text/plain',
          isFolder: false,
          modifiedTime: '2023-01-01T10:00:00Z',
          provider: 'google',
          providerName: 'Google Drive'
        }
      ];

      const provider2Files: FileMetadata[] = [
        {
          id: '2',
          name: 'file2.txt',
          path: '/folder/file2.txt',
          size: 200,
          mimeType: 'text/plain',
          isFolder: false,
          modifiedTime: '2023-01-02T10:00:00Z',
          provider: 'dropbox',
          providerName: 'Dropbox'
        }
      ];

      const provider1 = createMockProvider('google', provider1Files);
      const provider2 = createMockProvider('dropbox', provider2Files);

      const result = await aggregateFiles([provider1, provider2], '/');

      expect(result.files).toHaveLength(2);
      expect(result.files[0].name).toBe('file2.txt'); // Most recent first
      expect(result.files[1].name).toBe('file1.txt');
    });

    it('should detect duplicates by normalized filename and size', async () => {
      const provider1Files: FileMetadata[] = [
        {
          id: '1',
          name: 'document.pdf',
          path: 'some-id-from-google',
          size: 1024,
          mimeType: 'application/pdf',
          isFolder: false,
          modifiedTime: '2023-01-01T10:00:00Z',
          provider: 'google',
          providerName: 'Google Drive'
        }
      ];

      const provider2Files: FileMetadata[] = [
        {
          id: '2',
          name: 'document.pdf',
          path: '/path/to/document.pdf',
          size: 1024, // Same size
          mimeType: 'application/pdf',
          isFolder: false,
          modifiedTime: '2023-01-02T10:00:00Z', // More recent
          provider: 'dropbox',
          providerName: 'Dropbox'
        }
      ];

      const provider1 = createMockProvider('google', provider1Files);
      const provider2 = createMockProvider('dropbox', provider2Files);

      const result = await aggregateFiles([provider1, provider2], '/');

      expect(result.files).toHaveLength(1);
      expect(result.files[0].isDuplicate).toBe(true);
      expect(result.files[0].providers).toContain('google');
      expect(result.files[0].providers).toContain('dropbox');
      expect(result.files[0].primaryProvider).toBe('dropbox'); // More recent
    });

    it('should NOT detect files with same name but different extensions as duplicates', async () => {
      const provider1Files: FileMetadata[] = [
        {
          id: '1',
          name: 'report.pdf',
          path: 'some-id-from-google',
          size: 1024,
          mimeType: 'application/pdf',
          isFolder: false,
          modifiedTime: '2023-01-01T10:00:00Z',
          provider: 'google',
          providerName: 'Google Drive'
        }
      ];

      const provider2Files: FileMetadata[] = [
        {
          id: '2',
          name: 'report.txt',
          path: '/path/to/report.txt',
          size: 1024, // Same size but different extension
          mimeType: 'text/plain',
          isFolder: false,
          modifiedTime: '2023-01-02T10:00:00Z',
          provider: 'dropbox',
          providerName: 'Dropbox'
        }
      ];

      const provider1 = createMockProvider('google', provider1Files);
      const provider2 = createMockProvider('dropbox', provider2Files);

      const result = await aggregateFiles([provider1, provider2], '/');

      expect(result.files).toHaveLength(2); // Should be 2 separate files, not 1 duplicate
      expect(result.files[0].isDuplicate).toBe(false);
      expect(result.files[1].isDuplicate).toBe(false);
    });

    it('should detect files with same name and extension as duplicates', async () => {
      const provider1Files: FileMetadata[] = [
        {
          id: '1',
          name: 'image.jpg',
          path: 'some-id-from-google',
          size: 2048,
          mimeType: 'image/jpeg',
          isFolder: false,
          modifiedTime: '2023-01-01T10:00:00Z',
          provider: 'google',
          providerName: 'Google Drive'
        }
      ];

      const provider2Files: FileMetadata[] = [
        {
          id: '2',
          name: 'image.jpg',
          path: '/path/to/image.jpg',
          size: 2048, // Same name, same size
          mimeType: 'image/jpeg',
          isFolder: false,
          modifiedTime: '2023-01-02T10:00:00Z',
          provider: 'dropbox',
          providerName: 'Dropbox'
        }
      ];

      const provider1 = createMockProvider('google', provider1Files);
      const provider2 = createMockProvider('dropbox', provider2Files);

      const result = await aggregateFiles([provider1, provider2], '/');

      expect(result.files).toHaveLength(1); // Should be merged as duplicate
      expect(result.files[0].isDuplicate).toBe(true);
      expect(result.files[0].providers).toContain('google');
      expect(result.files[0].providers).toContain('dropbox');
    });

    it('should handle provider errors gracefully', async () => {
      const provider1 = createMockProvider('google', [
        {
          id: '1',
          name: 'file1.txt',
          path: '/folder/file1.txt',
          size: 100,
          mimeType: 'text/plain',
          isFolder: false,
          modifiedTime: '2023-01-01T10:00:00Z',
          provider: 'google',
          providerName: 'Google Drive'
        }
      ]);

      const provider2 = {
        providerId: 'dropbox',
        listFiles: jest.fn().mockRejectedValue(new Error('Network error'))
      };

      const result = await aggregateFiles([provider1, provider2], '/');

      expect(result.files).toHaveLength(1); // Only files from successful provider
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].providerId).toBe('dropbox');
      expect(result.errors[0].error).toBe('Network error');
    });

    it('should sort files by modified date descending', async () => {
      const provider1Files: FileMetadata[] = [
        {
          id: '1',
          name: 'old-file.txt',
          path: '/old.txt',
          size: 100,
          mimeType: 'text/plain',
          isFolder: false,
          modifiedTime: '2023-01-01T10:00:00Z',
          provider: 'google',
          providerName: 'Google Drive'
        },
        {
          id: '2',
          name: 'new-file.txt',
          path: '/new.txt',
          size: 200,
          mimeType: 'text/plain',
          isFolder: false,
          modifiedTime: '2023-02-01T10:00:00Z', // More recent
          provider: 'google',
          providerName: 'Google Drive'
        }
      ];

      const provider1 = createMockProvider('google', provider1Files);

      const result = await aggregateFiles([provider1], '/');

      expect(result.files[0].name).toBe('new-file.txt'); // Newest first
      expect(result.files[1].name).toBe('old-file.txt');
    });
  });

  describe('filterByProvider', () => {
    it('should filter files by provider', () => {
      const files: AggregatedFileItem[] = [
        {
          id: '1',
          name: 'file1.txt',
          path: '/file1.txt',
          size: 100,
          mimeType: 'text/plain',
          isFolder: false,
          modifiedTime: '2023-01-01T10:00:00Z',
          provider: 'google',
          providerName: 'Google Drive',
          providers: ['google'],
          primaryProvider: 'google',
          isDuplicate: false
        },
        {
          id: '2',
          name: 'file2.txt',
          path: '/file2.txt',
          size: 200,
          mimeType: 'text/plain',
          isFolder: false,
          modifiedTime: '2023-01-01T10:00:00Z',
          provider: 'dropbox',
          providerName: 'Dropbox',
          providers: ['dropbox'],
          primaryProvider: 'dropbox',
          isDuplicate: false
        }
      ];

      const filtered = filterByProvider(files, 'google');

      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('file1.txt');
    });

    it('should return all files when no provider specified', () => {
      const files: AggregatedFileItem[] = [
        {
          id: '1',
          name: 'file1.txt',
          path: '/file1.txt',
          size: 100,
          mimeType: 'text/plain',
          isFolder: false,
          modifiedTime: '2023-01-01T10:00:00Z',
          provider: 'google',
          providerName: 'Google Drive',
          providers: ['google'],
          primaryProvider: 'google',
          isDuplicate: false
        }
      ];

      const filtered = filterByProvider(files);

      expect(filtered).toHaveLength(1);
    });
  });

  describe('getDuplicatesOnly', () => {
    it('should return only duplicate files', () => {
      const files: AggregatedFileItem[] = [
        {
          id: '1',
          name: 'unique-file.txt',
          path: '/unique.txt',
          size: 100,
          mimeType: 'text/plain',
          isFolder: false,
          modifiedTime: '2023-01-01T10:00:00Z',
          provider: 'google',
          providerName: 'Google Drive',
          providers: ['google'],
          primaryProvider: 'google',
          isDuplicate: false
        },
        {
          id: '2',
          name: 'duplicate-file.txt',
          path: '/dup.txt',
          size: 200,
          mimeType: 'text/plain',
          isFolder: false,
          modifiedTime: '2023-01-01T10:00:00Z',
          provider: 'dropbox',
          providerName: 'Dropbox',
          providers: ['dropbox', 'google'],
          primaryProvider: 'dropbox',
          isDuplicate: true
        }
      ];

      const duplicates = getDuplicatesOnly(files);

      expect(duplicates).toHaveLength(1);
      expect(duplicates[0].name).toBe('duplicate-file.txt');
      expect(duplicates[0].isDuplicate).toBe(true);
    });
  });

  describe('getUniqueOnly', () => {
    it('should return only unique files', () => {
      const files: AggregatedFileItem[] = [
        {
          id: '1',
          name: 'unique-file.txt',
          path: '/unique.txt',
          size: 100,
          mimeType: 'text/plain',
          isFolder: false,
          modifiedTime: '2023-01-01T10:00:00Z',
          provider: 'google',
          providerName: 'Google Drive',
          providers: ['google'],
          primaryProvider: 'google',
          isDuplicate: false
        },
        {
          id: '2',
          name: 'duplicate-file.txt',
          path: '/dup.txt',
          size: 200,
          mimeType: 'text/plain',
          isFolder: false,
          modifiedTime: '2023-01-01T10:00:00Z',
          provider: 'dropbox',
          providerName: 'Dropbox',
          providers: ['dropbox', 'google'],
          primaryProvider: 'dropbox',
          isDuplicate: true
        }
      ];

      const unique = getUniqueOnly(files);

      expect(unique).toHaveLength(1);
      expect(unique[0].name).toBe('unique-file.txt');
      expect(unique[0].isDuplicate).toBe(false);
    });
  });

  describe('getProviderDistribution', () => {
    it('should return provider distribution counts', () => {
      const files: AggregatedFileItem[] = [
        {
          id: '1',
          name: 'file1.txt',
          path: '/file1.txt',
          size: 100,
          mimeType: 'text/plain',
          isFolder: false,
          modifiedTime: '2023-01-01T10:00:00Z',
          provider: 'google',
          providerName: 'Google Drive',
          providers: ['google'],
          primaryProvider: 'google',
          isDuplicate: false
        },
        {
          id: '2',
          name: 'file2.txt',
          path: '/file2.txt',
          size: 200,
          mimeType: 'text/plain',
          isFolder: false,
          modifiedTime: '2023-01-01T10:00:00Z',
          provider: 'dropbox',
          providerName: 'Dropbox',
          providers: ['dropbox', 'google'], // This file is on 2 providers
          primaryProvider: 'dropbox',
          isDuplicate: true
        }
      ];

      const distribution = getProviderDistribution(files);

      expect(distribution.google).toBe(2); // Appears in 2 files (once as single provider, once as duplicate)
      expect(distribution.dropbox).toBe(1); // Appears in 1 file as primary provider
    });
  });
});