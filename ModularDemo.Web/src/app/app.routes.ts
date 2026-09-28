import { Routes } from '@angular/router';
import { SitePage } from './site/site-page';

// Umbraco owns the URL structure: every path is resolved against the site tree by SitePage.
export const routes: Routes = [{ path: '**', component: SitePage }];
