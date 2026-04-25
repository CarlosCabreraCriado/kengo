import { type Provider } from '@angular/core';
import { ConvexService } from './convex.service';

export function provideConvex(): Provider[] {
  return [ConvexService];
}
