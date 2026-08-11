import { TestBed } from '@angular/core/testing';
import { afterEach, vi } from 'vitest';
import { AiService } from './ai.service';
import { AiStore } from './ai.store';
import { TagsService } from './tags.service';
import { UsefulnessService } from './usefulness.service';

describe('AiService', () => {
    let service: AiService;
    let mockAiStore: any;
    let checkpointValue: any;
    let mockTagsService: any;
    let mockUsefulnessService: any;

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    beforeEach(() => {
        checkpointValue = null;
        mockAiStore = {
            aiConfig: vi.fn().mockReturnValue({
                baseUrl: 'http://localhost:11434/v1',
                apiKey: '',
                model: 'llama3:latest',
                allowNewTags: false
            }),
            checkpoint: vi.fn(() => checkpointValue),
            progress: {
                isProcessing: vi.fn().mockReturnValue(false),
                isPaused: vi.fn().mockReturnValue(false),
                isCancelled: vi.fn().mockReturnValue(false)
            },
            updateProgress: vi.fn(),
            setCheckpoint: vi.fn((checkpoint: any) => {
                checkpointValue = checkpoint;
            }),
            updateCheckpoint: vi.fn((update: any) => {
                checkpointValue = {
                    ...checkpointValue,
                    ...update,
                    updatedAt: update.updatedAt ?? Date.now()
                };
            }),
            discardCheckpoint: vi.fn(() => {
                checkpointValue = null;
            }),
            cancelProcessing: vi.fn(() => {
                checkpointValue = null;
            })
        };

        mockTagsService = {
            availableTags: vi.fn().mockReturnValue([]),
            getTagsForBookmark: vi.fn().mockReturnValue([]),
            setTagsForBookmarks: vi.fn(),
            addAvailableTags: vi.fn(),
            whenReady: vi.fn().mockResolvedValue(undefined)
        };
        mockUsefulnessService = {
            getRatingForBookmark: vi.fn(),
            setAiScores: vi.fn(),
            whenReady: vi.fn().mockResolvedValue(undefined)
        };

        TestBed.configureTestingModule({
            providers: [
                AiService,
                { provide: AiStore, useValue: mockAiStore },
                { provide: TagsService, useValue: mockTagsService },
                { provide: UsefulnessService, useValue: mockUsefulnessService }
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
            await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
            const requestSignal = (fetchMock.mock.calls[0][1] as RequestInit).signal;

            service.cancelProcessing();
            await expect(categorization).resolves.toBeUndefined();

            expect(mockAiStore.cancelProcessing).toHaveBeenCalledTimes(1);
            expect(requestSignal?.aborted).toBe(true);
            expect(mockTagsService.setTagsForBookmarks).not.toHaveBeenCalled();
            expect(mockAiStore.updateProgress).toHaveBeenLastCalledWith({
                isProcessing: false,
                isPaused: false,
                operation: null
            });
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

        it('requires restart when the tag pool changed after the checkpoint', async () => {
            checkpointValue = (service as any).createCheckpoint('tags', ['1'], ['ExistingTag']);
            checkpointValue = { ...checkpointValue, status: 'interrupted' };
            mockTagsService.availableTags.mockReturnValue(['ChangedTag']);

            await expect(service.resumeCheckpoint([
                { id: '1', title: 'Bookmark', url: 'https://example.com' }
            ])).rejects.toThrow('AI configuration changed. Discard this job and start it again.');

            expect(checkpointValue.status).toBe('failed');
        });
    });

    describe('scoreUsefulness', () => {
        const bookmarks = [1, 2, 3, 4, 5].map(score => ({
            id: String(score),
            title: `Bookmark ${score}`,
            url: `https://${score}.example`,
            dateAdded: 123,
            dateLastUsed: 456
        })) as chrome.bookmarks.BookmarkTreeNode[];

        it('sends only id, title, and URL and returns all rubric scores', async () => {
            const fetchMock = vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({
                    choices: [{
                        message: {
                            content: JSON.stringify({
                                results: bookmarks.map((bookmark, index) => ({
                                    id: bookmark.id,
                                    score: index + 1
                                }))
                            })
                        }
                    }]
                })
            });
            vi.stubGlobal('fetch', fetchMock);

            await expect(service.scoreUsefulness(bookmarks)).resolves.toEqual({
                '1': 1,
                '2': 2,
                '3': 3,
                '4': 4,
                '5': 5
            });

            const body = JSON.parse(fetchMock.mock.calls[0][1].body);
            const prompt = body.messages[1].content as string;
            expect(prompt).toContain('1 — very low expected future value');
            expect(prompt).toContain('2 — limited, narrow, or easily replaceable value');
            expect(prompt).toContain('3 — useful in a specific situation');
            expect(prompt).toContain('4 — strong, reusable reference or tool');
            expect(prompt).toContain('5 — exceptional, distinctive, or repeatedly valuable');
            expect(prompt).toContain('Treat 3 as the ordinary default. Reserve 1 and 5 for clear cases.');
            expect(prompt).not.toContain('dateAdded');
            expect(prompt).not.toContain('dateLastUsed');
            expect(body.response_format.json_schema.schema.properties.results.items.properties.score)
                .toEqual({ type: 'integer', minimum: 1, maximum: 5 });
        });

        it.each([
            ['missing result', [{ id: '1', score: 3 }]],
            ['duplicate id', [{ id: '1', score: 3 }, { id: '1', score: 4 }]],
            ['unknown id', [{ id: '1', score: 3 }, { id: 'unknown', score: 4 }]],
            ['out-of-range score', [{ id: '1', score: 3 }, { id: '2', score: 6 }]],
            ['fractional score', [{ id: '1', score: 3 }, { id: '2', score: 2.5 }]],
            ['additional property', [{ id: '1', score: 3 }, { id: '2', score: 4, reason: 'extra' }]]
        ])('rejects an invalid response with a %s', async (_label, results) => {
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({
                    choices: [{ message: { content: JSON.stringify({ results }) } }]
                })
            }));

            await expect(service.scoreUsefulness(bookmarks.slice(0, 2)))
                .rejects.toThrow('AI returned invalid usefulness ratings');
        });

        it('rejects folders before making a request', async () => {
            const fetchMock = vi.fn();
            vi.stubGlobal('fetch', fetchMock);

            await expect(service.scoreUsefulness([{ id: 'folder', title: 'Folder' }]))
                .rejects.toThrow('Usefulness can only be scored for bookmarks with URLs');
            expect(fetchMock).not.toHaveBeenCalled();
        });
    });

    describe('rateUsefulnessInBulk', () => {
        const tree = [{
            id: 'root',
            title: 'Root',
            children: [
                { id: 'unscored', title: 'Unscored', url: 'https://unscored.example' },
                { id: 'ai', title: 'AI', url: 'https://ai.example' },
                { id: 'manual', title: 'Manual', url: 'https://manual.example' }
            ]
        }] as chrome.bookmarks.BookmarkTreeNode[];

        beforeEach(() => {
            mockUsefulnessService.getRatingForBookmark.mockImplementation((id: string) => {
                if (id === 'ai') return { score: 2, source: 'ai' };
                if (id === 'manual') return { score: 5, source: 'manual' };
                return undefined;
            });
        });

        it('rates only unscored bookmarks', async () => {
            vi.spyOn(service, 'scoreUsefulness').mockResolvedValue({ unscored: 4 });

            await service.rateUsefulnessInBulk(tree, 'unscored');

            expect(service.scoreUsefulness).toHaveBeenCalledWith(
                [expect.objectContaining({ id: 'unscored' })],
                expect.any(AbortSignal)
            );
            expect(mockUsefulnessService.setAiScores).toHaveBeenCalledWith({ unscored: 4 });
        });

        it('re-rates only AI scores and preserves manual scores', async () => {
            vi.spyOn(service, 'scoreUsefulness').mockResolvedValue({ ai: 3 });

            await service.rateUsefulnessInBulk(tree, 'rerate-ai');

            expect(service.scoreUsefulness).toHaveBeenCalledWith(
                [expect.objectContaining({ id: 'ai' })],
                expect.any(AbortSignal)
            );
            expect(mockUsefulnessService.setAiScores).toHaveBeenCalledWith({ ai: 3 });
        });

        it('keeps completed batches and does not apply the failing batch', async () => {
            const manyBookmarks = Array.from({ length: 11 }, (_, index) => ({
                id: String(index),
                title: `Bookmark ${index}`,
                url: `https://${index}.example`
            })) as chrome.bookmarks.BookmarkTreeNode[];
            mockUsefulnessService.getRatingForBookmark.mockReturnValue(undefined);
            vi.spyOn(service, 'scoreUsefulness')
                .mockResolvedValueOnce(Object.fromEntries(
                    manyBookmarks.slice(0, 10).map(bookmark => [bookmark.id, 3])
                ) as any)
                .mockRejectedValueOnce(new Error('Invalid batch'));

            await expect(service.rateUsefulnessInBulk(manyBookmarks, 'unscored'))
                .rejects.toThrow('Invalid batch');

            expect(mockUsefulnessService.setAiScores).toHaveBeenCalledTimes(1);
            expect(mockUsefulnessService.setAiScores).toHaveBeenCalledWith(
                Object.fromEntries(manyBookmarks.slice(0, 10).map(bookmark => [bookmark.id, 3]))
            );
            expect(checkpointValue.nextCursor).toBe(10);
            expect(checkpointValue.status).toBe('failed');
            expect(checkpointValue.lastError).toBe('Invalid batch');
        });

        it('re-resolves deleted bookmarks and protects new manual ratings when resumed', async () => {
            const treeOnResume = [{
                id: 'root',
                title: 'Root',
                children: [
                    { id: 'manual-now', title: 'Manual now', url: 'https://manual.example' },
                    { id: 'eligible', title: 'Eligible', url: 'https://eligible.example' }
                ]
            }] as chrome.bookmarks.BookmarkTreeNode[];
            checkpointValue = (service as any).createCheckpoint(
                'usefulness-unscored',
                ['deleted', 'manual-now', 'eligible']
            );
            checkpointValue = { ...checkpointValue, status: 'interrupted' };
            mockUsefulnessService.getRatingForBookmark.mockImplementation((id: string) =>
                id === 'manual-now' ? { score: 5, source: 'manual' } : undefined
            );
            vi.spyOn(service, 'scoreUsefulness').mockResolvedValue({ eligible: 4 });

            await service.resumeCheckpoint(treeOnResume);

            expect(service.scoreUsefulness).toHaveBeenCalledWith(
                [expect.objectContaining({ id: 'eligible' })],
                expect.any(AbortSignal)
            );
            expect(mockUsefulnessService.setAiScores).toHaveBeenCalledWith({ eligible: 4 });
            expect(mockAiStore.discardCheckpoint).toHaveBeenCalledTimes(1);
        });

        it('requires restart when relevant AI configuration changed', async () => {
            checkpointValue = (service as any).createCheckpoint('usefulness-unscored', ['unscored']);
            checkpointValue = { ...checkpointValue, status: 'interrupted' };
            mockAiStore.aiConfig.mockReturnValue({
                baseUrl: 'http://localhost:11434/v1',
                apiKey: 'a-different-secret-does-not-matter',
                model: 'a-different-model',
                allowNewTags: false
            });

            await expect(service.resumeCheckpoint(tree)).rejects.toThrow(
                'AI configuration changed. Discard this job and start it again.'
            );
            expect(checkpointValue.status).toBe('failed');
            expect(mockUsefulnessService.setAiScores).not.toHaveBeenCalled();
        });

        it('does not include API key contents in the configuration fingerprint', () => {
            const first = (service as any).configurationFingerprint('usefulness-unscored', 1);
            mockAiStore.aiConfig.mockReturnValue({
                baseUrl: 'http://localhost:11434/v1',
                apiKey: 'rotated-secret',
                model: 'llama3:latest',
                allowNewTags: false
            });

            expect((service as any).configurationFingerprint('usefulness-unscored', 1)).toBe(first);
        });

        it('retries a transient network failure three times before succeeding', async () => {
            mockUsefulnessService.getRatingForBookmark.mockReturnValue(undefined);
            vi.spyOn(service as any, 'delay').mockResolvedValue(undefined);
            vi.spyOn(service, 'scoreUsefulness')
                .mockRejectedValueOnce(new TypeError('network'))
                .mockRejectedValueOnce(new TypeError('network'))
                .mockRejectedValueOnce(new TypeError('network'))
                .mockResolvedValueOnce({ unscored: 4 });

            await service.rateUsefulnessInBulk(tree, 'unscored');

            expect(service.scoreUsefulness).toHaveBeenCalledTimes(4);
            expect((service as any).delay).toHaveBeenCalledTimes(3);
            expect(mockUsefulnessService.setAiScores).toHaveBeenCalledWith({ unscored: 4 });
        });

        it.each([429, 503])('retries transient HTTP %s responses', async (status) => {
            mockUsefulnessService.getRatingForBookmark.mockImplementation((id: string) =>
                id === 'unscored' ? undefined : { score: 5, source: 'manual' }
            );
            vi.spyOn(service as any, 'delay').mockResolvedValue(undefined);
            const success = {
                ok: true,
                json: () => Promise.resolve({
                    choices: [{ message: { content: JSON.stringify({
                        results: [{ id: 'unscored', score: 4 }]
                    }) } }]
                })
            };
            const failure = {
                ok: false,
                status,
                statusText: 'temporary',
                text: () => Promise.resolve('retry')
            };
            const fetchMock = vi.fn()
                .mockResolvedValueOnce(failure)
                .mockResolvedValueOnce(failure)
                .mockResolvedValueOnce(failure)
                .mockResolvedValueOnce(success);
            vi.stubGlobal('fetch', fetchMock);

            await service.rateUsefulnessInBulk(tree, 'unscored');

            expect(fetchMock).toHaveBeenCalledTimes(4);
            expect((service as any).delay).toHaveBeenCalledTimes(3);
        });

        it('stops on a schema failure without retrying or advancing the cursor', async () => {
            mockUsefulnessService.getRatingForBookmark.mockImplementation((id: string) =>
                id === 'unscored' ? undefined : { score: 5, source: 'manual' }
            );
            vi.spyOn(service as any, 'delay').mockResolvedValue(undefined);
            const fetchMock = vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({
                    choices: [{ message: { content: JSON.stringify({ results: [] }) } }]
                })
            });
            vi.stubGlobal('fetch', fetchMock);

            await expect(service.rateUsefulnessInBulk(tree, 'unscored'))
                .rejects.toThrow('AI returned invalid usefulness ratings');

            expect(fetchMock).toHaveBeenCalledTimes(1);
            expect((service as any).delay).not.toHaveBeenCalled();
            expect(checkpointValue.nextCursor).toBe(0);
            expect(checkpointValue.status).toBe('failed');
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
