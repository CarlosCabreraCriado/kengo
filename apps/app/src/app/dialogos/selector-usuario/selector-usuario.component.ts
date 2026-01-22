import { Component, Input, Output, EventEmitter } from "@angular/core";
import { MatCardModule } from "@angular/material/card";
import { TablaUsuariosComponent } from "../../tabla-usuarios/tabla-usuarios.component";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";

import {
  MatDialogRef,
  MatDialogTitle,
  MatDialogContent,
  MatDialogActions,
  MatDialogClose,
} from "@angular/material/dialog";

@Component({
  selector: "app-selector-usuario",
  standalone: true,
  imports: [
    TablaUsuariosComponent,
    MatCardModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    MatButtonModule,
    MatIconModule,
  ],
  providers: [],
  templateUrl: "./selector-usuario.component.html",
  styleUrl: "./selector-usuario.component.scss",
})
export class SelectorUsuarioComponent {
  @Input({ required: false }) input: boolean = true;
  @Output() output = new EventEmitter<any>();

  constructor(public dialogRef: MatDialogRef<SelectorUsuarioComponent>) {}
  seleccionarUsuario(id_usuario: number) {
    this.dialogRef.close(id_usuario);
  }
}
