import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute } from '@angular/router';
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
        MatIconModule, MatInputModule, MatFormFieldModule, RouterModule
    ],
    templateUrl: './account-settings.component.html'
})
export class AccountSettingsComponent implements OnInit {
    private fb = inject(FormBuilder);
    public authService = inject(AuthService);
    public subscriptionService = inject(SubscriptionService);
    private route = inject(ActivatedRoute);

    profileForm: FormGroup;
    isLoading = false;
    isUploading = false;
    currentStatus: SubscriptionStatus | null = null;

    constructor() {
        this.profileForm = this.fb.group({
            fullName: ['', Validators.required],
            phoneNumber: ['', [Validators.required, Validators.pattern('^[0-9]{10}$')]]
        });
    }

    ngOnInit() {
        this.route.queryParams.subscribe(params => {
            if (params['status'] === 'success') {
                Swal.fire({
                    icon: 'success',
                    title: '¡Pago Procesado!',
                    text: 'Estamos validando tu pago. Los cambios se verán reflejados en unos momentos.',
                    timer: 5000
                });
            } else if (params['status'] === 'cancel') {
                Swal.fire('Pago Cancelado', 'No se realizó ningún cobro.', 'info');
            }
        });

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
        const isVip = plan === 'VIP';
        const limitText = isVip ? 'Límite de 10 propiedades activas.' : 'Propiedades ilimitadas.';
        const price30 = isVip ? '$99 MXN' : '$199 MXN';
        const price60 = isVip ? '$149 MXN' : '$299 MXN';

        const result = await Swal.fire({
            title: `Contratar Plan ${plan}`,
            html: `
                <p class="mb-2 fw-bold text-primary">${limitText}</p>
                <p class="text-muted small">Serás redirigido a la pasarela segura de Stripe.</p>
            `,
            icon: 'info',
            input: 'radio',
            inputOptions: {
                '30': `30 Días - ${price30}`,
                '60': `60 Días - ${price60}`
            },
            inputValidator: (value) => {
                if (!value) {
                    return 'Debes seleccionar una opción'
                }
                return null;
            },
            showCancelButton: true,
            confirmButtonText: 'Continuar al Pago',
            cancelButtonText: 'Cancelar'
        });

        if (result.isConfirmed && result.value) {
            this.isLoading = true;
            Swal.fire({
                title: 'Preparando Pago...',
                text: 'Por favor no cierres esta ventana',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });

            try {
                console.log('Starting checkout for plan:', plan, 'for', result.value, 'days');
                await this.subscriptionService.startStripeCheckout(plan, parseInt(result.value) as 30 | 60);
            } catch (e: any) {
                console.error(e);
                Swal.fire('Error', 'No se pudo iniciar la sesión de pago. Intenta de nuevo.', 'error');
            } finally {
                this.isLoading = false;
            }
        }
    }

    async changePassword() {
        const { value: formValues } = await Swal.fire({
            title: 'Cambiar Contraseña',
            html:
                '<input id="swal-input1" class="swal2-input" type="password" placeholder="Contraseña Actual">' +
                '<input id="swal-input2" class="swal2-input" type="password" placeholder="Nueva Contraseña">' +
                '<input id="swal-input3" class="swal2-input" type="password" placeholder="Confirmar Nueva Contraseña">',
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Actualizar',
            cancelButtonText: 'Cancelar',
            preConfirm: () => {
                const current = (document.getElementById('swal-input1') as HTMLInputElement).value;
                const newPass = (document.getElementById('swal-input2') as HTMLInputElement).value;
                const confirm = (document.getElementById('swal-input3') as HTMLInputElement).value;

                if (!current || !newPass || !confirm) {
                    Swal.showValidationMessage('Por favor llena todos los campos');
                    return false;
                }
                if (newPass !== confirm) {
                    Swal.showValidationMessage('Las nuevas contraseñas no coinciden');
                    return false;
                }
                if (newPass.length < 6 || newPass.length > 20) {
                    Swal.showValidationMessage('La contraseña debe tener entre 6 y 20 caracteres');
                    return false;
                }

                return [current, newPass];
            }
        });

        if (formValues) {
            const [current, newPass] = formValues;
            this.isLoading = true;
            Swal.fire({ title: 'Actualizando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

            try {
                await this.authService.changePassword(current, newPass);
                Swal.fire('¡Éxito!', 'Tu contraseña ha sido actualizada.', 'success');
            } catch (error: any) {
                console.error(error);
                let message = 'No se pudo cambiar la contraseña.';
                if (error.code === 'auth/wrong-password') {
                    message = 'La contraseña actual es incorrecta.';
                }
                Swal.fire('Error', message, 'error');
            } finally {
                this.isLoading = false;
            }
        }
    }
}
