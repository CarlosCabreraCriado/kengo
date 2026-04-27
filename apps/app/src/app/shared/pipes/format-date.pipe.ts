import { Pipe, PipeTransform } from '@angular/core';
import { formatDate, type FormatDateVariant } from '../utils/format-date';

@Pipe({ name: 'formatDate', standalone: true, pure: true })
export class FormatDatePipe implements PipeTransform {
  transform(value: string | null | undefined, variant: FormatDateVariant = 'long'): string {
    return value ? formatDate(value, variant) : '';
  }
}
