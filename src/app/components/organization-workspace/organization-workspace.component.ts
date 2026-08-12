import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CdkFixedSizeVirtualScroll, CdkVirtualForOf, CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { RouterLink } from '@angular/router';
import { BookmarksFacadeService } from '../../services/bookmarks-facade.service';
import { BookmarksProviderService } from '../../services/bookmarks-provider.service';
import { EmbeddingService, stableFingerprint } from '../../services/embedding.service';
import { defaultTopicCount } from '../../services/organization-engine';
import { OrganizationPlannerService } from '../../services/organization-planner.service';
import { OrganizationInput, OrganizationPlan, OrganizationProposal, OrganizationScope } from '../../services/organization.types';
import { QuarantineService } from '../../services/quarantine.service';
import { TagsService } from '../../services/tags.service';
import { UsefulnessService } from '../../services/usefulness.service';
import { OrganizationApplyService } from '../../services/organization-apply.service';

@Component({
  standalone: true,
  selector: 'app-organization-workspace',
  imports: [FormsModule, RouterLink, CdkFixedSizeVirtualScroll, CdkVirtualForOf, CdkVirtualScrollViewport],
  templateUrl: './organization-workspace.component.html',
  styleUrls: ['./organization-workspace.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrganizationWorkspaceComponent {
  private provider = inject(BookmarksProviderService);
  private facade = inject(BookmarksFacadeService);
  private tags = inject(TagsService);
  private usefulness = inject(UsefulnessService);
  private quarantine = inject(QuarantineService);
  private embeddings = inject(EmbeddingService);
  private planner = inject(OrganizationPlannerService);
  private applyService = inject(OrganizationApplyService);

  public scopeType = signal<OrganizationScope['type']>('all');
  public scopeId = signal('');
  public destinationRootId = signal('');
  public topicCount = signal(1);
  public plan = signal<OrganizationPlan | null>(null);
  public isGenerating = signal(false);
  public error = signal('');
  public message = signal('');
  public folders = computed(() => Object.values(this.facade.bookmarksMap()).filter(node => !node.url && node.parentId));
  public collections = this.facade.smartCollectionsService.collections;
  public proposals = computed(() => this.plan()?.proposals ?? []);

  public async generate(): Promise<void> {
    this.error.set('');
    if (!this.destinationRootId()) { this.error.set('Choose an existing destination root.'); return; }
    this.isGenerating.set(true);
    try {
      const tree = await this.provider.getBookmarks();
      const pathById = new Map<string, string>();
      const nodes = flatten(tree, pathById).filter(node => Boolean(node.url));
      const quarantined = new Set(Object.keys(this.quarantine.records()));
      const scoped = this.applyScope(nodes).filter(node => !quarantined.has(node.id));
      const inputs: OrganizationInput[] = scoped.map(node => {
        const input = {
          id: node.id, title: node.title, url: node.url!, path: pathById.get(node.id) ?? '',
          tags: this.tags.getTagsForBookmark(node.id),
          usefulness: this.usefulness.getRatingForBookmark(node.id)?.score
        };
        return { ...input, fingerprint: stableFingerprint(JSON.stringify(input)) };
      });
      if (inputs.length === 0) throw new Error('The selected scope has no eligible bookmarks.');
      const max = Math.min(inputs.length, 100);
      const count = Math.max(1, Math.min(this.topicCount() || defaultTopicCount(inputs.length), max));
      this.topicCount.set(count);
      const vectors = await this.embeddings.embed(inputs);
      this.plan.set(await this.planner.generate(
        inputs, vectors, this.destinationRootId(), this.currentScope(), count
      ));
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Organization plan generation failed');
    } finally { this.isGenerating.set(false); }
  }

  public toggleProposal(proposal: OrganizationProposal, selected: boolean): void {
    this.updateProposal(proposal.bookmarkId, { selected });
  }
  public excludeProposal(proposal: OrganizationProposal, excluded: boolean): void {
    this.updateProposal(proposal.bookmarkId, { excluded, selected: excluded ? false : proposal.selected });
  }
  public selectCluster(clusterId: string, selected: boolean): void {
    const plan = this.plan(); if (!plan) return;
    this.plan.set({ ...plan, proposals: plan.proposals.map(item =>
      item.clusterId === clusterId && !item.excluded ? { ...item, selected } : item) });
  }
  public renameFolder(clusterId: string, value: string): void {
    const plan = this.plan(); if (!plan || !value.trim()) return;
    const cluster = plan.clusters.find(item => item.id === clusterId); if (!cluster) return;
    const path = [value.trim(), ...cluster.folderPath.slice(1)].slice(0, 2);
    this.plan.set({ ...plan,
      clusters: plan.clusters.map(item => item.id === clusterId ? { ...item, folderPath: path } : item),
      proposals: plan.proposals.map(item => item.clusterId === clusterId ? { ...item, destinationPath: path } : item)
    });
  }

  public async apply(): Promise<void> {
    const plan = this.plan(); if (!plan) return;
    const count = plan.proposals.filter(item => item.selected && !item.excluded).length;
    if (!confirm(`Apply ${count} selected bookmark proposals and approved tag consolidations? A JSON backup will be downloaded first.`)) return;
    try {
      await this.applyService.apply(plan);
      this.message.set('Organization plan applied. You can undo it once.');
    } catch (error) {
      if (error instanceof Error && error.message.includes('undo record')
        && confirm(`${error.message} Continue and replace it?`)) {
        await this.applyService.apply(plan, true); this.message.set('Organization plan applied.'); return;
      }
      this.error.set(error instanceof Error ? error.message : 'Apply failed');
    }
  }

  public async undo(): Promise<void> {
    try { const result = await this.applyService.undo(); this.message.set(`Undo restored ${result.restored} changes; ${result.conflicts} conflicts were left untouched.`); }
    catch (error) { this.error.set(error instanceof Error ? error.message : 'Undo failed'); }
  }

  private updateProposal(bookmarkId: string, changes: Partial<OrganizationProposal>): void {
    const plan = this.plan(); if (!plan) return;
    this.plan.set({ ...plan, proposals: plan.proposals.map(item => item.bookmarkId === bookmarkId ? { ...item, ...changes } : item) });
  }
  private currentScope(): OrganizationScope {
    if (this.scopeType() === 'folder') return { type: 'folder', folderId: this.scopeId() };
    if (this.scopeType() === 'smart-collection') return { type: 'smart-collection', collectionId: this.scopeId() };
    if (this.scopeType() === 'selection') return { type: 'selection', bookmarkIds: this.facade.selectedBookmarks().map(item => item.id) };
    return { type: 'all' };
  }
  private applyScope(nodes: chrome.bookmarks.BookmarkTreeNode[]): chrome.bookmarks.BookmarkTreeNode[] {
    const scope = this.currentScope();
    if (scope.type === 'all') return nodes;
    if (scope.type === 'selection') return nodes.filter(node => scope.bookmarkIds.includes(node.id));
    if (scope.type === 'folder') return nodes.filter(node => isDescendant(node, scope.folderId, this.facade.bookmarksMap()));
    if (this.facade.selectedSmartCollectionId() !== scope.collectionId) throw new Error('Open the Smart Collection before organizing it.');
    const ids = new Set(this.facade.items().map(item => item.id));
    return nodes.filter(node => ids.has(node.id));
  }
}

function flatten(tree: readonly chrome.bookmarks.BookmarkTreeNode[], paths: Map<string, string>): chrome.bookmarks.BookmarkTreeNode[] {
  const output: chrome.bookmarks.BookmarkTreeNode[] = [];
  const visit = (node: chrome.bookmarks.BookmarkTreeNode, parents: string[]) => {
    const path = node.url ? parents : [...parents, node.title];
    paths.set(node.id, path.join(' / ')); output.push(node);
    node.children?.forEach(child => visit(child, path));
  };
  tree.forEach(root => root.children?.forEach(child => visit(child, [])));
  return output;
}
function isDescendant(node: chrome.bookmarks.BookmarkTreeNode, folderId: string, map: Readonly<Record<string, chrome.bookmarks.BookmarkTreeNode>>): boolean {
  let parentId = node.parentId;
  while (parentId) { if (parentId === folderId) return true; parentId = map[parentId]?.parentId; }
  return false;
}
