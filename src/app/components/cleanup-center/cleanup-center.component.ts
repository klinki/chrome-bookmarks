import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  untracked
} from '@angular/core';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { merge } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CleanupAnalyzerService, StaleCleanupAnalysisError } from '../../services/cleanup-analyzer.service';
import { CleanupSettingsService } from '../../services/cleanup-settings.service';
import { CleanupReason, DuplicateGroup } from '../../services/cleanup.types';
import { QuarantineService } from '../../services/quarantine.service';
import { BookmarksProviderService } from '../../services/bookmarks-provider.service';
import { BulkMutationCoordinatorService } from '../../services/bulk-mutation-coordinator.service';
import { TagsService } from '../../services/tags.service';
import { UsefulnessService } from '../../services/usefulness.service';

interface CleanupView {
  reason: CleanupReason;
  label: string;
}

const CLEANUP_VIEWS: CleanupView[] = [
  { reason: 'exact-duplicate', label: 'Exact duplicate URLs' },
  { reason: 'probable-duplicate', label: 'Probable duplicate URLs' },
  { reason: 'stale', label: 'Stale bookmarks' },
  { reason: 'unknown-usage', label: 'Unknown usage' },
  { reason: 'untagged', label: 'Untagged bookmarks' },
  { reason: 'unrated', label: 'Unrated bookmarks' },
  { reason: 'low-usefulness', label: 'Usefulness 1–2' },
  { reason: 'empty-folder', label: 'Empty folders' },
  { reason: 'quarantined', label: 'Quarantined items' }
];

