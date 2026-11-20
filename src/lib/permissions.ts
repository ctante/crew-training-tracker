export const PERMISSIONS = [
  {
    key: "sign_off",
    label: "Sign off modules",
    detail: "Mark a module complete and set the completed date.",
    group: "Training",
    adminGrant: false,
  },
  {
    key: "schedule",
    label: "Schedule sessions",
    detail: "Set the training date and the trainer on a module.",
    group: "Training",
    adminGrant: false,
  },
  {
    key: "trainees_edit",
    label: "Add or edit trainees",
    detail: "Add a trainee and change the name, restaurant, language, or start date. The first path is chosen when the trainee is added.",
    group: "Training",
    adminGrant: false,
  },
  {
    key: "trainees_deactivate",
    label: "Deactivate trainees",
    detail: "Pause, complete, or remove a trainee.",
    group: "Training",
    adminGrant: false,
  },
  {
    key: "paths",
    label: "Choose or change paths",
    detail: "Change Service or Production, or add the second path.",
    group: "Training",
    adminGrant: false,
  },
  {
    key: "reports",
    label: "Run reports",
    detail: "Open reports for the restaurants this person can see.",
    group: "Reports",
    adminGrant: false,
  },
  {
    key: "export",
    label: "Export CSV",
    detail: "Download trainee and report spreadsheets.",
    group: "Reports",
    adminGrant: false,
  },
  {
    key: "view_development",
    label: "View development",
    detail: "See the weekly development hours and comments for the restaurants this person can open.",
    group: "Development",
    adminGrant: false,
  },
  {
    key: "edit_development",
    label: "Edit development",
    detail: "Change weekly hours, comments, and store notes, copy last week, and import a development sheet. With Manage roster, add and edit people on that page.",
    group: "Development",
    adminGrant: true,
  },
  {
    key: "view_stores",
    label: "View other stores",
    detail: "See every restaurant assigned to this account, not just one. An Admin still has to assign those restaurants.",
    group: "Scope",
    adminGrant: true,
  },
  {
    key: "modules",
    label: "Manage modules",
    detail: "Edit the training path catalog.",
    group: "Admin",
    adminGrant: true,
  },
  {
    key: "roster_import",
    label: "Manage roster and import",
    detail: "Add, edit, and remove people on the development roster, and import bulk progress.",
    group: "Admin",
    adminGrant: true,
  },
  {
    key: "users",
    label: "Manage users",
    detail: "Create accounts, set passwords, and choose permissions.",
    group: "Admin",
    adminGrant: true,
  },
  {
    key: "store_logins",
    label: "Manage store logins",
    detail: "Set the shared password for a restaurant.",
    group: "Admin",
    adminGrant: true,
  },
] as const;

export type Permission = (typeof PERMISSIONS)[number]["key"];
export type UserRole = "ADMIN" | "SUPERVISOR" | "MANAGER" | "USER";

export const USER_ROLES: UserRole[] = ["ADMIN", "SUPERVISOR", "MANAGER", "USER"];

const ALL_KEYS = PERMISSIONS.map((item) => item.key);

export const CODE_ROLE_DEFAULTS: Record<UserRole, Permission[]> = {
  USER: ["sign_off"],
  MANAGER: ["sign_off", "schedule", "trainees_edit", "reports", "export", "view_development"],
  SUPERVISOR: ["sign_off", "schedule", "trainees_edit", "reports", "export", "view_development", "view_stores", "users"],
  ADMIN: [...ALL_KEYS],
};

export type PermissionMap = Record<Permission, boolean>;
export type RoleDefaultMap = Record<UserRole, Permission[]>;

export function isUserRole(value: string): value is UserRole {
  return USER_ROLES.includes(value as UserRole);
}

export function isPermission(value: string): value is Permission {
  return ALL_KEYS.includes(value as Permission);
}

export function isAdminGrant(key: Permission) {
  return PERMISSIONS.find((item) => item.key === key)?.adminGrant === true;
}

export function emptyPermissionMap(): PermissionMap {
  return Object.fromEntries(ALL_KEYS.map((key) => [key, false])) as PermissionMap;
}

export function permissionMap(keys: readonly string[]): PermissionMap {
  const map = emptyPermissionMap();
  for (const key of keys) {
    if (isPermission(key)) map[key] = true;
  }
  return map;
}

export function roleDefaults(role: UserRole, custom?: RoleDefaultMap): PermissionMap {
  const keys = role === "ADMIN" ? CODE_ROLE_DEFAULTS.ADMIN : (custom?.[role] ?? CODE_ROLE_DEFAULTS[role]);
  return permissionMap(keys);
}

export function parseOverrides(value: unknown): Partial<PermissionMap> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const overrides: Partial<PermissionMap> = {};
  for (const [key, allowed] of Object.entries(value)) {
    if (isPermission(key) && typeof allowed === "boolean") overrides[key] = allowed;
  }
  return overrides;
}

export function effectivePermissions(role: UserRole, overrides: unknown, custom?: RoleDefaultMap): PermissionMap {
  const map = roleDefaults(role, custom);
  for (const [key, allowed] of Object.entries(parseOverrides(overrides))) {
    if (isPermission(key) && typeof allowed === "boolean") map[key] = allowed;
  }
  return map;
}

export function overridesFor(role: UserRole, selected: PermissionMap, custom?: RoleDefaultMap): Partial<PermissionMap> {
  const defaults = roleDefaults(role, custom);
  const overrides: Partial<PermissionMap> = {};
  for (const key of ALL_KEYS) {
    if (selected[key] !== defaults[key]) overrides[key] = selected[key];
  }
  return overrides;
}

export function selectedKeys(map: PermissionMap): Permission[] {
  return ALL_KEYS.filter((key) => map[key]);
}

export function permissionLabel(key: Permission) {
  return PERMISSIONS.find((item) => item.key === key)?.label ?? key;
}

export const ROLE_SUMMARIES: { role: UserRole; title: string; text: string }[] = [
  {
    role: "USER",
    title: "User",
    text: "Signs off modules for one restaurant. The shared restaurant password is a User account. The username is the restaurant number, and the password can also be used with the username left blank.",
  },
  {
    role: "MANAGER",
    title: "Manager",
    text: "Everything a User can do, plus scheduling, adding trainees, reports, and viewing the development week, for one restaurant.",
  },
  {
    role: "SUPERVISOR",
    title: "Supervisor",
    text: "Everything a Manager can do, across the restaurants assigned here, plus managing Managers and Users for those restaurants.",
  },
  {
    role: "ADMIN",
    title: "Admin",
    text: "Every restaurant and every Admin page, including editing the development week. The admin password still signs in without a username.",
  },
];
