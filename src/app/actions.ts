"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  commitImport,
  createStaff,
  markModuleLinkOk,
  matchLogin,
  previewDevelopmentReport,
  setStorePassword,
  syncDevelopmentReport,
  addCatalogModule,
  addSecondPath,
  createTrainee,
  deleteTrainee,
  moveCatalogModule,
  moveCatalogModuleToSection,
  previewImport,
  previewSpanish,
  retranslateModule,
  removeCatalogModule,
  restoreCatalogModule,
  setTraineeLanguage,
  setTraineePath,
  translateMissingSpanish,
  updateModuleTemplate,
  updateProgress,
  updateStaff,
  updateStoreName,
  updateTrainee,
  type SingleContext,
} from "@/lib/data";
import { access, loadRoleDefaults, requireAdmin } from "@/lib/access";
import { effectivePermissions, isPermission, isUserRole, type Permission, type UserRole } from "@/lib/permissions";
import { matchUserLogin, resetUserPermissions, saveAppUser, saveRoleDefaults, type UserDraft } from "@/lib/users";
import { prisma } from "@/lib/db";
import { googleSheetsDevelopmentReportSource } from "@/lib/roster/google-sheets";
import { csvDevelopmentReportSource } from "@/lib/roster/source";
import { SESSION_COOKIE, createSessionToken, safeNextPath, sessionCookieOptions } from "@/lib/session";
import { seedDatabase } from "@/lib/seed-run";

function message(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

function refreshAll() {
  revalidatePath("/", "layout");
}

export async function createTraineeAction(input: {
  name: string;
  storeId: string;
  startDate: string;
  language: string;
  position: string;
  path: string;
}) {
  try {
    const id = await createTrainee(input);
    refreshAll();
    return { id };
  } catch (error) {
    return { error: message(error) };
  }
}

export async function updateTraineeAction(formData: FormData) {
  const id = String(formData.get("id") || "");
  try {
    await updateTrainee(id, {
      name: String(formData.get("name") || ""),
      storeId: String(formData.get("storeId") || ""),
      startDate: String(formData.get("startDate") || ""),
      status: String(formData.get("status") || "ACTIVE"),
      path: String(formData.get("path") || ""),
    });
  } catch (error) {
    redirect(`/trainees/${id}?error=${encodeURIComponent(message(error))}`);
  }
  refreshAll();
  redirect(`/trainees/${id}?saved=details`);
}

export async function setTraineePathAction(formData: FormData) {
  const id = String(formData.get("id") || "");
  try {
    await setTraineePath(id, String(formData.get("path") || ""));
  } catch (error) {
    redirect(`/trainees/${id}?error=${encodeURIComponent(message(error))}`);
  }
  refreshAll();
  redirect(`/trainees/${id}?saved=path`);
}

export async function addSecondPathAction(formData: FormData) {
  const id = String(formData.get("id") || "");
  try {
    await addSecondPath(id);
  } catch (error) {
    redirect(`/trainees/${id}?error=${encodeURIComponent(message(error))}`);
  }
  refreshAll();
  redirect(`/trainees/${id}?saved=second`);
}

export async function changeLanguageAction(formData: FormData) {
  const id = String(formData.get("id") || "");
  const language = formData.get("language") === "es" ? "es" : "en";
  try {
    await setTraineeLanguage(id, language);
  } catch (error) {
    redirect(`/trainees/${id}?error=${encodeURIComponent(message(error))}`);
  }
  refreshAll();
  redirect(`/trainees/${id}?saved=language`);
}

export async function deleteTraineeAction(formData: FormData) {
  const id = String(formData.get("id") || "");
  if (formData.get("confirm") !== "yes") {
    redirect(`/trainees/${id}?error=${encodeURIComponent("Check the box to remove this trainee.")}`);
  }
  await deleteTrainee(id);
  refreshAll();
  redirect("/trainees");
}

export async function saveProgressAction(input: {
  traineeModuleId: string;
  scheduledDate: string;
  trainerValue: string;
  completed: boolean;
  completedDate: string;
  notes: string;
}) {
  try {
    await updateProgress(input);
    refreshAll();
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: message(error) };
  }
}

export async function saveStoreAction(formData: FormData) {
  const id = String(formData.get("id") || "");
  try {
    await updateStoreName(id, String(formData.get("name") || ""));
  } catch (error) {
    redirect(`/admin?error=${encodeURIComponent(message(error))}`);
  }
  refreshAll();
  redirect(`/admin?saved=store#store-${id}`);
}

