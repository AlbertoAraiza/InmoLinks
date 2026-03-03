import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { AuthService } from '../../../core/services/auth.service';
import { SubscriptionService, SubscriptionStatus } from '../../../core/services/subscription.service';
import Swal from 'sweetalert2';

@Component({
    selector: 'app-account-settings',
    standalone: true,
    imports: [
        CommonModule, ReactiveFormsModule, MatCardModule, MatButtonModule,
        MatIconModule, MatInputModule, MatFormFieldModule
    ],
    templateUrl: './account-settings.component.html'
})
export class AccountSettingsComponent implements OnInit {
    private fb = inject(FormBuilder);
    public authService = inject(AuthService);
    public subscriptionService = inject(SubscriptionService);

    profileForm: FormGroup;
    isLoading = false;
    isUploading = false;
    currentStatus: SubscriptionStatus | null = null;

    constructor() {
        this.profileForm = this.fb.group({
            fullName: ['', Validators.required],
            phoneNumber: [{ value: '', disabled: true }, [Validators.required, Validators.pattern('^[0-9]{10}$')]]
        });
    }

    ngOnInit() {
        this.authService.currentProfile$.subscribe(profile => {
            if (profile) {
                this.profileForm.patchValue({
                    fullName: profile.fullName,
                    phoneNumber: profile.phoneNumber
                });
            }
        });

        this.subscriptionService.subscriptionStatus$.subscribe(status => {
            this.currentStatus = status;
        });
    }

    async updateProfile() {
        if (this.profileForm.invalid) return;

        this.isLoading = true;
        try {
            const profile = this.authService.currentProfile;
            if (profile) {
                await this.authService.updateProfile(profile.uid, this.profileForm.value);
                Swal.fire({
                    icon: 'success',
                    title: 'Perfil Actualizado',
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 2000
                });
            }
        } catch (e) {
            console.error(e);
            Swal.fire('Error', 'No se pudo actualizar el perfil', 'error');
        } finally {
            this.isLoading = false;
        }
    }

    async onPhotoSelected(event: any) {
        const file = event.target.files[0];
        if (!file) return;

        this.isUploading = true;
        try {
            const profile = this.authService.currentProfile;
            if (profile) {
                const photoUrl = await this.authService.uploadProfilePhoto(file, profile.uid);
                await this.authService.updateProfile(profile.uid, { profilePhotoUrl: photoUrl });
            }
        } catch (e) {
            console.error(e);
            Swal.fire('Error', 'No se pudo subir la foto', 'error');
        } finally {
            this.isUploading = false;
        }
    }

    async startCheckout(plan: 'VIP' | 'Premium') {
        const result = await Swal.fire({
            title: `Contratar Plan ${plan}`,
            text: 'Selecciona una vigencia. (Simulador de Stripe)',
            icon: 'info',
            input: 'radio',
            inputOptions: {
                '30': '30 Días',
                '60': '60 Días'
            },
            inputValidator: (value) => {
                if (!value) {
                    return 'Debes seleccionar una opción'
                }
                return null;
            },
            showCancelButton: true,
            confirmButtonText: 'Pagar con Stripe',
            cancelButtonText: 'Cancelar'
        });

        if (result.isConfirmed && result.value) {
            this.isLoading = true;
            Swal.fire({ title: 'Procesando Pago...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            try {
                // Simulate HTTP delay
                await new Promise(r => setTimeout(r, 2000));

                // Process the mock purchase
                await this.subscriptionService.simulatePurchase(plan, parseInt(result.value) as 30 | 60);

                Swal.fire('¡Pago Exitoso!', `Ahora tienes el Plan ${plan} por ${result.value} días.`, 'success');
            } catch (e: any) {
                console.error(e);
                Swal.fire('Error en el pago', e.message, 'error');
            } finally {
                this.isLoading = false;
            }
        }
    }
}
