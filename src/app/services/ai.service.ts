import { inject, Injectable } from '@angular/core';
import { AiStore } from './ai.store';
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
    private store = inject(AiStore);
    private tagsService = inject(TagsService);
    private activeCategorization: AbortController | null = null;

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

    public async suggestTags(
        bookmarks: chrome.bookmarks.BookmarkTreeNode[],
        availableTags: string[],
        signal?: AbortSignal
    ): Promise<Record<string, string[]>> {
        const config = this.store.aiConfig();
        if (!config.baseUrl) {
            throw new Error('AI Base URL is not configured');
        }

        const availableTagsStr = availableTags.join(', ');
        const bookmarksData = bookmarks.map(b => ({
            id: b.id,
            title: b.title,
            url: b.url
        }));

        const instruction = config.allowNewTags
            ? '2. If none of the available tags are suitable, you can suggest NEW tags if you think they are very relevant, but try to stick to the available ones if possible.'
            : '2. You are RESTRICTED to use ONLY the provided Available Tags. Do NOT create new tags.';

        const prompt = `
You are a bookmark categorization assistant. Your task is to assign relevant tags to each bookmark from the provided list of available tags.

Available Tags: [${availableTagsStr}]

Bookmarks to categorize:
${JSON.stringify(bookmarksData, null, 2)}

Instructions:
1. For each bookmark, choose one or more tags from the "Available Tags" list that best describe the bookmark.
${instruction}
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
            }),
            signal
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
                        let tags = item.tags;
                        if (!config.allowNewTags) {
                            tags = tags.filter((t: string) => availableTags.includes(t));
                        }
                        if (tags.length > 0) {
                            output[item.id] = tags;
                        }
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
        this.activeCategorization?.abort();
        const controller = new AbortController();
        this.activeCategorization = controller;

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
                if (controller.signal.aborted || this.store.progress.isCancelled()) {
                    break;
                }

                while (this.store.progress.isPaused()
                    && !controller.signal.aborted
                    && !this.store.progress.isCancelled()) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }

                if (controller.signal.aborted || this.store.progress.isCancelled()) {
                    break;
                }

                const batch = bookmarksToProcess.slice(i, i + batchSize);
                this.store.updateProgress({
                    currentBatch: `Processing ${i + 1} to ${Math.min(i + batchSize, total)} of ${total}...`
                });

                const suggestions = await this.suggestTags(batch, availableTags, controller.signal);

                const tagUpdates: Record<string, string[]> = {};
                const newAvailableTags: string[] = [];
                for (const [id, tags] of Object.entries(suggestions)) {
                    if (controller.signal.aborted || this.store.progress.isCancelled()) {
                        return;
                    }

                    const current = this.tagsService.getTagsForBookmark(id);
                    tagUpdates[id] = Array.from(new Set([...current, ...tags]));
                    newAvailableTags.push(...tags);
                }
                this.tagsService.setTagsForBookmarks(tagUpdates);
                this.tagsService.addAvailableTags(newAvailableTags);

                this.store.updateProgress({
                    processed: Math.min(i + batch.length, total)
                });
            }
        } catch (error) {
            if (!controller.signal.aborted) {
                throw error;
            }
        } finally {
            if (this.activeCategorization === controller) {
                this.activeCategorization = null;
                this.store.updateProgress({ isProcessing: false });
            }
        }
    }

    public cancelCategorization() {
        this.store.cancelCategorization();
        this.activeCategorization?.abort();
    }

    public async getOllamaModels(baseUrl: string, signal?: AbortSignal): Promise<string[]> {
        // Ollama usually listens on /api/tags for model list
        // If baseUrl is http://localhost:11434/v1, we need to adjust it to http://localhost:11434/api/tags
        const url = new URL(baseUrl);
        const tagsUrl = `${url.protocol}//${url.host}/api/tags`;

        const response = await fetch(tagsUrl, { signal });
        if (!response.ok) {
            throw new Error(`Failed to fetch Ollama models: ${response.statusText}`);
        }

        const data = await response.json();
        return data.models.map((m: any) => m.name);
    }

    public async getLMStudioModels(baseUrl: string, signal?: AbortSignal): Promise<string[]> {
        // LM Studio uses OpenAI-compatible endpoint at /v1/models
        const url = new URL(baseUrl);
        const modelsUrl = `${url.protocol}//${url.host}/v1/models`;

        const response = await fetch(modelsUrl, { signal });
        if (!response.ok) {
            throw new Error(`Failed to fetch LM Studio models: ${response.statusText}`);
        }

        const data = await response.json();
        return data.data.map((m: any) => m.id);
    }

    public async discoverProviderModels(provider: AiProvider, signal?: AbortSignal): Promise<string[]> {
        if (provider.name === 'Ollama') {
            return await this.getOllamaModels(provider.discoveryUrl, signal);
        } else if (provider.name === 'LM Studio') {
            return await this.getLMStudioModels(provider.discoveryUrl, signal);
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
