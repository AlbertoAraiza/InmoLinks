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
    private scriptLoaded = false;

    constructor() {
        this.subscriptionService.subscriptionStatus$.subscribe(status => {
            if (status.hasAds && !this.scriptLoaded) {
                this.loadAdSense();
            }
        });
    }

    private loadAdSense() {
        if (this.scriptLoaded) return;
        
        const script = document.createElement('script');
        script.async = true;
        script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8257518278474067';
        script.crossOrigin = 'anonymous';
        document.head.appendChild(script);
        this.scriptLoaded = true;
    }
}
