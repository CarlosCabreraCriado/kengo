import { Component, Input, Output, EventEmitter, Inject } from "@angular/core";
import { MatCardModule } from "@angular/material/card";
import { TablaInstitucionesComponent } from "../../tabla-instituciones/tabla-instituciones.component";
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
  selector: "app-selector-institucion",
  standalone: true,
  imports: [
    TablaInstitucionesComponent,
    MatCardModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    MatButtonModule,
  ],
  providers: [],
  templateUrl: "./selector-institucion.component.html",
  styleUrl: "./selector-institucion.component.scss",
})
export class SelectorInstitucionComponent {
  @Input({ required: false }) input: boolean = true;
  @Output() output = new EventEmitter<any>();

  constructor(
    public dialogRef: MatDialogRef<SelectorInstitucionComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
  ) {}

  seleccionarInstitucion(id_institucion: number) {
    this.dialogRef.close(id_institucion);
  }
}
