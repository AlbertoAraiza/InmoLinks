import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

// Angular Material
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

// Services
import { AuthService } from '../../../core/services/auth.service';
import Swal from 'sweetalert2';

@Component({
    selector: 'app-login',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatIconModule,
        MatProgressSpinnerModule
    ],
    templateUrl: './login.component.html'
})
export class LoginComponent implements OnInit {
    private fb = inject(FormBuilder);
    private authService = inject(AuthService);
    private router = inject(Router);

    phoneForm: FormGroup;
    otpForm: FormGroup;

    step: 'phone' | 'otp' = 'phone';
    isLoading = false;

    constructor() {
        this.phoneForm = this.fb.group({
            phoneNumber: ['', [Validators.required, Validators.pattern('^[0-9]{10}$')]]
        });

        this.otpForm = this.fb.group({
            code: ['', [Validators.required, Validators.pattern('^[0-9]{6}$')]]
        });
    }

    ngOnInit() {
        // Initialize Google reCAPTCHA
        setTimeout(() => {
            this.authService.initRecaptchaPlugin('recaptcha-container');
        }, 100);
    }

    async sendOtp() {
        if (this.phoneForm.invalid) return;

        this.isLoading = true;
        const phone = this.phoneForm.value.phoneNumber;

        try {
            await this.authService.sendOtp(phone);
            this.step = 'otp';
            Swal.fire({
                icon: 'success',
                title: 'SMS Enviado',
                text: 'Hemos enviado un código de 6 dígitos a tu celular.',
                confirmButtonColor: '#3f51b5'
            });
        } catch (error: any) {
            console.error(error);
            Swal.fire({
                icon: 'error',
                title: 'Error de Autenticación',
                text: error.message || 'Verifica el número e intenta nuevamente.',
                confirmButtonColor: '#f44336'
            });
        } finally {
            this.isLoading = false;
        }
    }

    async verifyOtp() {
        if (this.otpForm.invalid) return;

        this.isLoading = true;
        const code = this.otpForm.value.code;

        try {
            const user = await this.authService.verifyOtp(code);

            // Checking Profile Status to Route
            const profileExists = await this.authService.checkProfileExists(user.uid);

            if (profileExists) {
                this.router.navigate(['/dashboard']);
            } else {
                this.router.navigate(['/complete-profile']);
            }

        } catch (error: any) {
            console.error(error);

            let errorMsg = 'El código proporcionado es incorrecto o expiró.';
            if (error.code === 'permission-denied' || error.message.includes('permissions')) {
                errorMsg = 'Error de permisos en la base de datos (Firestore). Por favor verifica las reglas de seguridad.';
            }

            Swal.fire({
                icon: 'error',
                title: 'Error de Autenticación',
                text: errorMsg,
                confirmButtonColor: '#f44336'
            });
            this.isLoading = false;
        }
    }
}
