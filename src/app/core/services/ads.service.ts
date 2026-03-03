import { Injectable, inject } from '@angular/core';
import { SubscriptionService } from './subscription.service';
import Swal from 'sweetalert2';
import { firstValueFrom } from 'rxjs';
import { PropertyService } from './property.service';

@Injectable({
    providedIn: 'root'
})
export class AdsService {
    private subscriptionService = inject(SubscriptionService);

    // Mocks an AdMob Interstitial Ad taking over the screen for 3 seconds
    async showInterstitialAd(): Promise<void> {
        const profile$ = this.subscriptionService.subscriptionStatus$;
        const status = await firstValueFrom(profile$);

        if (status.hasAds) {
            return new Promise((resolve) => {
                let timerInterval: any;
                Swal.fire({
                    title: 'PUBLICIDAD',
                    html: 'Anuncio patrocinado por Google AdMob... <br><br> <b>3</b>',
                    timer: 3000,
                    timerProgressBar: true,
                    allowOutsideClick: false,
                    allowEscapeKey: false,
                    willOpen: () => {
                        const confirmBtn = Swal.getConfirmButton();
                        if (confirmBtn) confirmBtn.style.display = 'none';
                    },
                    didOpen: () => {
                        const b = Swal.getHtmlContainer()?.querySelector('b');
                        timerInterval = setInterval(() => {
                            if (b && Swal.getTimerLeft()) {
                                b.textContent = `${Math.ceil(Swal.getTimerLeft()! / 1000)}`;
                            }
                        }, 100);
                    },
                    willClose: () => {
                        clearInterval(timerInterval);
                    }
                }).then(() => {
                    resolve();
                });
            });
        }
    }
}
