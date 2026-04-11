import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';

import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';

import { PropertyService } from '../../../core/services/property.service';
import { SubscriptionService } from '../../../core/services/subscription.service';
import Swal from 'sweetalert2';

@Component({
    selector: 'app-property-list',
    standalone: true,
    imports: [CommonModule, RouterModule, MatCardModule, MatButtonModule, MatIconModule, MatChipsModule],
    templateUrl: './property-list.component.html'
})
export class PropertyListComponent implements OnInit {
    propertyService = inject(PropertyService);
    subscriptionService = inject(SubscriptionService);
    private router = inject(Router);

    properties: any[] = [];
    isLoading = true;

    ngOnInit(): void {
        this.loadProperties();
    }

    async loadProperties() {
        this.isLoading = true;
        try {
            this.properties = await this.propertyService.getMyProperties();
        } catch (error) {
            console.error(error);
        } finally {
            this.isLoading = false;
        }
    }

    copyLink(propertyId: string) {
        // We will assume the site is hosted at the current window location origin + /inmolinks
        const url = `${window.location.origin}/inmolinks/p/${propertyId}`;

        const copyToClipboard = (text: string) => {
            if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
                return navigator.clipboard.writeText(text);
            } else {
                return new Promise<void>((resolve, reject) => {
                    const el = document.createElement('textarea');
                    el.value = text;
                    document.body.appendChild(el);
                    el.select();
                    try {
                        document.execCommand('copy');
                        resolve();
                    } catch (err) {
                        reject(err);
                    } finally {
                        document.body.removeChild(el);
                    }
                });
            }
        };

        copyToClipboard(url).then(() => {
            Swal.fire({
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000,
                icon: 'success',
                title: 'Enlace Copiado'
            });
        }).catch(err => {
            Swal.fire('Error', 'No se pudo copiar el enlace', 'error');
            console.error(err);
        });
    }

    confirmDelete(propertyId: string) {
        Swal.fire({
            title: '¿Estás seguro?',
            text: "Eliminarás esta propiedad de tu catálogo y el enlace público dejará de funcionar.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar'
        }).then(async (result) => {
            if (result.isConfirmed) {
                await this.propertyService.deleteProperty(propertyId);
                this.properties = this.properties.filter(p => p.id !== propertyId);
                Swal.fire('Eliminada', 'La propiedad ha sido borrada.', 'success');
            }
        });
    }

    async checkAddProperty() {
        const canAdd = await this.subscriptionService.canAddProperty();
        if (canAdd) {
            this.router.navigate(['/dashboard/new']);
        } else {
            Swal.fire({
                icon: 'warning',
                title: 'Límite Alcanzado',
                text: 'Has alcanzado el límite de propiedades de tu plan actual. Para seguir publicando, por favor mejora tu plan.',
                confirmButtonText: 'Ver Planes',
                showCancelButton: true,
                cancelButtonText: 'Cancelar'
            }).then((result) => {
                if (result.isConfirmed) {
                    this.router.navigate(['/dashboard/account']);
                }
            });
        }
    }
}
