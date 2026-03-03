import { Component, inject } from '@angular/core';
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
    selector: 'app-complete-profile',
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
    templateUrl: './complete-profile.component.html'
})
export class CompleteProfileComponent {
    private fb = inject(FormBuilder);
    private authService = inject(AuthService);
    private router = inject(Router);

    profileForm: FormGroup;
    isLoading = false;
    selectedFile: File | null = null;
    photoPreview: string | ArrayBuffer | null = null;

    constructor() {
        this.profileForm = this.fb.group({
            fullName: ['', [Validators.required, Validators.minLength(3)]]
        });
    }

    onFileSelected(event: any) {
        const file = event.target.files[0];
        if (file) {
            this.selectedFile = file;
            const reader = new FileReader();
            reader.onload = e => this.photoPreview = reader.result;
            reader.readAsDataURL(file);
        }
    }

    async saveProfile() {
        if (this.profileForm.invalid) return;

        this.isLoading = true;
        const { fullName } = this.profileForm.value;

        try {
            let photoUrl = '';
            
            if (this.selectedFile) {
                const user = this.authService.currentUser;
                if (user) {
                    photoUrl = await this.authService.uploadProfilePhoto(this.selectedFile, user.uid);
                }
            }

            await this.authService.completeProfile(fullName, photoUrl);

            Swal.fire({
                icon: 'success',
                title: '¡Perfil Creado!',
                text: 'Bienvenido a InmoLinks',
                timer: 2000,
                showConfirmButton: false
            });

            this.router.navigate(['/dashboard']);

        } catch (error: any) {
            console.error(error);
            Swal.fire({
                icon: 'error',
                title: 'Error Inesperado',
                text: 'No pudimos guardar tu perfil, intenta más tarde. ' + error.message,
            });
        } finally {
            this.isLoading = false;
        }
    }
}
