/**
 * TimeLock-v no crea usuarios demo: todas las cuentas se registran mediante
 * la autenticación local. Los datos existentes se conservan al hacer db push.
 */
async function main() {
  console.log("Seed omitido: crea una cuenta desde /register para comenzar.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
