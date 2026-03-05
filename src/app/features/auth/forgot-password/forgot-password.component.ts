import { Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

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
    selector: 'app-forgot-password',
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
    templateUrl: './forgot-password.component.html'
})
export class ForgotPasswordComponent {
    private fb = inject(FormBuilder);
    private authService = inject(AuthService);

    forgotForm: FormGroup;
    isLoading = false;

    constructor() {
        this.forgotForm = this.fb.group({
            email: ['', [Validators.required, Validators.email]]
        });
    }

    async onSubmit() {
        if (this.forgotForm.invalid) return;

        this.isLoading = true;
        try {
            await this.authService.sendPasswordReset(this.forgotForm.value.email);
            Swal.fire({
                icon: 'success',
                title: 'Correo Enviado',
                text: 'Revisa tu bandeja de entrada para restablecer tu contraseña.',
                confirmButtonColor: '#3f51b5'
            });
        } catch (error) {
            console.error(error);
            Swal.fire('Error', 'No pudimos procesar tu solicitud. Verifica el correo.', 'error');
        } finally {
            this.isLoading = false;
        }
    }
}
