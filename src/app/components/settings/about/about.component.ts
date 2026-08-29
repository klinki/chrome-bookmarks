import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './about.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./about.component.css']
})
export class AboutComponent {
  version = environment.version;
  buildDate = environment.date;
  commitHash = environment.commitHash;
}
