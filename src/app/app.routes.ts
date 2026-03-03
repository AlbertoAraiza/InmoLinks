import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login/login.component';
import { AccountSettingsComponent } from './features/dashboard/account-settings/account-settings.component';
import { CompleteProfileComponent } from './features/auth/complete-profile/complete-profile.component';
import { authGuard } from './core/guards/auth.guard';
import { DashboardLayoutComponent } from './features/dashboard/dashboard-layout/dashboard-layout.component';
import { PropertyListComponent } from './features/dashboard/property-list/property-list.component';
import { PropertyFormComponent } from './features/dashboard/property-form/property-form.component';
import { PropertyDetailComponent } from './features/public/property-detail/property-detail.component';

export const routes: Routes = [
    { path: 'login', component: LoginComponent },
    { path: 'complete-profile', component: CompleteProfileComponent, canActivate: [authGuard] },
    {
        path: 'dashboard',
        component: DashboardLayoutComponent,
        canActivate: [authGuard],
        children: [
            { path: '', component: PropertyListComponent, pathMatch: 'full' },
            { path: 'new', component: PropertyFormComponent },
            { path: 'edit/:id', component: PropertyFormComponent },
            { path: 'account', component: AccountSettingsComponent }
        ]
    },
    { path: 'p/:id', component: PropertyDetailComponent },
    { path: '', redirectTo: 'login', pathMatch: 'full' },
    { path: '**', redirectTo: 'login' }
];
