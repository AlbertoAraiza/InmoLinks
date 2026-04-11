import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { firstValueFrom, Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';

// Angular Material
import { MatStepperModule } from '@angular/material/stepper';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { GoogleMapsModule } from '@angular/google-maps';

import { PropertyService } from '../../../core/services/property.service';
import { AuthService } from '../../../core/services/auth.service';
import { SubscriptionService } from '../../../core/services/subscription.service';
import { AdsService } from '../../../core/services/ads.service';
import Swal from 'sweetalert2';

@Component({
    selector: 'app-property-form',
    standalone: true,
    imports: [
        CommonModule, ReactiveFormsModule, RouterModule, GoogleMapsModule,
        MatStepperModule, MatFormFieldModule, MatInputModule,
        MatButtonModule, MatSelectModule, MatIconModule, MatProgressSpinnerModule
    ],
    templateUrl: './property-form.component.html',
    styles: [`
        @media (max-width: 768px) {
            ::ng-deep .mat-vertical-content-container {
                margin-left: 0 !important;
                padding: 0 !important;
            }
            ::ng-deep .mat-vertical-stepper-header {
                padding: 16px 8px !important;
            }
            ::ng-deep .mat-stepper-vertical {
                padding: 0 !important;
                margin-top: -16px;
            }
            ::ng-deep .mat-vertical-content {
                padding: 0 8px 16px 8px !important;
            }
        }
    `]
})
export class PropertyFormComponent implements OnInit {
    private fb = inject(FormBuilder);
    private propertyService = inject(PropertyService);
    private authService = inject(AuthService);
    private subscriptionService = inject(SubscriptionService);
    private adsService = inject(AdsService);
    private router = inject(Router);
    private route = inject(ActivatedRoute);
    private breakpointObserver = inject(BreakpointObserver);

    isMobile$: Observable<boolean> = this.breakpointObserver.observe(Breakpoints.Handset)
        .pipe(map(result => result.matches));

    isEditMode = false;
    editPropertyId: string | null = null;
    existingImageUrls: string[] = [];

    isLinear = true;
    isLoading = false;
    isSearchingMap = false;
    mapVisible = false;

    // Google Maps Config
    mapCenter: google.maps.LatLngLiteral = { lat: 23.6345, lng: -102.5528 }; // Default Mexico
    mapZoom = 14;
    markerPosition: google.maps.LatLngLiteral | null = null;
    markerOptions: google.maps.MarkerOptions = { draggable: true };

    basicFormGroup: FormGroup;
    locationFormGroup: FormGroup;
    featuresFormGroup: FormGroup;
    mediaFormGroup: FormGroup; // Placeholder for now

    // As per Business Logic Specs
    zonas = ['Centro', 'Norte', 'Sur', 'Oriente', 'Poniente'];

    constructor() {
        this.basicFormGroup = this.fb.group({
            title: ['', Validators.required],
            price: ['', [Validators.required, Validators.min(0)]],
            description: ['', Validators.required],
        });

        this.locationFormGroup = this.fb.group({
            city: ['', Validators.required],
            neighborhood: ['', Validators.required],
            zipCode: ['', [Validators.required, Validators.pattern('^[0-9]{4,5}$')]],
            address: [''],
            zone: ['', Validators.required],
            lat: [null, Validators.required],
            lng: [null, Validators.required]
        });

        this.featuresFormGroup = this.fb.group({
            bedrooms: [0, [Validators.required, Validators.min(0)]],
            bathrooms: [0, [Validators.required, Validators.min(0)]],
            landAreaSqM: [0, [Validators.required, Validators.min(0)]],
            constructionAreaSqM: [0, [Validators.required, Validators.min(0)]],
        });

        this.mediaFormGroup = this.fb.group({
            videoUrl: ['']
        });
    }

    ngOnInit() {
        this.route.paramMap.subscribe(async params => {
            const id = params.get('id');
            if (id) {
                this.isEditMode = true;
                this.editPropertyId = id;
                this.loadPropertyForEdit(id);
            } else {
                // Determine if we have a profile loaded, otherwise wait for auth state to settle on hard refresh
                let currentProfile = this.authService.currentProfile;
                if (!currentProfile) {
                    currentProfile = await firstValueFrom(
                        this.authService.currentProfile$.pipe(filter(profile => profile !== null))
                    );
                }

                const canAdd = await this.subscriptionService.canAddProperty();
                if (!canAdd) {
                    Swal.fire('Límite Alcanzado', 'Has alcanzado el límite de propiedades de tu plan actual. Para seguir publicando, mejora tu plan.', 'warning').then(() => {
                        this.router.navigate(['/dashboard/account']);
                    });
                }
            }
        });
    }

    async loadPropertyForEdit(id: string) {
        this.isLoading = true;
        try {
            const property = await this.propertyService.getPropertyById(id);
            if (property) {
                // Populate basic
                this.basicFormGroup.patchValue({
                    title: property.title,
                    price: property.price,
                    description: property.description
                });

                // Populate location
                this.locationFormGroup.patchValue({
                    city: property.location.city,
                    neighborhood: property.location.neighborhood,
                    zipCode: property.location.zipCode || '', // Backward compatibility
                    zone: property.location.zone,
                    address: property.location.address || '',
                    lat: property.location.approxLat || null,
                    lng: property.location.approxLng || null
                });

                // Populate features
                this.featuresFormGroup.patchValue({
                    bedrooms: property.features.bedrooms,
                    bathrooms: property.features.bathrooms,
                    landAreaSqM: property.features.landAreaSqM,
                    constructionAreaSqM: property.features.constructionAreaSqM
                });

                // Restore map if coords exist
                if (property.location.approxLat && property.location.approxLng) {
                    this.updateMapPosition(property.location.approxLat, property.location.approxLng);
                }

                // Restore existing images and videos
                if (property.media?.images) {
                    this.existingImageUrls = [...property.media.images];
                }
                if (property.media?.videos && property.media.videos.length > 0) {
                    this.mediaFormGroup.patchValue({
                        videoUrl: property.media.videos[0]
                    });
                }
            } else {
                Swal.fire('Error', 'Propiedad no encontrada', 'error');
                this.router.navigate(['/dashboard']);
            }
        } catch (error) {
            console.error("Error loading property", error);
        } finally {
            this.isLoading = false;
        }
    }

    selectedImages: File[] = [];
    imagePreviews: string[] = [];

    onImagesSelected(event: any) {
        const files: FileList = event.target.files;
        if (files) {
            Array.from(files).forEach(file => {
                this.selectedImages.push(file);
                const reader = new FileReader();
                reader.onload = e => {
                    if (reader.result) {
                        this.imagePreviews.push(reader.result as string);
                    }
                };
                reader.readAsDataURL(file);
            });
        }
    }

    removeExistingImage(index: number) {
        this.existingImageUrls.splice(index, 1);
    }

    removeImage(index: number) {
        this.selectedImages.splice(index, 1);
        this.imagePreviews.splice(index, 1);
    }

    async searchLocation() {
        const { neighborhood, zipCode, city, address } = this.locationFormGroup.value;
        if (!neighborhood || !zipCode) return;

        this.isSearchingMap = true;

        try {
            if (typeof google === 'undefined' || !google.maps) {
                this.isSearchingMap = false;
                Swal.fire('Aviso de Red', 'No pudimos conectar con los servicios de Google Maps. Asegúrate de estar conectado a internet y de no tener bloqueadores de red activos.', 'warning');
                return;
            }

            const geocoder = new google.maps.Geocoder();
            // Check if address is a Maps URL
            const mapsUrlRegex = /(?:https?:\/\/)?(?:www\.)?(?:google\.com\/maps\/place\/|goo\.gl\/maps\/|maps\.app\.goo\.gl\/)/;

            if (address && mapsUrlRegex.test(address)) {
                const coordMatch = address.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
                if (coordMatch) {
                    const lat = parseFloat(coordMatch[1]);
                    const lng = parseFloat(coordMatch[2]);
                    this.updateMapPosition(lat, lng);

                    // reverse geocode to get street name
                    const results = await this.geocodeLatLng(geocoder, lat, lng).catch(() => null);
                    if (results && results.length > 0) {
                        // Clean up the address a bit if needed, then update the form control
                        const formatted = results[0].formatted_address;
                        this.locationFormGroup.controls['address'].setValue(formatted);
                        this.locationFormGroup.controls['address'].updateValueAndValidity();
                    } else {
                        // Could not parse address from coords, clear the URL so user types it manually
                        this.locationFormGroup.controls['address'].setValue('');
                        this.locationFormGroup.controls['address'].updateValueAndValidity();
                        Swal.fire('Atención', 'Obtuvimos el punto en el mapa, pero no el nombre de la calle. Por favor ingresa el nombre de la calle manualmente.', 'info');
                    }
                } else {
                    this.locationFormGroup.controls['address'].setValue('');
                    this.locationFormGroup.controls['address'].updateValueAndValidity();
                    Swal.fire('Aviso', 'No pudimos extraer las coordenadas exactas del enlace corto. Escribe la dirección manualmente.', 'info');
                }
            } else {
                // Tier 1: Exact search (Address + Neighborhood + Zip + City)
                let query = `${address ? address + ', ' : ''}${neighborhood}, ${zipCode}, ${city || ''}, Mexico`;
                let response = await geocoder.geocode({ address: query }).catch(() => null);

                // If the result is APPROXIMATE (meaning Maps couldn't find the street, and just returned the city or state center)
                let isExact = response && response.results && response.results.length > 0 &&
                    (response.results[0].geometry.location_type === 'ROOFTOP' ||
                        response.results[0].geometry.location_type === 'RANGE_INTERPOLATED' ||
                        response.results[0].geometry.location_type === 'GEOMETRIC_CENTER');

                // Tier 2: Fallback to Neighborhood / ZipCode only to prevent random out-of-context drops
                if (!isExact && address) {
                    query = `${neighborhood}, ${zipCode}, ${city || ''}, Mexico`;
                    response = await geocoder.geocode({ address: query }).catch(() => null);
                    isExact = response && response.results && response.results.length > 0;
                    if (isExact) {
                        Swal.fire('Ubicación Aproximada', 'Google Maps no encontró la calle/número exacto. Hemos centrado el mapa en la colonia. Por favor, arrastra el pin rojo a la posición correcta.', 'info');
                    }
                }

                if (response && response.results && response.results.length > 0) {
                    const location = response.results[0].geometry.location;
                    this.updateMapPosition(location.lat(), location.lng());
                } else {
                    Swal.fire('No Encontrada', 'No pudimos localizar esta zona ni siquiera por Código Postal. Verifica los datos.', 'warning');
                }
            }
        } catch (error) {
            console.error("Geocoding error", error);
            Swal.fire('Error', 'Hubo un problema contactando a Google Maps.', 'error');
        } finally {
            this.isSearchingMap = false;
        }
    }

    private geocodeLatLng(geocoder: google.maps.Geocoder, lat: number, lng: number): Promise<google.maps.GeocoderResult[]> {
        return new Promise((resolve, reject) => {
            geocoder.geocode({ location: { lat, lng } }, (results, status) => {
                if (status === 'OK' && results) {
                    resolve(results);
                } else {
                    reject(status);
                }
            });
        });
    }

    private updateMapPosition(lat: number, lng: number) {
        this.mapCenter = { lat, lng };
        this.markerPosition = { lat, lng };
        this.mapZoom = 17;
        this.mapVisible = true;
        this.locationFormGroup.patchValue({ lat, lng });
    }

    onMarkerDragEnd(event: google.maps.MapMouseEvent) {
        if (event.latLng) {
            this.locationFormGroup.patchValue({
                lat: event.latLng.lat(),
                lng: event.latLng.lng()
            });
        }
    }

    async submitProperty() {
        if (this.basicFormGroup.invalid || this.locationFormGroup.invalid || this.featuresFormGroup.invalid) return;

        this.isLoading = true;

        const payload = {
            ...this.basicFormGroup.value,
            currency: 'MXN',
            status: 'published',
            location: {
                ...this.locationFormGroup.value,
                approxLat: this.locationFormGroup.value.lat, // Legacy property format map
                approxLng: this.locationFormGroup.value.lng
            },
            features: this.featuresFormGroup.value,
            media: {
                videos: [this.mediaFormGroup.value.videoUrl].filter(v => !!v)
            }
        };

        try {
            if (this.isEditMode && this.editPropertyId) {
                await this.propertyService.updateProperty(this.editPropertyId, payload, this.selectedImages, this.existingImageUrls);
                Swal.fire('¡Actualizado!', 'La propiedad ha sido modificada con éxito.', 'success')
                    .then(() => this.router.navigate(['/dashboard']));
            } else {
                const propertyId = await this.propertyService.createProperty(payload, this.selectedImages);
                Swal.fire({
                    icon: 'success',
                    title: '¡Propiedad Publicada!',
                    text: 'Los clientes ya pueden visualizarla.',
                    confirmButtonText: 'Ir a mi Catálogo'
                }).then(() => {
                    this.router.navigate(['/dashboard']);
                });
            }


        } catch (error: any) {
            console.error(error);
            Swal.fire('Error', 'No se pudo guardar la propiedad: ' + error.message, 'error');
        } finally {
            this.isLoading = false;
        }
    }

    cancelForm() {
        Swal.fire({
            title: '¿Cancelar captura?',
            text: 'Toda la información no guardada se perderá definitivamente.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Sí, salir sin guardar',
            cancelButtonText: 'Continuar editando',
            reverseButtons: true
        }).then((result) => {
            if (result.isConfirmed) {
                this.router.navigate(['/dashboard']);
            }
        });
    }
}
