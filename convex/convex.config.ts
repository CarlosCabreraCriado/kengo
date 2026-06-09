import { defineApp } from "convex/server";
// LOCAL INSTALL del componente Better-Auth (antes: "@convex-dev/better-auth/convex.config").
// Conserva el mismo nombre de componente "betterAuth" → mismas tablas/datos.
// Necesario para extender el schema con los campos del plugin admin (impersonación).
import betterAuth from "./betterAuth/convex.config";
import stripe from "@convex-dev/stripe/convex.config.js";
import aggregate from "@convex-dev/aggregate/convex.config";
import migrations from "@convex-dev/migrations/convex.config";

const app = defineApp();
app.use(betterAuth);
app.use(stripe);

// Aggregates — un B-tree independiente por instancia (namespaced).
// Ver convex/aggregates/README.md para razones de namespacing y notas de
// contención.
app.use(aggregate, { name: "executionsByPaciente" });
app.use(aggregate, { name: "executionsByClinic" });
app.use(aggregate, { name: "executionsByExercise" });
app.use(aggregate, { name: "executionsByPacienteDolor" });
app.use(aggregate, { name: "sessionsByClinic" });
app.use(aggregate, { name: "plansByClinicActive" });
app.use(aggregate, { name: "patientsByClinicAdherencia" });
app.use(aggregate, { name: "patientsByClinicRiskScore" });
app.use(aggregate, { name: "patientsByClinicDolor" });
app.use(aggregate, { name: "patientsWithActivePlanByClinic" });

app.use(migrations);

export default app;
