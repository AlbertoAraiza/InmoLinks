import { Injectable, inject } from '@angular/core';
import { Firestore, collection, doc, setDoc, query, where, getDocs, deleteDoc, getDoc, updateDoc } from '@angular/fire/firestore';
import { Storage, ref, uploadBytes, getDownloadURL } from '@angular/fire/storage';
import { AuthService, AdvisorProfile } from './auth.service';

export interface PropertyListing {
    id?: string;
    advisorUid: string;
    advisorName: string;
    advisorProfilePhoto: string;
    advisorPhone: string;
    title: string;
    description: string;
    price: number;
    currency: string;
    status: 'published' | 'draft' | 'sold';
    location: {
        city: string;
        neighborhood: string;
        zone: 'Centro' | 'Norte' | 'Sur' | 'Oriente' | 'Poniente';
        zipCode?: string;
        address?: string;
        approxLat: number;
        approxLng: number;
    };
    features: {
        bedrooms: number;
        bathrooms: number;
        landAreaSqM: number;
        constructionAreaSqM: number;
    };
    media: {
        images: string[];
        videos: string[];
    }
}

@Injectable({
    providedIn: 'root'
})
export class PropertyService {
    private firestore: Firestore = inject(Firestore);
    private storage: Storage = inject(Storage);
    private authService: AuthService = inject(AuthService);

    constructor() { }

    async createProperty(propertyData: Partial<PropertyListing>, images: File[] = []): Promise<string> {
        const profile = this.authService.currentProfile;
        if (!profile) throw new Error('Debes tener tu perfil completo para publicar.');

        // 1. Generate randomized ID
        const propertyId = doc(collection(this.firestore, 'properties')).id;

        // 2. Upload images if provided
        let uploadedUrls: string[] = [];
        if (images.length > 0) {
            uploadedUrls = await this.uploadPropertyImages(images, propertyId);
        }

        // 3. Denormalize user data into the property
        const finalProperty: PropertyListing = {
            ...propertyData,
            id: propertyId,
            advisorUid: profile.uid,
            advisorName: profile.fullName,
            advisorProfilePhoto: profile.profilePhotoUrl,
            advisorPhone: profile.phoneNumber,
            status: propertyData.status || 'draft',
            media: {
                images: uploadedUrls,
                videos: []
            }
        } as PropertyListing;

        // 3. Save to Firestore
        const docRef = doc(this.firestore, `properties/${propertyId}`);
        await setDoc(docRef, finalProperty);

        return propertyId;
    }

    async getPropertyById(propertyId: string): Promise<PropertyListing | null> {
        const docRef = doc(this.firestore, `properties/${propertyId}`);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() } as PropertyListing;
        }
        return null;
    }

    async updateProperty(propertyId: string, propertyData: Partial<PropertyListing>, newImages: File[] = [], existingImageUrls: string[] = []): Promise<void> {
        // Upload new images if any
        let uploadedUrls: string[] = [];
        if (newImages.length > 0) {
            uploadedUrls = await this.uploadPropertyImages(newImages, propertyId);
        }

        const combinedImages = [...existingImageUrls, ...uploadedUrls];

        const docRef = doc(this.firestore, `properties/${propertyId}`);

        const updateData: any = {
            ...propertyData,
            'media.images': combinedImages
        };

        // Note: For deep updates like media, it's safer to use updateDoc passing only the changed fields
        // Here we just merge to avoid overwriting advisor info
        await updateDoc(docRef, updateData);
    }

    async getMyProperties(): Promise<PropertyListing[]> {
        const user = this.authService.currentUser;
        if (!user) return [];

        const q = query(collection(this.firestore, 'properties'), where('advisorUid', '==', user.uid));
        const querySnapshot = await getDocs(q);

        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PropertyListing));
    }

    async getPublicProperty(propertyId: string): Promise<PropertyListing | null> {
        // In a real app we would use getDoc, and rely on Security Rules to block non-published.
        return null;
    }

    async deleteProperty(propertyId: string): Promise<void> {
        const docRef = doc(this.firestore, `properties/${propertyId}`);
        await deleteDoc(docRef);
    }

    async uploadPropertyImages(files: File[], propertyId: string): Promise<string[]> {
        const uploadPromises = files.map(async (file, index) => {
            const filePath = `properties/${propertyId}/image_${Date.now()}_${index}`;
            const storageRef = ref(this.storage, filePath);
            await uploadBytes(storageRef, file);
            return await getDownloadURL(storageRef);
        });

        return Promise.all(uploadPromises);
    }
}
