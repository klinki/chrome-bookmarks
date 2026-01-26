import { ChangeDetectionStrategy, Component, inject, signal, resource, computed, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { BookmarksStore } from '../../services/bookmarks.store';
import { TagsService } from '../../services/tags.service';
import { AiService, AiProvider } from '../../services/ai.service';
import { BookmarksProviderService } from '../../services/bookmarks-provider.service';

@Component({
  selector: 'app-ai-settings',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, FormsModule],
  templateUrl: './ai-settings.component.html',
  styleUrl: './ai-settings.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiSettingsComponent {
  private fb = inject(FormBuilder);
  private store = inject(BookmarksStore);
  private tagsService = inject(TagsService);
  private aiService = inject(AiService);
  private provider = inject(BookmarksProviderService);

  public availableTags = this.tagsService.availableTags;
  public progress = this.store.progress;
  public providers = this.aiService.providers;

  // Model Discovery State using Signals
  public showDiscoveryModal = signal(false);
  public selectedProvider = signal<AiProvider>(this.aiService.providers[0]);
  public selectedDiscoveredModel = signal('');

  // Trigger for discovery resource
  private discoveryTrigger = signal<number>(0);

  // Discovery Resource
  public discoveryResource = resource({
    loader: async () => {
      const trigger = this.discoveryTrigger();
      const showModal = this.showDiscoveryModal();

      if (trigger === 0 || !showModal) {
        return [];
      }

      // We use untracked for provider so it doesn't trigger new requests automatically when changed in the form.
      // New request only happens when 'discoveryTrigger' increments (button click).
      const provider = untracked(() => this.selectedProvider());

      return await this.aiService.discoverProviderModels(provider);
    }
  });

  public discoveredModels = computed(() => this.discoveryResource.value() ?? []);
  public isDiscovering = this.discoveryResource.isLoading;
  public discoveryError = computed(() => this.discoveryResource.error() ? 'Failed to discover models' : '');

  public configForm = this.fb.group({
    baseUrl: [this.store.prefs.aiConfig().baseUrl],
    apiKey: [this.store.prefs.aiConfig().apiKey],
    model: [this.store.prefs.aiConfig().model],
    allowNewTags: [this.store.prefs.aiConfig().allowNewTags]
  });

  public saveConfig() {
    if (this.configForm.valid) {
      this.store.updateAiConfig(this.configForm.value as any);
      this.configForm.markAsPristine();
    }
  }

  public async categorizeAllBookmarks() {
    const tree = await this.provider.getBookmarks();
    await this.aiService.categorizeAll(tree, this.availableTags());
  }

  public togglePause() {
    this.store.togglePause();
  }

  public cancelCategorization() {
    this.store.cancelCategorization();
  }

  public addTag(input: HTMLInputElement) {
    const val = input.value.trim();
    if (val) {
      this.tagsService.addAvailableTag(val);
      input.value = '';
    }
  }

  public removeTag(tag: string) {
    this.tagsService.removeAvailableTag(tag);
  }

  public openDiscovery() {
    this.showDiscoveryModal.set(true);
  }

  public closeDiscovery() {
    this.showDiscoveryModal.set(false);
    this.discoveryTrigger.set(0);
  }

  public onProviderChange(provider: AiProvider) {
    this.selectedProvider.set(provider);
  }

  public async discoverModels() {
    this.discoveryTrigger.update(v => v + 1);
    this.discoveryResource.reload();
  }

  public confirmDiscovery() {
    const selectedModel = this.selectedDiscoveredModel();
    if (selectedModel) {
      const provider = this.selectedProvider();

      this.configForm.patchValue({
        baseUrl: provider.completionUrl,
        model: selectedModel
      });
      this.configForm.markAsDirty();
      this.closeDiscovery();
    }
  }

  public compareProviders(p1: AiProvider, p2: AiProvider): boolean {
    return p1 && p2 ? p1.name === p2.name : p1 === p2;
  }
}
