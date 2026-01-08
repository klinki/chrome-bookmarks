import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { BookmarksStore } from '../../services/bookmarks.store';
import { TagsService } from '../../services/tags.service';
import { AiService } from '../../services/ai.service';
import { BookmarksProviderService } from '../../services/bookmarks-provider.service';

@Component({
  selector: 'app-ai-settings',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
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

  public configForm = this.fb.group({
    baseUrl: [this.store.prefs.aiConfig().baseUrl],
    apiKey: [this.store.prefs.aiConfig().apiKey],
    model: [this.store.prefs.aiConfig().model]
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
}
