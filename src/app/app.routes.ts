import { Routes } from '@angular/router';

export const routes: Routes = [
    {
        path: '',
        loadComponent: () => import('./components/bookmarks-view/bookmarks-view.component')
            .then(m => m.BookmarksViewComponent)
    },
    {
        path: 'cleanup',
        loadComponent: () => import('./components/cleanup-center/cleanup-center.component')
            .then(m => m.CleanupCenterComponent)
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
            },
            {
                path: 'about',
                loadComponent: () => import('./components/settings/about/about.component').then(m => m.AboutComponent)
            }
        ]
    }
];
