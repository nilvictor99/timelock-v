import { z } from "zod";

const commonCompromised = new Set([
  "passwordpassword",
  "123456789012",
  "1234567890123456",
  "qwertyuiopasdf",
  "correcthorsebatterystaple",
  "letmeinletmein",
  "adminadminadmin"
]);

export const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email("Introduce un correo válido."),
  password: z.string().min(12, "La contraseña debe tener al menos 12 caracteres.").refine(
    (value) => !commonCompromised.has(value.toLowerCase()),
    "Elige una contraseña menos común."
  )
});

export const registrationSchema = credentialsSchema.extend({
  name: z.string().trim().min(2, "Introduce tu nombre."),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: "Debes aceptar los términos." }) }),
  remember: z.boolean().optional()
});
