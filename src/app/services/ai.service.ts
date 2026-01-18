import { inject, Injectable } from '@angular/core';
import { BookmarksStore } from './bookmarks.store';
import { TagsService } from './tags.service';

export interface AiProvider {
    name: string;
    discoveryUrl: string;
    completionUrl: string;
}

@Injectable({
    providedIn: 'root'
})
export class AiService {
    private store = inject(BookmarksStore);
    private tagsService = inject(TagsService);

    public readonly providers: AiProvider[] = [
        {
            name: 'Ollama',
            discoveryUrl: 'http://localhost:11434',
            completionUrl: 'http://localhost:11434/v1'
        },
        {
            name: 'LM Studio',
            discoveryUrl: 'http://localhost:1234',
            completionUrl: 'http://localhost:1234'
        }
    ];

    public async suggestTags(bookmarks: chrome.bookmarks.BookmarkTreeNode[], availableTags: string[]): Promise<Record<string, string[]>> {
        const config = this.store.prefs.aiConfig();
        if (!config.baseUrl) {
            throw new Error('AI Base URL is not configured');
        }

        const availableTagsStr = availableTags.join(', ');
        const bookmarksData = bookmarks.map(b => ({
            id: b.id,
            title: b.title,
            url: b.url
        }));

        const prompt = `
You are a bookmark categorization assistant. Your task is to assign relevant tags to each bookmark from the provided list of available tags.

Available Tags: [${availableTagsStr}]

Bookmarks to categorize:
${JSON.stringify(bookmarksData, null, 2)}

Instructions:
1. For each bookmark, choose one or more tags from the "Available Tags" list that best describe the bookmark.
2. If none of the available tags are suitable, you can suggest NEW tags if you think they are very relevant, but try to stick to the available ones if possible.
3. Return the result as a JSON object with a "results" property containing a list of objects, where each object has "id" and "tags" fields.
`;

        const response = await fetch(`${config.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKey}`
            },
            body: JSON.stringify({
                model: config.model,
                messages: [
                    {
                        role: 'system',
                        content: 'You are a helpful assistant that categorizes bookmarks. You output ONLY valid JSON.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.1,
                response_format: {
                    type: "json_schema",
                    json_schema: {
                        name: "categorization_response",
                        strict: true,
                        schema: {
                            type: "object",
                            properties: {
                                results: {
                                    type: "array",
                                    items: {
                                        type: "object",
                                        properties: {
                                            id: { type: "string" },
                                            tags: {
                                                type: "array",
                                                items: { type: "string" }
                                            }
                                        },
                                        required: ["id", "tags"],
                                        additionalProperties: false
                                    }
                                }
                            },
                            required: ["results"],
                            additionalProperties: false
                        }
                    }
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`AI API error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const result = await response.json();
        const content = result.choices[0].message.content;

        try {
            const parsed = JSON.parse(content);
            const output: Record<string, string[]> = {};
            if (parsed && Array.isArray(parsed.results)) {
                for (const item of parsed.results) {
                    if (item.id && Array.isArray(item.tags)) {
                        output[item.id] = item.tags;
                    }
                }
            }
            return output;
        } catch (e) {
            console.error('Failed to parse AI response:', content);
            throw new Error('AI returned invalid JSON');
        }
    }

    public async categorizeAll(bookmarks: chrome.bookmarks.BookmarkTreeNode[], availableTags: string[]) {
        const bookmarksToProcess = this.flattenBookmarks(bookmarks).filter(b => !!b.url);
        const total = bookmarksToProcess.length;
        const batchSize = 10;

        this.store.updateProgress({
            total,
            processed: 0,
            isProcessing: true,
            isPaused: false,
            isCancelled: false,
            currentBatch: ''
        });

        try {
            for (let i = 0; i < total; i += batchSize) {
                // Check for cancellation
                if (this.store.progress.isCancelled()) {
                    break;
                }

                // Handle Pause
                while (this.store.progress.isPaused() && !this.store.progress.isCancelled()) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }

                // Check again for cancellation after potential pause
                if (this.store.progress.isCancelled()) {
                    break;
                }

                const batch = bookmarksToProcess.slice(i, i + batchSize);
                this.store.updateProgress({
                    currentBatch: `Processing ${i + 1} to ${Math.min(i + batchSize, total)} of ${total}...`
                });

                const suggestions = await this.suggestTags(batch, availableTags);

                // Update tags for each bookmark in the batch
                for (const [id, tags] of Object.entries(suggestions)) {
                    // One last check before saving each bookmark in case of fast cancellation
                    if (this.store.progress.isCancelled()) return;

                    const current = this.tagsService.getTagsForBookmark(id);
                    const merged = Array.from(new Set([...current, ...tags]));
                    this.tagsService.setTagsForBookmark(id, merged);

                    tags.forEach(tag => this.tagsService.addAvailableTag(tag));
                }

                this.store.updateProgress({
                    processed: Math.min(i + batch.length, total)
                });
            }
        } finally {
            this.store.updateProgress({ isProcessing: false });
        }
    }

    public async getOllamaModels(baseUrl: string): Promise<string[]> {
        // Ollama usually listens on /api/tags for model list
        // If baseUrl is http://localhost:11434/v1, we need to adjust it to http://localhost:11434/api/tags
        const url = new URL(baseUrl);
        const tagsUrl = `${url.protocol}//${url.host}/api/tags`;

        const response = await fetch(tagsUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch Ollama models: ${response.statusText}`);
        }

        const data = await response.json();
        return data.models.map((m: any) => m.name);
    }

    public async getLMStudioModels(baseUrl: string): Promise<string[]> {
        // LM Studio uses OpenAI-compatible endpoint at /v1/models
        const url = new URL(baseUrl);
        const modelsUrl = `${url.protocol}//${url.host}/v1/models`;

        const response = await fetch(modelsUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch LM Studio models: ${response.statusText}`);
        }

        const data = await response.json();
        return data.data.map((m: any) => m.id);
    }

    public async discoverProviderModels(provider: AiProvider): Promise<string[]> {
        if (provider.name === 'Ollama') {
            return await this.getOllamaModels(provider.discoveryUrl);
        } else if (provider.name === 'LM Studio') {
            return await this.getLMStudioModels(provider.discoveryUrl);
        }
        return [];
    }

    private flattenBookmarks(nodes: chrome.bookmarks.BookmarkTreeNode[]): chrome.bookmarks.BookmarkTreeNode[] {
        const results: chrome.bookmarks.BookmarkTreeNode[] = [];
        const traverse = (list: chrome.bookmarks.BookmarkTreeNode[]) => {
            for (const node of list) {
                results.push(node);
                if (node.children) {
                    traverse(node.children);
                }
            }
        };
        traverse(nodes);
        return results;
    }
}
