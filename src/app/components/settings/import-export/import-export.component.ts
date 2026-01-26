import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ImportExportService } from '../../../services/import-export.service';

@Component({
  selector: 'app-import-export',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './import-export.component.html',
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
      this.wrapAction(() => this.importExportService.importJson(file), 'JSON Import successful');
    }
  }

  onHtmlFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      this.wrapAction(() => this.importExportService.importHtml(file), 'HTML Import successful');
    }
  }

  private async wrapAction(action: () => Promise<void>, successMessage: string) {
    this.isLoading = true;
    this.message = '';
    try {
      await action();
      this.message = successMessage;
      this.messageType = 'success';
    } catch (e: any) {
      console.error(e);
      this.message = 'Error: ' + (e.message || 'Unknown error');
      this.messageType = 'error';
    } finally {
      this.isLoading = false;
    }
  }
}
