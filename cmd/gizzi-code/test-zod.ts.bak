import z from "zod";

const schema = z.string();
console.log("Zod version:", z.version);
console.log("Schema ~standard property:", (schema as any)["~standard"]);

if (!(schema as any)["~standard"]) {
  console.log("FATAL: Zod schema is NOT Standard Schema compliant!");
} else {
  console.log("Vendor:", (schema as any)["~standard"].vendor);
}
