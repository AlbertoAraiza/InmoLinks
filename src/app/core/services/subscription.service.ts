import { Injectable, inject } from '@angular/core';
import { AuthService, AdvisorProfile } from './auth.service';
import { PropertyService } from './property.service';
import { Observable, combineLatest, map } from 'rxjs';

export type PlanType = 'Free' | 'VIP' | 'Premium';

export interface SubscriptionStatus {
    plan: PlanType;
    limit: number;
    hasAds: boolean;
    expiresAt?: number;
    daysRemaining?: number;
}

@Injectable({
    providedIn: 'root'
})
export class SubscriptionService {
    private authService = inject(AuthService);
    private propertyService = inject(PropertyService);

    // Business Rules Constants
    private readonly LIMIT_FREE = 1;
    private readonly LIMIT_VIP = 10;
    private readonly LIMIT_PREMIUM = Infinity;

    public subscriptionStatus$: Observable<SubscriptionStatus> = this.authService.currentProfile$.pipe(
        map(profile => this.calculateCurrentStatus(profile))
    );

    private calculateCurrentStatus(profile: AdvisorProfile | null): SubscriptionStatus {
        if (!profile) {
            return { plan: 'Free', limit: this.LIMIT_FREE, hasAds: true };
        }

        const now = Date.now();
        const vigenciaPremium = profile.vigenciaPremium || 0;
        const vigenciaVIP = profile.vigenciaVIP || 0;

        if (vigenciaPremium > now) {
            return {
                plan: 'Premium',
                limit: this.LIMIT_PREMIUM,
                hasAds: false,
                expiresAt: vigenciaPremium,
                daysRemaining: Math.ceil((vigenciaPremium - now) / (1000 * 60 * 60 * 24))
            };
        }

        if (vigenciaVIP > now) {
            return {
                plan: 'VIP',
                limit: this.LIMIT_VIP,
                hasAds: false,
                expiresAt: vigenciaVIP,
                daysRemaining: Math.ceil((vigenciaVIP - now) / (1000 * 60 * 60 * 24))
            };
        }

        // Default or Expired
        return { plan: 'Free', limit: this.LIMIT_FREE, hasAds: true };
    }

    async canAddProperty(): Promise<boolean> {
        const profile = this.authService.currentProfile;
        const status = this.calculateCurrentStatus(profile);

        if (status.plan === 'Premium') return true;

        const properties = await this.propertyService.getMyProperties();
        return properties.length < status.limit;
    }

    async simulatePurchase(plan: 'VIP' | 'Premium', days: 30 | 60): Promise<void> {
        const profile = this.authService.currentProfile;
        if (!profile) throw new Error("No profile found");

        const now = Date.now();
        const addedMs = days * 24 * 60 * 60 * 1000;

        let newVigenciaVIP = profile.vigenciaVIP || 0;
        let newVigenciaPremium = profile.vigenciaPremium || 0;

        if (plan === 'Premium') {
            // Si ya hay premium, se suma al premium actual. Si no, empieza desde ahora.
            const baseDate = newVigenciaPremium > now ? newVigenciaPremium : now;
            newVigenciaPremium = baseDate + addedMs;

            // Si se compra Premium teniendo VIP, el VIP se pausa (o los ms restantes se añaden AL FINAL del Premium)
            // Calculamos cuánto tiempo VIP le quedaba intacto y lo seteamos para QUE EMPIECE DESPUÉS DEL PREMIUM
            const vipTimeLeft = newVigenciaVIP > now ? newVigenciaVIP - now : 0;
            if (vipTimeLeft > 0) {
                newVigenciaVIP = newVigenciaPremium + vipTimeLeft;
            }

        } else if (plan === 'VIP') {
            // Si compra VIP teniendo Premium... el VIP debe ir hasta el final del Premium
            if (newVigenciaPremium > now) {
                const baseVIP = newVigenciaVIP > newVigenciaPremium ? newVigenciaVIP : newVigenciaPremium;
                newVigenciaVIP = baseVIP + addedMs;
            } else {
                // No hay premium actual
                const baseDate = newVigenciaVIP > now ? newVigenciaVIP : now;
                newVigenciaVIP = baseDate + addedMs;
            }
        }

        await this.authService.updateProfile(profile.uid, {
            vigenciaVIP: newVigenciaVIP,
            vigenciaPremium: newVigenciaPremium
        });
    }
}
