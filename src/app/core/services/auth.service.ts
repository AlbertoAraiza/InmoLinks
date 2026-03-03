import { Injectable, inject } from '@angular/core';
import { Auth, RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult, User, authState } from '@angular/fire/auth';
import { Firestore, doc, getDoc, setDoc, writeBatch, collection, query, where, getDocs } from '@angular/fire/firestore';
import { Storage, ref, uploadBytes, getDownloadURL } from '@angular/fire/storage';
import { BehaviorSubject, Observable, from, firstValueFrom } from 'rxjs';

export interface AdvisorProfile {
    uid: string;
    phoneNumber: string;
    fullName: string;
    profilePhotoUrl: string;
    isActive: boolean;
    createdAt: number;
    vigenciaVIP?: number; // Guardo timestamp en milisegundos
    vigenciaPremium?: number; // Guardo timestamp en milisegundos
}

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private auth: Auth = inject(Auth);
    private firestore: Firestore = inject(Firestore);
    private storage: Storage = inject(Storage);

    // RxJS Subjects for reactivity
    private currentUserSubject = new BehaviorSubject<User | null>(null);
    public currentUser$: Observable<User | null> = authState(this.auth);

    private currentProfileSubject = new BehaviorSubject<AdvisorProfile | null>(null);
    public currentProfile$: Observable<AdvisorProfile | null> = this.currentProfileSubject.asObservable();

    private confirmationResult: ConfirmationResult | null = null;
    private appVerifier: RecaptchaVerifier | null = null;

    constructor() {
        this.currentUser$.subscribe(async (user) => {
            this.currentUserSubject.next(user);
            if (user) {
                await this.loadUserProfile(user.uid);
            } else {
                this.currentProfileSubject.next(null);
            }
        });
    }

    get currentUser(): User | null {
        return this.auth.currentUser;
    }

    get currentProfile(): AdvisorProfile | null {
        return this.currentProfileSubject.value;
    }

    // 1. Initialize Recaptcha (Required for SMS Auth)
    initRecaptchaPlugin(containerId: string) {
        this.appVerifier = new RecaptchaVerifier(this.auth, containerId, {
            'size': 'invisible',
            'callback': () => {
                // reCAPTCHA solved
            }
        });
    }

    // 2. Request SMS OTP
    async sendOtp(phoneNumber: string): Promise<void> {
        if (!this.appVerifier) throw new Error('RecaptchaVerifier not initialized');

        // Auto-append Mexico country code as per specs
        const formattedNumber = `+52${phoneNumber}`;

        try {
            this.confirmationResult = await signInWithPhoneNumber(this.auth, formattedNumber, this.appVerifier);
        } catch (error) {
            console.error('Error sending SMS OTP', error);
            throw error;
        }
    }

    // 3. Verify OTP Code
    async verifyOtp(code: string): Promise<User> {
        if (!this.confirmationResult) throw new Error('No pending OTP verification');

        try {
            const result = await this.confirmationResult.confirm(code);
            return result.user;
        } catch (error) {
            console.error('Error verifying OTP', error);
            throw error;
        }
    }

    // 4. Logout
    async logout(): Promise<void> {
        await this.auth.signOut();
    }

    // Load profile from Firestore
    private async loadUserProfile(uid: string): Promise<void> {
        const docRef = doc(this.firestore, `advisors/${uid}`);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            this.currentProfileSubject.next({ uid, ...docSnap.data() } as AdvisorProfile);
        } else {
            // Si no existe, setearemos nulo y el componente decidirá redigirir a completar perfil
            this.currentProfileSubject.next(null);
        }
    }

    // 5. Create Profile (Onboarding)
    async completeProfile(fullName: string, profilePhotoUrl: string = ''): Promise<void> {
        const user = this.currentUser;
        if (!user) throw new Error('Cannot create profile without an active auth session');

        // Phone format in DB should be 10 digits as per specs
        const cleanPhone = user.phoneNumber?.replace('+52', '') || '';

        const newProfile: AdvisorProfile = {
            uid: user.uid,
            phoneNumber: cleanPhone,
            fullName,
            profilePhotoUrl: profilePhotoUrl || 'assets/default-avatar.png',
            isActive: true,
            createdAt: Date.now(),
            vigenciaVIP: 0,
            vigenciaPremium: 0
        };

        const docRef = doc(this.firestore, `advisors/${user.uid}`);
        await setDoc(docRef, newProfile);

        this.currentProfileSubject.next(newProfile);
    }

    // Direct check to avoid race conditions during login flow
    async checkProfileExists(uid: string): Promise<boolean> {
        const docRef = doc(this.firestore, `advisors/${uid}`);
        const docSnap = await getDoc(docRef);
        return docSnap.exists();
    }

    // 6. Upload Profile Photo
    async uploadProfilePhoto(file: File, uid: string): Promise<string> {
        const filePath = `advisors/${uid}/profile_${Date.now()}`;
        const storageRef = ref(this.storage, filePath);
        await uploadBytes(storageRef, file);
        return await getDownloadURL(storageRef);
    }

    // 7. Update Profile
    async updateProfile(uid: string, data: Partial<AdvisorProfile>): Promise<void> {
        const docRef = doc(this.firestore, `advisors/${uid}`);

        const batch = writeBatch(this.firestore);
        batch.set(docRef, data, { merge: true });

        // Sincronizar los cambios con la información desnormalizada en todas sus propiedades
        if (data.fullName || data.phoneNumber || data.profilePhotoUrl) {
            const propertiesRef = collection(this.firestore, 'properties');
            const q = query(propertiesRef, where('advisorUid', '==', uid));
            const querySnapshot = await getDocs(q);

            const propertyUpdate: any = {};
            if (data.fullName) propertyUpdate.advisorName = data.fullName;
            if (data.phoneNumber) propertyUpdate.advisorPhone = data.phoneNumber;
            if (data.profilePhotoUrl) propertyUpdate.advisorProfilePhoto = data.profilePhotoUrl;

            querySnapshot.forEach((propertyDoc) => {
                batch.update(propertyDoc.ref, propertyUpdate);
            });
        }

        await batch.commit();

        // Update local state
        const current = this.currentProfileSubject.value;
        if (current) {
            this.currentProfileSubject.next({ ...current, ...data });
        }
    }
}
