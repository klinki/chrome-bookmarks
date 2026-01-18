import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { AiService } from './ai.service';
import { BookmarksStore } from './bookmarks.store';
import { TagsService } from './tags.service';

describe('AiService', () => {
    let service: AiService;
    let mockBookmarksStore: any;
    let mockTagsService: any;

    beforeEach(() => {
        mockBookmarksStore = {
            prefs: {
                aiConfig: vi.fn().mockReturnValue({
                    baseUrl: 'http://localhost:11434/v1',
                    apiKey: '',
                    model: 'llama3:latest'
                })
            },
            progress: {
                isProcessing: vi.fn().mockReturnValue(false),
                isPaused: vi.fn().mockReturnValue(false),
                isCancelled: vi.fn().mockReturnValue(false)
            },
            updateProgress: vi.fn()
        };

        mockTagsService = {
            getTagsForBookmark: vi.fn().mockReturnValue([]),
            setTagsForBookmark: vi.fn(),
            addAvailableTag: vi.fn()
        };

        TestBed.configureTestingModule({
            providers: [
                AiService,
                { provide: BookmarksStore, useValue: mockBookmarksStore },
                { provide: TagsService, useValue: mockTagsService }
            ]
        });

        service = TestBed.inject(AiService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    describe('providers', () => {
        it('should have Ollama provider', () => {
            const ollamaProvider = service.providers.find(p => p.name === 'Ollama');
            expect(ollamaProvider).toBeTruthy();
            expect(ollamaProvider?.discoveryUrl).toBe('http://localhost:11434');
        });

        it('should have LM Studio provider', () => {
            const lmStudioProvider = service.providers.find(p => p.name === 'LM Studio');
            expect(lmStudioProvider).toBeTruthy();
            expect(lmStudioProvider?.discoveryUrl).toBe('http://localhost:1234');
        });
    });

    describe('suggestTags', () => {
        it('should throw error if baseUrl is not configured', async () => {
            mockBookmarksStore.prefs.aiConfig.mockReturnValue({ baseUrl: '' });

            await expect(service.suggestTags([], []))
                .rejects.toThrowError('AI Base URL is not configured');
        });
    });

    describe('discoverProviderModels', () => {
        it('should call getOllamaModels for Ollama provider', async () => {
            const ollamaProvider = service.providers.find(p => p.name === 'Ollama')!;
            
            vi.spyOn(service, 'getOllamaModels').mockResolvedValue(['llama3', 'mistral']);
            
            const models = await service.discoverProviderModels(ollamaProvider);
            
            expect(service.getOllamaModels).toHaveBeenCalledWith(ollamaProvider.discoveryUrl);
            expect(models).toEqual(['llama3', 'mistral']);
        });

        it('should call getLMStudioModels for LM Studio provider', async () => {
            const lmStudioProvider = service.providers.find(p => p.name === 'LM Studio')!;
            
            vi.spyOn(service, 'getLMStudioModels').mockResolvedValue(['model-a', 'model-b']);
            
            const models = await service.discoverProviderModels(lmStudioProvider);
            
            expect(service.getLMStudioModels).toHaveBeenCalledWith(lmStudioProvider.discoveryUrl);
            expect(models).toEqual(['model-a', 'model-b']);
        });

        it('should return empty array for unknown provider', async () => {
            const unknownProvider = { name: 'Unknown', discoveryUrl: '', completionUrl: '' };
            
            const models = await service.discoverProviderModels(unknownProvider);
            
            expect(models).toEqual([]);
        });
    });

    describe('flattenBookmarks', () => {
        it('should correctly flatten nested bookmarks', () => {
            const mockBookmarks: chrome.bookmarks.BookmarkTreeNode[] = [
                { id: '1', title: 'Folder 1', children: [
                    { id: '11', title: 'Bookmark 1-1', url: 'http://1-1.com' },
                    { id: '12', title: 'Folder 1-2', children: [
                        { id: '121', title: 'Bookmark 1-2-1', url: 'http://1-2-1.com' }
                    ]}
                ]},
                { id: '2', title: 'Bookmark 2', url: 'http://2.com' }
            ];

            const flattened = (service as any).flattenBookmarks(mockBookmarks);

            expect(flattened.length).toBe(5);
            expect(flattened.map((b: any) => b.id)).toEqual(['1', '11', '12', '121', '2']);
        });

        it('should handle empty input', () => {
            const flattened = (service as any).flattenBookmarks([]);
            expect(flattened).toEqual([]);
        });
    });
});

