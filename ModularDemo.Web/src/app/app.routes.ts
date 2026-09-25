import { Routes } from '@angular/router';
import { ContentPage } from './content/content-page';

// Umbraco owns the URL structure: every path is resolved by the CMS.
export const routes: Routes = [{ path: '**', component: ContentPage }];
