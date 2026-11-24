export type HelpRoleId = "USER" | "MANAGER" | "SUPERVISOR" | "ADMIN";

export type HelpGuide = {
  id: HelpRoleId;
  title: string;
  summary: string;
  video: string;
  captions: string;
  poster: string;
  steps: string[];
};

export const HELP_GUIDES: HelpGuide[] = [
  {
    id: "USER",
    title: "User",
    summary: "Sign off training that is finished at your restaurant. A User sees one restaurant.",
    video: "/help/user.mp4",
    captions: "/help/user.vtt",
    poster: "/help/user.jpg",
    steps: [
      "Sign in with your username and password.",
      "Open the Board. It lists the trainees at your restaurant.",
      "Open a trainee to see the Individual Training Schedule.",
      "Check Completed on a module that is finished. The date fills in.",
      "Sign out when you leave the shared desk.",
    ],
  },
  {
    id: "MANAGER",
    title: "Manager",
    summary: "Run training for one restaurant: add a trainee, choose a path, mark modules complete, and use the Schedule.",
    video: "/help/manager.mp4",
    captions: "/help/manager.vtt",
    poster: "/help/manager.jpg",
    steps: [
      "Sign in as a Manager for your restaurant.",
      "Open Trainees to see that restaurant's crew.",
      "Add a trainee and choose Service or Production. Foundation is included for everyone.",
      "Open the trainee and check Completed on a finished module.",
      "Open Schedule and pick a day. The number on the calendar is how many people train that day.",
      "The full Employee Roster is an Admin page. A Manager works from Trainees and Schedule.",
    ],
  },
  {
    id: "SUPERVISOR",
    title: "Supervisor",
    summary: "Compare the restaurants assigned to you, then schedule across those restaurants.",
    video: "/help/supervisor.mp4",
    captions: "/help/supervisor.vtt",
    poster: "/help/supervisor.jpg",
    steps: [
      "Sign in as a Supervisor. The header lists every restaurant assigned to you.",
      "Open Reports. Use Select All or Clear All, then Apply Stores.",
      "Read completion by restaurant to compare progress.",
      "Open Schedule and switch the restaurant filter to see one store or all of yours.",
      "Open a trainee when you need to sign off or check a date.",
    ],
  },
  {
    id: "ADMIN",
    title: "Admin",
    summary: "Every restaurant, plus the roster, user accounts, store passwords, and the training path.",
    video: "/help/admin.mp4",
    captions: "/help/admin.vtt",
    poster: "/help/admin.jpg",
    steps: [
      "Sign in with the admin password. Leave the username blank.",
      "Open Admin, then Employee Roster. Positions come from the roster import.",
      "Use Import CSV when a new MyQSRSoft file arrives. The file needs a position column.",
      "Open Users to add an account and choose User, Manager, Supervisor, or Admin.",
      "Open Store Passwords to set the shared login for a restaurant.",
      "Open Modules to review the Crew Training Path materials.",
    ],
  },
];

export function helpRoleId(role: string): HelpRoleId {
  if (role === "admin") return "ADMIN";
  if (role === "supervisor") return "SUPERVISOR";
  if (role === "manager") return "MANAGER";
  return "USER";
}

const HELP_MEDIA = /^(user|manager|supervisor|admin)\.(mp4|vtt|jpg)$/;

export function helpMediaRole(file: string): HelpRoleId | null {
  const match = HELP_MEDIA.exec(file);
  if (!match) return null;
  return match[1].toUpperCase() as HelpRoleId;
}

export function canWatchHelp(viewerRole: string, fileRole: HelpRoleId) {
  if (viewerRole === "admin") return true;
  return helpRoleId(viewerRole) === fileRole;
}
