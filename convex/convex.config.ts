import { defineApp } from "convex/server";
import betterAuth from "@convex-dev/better-auth/convex.config";
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

app.use(migrations);

export default app;
