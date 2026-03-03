import { Component, Inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
    selector: 'app-lightbox-dialog',
    standalone: true,
    imports: [CommonModule, MatButtonModule, MatIconModule],
    template: `
    <div class="lightbox-container position-relative w-100 h-100 bg-black d-flex flex-column align-items-center justify-content-center" (click)="closeDialog()">
      
      <!-- Top Bar -->
      <div class="position-absolute top-0 w-100 p-3 d-flex justify-content-between align-items-center z-3" (click)="$event.stopPropagation()">
          <span class="text-white fw-bold fs-5">{{ currentIndex + 1 }} / {{ data.images.length }}</span>
          <button mat-icon-button color="warn" class="bg-dark rounded-circle text-white shadow-sm opacity-75" (click)="closeDialog()">
              <mat-icon>close</mat-icon>
          </button>
      </div>

      <!-- Main Image -->
      <div class="d-flex align-items-center justify-content-center w-100 h-100 p-md-5" (click)="$event.stopPropagation()">
          <!-- Added pinch-zoom specific logic could go here, but a CSS scalable img serves as baseline -->
          <img [src]="data.images[currentIndex]" 
               class="img-fluid object-fit-contain shadow-lg lightbox-img" 
               style="max-height: 90vh; max-width: 95vw; transition: transform 0.2s;"
               (dblclick)="toggleZoom()"
               [style.transform]="isZoomed ? 'scale(2)' : 'scale(1)'"
               [style.cursor]="isZoomed ? 'zoom-out' : 'zoom-in'">
      </div>

      <!-- Nav Controls -->
      <button mat-icon-button class="position-absolute start-0 ms-2 ms-md-4 text-white p-3 rounded-circle bg-dark opacity-50 nav-btn" 
              style="top: 50%; width: 56px; height: 56px;" 
              *ngIf="data.images.length > 1"
              (click)="prev($event)">
          <mat-icon style="font-size: 32px; width: 32px; height: 32px; line-height: 24px;">chevron_left</mat-icon>
      </button>

      <button mat-icon-button class="position-absolute end-0 me-2 me-md-4 text-white p-3 rounded-circle bg-dark opacity-50 nav-btn" 
              style="top: 50%; width: 56px; height: 56px;" 
              *ngIf="data.images.length > 1"
              (click)="next($event)">
          <mat-icon style="font-size: 32px; width: 32px; height: 32px; line-height: 24px;">chevron_right</mat-icon>
      </button>

      <!-- Bottom instruction -->
      <div class="position-absolute bottom-0 w-100 p-3 text-center z-3 pointer-events-none" *ngIf="!isZoomed">
         <p class="text-white small opacity-75 m-0 d-none d-md-block">Usa las flechas de tu teclado para navegar. Doble clic para acercar.</p>
      </div>

    </div>
  `,
    styles: [`
    .lightbox-container {
        height: 100vh !important;
        width: 100vw !important;
        overflow: hidden;
    }
    .nav-btn:hover {
        opacity: 0.9 !important;
        transform: scale(1.1);
        transition: all 0.2s;
    }
    .pointer-events-none { pointer-events: none; }
  `]
})
export class LightboxDialogComponent {
    currentIndex: number;
    isZoomed = false;

    constructor(
        public dialogRef: MatDialogRef<LightboxDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: { images: string[], startIndex: number }
    ) {
        this.currentIndex = data.startIndex || 0;
    }

    @HostListener('window:keydown', ['$event'])
    handleKeyboardEvent(event: KeyboardEvent) {
        if (event.key === 'ArrowRight') {
            this.next();
        } else if (event.key === 'ArrowLeft') {
            this.prev();
        } else if (event.key === 'Escape') {
            this.closeDialog();
        }
    }

    next(event?: Event) {
        if (event) event.stopPropagation();
        this.isZoomed = false;
        this.currentIndex = (this.currentIndex + 1) % this.data.images.length;
    }

    prev(event?: Event) {
        if (event) event.stopPropagation();
        this.isZoomed = false;
        this.currentIndex = (this.currentIndex - 1 + this.data.images.length) % this.data.images.length;
    }

    toggleZoom() {
        this.isZoomed = !this.isZoomed;
    }

    closeDialog() {
        this.dialogRef.close();
    }
}
