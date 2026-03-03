import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';

// Material
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { GoogleMapsModule } from '@angular/google-maps';

import { PropertyService, PropertyListing } from '../../../core/services/property.service';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { LightboxDialogComponent } from './lightbox-dialog.component';
import Swal from 'sweetalert2';

@Component({
    selector: 'app-property-detail',
    standalone: true,
    imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule, MatChipsModule, MatProgressSpinnerModule, GoogleMapsModule, MatDialogModule],
    templateUrl: './property-detail.component.html'
})
export class PropertyDetailComponent implements OnInit {
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private firestore = inject(Firestore);
    private dialog = inject(MatDialog);

    property: PropertyListing | null = null;
    isLoading = true;
    mapLoaded = false;
    showBannerAd = false;

    // Google Maps Config for approximate location (Option B)
    mapOptions: google.maps.MapOptions = {
        mapId: 'DEMO_MAP_ID', // Replaces old map type IDs for modern vector maps
        disableDefaultUI: true,
        zoomControl: true,
    };
    mapCenter: google.maps.LatLngLiteral = { lat: 0, lng: 0 };
    mapZoom = 15;

    circleOptions: google.maps.CircleOptions = {
        fillColor: '#3f51b5',
        fillOpacity: 0.2,
        strokeColor: '#3f51b5',
        strokeOpacity: 0.8,
        strokeWeight: 2,
        radius: 500, // 500 meters radius
    };

    ngOnInit(): void {
        this.checkMapLoaded();
        const propertyId = this.route.snapshot.paramMap.get('id');
        if (propertyId) {
            this.loadProperty(propertyId);
        } else {
            this.router.navigate(['/']);
        }
    }

    checkMapLoaded() {
        if (window['google'] && window['google'].maps) {
            this.mapLoaded = true;
        } else {
            setTimeout(() => this.checkMapLoaded(), 100);
        }
    }

    async loadProperty(propertyId: string) {
        this.isLoading = true;
        try {
            // In this public view we use direct Firestore getDoc to bypass the auth requirement of the service for now
            // Assuming security rules allow read for status == published
            const docRef = doc(this.firestore, `properties/${propertyId}`);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists() && docSnap.data()['status'] === 'published') {
                this.property = { id: docSnap.id, ...docSnap.data() } as PropertyListing;

                // Initialize approximate map center
                if (this.property.location?.approxLat && this.property.location?.approxLng) {
                    this.mapCenter = {
                        lat: this.property.location.approxLat,
                        lng: this.property.location.approxLng
                    };
                }
                // Check if the author is on Free Plan
                this.checkIfAuthorHasAds(this.property.advisorUid);
            } else {
                // Property not found or not published
                this.property = null;
            }
        } catch (error) {
            console.error("Error loading property", error);
        } finally {
            this.isLoading = false;
        }
    }

    contactAgent() {
        if (!this.property) return;

        const phone = this.property.advisorPhone;
        const colonia = this.property.location?.neighborhood || 'su catálogo';

        // Clean phone number just in case (e.g. adding 52 if missing, removing spaces)
        let formattedPhone = phone.replace(/\D/g, '');
        if (formattedPhone.length === 10) {
            formattedPhone = `52${formattedPhone}`;
        }

        const message = encodeURIComponent(`¡Hola! Me interesa la propiedad en ${colonia} que vi en InmoLinks.`);
        const waUrl = `https://wa.me/${formattedPhone}?text=${message}`;

        window.open(waUrl, '_blank');
    }

    openLightbox(index: number) {
        if (!this.property?.media?.images?.length) return;

        this.dialog.open(LightboxDialogComponent, {
            data: {
                images: this.property.media.images,
                startIndex: index
            },
            maxWidth: '100vw',
            maxHeight: '100vh',
            height: '100%',
            width: '100%',
            panelClass: ['p-0', 'm-0', 'bg-black'],
            backdropClass: 'bg-black'
        });
    }

    copyLink() {
        if (!this.property) return;
        const url = window.location.href;
        navigator.clipboard.writeText(url).then(() => {
            Swal.fire({
                title: '¡Enlace copiado!',
                text: 'El enlace de esta propiedad se ha copiado al portapapeles.',
                icon: 'success',
                timer: 2000,
                showConfirmButton: false,
                toast: true,
                position: 'top-end'
            });
        });
    }

    async checkIfAuthorHasAds(advisorUid: string) {
        try {
            const docRef = doc(this.firestore, `advisors/${advisorUid}`);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                const now = Date.now();
                const vigenciaPremium = data['vigenciaPremium'] || 0;
                const vigenciaVIP = data['vigenciaVIP'] || 0;

                if (vigenciaPremium < now && vigenciaVIP < now) {
                    this.showBannerAd = true; // Activar el Banner Inferior
                }
            } else {
                this.showBannerAd = true;
            }
        } catch (e) {
            console.error('Error checking author subscription', e);
        }
    }
}
