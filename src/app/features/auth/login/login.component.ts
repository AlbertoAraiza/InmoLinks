import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';

// Angular Material
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';

// Services
import { AuthService } from '../../../core/services/auth.service';
import Swal from 'sweetalert2';

@Component({
    selector: 'app-login',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        RouterModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatIconModule,
        MatProgressSpinnerModule,
        MatCardModule
    ],
    templateUrl: './login.component.html'
})
export class LoginComponent {
    private fb = inject(FormBuilder);
    private authService = inject(AuthService);
    private router = inject(Router);

    loginForm: FormGroup;
    isLoading = false;
    hidePassword = true;

    constructor() {
        this.loginForm = this.fb.group({
            email: ['', [Validators.required, Validators.email]],
            password: ['', [Validators.required, Validators.minLength(8)]]
        });
    }

    async onSubmit() {
        if (this.loginForm.invalid) return;

        this.isLoading = true;
        const { email, password } = this.loginForm.value;

        try {
            const user = await this.authService.login(email, password);

            // Checking Profile Status to Route
            const profileExists = await this.authService.checkProfileExists(user.uid);

            if (profileExists) {
                this.router.navigate(['/dashboard']);
            } else {
                // If by any chance the profile was deleted but auth remains
                this.router.navigate(['/complete-profile']);
            }

        } catch (error: any) {
            console.error(error);

            let errorMsg = 'Correo o contraseña incorrectos.';
            if (error.code === 'auth/user-not-found') {
                errorMsg = 'No existe una cuenta con este correo.';
            } else if (error.code === 'auth/wrong-password') {
                errorMsg = 'Contraseña incorrecta.';
            } else if (error.code === 'auth/too-many-requests') {
                errorMsg = 'Demasiados intentos. Intenta más tarde.';
            }

            Swal.fire({
                icon: 'error',
                title: 'Error de Acceso',
                text: errorMsg,
                confirmButtonColor: '#f44336'
            });
            this.isLoading = false;
        }
    }
}
