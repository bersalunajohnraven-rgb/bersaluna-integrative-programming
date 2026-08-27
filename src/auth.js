import { supabase } from "./supabaseClient.js";

export async function getCurrentUser() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, name, email, role, phone, address, created_at")
    .eq("id", session.user.id)
    .maybeSingle();

  if (error) {
    console.error("Failed to load profile:", error.message);
    return null;
  }
  if (!profile) return null;

  return { ...profile, session };
}

export async function requireAuth(redirect = "login.html") {
  const user = await getCurrentUser();
  if (!user) {
    alert("You must log in first.");
    window.location.href = redirect;
    return null;
  }
  return user;
}

export async function requireAdmin(redirect = "login.html") {
  const user = await requireAuth(redirect);
  if (!user) return null;
  if (user.role !== "admin") {
    alert("Access denied. Admins only.");
    window.location.href = "index.html";
    return null;
  }
  return user;
}

export async function signOutAndRedirect() {
  await supabase.auth.signOut();
  window.location.href = "login.html";
}
