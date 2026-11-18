"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  commitImport,
  createStaff,
  previewDevelopmentReport,
  syncDevelopmentReport,
  createTrainee,
  deleteTrainee,
  previewImport,
  setTraineeLanguage,
  updateModuleTemplate,
  updateProgress,
  updateStaff,
  updateStoreName,
  updateTrainee,
  type SingleContext,
} from "@/lib/data";
import { prisma } from "@/lib/db";
import { googleSheetsDevelopmentReportSource } from "@/lib/roster/google-sheets";
import { csvDevelopmentReportSource } from "@/lib/roster/source";
import { SESSION_COOKIE, createSessionToken, safeEqual, safeNextPath, sessionCookieOptions } from "@/lib/session";
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
      position: String(formData.get("position") || ""),
      status: String(formData.get("status") || "ACTIVE"),
    });
  } catch (error) {
    redirect(`/trainees/${id}?error=${encodeURIComponent(message(error))}`);
  }
  refreshAll();
  redirect(`/trainees/${id}?saved=details`);
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
}) {
  try {
    await updateModuleTemplate(input.id, input);
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

export async function signInAction(input: { password: string; nextPath: string }) {
  const expected = process.env.APP_PASSWORD;
  if (!expected) return { error: "Access is not configured yet. Add APP_PASSWORD on the host." };
  if (!process.env.SESSION_SECRET) return { error: "Access is not configured yet. Add SESSION_SECRET on the host." };
  if (!safeEqual(input.password, expected)) return { error: "That password does not match." };
  const jar = await cookies();
  jar.set(SESSION_COOKIE, await createSessionToken(), sessionCookieOptions());
  redirect(safeNextPath(input.nextPath));
}

export async function signOutAction() {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
  redirect("/login");
}

export async function resetSampleAction(formData: FormData) {
  if (formData.get("confirm") !== "yes") {
    redirect("/admin?error=Check+the+box+to+replace+everything+with+the+sample+set.");
  }
  await seedDatabase(prisma);
  refreshAll();
  redirect("/?reset=1");
}
