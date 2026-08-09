import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { AiService } from './ai.service';
import { AiStore } from './ai.store';
import { TagsService } from './tags.service';

describe('AiService', () => {
    let service: AiService;
    let mockAiStore: any;
    let mockTagsService: any;

    beforeEach(() => {
        mockAiStore = {
            aiConfig: vi.fn().mockReturnValue({
                baseUrl: 'http://localhost:11434/v1',
                apiKey: '',
                model: 'llama3:latest'
            }),
            progress: {
                isProcessing: vi.fn().mockReturnValue(false),
                isPaused: vi.fn().mockReturnValue(false),
                isCancelled: vi.fn().mockReturnValue(false)
            },
            updateProgress: vi.fn(),
            cancelCategorization: vi.fn()
        };

        mockTagsService = {
            getTagsForBookmark: vi.fn().mockReturnValue([]),
            setTagsForBookmarks: vi.fn(),
            addAvailableTags: vi.fn()
        };

        TestBed.configureTestingModule({
            providers: [
                AiService,
                { provide: AiStore, useValue: mockAiStore },
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
            mockAiStore.aiConfig.mockReturnValue({ baseUrl: '' });

            await expect(service.suggestTags([], []))
                .rejects.toThrowError('AI Base URL is not configured');
        });

        it('should filter out new tags when allowNewTags is false', async () => {
            mockAiStore.aiConfig.mockReturnValue({
                baseUrl: 'http://localhost:11434/v1',
                apiKey: '',
                model: 'llama3:latest',
                allowNewTags: false
            });

            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({
                    choices: [{
                        message: {
                            content: JSON.stringify({
                                results: [{
                                    id: '1',
                                    tags: ['ExistingTag', 'NewTag']
                                }]
                            })
                        }
                    }]
                })
            } as any);

            const result = await service.suggestTags(
                [{ id: '1', title: 'Test', url: 'http://test.com' } as any],
                ['ExistingTag']
            );

            expect(result['1']).toEqual(['ExistingTag']);
        });

        it('should allow new tags when allowNewTags is true', async () => {
             mockAiStore.aiConfig.mockReturnValue({
                baseUrl: 'http://localhost:11434/v1',
                apiKey: '',
                model: 'llama3:latest',
                allowNewTags: true
            });

            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({
                    choices: [{
                        message: {
                            content: JSON.stringify({
                                results: [{
                                    id: '1',
                                    tags: ['ExistingTag', 'NewTag']
                                }]
                            })
                        }
                    }]
                })
            } as any);

            const result = await service.suggestTags(
                [{ id: '1', title: 'Test', url: 'http://test.com' } as any],
                ['ExistingTag']
            );

            expect(result['1']).toEqual(['ExistingTag', 'NewTag']);
        });
    });

    describe('categorizeAll', () => {
        it('aborts the in-flight request and does not apply tags after cancellation', async () => {
            const fetchMock = vi.fn((_url: string, init: RequestInit) => {
                return new Promise<Response>((_resolve, reject) => {
                    init.signal?.addEventListener('abort', () => {
                        reject(new DOMException('The operation was aborted', 'AbortError'));
                    }, { once: true });
                });
            });
            vi.stubGlobal('fetch', fetchMock);
            const bookmarks = [{
                id: '1',
                title: 'Bookmark',
                url: 'https://example.com'
            }] as chrome.bookmarks.BookmarkTreeNode[];

            const categorization = service.categorizeAll(bookmarks, ['ExistingTag']);
            const requestSignal = (fetchMock.mock.calls[0][1] as RequestInit).signal;

            service.cancelCategorization();
            await expect(categorization).resolves.toBeUndefined();

            expect(mockAiStore.cancelCategorization).toHaveBeenCalledTimes(1);
            expect(requestSignal?.aborted).toBe(true);
            expect(mockTagsService.setTagsForBookmarks).not.toHaveBeenCalled();
            expect(mockAiStore.updateProgress).toHaveBeenLastCalledWith({
                isProcessing: false
            });
            vi.unstubAllGlobals();
        });

        it('persists each suggested tag batch with one update per tag collection', async () => {
            vi.spyOn(service, 'suggestTags').mockResolvedValue({
                '1': ['Work'],
                '2': ['Reference']
            });
            const bookmarks = [
                { id: '1', title: 'First', url: 'https://first.example' },
                { id: '2', title: 'Second', url: 'https://second.example' }
            ] as chrome.bookmarks.BookmarkTreeNode[];

            await service.categorizeAll(bookmarks, []);

            expect(mockTagsService.setTagsForBookmarks).toHaveBeenCalledTimes(1);
            expect(mockTagsService.setTagsForBookmarks).toHaveBeenCalledWith({
                '1': ['Work'],
                '2': ['Reference']
            });
            expect(mockTagsService.addAvailableTags).toHaveBeenCalledTimes(1);
            expect(mockTagsService.addAvailableTags).toHaveBeenCalledWith(['Work', 'Reference']);
        });
    });

    describe('discoverProviderModels', () => {
        it('should call getOllamaModels for Ollama provider', async () => {
            const ollamaProvider = service.providers.find(p => p.name === 'Ollama')!;
            
            vi.spyOn(service, 'getOllamaModels').mockResolvedValue(['llama3', 'mistral']);
            
            const models = await service.discoverProviderModels(ollamaProvider);
            
            expect(service.getOllamaModels).toHaveBeenCalledWith(ollamaProvider.discoveryUrl, undefined);
            expect(models).toEqual(['llama3', 'mistral']);
        });

        it('should call getLMStudioModels for LM Studio provider', async () => {
            const lmStudioProvider = service.providers.find(p => p.name === 'LM Studio')!;
            
            vi.spyOn(service, 'getLMStudioModels').mockResolvedValue(['model-a', 'model-b']);
            
            const models = await service.discoverProviderModels(lmStudioProvider);
            
            expect(service.getLMStudioModels).toHaveBeenCalledWith(lmStudioProvider.discoveryUrl, undefined);
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

