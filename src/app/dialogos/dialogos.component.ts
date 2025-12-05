import { Component, Inject } from "@angular/core";
import {
  MAT_DIALOG_DATA,
  MatDialogRef,
  MatDialogTitle,
  MatDialogContent,
  MatDialogActions,
  MatDialogClose,
} from "@angular/material/dialog";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { FormsModule } from "@angular/forms";
import { MatInputModule } from "@angular/material/input";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { RouterLink } from "@angular/router";

export interface DialogData {
  tipo:
    | "confirmacion"
    | "informativo"
    | "error"
    | "exito"
    | "procesando"
    | "warning"
    | "link"
    | "web";
  titulo: string;
  mensaje: string;
  routerLink?: string;
  mensajeLink?: string;
}

// Dialog Overview Example Dialog
@Component({
  selector: "dialog-overview-example-dialog",
  templateUrl: "dialogos.component.html",
  styleUrl: "./dialogos.component.scss",
  standalone: true,
  imports: [
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatInputModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    RouterLink,
  ],
})
export class DialogoComponent {
  constructor(
    public dialogRef: MatDialogRef<DialogoComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DialogData,
  ) {}

  onNoClick(): void {
    this.dialogRef.close();
  }
}
