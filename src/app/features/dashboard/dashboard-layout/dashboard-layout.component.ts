import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

// Material
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';

import { AuthService } from '../../../core/services/auth.service';
import { Router } from '@angular/router';

@Component({
    selector: 'app-dashboard-layout',
    standalone: true,
    imports: [CommonModule, RouterModule, MatToolbarModule, MatButtonModule, MatIconModule, MatMenuModule],
    templateUrl: './dashboard-layout.component.html'
})
export class DashboardLayoutComponent {
    authService = inject(AuthService);
    router = inject(Router);
    isSidebarOpen = false;

    logout() {
        this.authService.logout().then(() => {
            this.router.navigate(['/login']);
        });
    }
}
