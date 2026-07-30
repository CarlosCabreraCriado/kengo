# CONTEXT.md — Lenguaje ubicuo de Kengo

Glosario de términos del dominio. Solo vocabulario: sin detalles de implementación.

## Billing / suscripciones

- **Plan** (o **tier**): nivel comercial de una clínica — `Lonely`, `Smart` o `Medium`. Se **deriva** del número de fisios facturables de la clínica; nunca se elige directamente. Cambiar de plan = cambiar el tamaño del equipo.
- **Variante**: eje elegible del pricing, `base` o `ilimitada`. Es el único aspecto del plan que el owner decide. La variante `base` impone un cap de pacientes; la `ilimitada` no tiene cap.
- **Cap de pacientes**: número máximo de pacientes vinculados que admite la variante base de cada plan. "Sin cap" aplica a la variante ilimitada y a las clínicas enterprise.
- **Fisio facturable**: miembro de la clínica con puesto `fisio` o `admin`. Determina el plan y la cantidad facturada.
- **Paciente vinculado**: miembro de la clínica con puesto `paciente`. Es lo que cuenta contra el cap de pacientes.
- **Pre-checkout**: situación de una clínica sin suscripción viva (`none`, `canceled`, `incomplete`), en la que activar la suscripción crea una suscripción nueva. Es el único momento en que la variante se elige *antes* de pagar; con suscripción viva, la variante se cambia sobre la suscripción existente.
- **Enterprise**: clínica que supera el límite de autoservicio (más de 9 fisios). No tiene plan de catálogo: requiere contacto con ventas.
- **Owner**: propietario único de la clínica; la única persona que puede gestionar la suscripción.
