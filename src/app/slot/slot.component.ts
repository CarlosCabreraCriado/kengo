import {
  Component,
  Input,
  ViewChild,
  ViewContainerRef,
  OnInit,
} from '@angular/core';
import { BentoService } from '../services/bento.service';

@Component({
  selector: 'app-slot',
  standalone: true,
  imports: [],
  template: `<ng-template #container></ng-template>`,
})
export class SlotComponent implements OnInit {
  @Input() slotName!: string;
  @ViewChild('container', { read: ViewContainerRef, static: true })
  container!: ViewContainerRef;

  constructor(private bentoService: BentoService) {}

  async ngOnInit() {
    const component = await this.bentoService.getComponentForSlot(
      this.slotName,
    );
    if (component) {
      this.container.clear();
      this.container.createComponent(component);
    }
  }
}
