import { Component, inject } from '@angular/core';
import { DialogRef } from '@angular/cdk/dialog';

@Component({
  selector: 'app-privacy-policy',
  standalone: true,
  imports: [],
  templateUrl: './privacy-policy.component.html',
  styleUrl: './privacy-policy.component.css',
})
export class PrivacyPolicyComponent {
  private dialogRef = inject(DialogRef);

  cerrar() {
    this.dialogRef.close();
  }
}
