import { Injectable, inject } from '@angular/core';
import { AuthService, AdvisorProfile } from './auth.service';
import { PropertyService } from './property.service';
import { Observable, combineLatest, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Functions, httpsCallable } from '@angular/fire/functions';

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
    private functions = inject(Functions);

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

    async startStripeCheckout(plan: 'VIP' | 'Premium', days: 30 | 60): Promise<void> {
        const profile = this.authService.currentProfile;
        console.log('Profile:', profile);
        if (!profile) throw new Error("No profile found");

        const priceKey = `${plan.toUpperCase()}_${days}` as keyof typeof environment.stripe.prices;
        const priceId = environment.stripe.prices[priceKey];
        console.log('Price ID:', priceId);
        const createCheckout = httpsCallable(this.functions, 'createCheckoutSession');

        // Use current window origin for redirect URLs
        const origin = window.location.origin;

        try {
            const result: any = await createCheckout({
                priceId,
                plan,
                days,
                successUrl: `${origin}/dashboard/account?status=success&session_id={CHECKOUT_SESSION_ID}`,
                cancelUrl: `${origin}/dashboard/account?status=cancel`
            });

            if (result.data && result.data.url) {
                window.location.href = result.data.url;
            } else {
                throw new Error("No checkout URL returned");
            }
        } catch (error) {
            console.error("Error creating checkout session:", error);
            throw error;
        }
    }
}
