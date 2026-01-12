import { TestBed } from '@angular/core/testing';
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
                aiConfig: jasmine.createSpy('aiConfig').and.returnValue({
                    baseUrl: 'http://localhost:11434/v1',
                    apiKey: '',
                    model: 'llama3:latest'
                })
            },
            progress: {
                isProcessing: jasmine.createSpy('isProcessing').and.returnValue(false),
                isPaused: jasmine.createSpy('isPaused').and.returnValue(false),
                isCancelled: jasmine.createSpy('isCancelled').and.returnValue(false)
            },
            updateProgress: jasmine.createSpy('updateProgress')
        };

        mockTagsService = {
            getTagsForBookmark: jasmine.createSpy('getTagsForBookmark').and.returnValue([]),
            setTagsForBookmark: jasmine.createSpy('setTagsForBookmark'),
            addAvailableTag: jasmine.createSpy('addAvailableTag')
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
            mockBookmarksStore.prefs.aiConfig.and.returnValue({ baseUrl: '' });

            await expectAsync(service.suggestTags([], []))
                .toBeRejectedWithError('AI Base URL is not configured');
        });
    });

    describe('discoverProviderModels', () => {
        it('should call getOllamaModels for Ollama provider', async () => {
            const ollamaProvider = service.providers.find(p => p.name === 'Ollama')!;
            
            spyOn(service, 'getOllamaModels').and.returnValue(Promise.resolve(['llama3', 'mistral']));
            
            const models = await service.discoverProviderModels(ollamaProvider);
            
            expect(service.getOllamaModels).toHaveBeenCalledWith(ollamaProvider.discoveryUrl);
            expect(models).toEqual(['llama3', 'mistral']);
        });

        it('should call getLMStudioModels for LM Studio provider', async () => {
            const lmStudioProvider = service.providers.find(p => p.name === 'LM Studio')!;
            
            spyOn(service, 'getLMStudioModels').and.returnValue(Promise.resolve(['model-a', 'model-b']));
            
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
});