@Component({
  selector: 'app-cleanup-center',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ScrollingModule],
  templateUrl: './cleanup-center.component.html',
  styleUrl: './cleanup-center.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CleanupCenterComponent implements OnInit {
  private readonly analyzer = inject(CleanupAnalyzerService);
  private readonly settingsService = inject(CleanupSettingsService);
  private readonly quarantine = inject(QuarantineService);
  private readonly provider = inject(BookmarksProviderService);
  private readonly bulkMutations = inject(BulkMutationCoordinatorService);
  private readonly tagsService = inject(TagsService);
  private readonly usefulnessService = inject(UsefulnessService);
  private readonly destroyRef = inject(DestroyRef);
  private initialized = false;

  public readonly views = CLEANUP_VIEWS;
  public readonly selectedReason = signal<CleanupReason>('exact-duplicate');
  public readonly selectedIds = signal<ReadonlySet<string>>(new Set());
  public readonly keeperOverrides = signal<Readonly<Record<string, string>>>({});
  public readonly actionError = signal<string | null>(null);
  public readonly result = this.analyzer.result;
  public readonly analyzing = this.analyzer.analyzing;
  public readonly analysisError = this.analyzer.error;
  public readonly mutationProgress = this.bulkMutations.progress;
  public staleDays = this.settingsService.settings().staleDays;

  public readonly selectedView = computed(() =>
    this.views.find(view => view.reason === this.selectedReason())!);
  public readonly visibleFindings = computed(() =>
    this.result()?.findings.filter(finding =>
      finding.matchedReasons.includes(this.selectedReason())) ?? []);
  public readonly datedUnknownFindings = computed(() =>
    this.visibleFindings().filter(finding => !finding.undated));
  public readonly undatedUnknownFindings = computed(() =>
    this.visibleFindings().filter(finding => finding.undated));
  public readonly visibleGroups = computed(() => {
    const result = this.result();
    if (!result) {
      return [];
    }
    return this.selectedReason() === 'exact-duplicate'
      ? result.exactDuplicateGroups
      : this.selectedReason() === 'probable-duplicate'
        ? result.probableDuplicateGroups
        : [];
  });
  public readonly findingById = computed(() => new Map(
    (this.result()?.findings ?? []).map(finding => [finding.nodeId, finding])
  ));
  public readonly selectedCount = computed(() => this.selectedIds().size);
  public readonly isDuplicateView = computed(() =>
    this.selectedReason() === 'exact-duplicate' || this.selectedReason() === 'probable-duplicate');
  public readonly canQuarantine = computed(() =>
    this.selectedReason() !== 'quarantined'
    && this.selectedCount() > 0
    && !this.mutationProgress().active);
  public readonly canRestoreOrPurge = computed(() =>
    this.selectedReason() === 'quarantined'
    && this.selectedCount() > 0
    && !this.mutationProgress().active);

  constructor() {
    merge(
      this.provider.onCreatedEvent$,
      this.provider.onRemovedEvent$,
      this.provider.onChangedEvent$,
      this.provider.onMovedEvent$
    ).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (this.initialized && !this.bulkMutations.isActive()) {
        this.analyzer.scheduleCurrentLibraryAnalysis();
      }
    });

    effect(() => {
      this.tagsService.bookmarkTags();
      this.usefulnessService.bookmarkUsefulness();
      this.settingsService.settings();
      if (this.initialized) {
        untracked(() => this.analyzer.scheduleCurrentLibraryAnalysis());
      }
    });
  }

  public ngOnInit(): void {
    this.initialized = true;
    void this.refresh();
  }

  public async refresh(): Promise<void> {
    try {
      await this.analyzer.analyzeCurrentLibrary();
    } catch (error) {
      if (!(error instanceof StaleCleanupAnalysisError)) {
        this.actionError.set(error instanceof Error ? error.message : String(error));
      }
    }
  }

  public chooseView(reason: CleanupReason): void {
    this.selectedReason.set(reason);
    this.selectedIds.set(new Set());
  }

  public updateStaleThreshold(): void {
    this.settingsService.update({ staleDays: Math.max(1, Math.round(this.staleDays)) });
    this.staleDays = this.settingsService.settings().staleDays;
    void this.refresh();
  }

  public count(reason: CleanupReason): number {
    return this.result()?.counts[reason] ?? 0;
  }

  public isSelected(nodeId: string): boolean {
    return this.selectedIds().has(nodeId);
  }

  public toggleSelected(nodeId: string, selected: boolean): void {
    const next = new Set(this.selectedIds());
    if (selected) {
      next.add(nodeId);
    } else {
      next.delete(nodeId);
    }
    this.selectedIds.set(next);
  }

  public selectAllVisible(): void {
    const next = new Set(this.selectedIds());
    this.visibleFindings().forEach(finding => next.add(finding.nodeId));
    this.selectedIds.set(next);
  }

  public clearSelection(): void {
    this.selectedIds.set(new Set());
  }

  public keeperFor(group: DuplicateGroup): string {
    return this.keeperOverrides()[group.id] ?? group.keeperId;
  }

  public setKeeper(group: DuplicateGroup, keeperId: string): void {
    this.keeperOverrides.update(overrides => ({ ...overrides, [group.id]: keeperId }));
    const next = new Set(this.selectedIds());
    next.delete(keeperId);
    this.selectedIds.set(next);
  }

  public selectGroupCopies(group: DuplicateGroup): void {
    const keeperId = this.keeperFor(group);
    const next = new Set(this.selectedIds());
    group.bookmarkIds.forEach(nodeId => {
      if (nodeId !== keeperId) {
        next.add(nodeId);
      }
    });
    this.selectedIds.set(next);
  }

  public selectAllExactCopies(): void {
    const next = new Set<string>();
    this.visibleGroups().forEach(group => {
      const keeperId = this.keeperFor(group);
      group.bookmarkIds.forEach(nodeId => {
        if (nodeId !== keeperId) {
          next.add(nodeId);
        }
      });
    });
    this.selectedIds.set(next);
  }

  public findingTitle(nodeId: string): string {
    return this.findingById().get(nodeId)?.title ?? nodeId;
  }

  public async quarantineSelected(): Promise<void> {
    if (!this.canQuarantine()) {
      return;
    }
    const reason = this.selectedReason() as Exclude<CleanupReason, 'quarantined'>;
    if (!window.confirm(`Quarantine ${this.selectedCount()} selected item(s)?`)) {
      return;
    }
    this.actionError.set(null);
    try {
      const tree = await this.provider.getBookmarks();
      const nodeMap = flattenTree(tree);
      const matchedReasonsById = Object.fromEntries(
        this.visibleFindings().map(finding => [finding.nodeId, finding.matchedReasons])
      );
      if (this.isDuplicateView()) {
        for (const group of this.visibleGroups()) {
          const keeperId = this.keeperFor(group);
          const items = group.bookmarkIds
            .filter(nodeId => nodeId !== keeperId && this.selectedIds().has(nodeId))
            .map(nodeId => nodeMap.get(nodeId))
            .filter((node): node is chrome.bookmarks.BookmarkTreeNode => Boolean(node));
          if (items.length > 0) {
            await this.quarantine.quarantine({
              items,
              actionReason: reason,
              matchedReasonsById,
              duplicateKeeperId: keeperId,
              duplicateBookmarkIds: group.bookmarkIds
            });
          }
        }
      } else {
        const items = [...this.selectedIds()]
          .map(nodeId => nodeMap.get(nodeId))
          .filter((node): node is chrome.bookmarks.BookmarkTreeNode => Boolean(node));
        await this.quarantine.quarantine({ items, actionReason: reason, matchedReasonsById });
      }
      this.clearSelection();
      await this.refresh();
    } catch (error) {
      this.actionError.set(error instanceof Error ? error.message : String(error));
    }
  }

  public async restoreSelected(): Promise<void> {
    if (!this.canRestoreOrPurge()) {
      return;
    }
    this.actionError.set(null);
    try {
      await this.quarantine.restore([...this.selectedIds()]);
      this.clearSelection();
      await this.refresh();
    } catch (error) {
      this.actionError.set(error instanceof Error ? error.message : String(error));
    }
  }

  public async purgeSelected(): Promise<void> {
    if (!this.canRestoreOrPurge()
      || !window.confirm(`Permanently delete ${this.selectedCount()} item(s) after creating a JSON backup?`)) {
      return;
    }
    this.actionError.set(null);
    try {
      await this.quarantine.purge([...this.selectedIds()]);
      this.clearSelection();
      await this.refresh();
    } catch (error) {
      this.actionError.set(error instanceof Error ? error.message : String(error));
    }
  }

  public cancelMutation(): void {
    this.bulkMutations.cancel();
  }
}

function flattenTree(
  tree: readonly chrome.bookmarks.BookmarkTreeNode[]
): Map<string, chrome.bookmarks.BookmarkTreeNode> {
  const output = new Map<string, chrome.bookmarks.BookmarkTreeNode>();
  const stack = [...tree];
  while (stack.length > 0) {
    const node = stack.pop()!;
    output.set(node.id, node);
    if (node.children) {
      stack.push(...node.children);
    }
  }
  return output;
}
