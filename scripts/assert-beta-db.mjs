const ref = process.env.VERCEL_GIT_COMMIT_REF ?? "";
const raw = process.env.DATABASE_URL ?? "";
if (!raw) {
  console.log("DB_TARGET=missing");
  if (ref === "beta") process.exit(1);
  process.exit(0);
}
const host = new URL(raw).hostname;
const productionBranch = host.includes("ep-steep-bar-bb19ewgv");
console.log(productionBranch ? "DB_TARGET=production-branch" : "DB_TARGET=other-branch");
if (ref === "beta" && productionBranch) {
  console.error("Refusing to build beta against the production database.");
  process.exit(1);
}
