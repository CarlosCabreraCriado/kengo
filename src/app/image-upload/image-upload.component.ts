import { Component, EventEmitter, Output, Inject } from "@angular/core";
import { ImageCroppedEvent, ImageCropperComponent } from "ngx-image-cropper";
import { MatButtonModule } from "@angular/material/button";
import {
  MAT_DIALOG_DATA,
  MatDialogRef,
  MatDialogTitle,
  MatDialogContent,
  MatDialogActions,
  MatDialogClose,
} from "@angular/material/dialog";

@Component({
  selector: "app-image-upload",
  templateUrl: "./image-upload.component.html",
  styleUrls: ["./image-upload.component.scss"],
  standalone: true,
  imports: [ImageCropperComponent, MatButtonModule, MatDialogClose],
})
export class ImageUploadComponent {
  imageChangedEvent: any = "";
  croppedImage: any = "";

  @Output() imageCropped = new EventEmitter<File>();

  private imagen: Blob[] | null = null;
  private base64: Blob | null | undefined = null;

  constructor(
    public dialogRef: MatDialogRef<ImageUploadComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
  ) {
    if (data.url_perfil) {
      this.croppedImage = data.url_perfil;
    }
  }

  onNoClick(): void {
    this.dialogRef.close();
  }

  fileChangeEvent(event: any): void {
    this.imageChangedEvent = event;
  }

  imageCroppedEvent(event: ImageCroppedEvent): void {
    if (event.blob == undefined) {
      return;
    }
    this.base64 = event.blob;
  }

  guardar() {
    if (this.base64) {
      this.reducirResolucion(this.base64, 300, 300) // Reducir a 300x300px
        .then((blob) => {
          this.dialogRef.close({ blob: blob });
        });
    }
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
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d")!;

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
          "image/jpeg",
          0.8,
        ); // Calidad 80%
      };

      img.src = url;
    });
  }
}

