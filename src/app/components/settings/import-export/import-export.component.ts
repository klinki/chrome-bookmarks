import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ImportExportService } from '../../../services/import-export.service';
import { developmentLogger } from '../../../services/development-logger';

@Component({
  selector: 'app-import-export',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './import-export.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./import-export.component.css']
})
export class ImportExportComponent {
  private importExportService = inject(ImportExportService);

  isLoading = false;
  message = '';
  messageType: 'success' | 'error' = 'success';

  exportJson() {
    this.wrapAction(() => this.importExportService.exportJson(), 'JSON Export successful');
  }

  exportHtml() {
    this.wrapAction(() => this.importExportService.exportHtml(), 'HTML Export successful');
  }

  onJsonFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      this.wrapAction(() => this.importExportService.importJson(file), 'JSON Import successful', true);
    }
  }

  onHtmlFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      this.wrapAction(() => this.importExportService.importHtml(file), 'HTML Import successful');
    }
  }

  private async wrapAction(action: () => Promise<void>, successMessage: string, includeWarnings = false) {
    this.isLoading = true;
    this.message = '';
    try {
      await action();
      const warnings = includeWarnings ? this.importExportService.importWarnings() : [];
      this.message = warnings.length > 0
        ? `${successMessage}. ${warnings.join(' ')}`
        : successMessage;
      this.messageType = 'success';
    } catch (error) {
      developmentLogger.error('bookmarks.import-export.failed', error);
      this.message = 'Error: ' + (error instanceof Error ? error.message : 'Unknown error');
      this.messageType = 'error';
    } finally {
      this.isLoading = false;
    }
  }
}
