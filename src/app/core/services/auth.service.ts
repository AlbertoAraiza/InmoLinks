import { Injectable, inject } from '@angular/core';
import {
    Auth, authState, User,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    sendPasswordResetEmail,
    updatePassword,
    reauthenticateWithCredential,
    EmailAuthProvider
} from '@angular/fire/auth';
import { Firestore, doc, getDoc, setDoc, writeBatch, collection, query, where, getDocs } from '@angular/fire/firestore';
import { Storage, ref, uploadBytes, getDownloadURL } from '@angular/fire/storage';
import { BehaviorSubject, Observable, from, firstValueFrom } from 'rxjs';

export interface AdvisorProfile {
    uid: string;
    email: string;
    phoneNumber: string;
    fullName: string;
    profilePhotoUrl: string;
    isActive: boolean;
    createdAt: number;
    vigenciaVIP?: number;
    vigenciaPremium?: number;
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

    // 1. Login with Email & Password
    async login(email: string, password: string): Promise<User> {
        try {
            const result = await signInWithEmailAndPassword(this.auth, email, password);
            return result.user;
        } catch (error) {
            console.error('Error in login', error);
            throw error;
        }
    }

    // 2. Register new User and Profile
    async register(data: { email: string, password: string, fullName: string, phoneNumber: string }): Promise<User> {
        try {
            const result = await createUserWithEmailAndPassword(this.auth, data.email, data.password);

            // Create the profile in Firestore immediately
            const newProfile: AdvisorProfile = {
                uid: result.user.uid,
                email: data.email,
                phoneNumber: data.phoneNumber,
                fullName: data.fullName,
                profilePhotoUrl: 'assets/default-avatar.png',
                isActive: true,
                createdAt: Date.now(),
                vigenciaVIP: 0,
                vigenciaPremium: 0
            };

            await setDoc(doc(this.firestore, `advisors/${result.user.uid}`), newProfile);
            this.currentProfileSubject.next(newProfile);

            return result.user;
        } catch (error) {
            console.error('Error in register', error);
            throw error;
        }
    }

    // 3. Reset Password
    async sendPasswordReset(email: string): Promise<void> {
        await sendPasswordResetEmail(this.auth, email);
    }

    // 4. Update Password (with re-authentication)
    async changePassword(currentPassword: string, newPassword: string): Promise<void> {
        const user = this.auth.currentUser;
        if (!user || !user.email) throw new Error('No user logged in');

        const credential = EmailAuthProvider.credential(user.email, currentPassword);

        try {
            await reauthenticateWithCredential(user, credential);
            await updatePassword(user, newPassword);
        } catch (error) {
            console.error('Error changing password', error);
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

    // 5. Complete Profile (Onboarding - Optional if handled by register)
    async completeProfile(fullName: string, profilePhotoUrl: string = ''): Promise<void> {
        const user = this.currentUser;
        if (!user) throw new Error('Cannot create profile without an active auth session');

        const newProfile: AdvisorProfile = {
            uid: user.uid,
            email: user.email || '',
            phoneNumber: '', // Should be provided if not handled in register
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