export async function createStaffAction(formData: FormData) {
  const storeId = String(formData.get("storeId") || "");
  try {
    await createStaff({
      storeId,
      name: String(formData.get("name") || ""),
      position: String(formData.get("position") || ""),
      isGm: formData.get("isGm") === "on",
      qualified: formData.get("qualified") === "on",
    });
  } catch (error) {
    redirect(`/admin?error=${encodeURIComponent(message(error))}#store-${storeId}`);
  }
  refreshAll();
  redirect(`/admin?saved=person#store-${storeId}`);
}

export async function updateStaffAction(formData: FormData) {
  const id = String(formData.get("id") || "");
  const storeId = String(formData.get("storeId") || "");
  try {
    await updateStaff(id, {
      name: String(formData.get("name") || ""),
      position: String(formData.get("position") || ""),
      isGm: formData.get("isGm") === "on",
      qualified: formData.get("qualified") === "on",
      active: formData.get("active") === "on",
    });
  } catch (error) {
    redirect(`/admin?error=${encodeURIComponent(message(error))}#store-${storeId}`);
  }
  refreshAll();
  redirect(`/admin?saved=person#store-${storeId}`);
}

export async function saveModuleAction(input: {
  id: string;
  name: string;
  timeLabel: string;
  videoCount: string;
  credit: string;
  link: string;
  videoTitles: string;
  note: string;
  spanishManual?: { name: string; videoTitles: string; note: string };
}) {
  try {
    const result = await updateModuleTemplate(input.id, input);
    refreshAll();
    return { ok: true as const, warning: result.warning, spanish: result.spanish };
  } catch (error) {
    return { ok: false as const, error: message(error) };
  }
}

export async function previewSpanishAction(input: { name: string; videoTitles: string; note: string }) {
  try {
    const text = await previewSpanish(input);
    return text ? { ok: true as const, text } : { ok: false as const, error: "Spanish translation did not run. You can still save the English module." };
  } catch (error) {
    return { ok: false as const, error: message(error) };
  }
}

export async function retranslateModuleAction(id: string) {
  try {
    const result = await retranslateModule(id);
    refreshAll();
    return { ok: true as const, warning: result.warning, spanish: result.spanish };
  } catch (error) {
    return { ok: false as const, error: message(error) };
  }
}

export async function translateMissingAction() {
  let notice = "";
  let warning = "";
  try {
    const result = await translateMissingSpanish();
    notice = `Translated ${result.updated} module${result.updated === 1 ? "" : "s"}. ${result.skipped} already had Spanish text.`;
    warning = result.warning ? `&warning=${encodeURIComponent(result.warning)}` : "";
  } catch (error) {
    redirect(`/admin/modules?error=${encodeURIComponent(message(error))}`);
  }
  refreshAll();
  redirect(`/admin/modules?saved=translated&notice=${encodeURIComponent(notice)}${warning}`);
}

export async function addModuleAction(formData: FormData) {
  const language = formData.get("lang") === "es" ? "es" : "en";
  const source = formData.get("spanishSource") === "manual" ? "manual" : "auto";
  let warning = "";
  try {
    const result = await addCatalogModule({
      section: String(formData.get("section") || ""),
      nameEn: String(formData.get("nameEn") || ""),
      nameEs: String(formData.get("nameEs") || ""),
      timeLabel: String(formData.get("timeLabel") || ""),
      videoCount: String(formData.get("videoCount") || ""),
      credit: String(formData.get("credit") || ""),
      link: String(formData.get("link") || ""),
      videoTitles: String(formData.get("videoTitles") || ""),
      note: String(formData.get("note") || ""),
      videoTitlesEs: String(formData.get("videoTitlesEs") || ""),
      noteEs: String(formData.get("noteEs") || ""),
      spanishSource: source,
    });
    warning = result.warning ? `&warning=${encodeURIComponent(result.warning)}` : "";
  } catch (error) {
    redirect(`/admin/modules?lang=${language}&error=${encodeURIComponent(message(error))}`);
  }
  refreshAll();
  redirect(`/admin/modules?lang=${language}&saved=added${warning}`);
}

export async function markModuleLinkOkAction(id: string) {
  try {
    await markModuleLinkOk(id);
    refreshAll();
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: message(error) };
  }
}

export async function moveModuleSectionAction(id: string, section: string) {
  try {
    await moveCatalogModuleToSection(id, section);
    refreshAll();
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: message(error) };
  }
}

export async function moveModuleAction(id: string, direction: "up" | "down") {
  try {
    await moveCatalogModule(id, direction);
    refreshAll();
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: message(error) };
  }
}

