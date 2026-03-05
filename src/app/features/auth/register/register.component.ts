import { Component, inject } from '@angular/core';
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
    selector: 'app-register',
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
    templateUrl: './register.component.html'
})
export class RegisterComponent {
    private fb = inject(FormBuilder);
    private authService = inject(AuthService);
    private router = inject(Router);

    registerForm: FormGroup;
    isLoading = false;
    hidePassword = true;

    constructor() {
        this.registerForm = this.fb.group({
            fullName: ['', [Validators.required]],
            email: ['', [Validators.required, Validators.email]],
            phoneNumber: ['', [Validators.required, Validators.pattern('^[0-9]{10}$')]],
            password: ['', [
                Validators.required,
                Validators.minLength(8),
                Validators.maxLength(20),
                Validators.pattern(/^(?=.*[a-zA-Z])(?=.*[0-9]).*$/) // Al menos una letra y un número
            ]],
            confirmPassword: ['', [Validators.required]]
        }, { validators: this.passwordMatchValidator });
    }

    passwordMatchValidator(g: FormGroup) {
        return g.get('password')?.value === g.get('confirmPassword')?.value
            ? null : { 'mismatch': true };
    }

    async onSubmit() {
        if (this.registerForm.invalid) return;

        this.isLoading = true;
        const { email, password, fullName, phoneNumber } = this.registerForm.value;

        try {
            await this.authService.register({ email, password, fullName, phoneNumber });

            Swal.fire({
                icon: 'success',
                title: '¡Cuenta Creada!',
                text: 'Bienvenido a InmoLinks Pro.',
                showConfirmButton: false,
                timer: 2000
            });

            this.router.navigate(['/dashboard']);
        } catch (error: any) {
            console.error(error);
            let message = 'No se pudo crear la cuenta. Intenta de nuevo.';
            if (error.code === 'auth/email-already-in-use') {
                message = 'Este correo electrónico ya está registrado.';
            }

            Swal.fire('Error', message, 'error');
        } finally {
            this.isLoading = false;
        }
    }
}
