import { Routes } from '@angular/router';
import { BookmarksViewComponent } from './components/bookmarks-view/bookmarks-view.component';

export const routes: Routes = [
    {
        path: '',
        component: BookmarksViewComponent
    },
    {
        path: 'settings',
        loadComponent: () => import('./components/settings/settings.component').then(m => m.SettingsComponent),
        children: [
            {
                path: '',
                redirectTo: 'general',
                pathMatch: 'full'
            },
            {
                path: 'general',
                loadComponent: () => import('./components/settings/general-settings/general-settings.component').then(m => m.GeneralSettingsComponent)
            },
            {
                path: 'ai',
                loadComponent: () => import('./components/ai-settings/ai-settings.component').then(m => m.AiSettingsComponent)
            },
            {
                path: 'import-export',
                loadComponent: () => import('./components/settings/import-export/import-export.component').then(m => m.ImportExportComponent)
            }
        ]
    }
];