export async function removeModuleAction(id: string) {
  try {
    const outcome = await removeCatalogModule(id);
    refreshAll();
    return { ok: true as const, outcome };
  } catch (error) {
    return { ok: false as const, error: message(error) };
  }
}

export async function restoreModuleAction(id: string) {
  try {
    await restoreCatalogModule(id);
    refreshAll();
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: message(error) };
  }
}

export async function previewImportAction(csv: string, single: SingleContext | null) {
  try {
    const preview = await previewImport(csv, single);
    return { preview };
  } catch (error) {
    return { error: message(error) };
  }
}

export async function commitImportAction(csv: string, single: SingleContext | null) {
  try {
    const result = await commitImport(csv, single);
    refreshAll();
    return { result };
  } catch (error) {
    return { error: message(error) };
  }
}

export async function previewRosterAction(csv: string) {
  try {
    const preview = await previewDevelopmentReport(csv);
    return { preview };
  } catch (error) {
    return { error: message(error) };
  }
}

export async function commitRosterAction(csv: string) {
  try {
    const result = await syncDevelopmentReport(csvDevelopmentReportSource(csv));
    refreshAll();
    return { result };
  } catch (error) {
    return { error: message(error) };
  }
}

export async function syncGoogleRosterAction() {
  try {
    const result = await syncDevelopmentReport(googleSheetsDevelopmentReportSource());
    refreshAll();
    return { result };
  } catch (error) {
    return { error: message(error) };
  }
}

export async function signInAction(input: { login?: string; password: string; nextPath: string }) {
  if (!process.env.APP_PASSWORD) return { error: "Access is not configured yet. Add APP_PASSWORD on the host." };
  if (!process.env.SESSION_SECRET) return { error: "Access is not configured yet. Add SESSION_SECRET on the host." };
  const login = (input.login ?? "").trim();
  const jar = await cookies();
  const nextPath = safeNextPath(input.nextPath);
  if (login) {
    const match = await matchUserLogin(login, input.password);
    if (!match) return { error: "That username or password does not match." };
    jar.set(SESSION_COOKIE, await createSessionToken({ role: "user", userId: match.userId, version: match.version }), sessionCookieOptions());
    const account = await prisma.appUser.findUnique({ where: { id: match.userId } });
    const defaults = await loadRoleDefaults();
    const permissions =
      account && isUserRole(account.role) ? effectivePermissions(account.role, account.permissionOverrides, defaults) : null;
    const opensAdmin = Boolean(
      permissions && (permissions.users || permissions.modules || permissions.roster_import || permissions.store_logins),
    );
    redirect(!opensAdmin && nextPath.startsWith("/admin") ? "/" : nextPath);
  }
  const match = await matchLogin(input.password);
  if (!match) return { error: "That password does not match." };
  jar.set(SESSION_COOKIE, await createSessionToken(match), sessionCookieOptions());
  redirect(match.role === "user" && nextPath.startsWith("/admin") ? "/" : nextPath);
}

export async function saveUserAction(input: UserDraft) {
  try {
    const who = await access();
    const defaults = await loadRoleDefaults();
    const id = await saveAppUser(who, input, defaults);
    refreshAll();
    return { id };
  } catch (error) {
    return { error: message(error) };
  }
}

export async function resetUserPermissionsAction(userId: string) {
  try {
    const who = await access();
    await resetUserPermissions(who, userId);
    refreshAll();
    return { ok: true as const };
  } catch (error) {
    return { error: message(error) };
  }
}

export async function saveRoleDefaultsAction(input: { role: UserRole; permissions: Permission[] }) {
  try {
    const who = await access();
    const permissions = input.permissions.filter(isPermission);
    await saveRoleDefaults(who, input.role, permissions);
    refreshAll();
    return { ok: true as const };
  } catch (error) {
    return { error: message(error) };
  }
}

export async function signOutAction() {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
  redirect("/login");
}

export async function setStorePasswordAction(formData: FormData) {
  const storeId = String(formData.get("storeId") || "");
  try {
    await setStorePassword(storeId, String(formData.get("password") || ""), String(formData.get("confirm") || ""));
  } catch (error) {
    redirect(`/admin/access?error=${encodeURIComponent(message(error))}#store-${storeId}`);
  }
  redirect(`/admin/access?saved=1#store-${storeId}`);
}

export async function resetSampleAction(formData: FormData) {
  await requireAdmin();
  if (formData.get("confirm") !== "yes") {
    redirect("/admin?error=Check+the+box+to+replace+everything+with+the+sample+set.");
  }
  await seedDatabase(prisma);
  refreshAll();
  redirect("/?reset=1");
}
