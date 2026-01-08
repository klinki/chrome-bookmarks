import { Routes } from '@angular/router';
import { BookmarksViewComponent } from './components/bookmarks-view/bookmarks-view.component';

export const routes: Routes = [
    {
        path: '',
        component: BookmarksViewComponent
    },
    {
        path: 'settings/ai',
        loadComponent: () => import('./components/ai-settings/ai-settings.component').then(m => m.AiSettingsComponent)
    }
];
