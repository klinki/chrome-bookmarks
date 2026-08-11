import { inject, Injectable } from '@angular/core';
import { AiJobCheckpoint, AiOperation, AiStore } from './ai.store';
import { TagsService } from './tags.service';
import { developmentLogger } from './development-logger';
import {
    isUsefulnessScore,
    USEFULNESS_RUBRIC,
    UsefulnessScore,
    UsefulnessService
} from './usefulness.service';

export type UsefulnessBulkMode = 'unscored' | 'rerate-ai';

export interface AiProvider {
    name: string;
    discoveryUrl: string;
    completionUrl: string;
}

const AI_BATCH_SIZE = 10;
const TAG_PROMPT_VERSION = 1;
const USEFULNESS_PROMPT_VERSION = 1;

class AiHttpError extends Error {
    constructor(public readonly status: number, message: string) {
        super(message);
        this.name = 'AiHttpError';
    }
}

@Injectable({
    providedIn: 'root'
})
export class AiService {
    private store = inject(AiStore);
    private tagsService = inject(TagsService);
    private usefulnessService = inject(UsefulnessService);
    private activeProcessing: AbortController | null = null;

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
            throw new AiHttpError(
                response.status,
                `AI API error: ${response.status} ${response.statusText} - ${errorText}`
            );
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
        } catch (error) {
            developmentLogger.error('ai.response.parse.failed', error);
            throw new Error('AI returned invalid JSON');
        }
    }

    public async scoreUsefulness(
        bookmarks: chrome.bookmarks.BookmarkTreeNode[],
        signal?: AbortSignal
    ): Promise<Record<string, UsefulnessScore>> {
        if (bookmarks.length === 0) {
            return {};
        }
        if (bookmarks.some(bookmark => !bookmark.url)) {
            throw new Error('Usefulness can only be scored for bookmarks with URLs');
        }

        const config = this.store.aiConfig();
        if (!config.baseUrl) {
            throw new Error('AI Base URL is not configured');
        }

        const bookmarksData = bookmarks.map(bookmark => ({
            id: bookmark.id,
            title: bookmark.title,
            url: bookmark.url
        }));
        const rubric = USEFULNESS_RUBRIC
            .map(item => `${item.score} — ${item.description}`)
            .join('\n');
        const prompt = `
You are a bookmark usefulness classifier. Estimate the general expected future utility of every bookmark using only its title and URL.

Rating rubric:
${rubric}

Treat 3 as the ordinary default. Reserve 1 and 5 for clear cases.

Bookmarks to rate:
${JSON.stringify(bookmarksData, null, 2)}

Return one result for every bookmark. Each result must contain exactly the bookmark id and an integer score from 1 to 5.
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
                        content: 'You classify bookmark usefulness. You output ONLY valid JSON.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.1,
                response_format: {
                    type: 'json_schema',
                    json_schema: {
                        name: 'bookmark_usefulness_response',
                        strict: true,
                        schema: {
                            type: 'object',
                            properties: {
                                results: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            id: { type: 'string' },
                                            score: {
                                                type: 'integer',
                                                minimum: 1,
                                                maximum: 5
                                            }
                                        },
                                        required: ['id', 'score'],
                                        additionalProperties: false
                                    }
                                }
                            },
                            required: ['results'],
                            additionalProperties: false
                        }
                    }
                }
            }),
            signal
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new AiHttpError(
                response.status,
                `AI API error: ${response.status} ${response.statusText} - ${errorText}`
            );
        }

        try {
            const result = await response.json();
            const parsed = JSON.parse(result.choices[0].message.content) as unknown;
            return this.validateUsefulnessResponse(parsed, bookmarksData.map(bookmark => bookmark.id));
        } catch (error) {
            developmentLogger.error('ai.usefulness.response.invalid', error);
            throw new Error('AI returned invalid usefulness ratings');
        }
    }

    public async categorizeAll(
        bookmarks: chrome.bookmarks.BookmarkTreeNode[],
        availableTags: string[]
    ): Promise<void> {
        await this.waitForMetadata();
        const candidateIds = this.flattenBookmarks(bookmarks)
            .filter(bookmark => Boolean(bookmark.url))
            .map(bookmark => bookmark.id);
        const checkpoint = this.createCheckpoint('tags', candidateIds, availableTags);
        this.store.setCheckpoint(checkpoint);
        await this.runCheckpoint(bookmarks, checkpoint);
    }

    public async rateUsefulnessInBulk(
        bookmarks: chrome.bookmarks.BookmarkTreeNode[],
        mode: UsefulnessBulkMode
    ): Promise<void> {
        await this.waitForMetadata();
        const candidateIds = this.flattenBookmarks(bookmarks).filter(bookmark => {
            if (!bookmark.url) {
                return false;
            }
            const rating = this.usefulnessService.getRatingForBookmark(bookmark.id);
            return mode === 'unscored' ? rating === undefined : rating?.source === 'ai';
        }).map(bookmark => bookmark.id);
        const operation = mode === 'unscored' ? 'usefulness-unscored' : 'usefulness-rerate';
        const checkpoint = this.createCheckpoint(operation, candidateIds);
        this.store.setCheckpoint(checkpoint);
        await this.runCheckpoint(bookmarks, checkpoint);
    }

    public cancelProcessing(): void {
        this.store.cancelProcessing();
        this.activeProcessing?.abort();
    }

    /** @deprecated Use cancelProcessing for the shared AI job. */
    public cancelCategorization(): void {
        this.cancelProcessing();
    }

    public async resumeCheckpoint(bookmarks: chrome.bookmarks.BookmarkTreeNode[]): Promise<void> {
        await this.waitForMetadata();
        const checkpoint = this.store.checkpoint();
        if (!checkpoint) {
            throw new Error('No AI job is available to resume');
        }
        const currentTagPool = checkpoint.operation === 'tags'
            ? this.normalizeTagPool(this.tagsService.availableTags())
            : undefined;
        const expectedFingerprint = this.configurationFingerprint(
            checkpoint.operation,
            checkpoint.promptVersion,
            currentTagPool
        );
        if (expectedFingerprint !== checkpoint.configurationFingerprint) {
            const message = 'AI configuration changed. Discard this job and start it again.';
            this.store.updateCheckpoint({ status: 'failed', lastError: message });
            throw new Error(message);
        }
        this.store.updateCheckpoint({ status: 'running', lastError: undefined });
        await this.runCheckpoint(bookmarks, this.store.checkpoint()!);
    }

    public discardCheckpoint(): void {
        if (this.activeProcessing) {
            this.activeProcessing.abort();
            this.activeProcessing = null;
        }
        this.store.discardCheckpoint();
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

    private startProcessing(checkpoint: AiJobCheckpoint): AbortController {
        if (this.activeProcessing) {
            throw new Error('Another AI job is already running');
        }
        const controller = new AbortController();
        this.activeProcessing = controller;
        this.store.updateProgress({
            total: checkpoint.total,
            processed: checkpoint.nextCursor,
            isProcessing: true,
            isPaused: checkpoint.status === 'paused',
            isCancelled: false,
            currentBatch: '',
            operation: checkpoint.operation
        });
        return controller;
    }

    private async waitWhilePaused(signal: AbortSignal): Promise<void> {
        while (this.store.progress.isPaused()
            && !signal.aborted
            && !this.store.progress.isCancelled()) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    private createCheckpoint(
        operation: AiOperation,
        candidateIds: string[],
        tagPoolSnapshot?: string[]
    ): AiJobCheckpoint {
        if (this.store.checkpoint()) {
            throw new Error('An unfinished AI job exists. Resume or discard it first.');
        }
        const promptVersion = operation === 'tags' ? TAG_PROMPT_VERSION : USEFULNESS_PROMPT_VERSION;
        const normalizedTagPool = operation === 'tags'
            ? this.normalizeTagPool(tagPoolSnapshot ?? [])
            : undefined;
        const now = Date.now();
        return {
            version: 1,
            operation,
            candidateIds: Array.from(new Set(candidateIds)),
            nextCursor: 0,
            total: new Set(candidateIds).size,
            createdAt: now,
            updatedAt: now,
            promptVersion,
            configurationFingerprint: this.configurationFingerprint(
                operation,
                promptVersion,
                normalizedTagPool
            ),
            ...(normalizedTagPool ? { tagPoolSnapshot: normalizedTagPool } : {}),
            status: 'running'
        };
    }

    private async runCheckpoint(
        bookmarks: chrome.bookmarks.BookmarkTreeNode[],
        initialCheckpoint: AiJobCheckpoint
    ): Promise<void> {
        const controller = this.startProcessing(initialCheckpoint);
        const nodeMap = new Map(this.flattenBookmarks(bookmarks).map(bookmark => [bookmark.id, bookmark]));

        try {
            let checkpoint = initialCheckpoint;
            while (checkpoint.nextCursor < checkpoint.total) {
                if (controller.signal.aborted || this.store.progress.isCancelled()) {
                    return;
                }
                await this.waitWhilePaused(controller.signal);
                if (controller.signal.aborted || this.store.progress.isCancelled()) {
                    return;
                }

                const nextCursor = Math.min(checkpoint.nextCursor + AI_BATCH_SIZE, checkpoint.total);
                const candidateIds = checkpoint.candidateIds.slice(checkpoint.nextCursor, nextCursor);
                const batch = candidateIds
                    .map(id => nodeMap.get(id))
                    .filter((bookmark): bookmark is chrome.bookmarks.BookmarkTreeNode =>
                        Boolean(bookmark?.url) && this.isStillEligible(checkpoint.operation, bookmark!.id));
                this.store.updateProgress({
                    currentBatch: `${checkpoint.operation === 'tags' ? 'Processing' : 'Rating'} ${checkpoint.nextCursor + 1} to ${nextCursor} of ${checkpoint.total}...`
                });

                let tagPoolUpdate: Pick<AiJobCheckpoint, 'tagPoolSnapshot' | 'configurationFingerprint'> | undefined;
                if (batch.length > 0) {
                    if (checkpoint.operation === 'tags') {
                        const suggestions = await this.withTransientRetries(
                            () => this.suggestTags(batch, checkpoint.tagPoolSnapshot ?? [], controller.signal),
                            controller.signal
                        );
                        if (controller.signal.aborted || this.store.progress.isCancelled()) {
                            return;
                        }
                        const tagUpdates: Record<string, string[]> = {};
                        const newAvailableTags: string[] = [];
                        for (const [id, tags] of Object.entries(suggestions)) {
                            const current = this.tagsService.getTagsForBookmark(id);
                            tagUpdates[id] = Array.from(new Set([...current, ...tags]));
                            newAvailableTags.push(...tags);
                        }
                        this.tagsService.setTagsForBookmarks(tagUpdates);
                        this.tagsService.addAvailableTags(newAvailableTags);
                        const tagPoolSnapshot = this.normalizeTagPool(this.tagsService.availableTags());
                        tagPoolUpdate = {
                            tagPoolSnapshot,
                            configurationFingerprint: this.configurationFingerprint(
                                checkpoint.operation,
                                checkpoint.promptVersion,
                                tagPoolSnapshot
                            )
                        };
                    } else {
                        const scores = await this.withTransientRetries(
                            () => this.scoreUsefulness(batch, controller.signal),
                            controller.signal
                        );
                        if (controller.signal.aborted || this.store.progress.isCancelled()) {
                            return;
                        }
                        this.usefulnessService.setAiScores(scores);
                    }
                }

                this.store.updateCheckpoint({
                    nextCursor,
                    status: 'running',
                    lastError: undefined,
                    ...tagPoolUpdate
                });
                this.store.updateProgress({ processed: nextCursor });
                checkpoint = this.store.checkpoint()!;
            }

            this.store.discardCheckpoint();
        } catch (error) {
            if (!controller.signal.aborted) {
                const message = error instanceof Error ? error.message : String(error);
                this.store.updateCheckpoint({ status: 'failed', lastError: message });
                throw error;
            }
        } finally {
            if (this.activeProcessing === controller) {
                this.activeProcessing = null;
                this.store.updateProgress({
                    isProcessing: false,
                    isPaused: false,
                    operation: null
                });
            }
        }
    }

    private isStillEligible(operation: AiOperation, bookmarkId: string): boolean {
        if (operation === 'tags') {
            return true;
        }
        const rating = this.usefulnessService.getRatingForBookmark(bookmarkId);
        return operation === 'usefulness-unscored'
            ? rating === undefined
            : rating?.source === 'ai';
    }

    private async waitForMetadata(): Promise<void> {
        await Promise.all([
            this.tagsService.whenReady?.() ?? Promise.resolve(),
            this.usefulnessService.whenReady?.() ?? Promise.resolve()
        ]);
    }

    private configurationFingerprint(
        operation: AiOperation,
        promptVersion: number,
        tagPoolSnapshot?: string[]
    ): string {
        const config = this.store.aiConfig();
        return this.fnv1a(JSON.stringify({
            operation,
            promptVersion,
            baseUrl: config.baseUrl.replace(/\/+$/, ''),
            model: config.model,
            ...(operation === 'tags' ? {
                allowNewTags: Boolean(config.allowNewTags),
                tagPoolSnapshot: tagPoolSnapshot ?? []
            } : {})
        }));
    }

    private normalizeTagPool(tags: string[]): string[] {
        return Array.from(new Set(tags)).sort((left, right) => left.localeCompare(right));
    }

    private fnv1a(value: string): string {
        let hash = 0x811c9dc5;
        for (let index = 0; index < value.length; index += 1) {
            hash ^= value.charCodeAt(index);
            hash = Math.imul(hash, 0x01000193);
        }
        return (hash >>> 0).toString(16).padStart(8, '0');
    }

    private async withTransientRetries<T>(
        operation: () => Promise<T>,
        signal: AbortSignal
    ): Promise<T> {
        const delays = [1_000, 2_000, 4_000];
        for (let attempt = 0; ; attempt += 1) {
            try {
                return await operation();
            } catch (error) {
                if (signal.aborted || attempt >= delays.length || !this.isTransientError(error)) {
                    throw error;
                }
                await this.delay(delays[attempt], signal);
            }
        }
    }

    private isTransientError(error: unknown): boolean {
        return error instanceof TypeError
            || (error instanceof AiHttpError
                && (error.status === 429 || error.status >= 500));
    }

    private delay(milliseconds: number, signal: AbortSignal): Promise<void> {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(resolve, milliseconds);
            signal.addEventListener('abort', () => {
                clearTimeout(timeout);
                reject(new DOMException('The operation was aborted', 'AbortError'));
            }, { once: true });
        });
    }

    private validateUsefulnessResponse(
        value: unknown,
        expectedIds: string[]
    ): Record<string, UsefulnessScore> {
        if (!this.isRecord(value) || !Array.isArray(value['results'])) {
            throw new Error('Usefulness response must contain a results array');
        }

        const expected = new Set(expectedIds);
        const output: Record<string, UsefulnessScore> = {};
        for (const item of value['results']) {
            if (!this.isRecord(item)
                || Object.keys(item).length !== 2
                || typeof item['id'] !== 'string'
                || !expected.has(item['id'])
                || item['id'] in output
                || !isUsefulnessScore(item['score'])) {
                throw new Error('Usefulness response contains an invalid result');
            }
            output[item['id']] = item['score'];
        }

        if (Object.keys(output).length !== expected.size) {
            throw new Error('Usefulness response is missing bookmark results');
        }
        return output;
    }

    private isRecord(value: unknown): value is Record<string, unknown> {
        return typeof value === 'object' && value !== null && !Array.isArray(value);
    }
}
