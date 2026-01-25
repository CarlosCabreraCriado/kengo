import {
  Component,
  EventEmitter,
  Output,
  inject,
  signal,
  ElementRef,
  ViewChild,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import {
  ImageCropperComponent,
  ImageCroppedEvent,
  ImageTransform,
} from 'ngx-image-cropper';

interface DialogData {
  url_perfil?: string | null;
  resizeToWidth?: number; // p. ej. 512
  format?: 'png' | 'jpeg' | 'webp';
  quality?: number;
  precargar?: boolean; // intentar precargar la URL dada
}

@Component({
  selector: 'app-image-upload',
  templateUrl: './image-upload.component.html',
  styleUrls: ['./image-upload.component.css'],
  standalone: true,
  imports: [
    ImageCropperComponent,
  ],
})
export class ImageUploadComponent implements OnInit, OnDestroy {
  @Output() imageCropped = new EventEmitter<File>();

  private dialogRef = inject(DialogRef);
  data = inject<DialogData>(DIALOG_DATA);

  public archivoPrecargado = signal(false);

  // Estado
  imageChangedEvent: Event | null = null; // Evento del input (cuando se elige nueva imagen)
  imageURL: string | undefined | null = this.data?.url_perfil ?? null; // Para precargar la actual (si hay CORS OK)
  croppedBase64 = signal<string | null>(null);
  imageFile: File | null = null;

  //UI:
  loading = signal(false);
  loadError = signal<string | null>(null);
  pantallaCargarArchivo = signal(false);

  // Track para revocar URLs y no filtrar memoria
  private objectUrlFuente: string | null = null; // de la imagen de entrada
  private lastCroppedBlob: Blob | null = null;

  // Controles de transformación
  scale = 1;
  rotate = 0;
  flipH = false;
  flipV = false;
  // Transformaciones (permite pan/zoom/rotate)
  transform: ImageTransform = {
    scale: 1,
    translateH: 0,
    translateV: 0,
  };

  // Configuración
  readonly aspectRatio = 1; // avatar cuadrado
  readonly resizeToWidth = this.data?.resizeToWidth ?? 512;
  readonly format: 'png' | 'jpeg' | 'webp' = this.data?.format ?? 'jpeg';
  readonly quality = this.data?.quality ?? 0.9;

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild(ImageCropperComponent) cropper?: ImageCropperComponent;

  async ngOnInit() {
    // Si te pasan la URL del avatar actual y es privada, la cargamos como blob
    if (this.data?.url_perfil && this.data.precargar) {
      try {
        await this.precargarDesdeDirectus(this.data.url_perfil);
      } catch (e) {
        this.loadError.set(
          'No se pudo precargar el avatar (403). Selecciona una imagen.',
        );
        console.error(e);
      }
    }
  }

  ngOnDestroy() {
    if (this.objectUrlFuente) URL.revokeObjectURL(this.objectUrlFuente);
  }

  private async precargarDesdeDirectus(url: string) {
    this.loading.set(true);

    const res = await fetch(url, {
      mode: 'cors',
      credentials: 'include',
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);

    // Pásalo al cropper como si fuera imageURL normal
    this.objectUrlFuente = URL.createObjectURL(blob);
    this.imageURL = objUrl;
    this.imageChangedEvent = null; // nos aseguramos de usar imageURL
    this.loading.set(false);
    this.archivoPrecargado.set(true);
  }

  onNoClick(): void {
    this.dialogRef.close();
  }

  fileChangeEvent(event: Event): void {
    this.imageChangedEvent = event;
  }

  async reducirResolucion(
    blob: Blob,
    maxWidth: number,
    maxHeight: number,
  ): Promise<Blob[]> {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(blob);

      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;

        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height *= maxWidth / width;
            width = maxWidth;
          } else {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (optimizedBlob) => {
            URL.revokeObjectURL(url); // Liberar memoria
            if (optimizedBlob) {
              resolve([optimizedBlob]);
            }
          },
          'image/jpeg',
          0.8,
        ); // Calidad 80%
      };

      img.src = url;
    });
  }

  /** Abrir selector de archivos */
  openFilePicker() {
    this.fileInput?.nativeElement?.click();
  }

  onFileSelected(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const isImage = /^image\/(png|jpe?g|webp|gif|bmp|avif)$/i.test(file.type);
    const maxSizeMB = 8;
    if (!isImage) {
      this.loadError.set('Selecciona una imagen válida.');
      input.value = '';
      return;
    }
    if (file.size > maxSizeMB * 1024 * 1024) {
      this.loadError.set(`La imagen supera ${maxSizeMB} MB.`);
      input.value = '';
      return;
    }

    // Revoca la fuente anterior si la había
    if (this.objectUrlFuente) {
      URL.revokeObjectURL(this.objectUrlFuente);
      this.objectUrlFuente = null;
    }

    // Reset de errores y preview
    this.loadError.set(null);
    this.lastCroppedBlob = null;

    // Para activar el cropper con el archivo local:
    this.imageChangedEvent = null;
    this.imageURL = null;
    this.imageFile = file;

    // Limpia el input para permitir re-seleccionar el mismo archivo
    input.value = '';
    this.pantallaCargarArchivo.set(false);
  }

  // Drag & drop (desde escritorio o desde el navegador)
  async onDrop(ev: DragEvent) {
    ev.preventDefault();
    ev.stopPropagation();

    this.resetFuente();

    const dt = ev.dataTransfer;
    if (!dt) return;

    console.warn('Drop:', dt);
    // 1) Caso habitual: arrastran un archivo del SO
    if (dt.files && dt.files.length) {
      const file = dt.files[0];
      if (!this.esImagenValida(file)) return;
      this.imageFile = file;
      this.imageChangedEvent = null;
      this.imageURL = null;
      this.pantallaCargarArchivo.set(false);
      console.error('File arrastrado:', file);
      return;
    }

    // 2) Caso: arrastran una imagen desde otra pestaña (obtienes una URL, no un File)
    const url = dt.getData('text/uri-list') || dt.getData('text/plain');
    if (url && /^https?:\/\//i.test(url)) {
      try {
        const res = await fetch(url, { mode: 'cors' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();

        // Intenta deducir la extensión
        const ext = (blob.type && blob.type.split('/')[1]) || 'png';
        const file = new File([blob], `dropped.${ext}`, {
          type: blob.type || 'image/png',
        });

        if (!this.esImagenValida(file)) {
          console.error('Imagen no valida', file);
          return;
        }

        this.imageFile = file;
        this.imageChangedEvent = null;
        this.imageURL = null;
        this.pantallaCargarArchivo.set(false);
      } catch (e) {
        console.warn('No se pudo cargar la imagen arrastrada por URL:', e);
        this.loadError.set(
          'No se pudo cargar la imagen arrastrada (CORS). Guarda la imagen y arrástrala desde tu equipo.',
        );
      }
    }
  }

  onDragOver(ev: DragEvent) {
    ev.preventDefault();
  }

  private esImagenValida(file: File): boolean {
    // HEIC/HEIF no es soportado por la mayoría de navegadores
    const type = file.type.toLowerCase();
    const name = (file.name || '').toLowerCase();
    const isImage =
      /^image\/(png|jpe?g|webp|gif|bmp|avif)$/i.test(type) ||
      /\.(png|jpe?g|jpg|webp|gif|bmp|avif)$/.test(name);

    if (!isImage) {
      this.loadError.set(
        'Selecciona una imagen válida (png, jpg, webp, gif, bmp, avif).',
      );
      return false;
    }
    const maxSizeMB = 8;
    if (file.size > maxSizeMB * 1024 * 1024) {
      this.loadError.set(`La imagen supera ${maxSizeMB} MB.`);
      return false;
    }
    if (
      type.includes('heic') ||
      name.endsWith('.heic') ||
      name.endsWith('.heif')
    ) {
      this.loadError.set(
        'HEIC/HEIF no es compatible. Convierte la imagen a JPG/PNG/WebP primero.',
      );
      return false;
    }
    this.loadError.set(null);
    return true;
  }

  private resetFuente() {
    this.loadError.set(null);
    this.lastCroppedBlob = null;

    if (this.objectUrlFuente) {
      URL.revokeObjectURL(this.objectUrlFuente);
      this.objectUrlFuente = null;
    }

    this.imageFile = null;
    this.imageChangedEvent = null;
  }

  /** Evento de recorte del cropper */
  onCropped(e: ImageCroppedEvent) {
    // Con output='blob', e.blob llega con cada cambio
    if (e.blob) {
      this.lastCroppedBlob = e.blob;
    }
  }

  onCropperReady() {
    this.loading.set(false);
    this.transform = {
      ...this.transform,
      scale: 1,
      translateH: 0,
      translateV: 0,
    };
  }

  onLoadImageFailed() {
    this.loading.set(false);
    this.loadError.set(
      'No se pudo cargar la imagen (¿problema CORS o archivo corrupto?).',
    );
  }

  /** Controles de transformación */
  zoomIn() {
    this.scale = Math.min(this.scale + 0.1, 5);
    this.applyTransform();
  }
  zoomOut() {
    this.scale = Math.max(this.scale - 0.1, 0.2);
    this.applyTransform();
  }
  rotateLeft() {
    this.rotate = (this.rotate - 90) % 360;
    this.applyTransform();
  }
  rotateRight() {
    this.rotate = (this.rotate + 90) % 360;
    this.applyTransform();
  }
  toggleFlipH() {
    this.flipH = !this.flipH;
    this.applyTransform();
  }
  toggleFlipV() {
    this.flipV = !this.flipV;
    this.applyTransform();
  }
  resetTransform() {
    this.scale = 1;
    this.rotate = 0;
    this.flipH = false;
    this.flipV = false;
    this.applyTransform();
  }
  private applyTransform() {
    this.transform = {
      scale: this.scale,
      rotate: this.rotate,
      flipH: this.flipH,
      flipV: this.flipV,
    };
  }

  // === Guardar: recorte programático a Blob ===
  async guardar() {
    try {
      // Si tenemos el último blob de (imageCropped), úsalo; si no, recorta ahora
      let blob = this.lastCroppedBlob;
      if (!blob) {
        blob = (await this.cropper?.crop('blob'))?.blob ?? null;
      }
      if (!blob) {
        this.loadError.set('Selecciona una imagen y ajusta el recorte.');
        return;
      }

      // Asegura mime/extensión coherentes
      const mime = blob.type || `image/${this.data.format}`;
      const ext = mime.includes('jpeg')
        ? 'jpg'
        : mime.split('/')[1] ||
          (this.data.format === 'jpeg' ? 'jpg' : this.data.format);

      const file = new File([blob], `avatar.${ext}`, { type: mime });

      this.dialogRef.close({ file });
    } catch (e) {
      console.error(e);
      this.loadError.set('No se pudo generar el recorte.');
    }
  }

  cancelar() {
    this.dialogRef.close(null);
  }

  private async base64ToFile(
    base64: string,
    filename: string,
    format: 'png' | 'jpeg' | 'webp',
    quality: number,
  ): Promise<File> {
    // Convertimos base64 a Blob manteniendo el mime
    const res = await fetch(base64);
    let blob = await res.blob();

    // (Opcional) Fuerza recomprimir con el formato/calidad deseados
    blob = await this.reencodeBlob(blob, `image/${format}`, quality);

    return new File([blob], filename, { type: `image/${format}` });
  }

  /** Re-encode para asegurar mime/calidad (canvas) */
  private reencodeBlob(
    blob: Blob,
    mime: string,
    quality: number,
  ): Promise<Blob> {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(blob);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (b) => {
            URL.revokeObjectURL(url);
            resolve(b ?? blob);
          },
          mime,
          quality,
        );
      };
      img.src = url;
    });
  }
}
