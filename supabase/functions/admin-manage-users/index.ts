import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

if (req.method === "OPTIONS") {
  return new Response(null, { status: 200, headers: corsHeaders });
}

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !serviceRoleKey) {
  return new Response(
    JSON.stringify({ error: "Server is not configured correctly." }),
    { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

try {
  // Verify the caller is an admin by checking their JWT's profile role.
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) {
    return new Response(
      JSON.stringify({ error: "Unauthorized." }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: callerData, error: callerError } = await callerClient.auth.getUser(token);
  if (callerError || !callerData.user) {
    return new Response(
      JSON.stringify({ error: "Unauthorized." }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const callerId = callerData.user.id;
  const { data: callerProfile, error: profileError } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", callerId)
    .maybeSingle();

  if (profileError || !callerProfile || callerProfile.role !== "admin") {
    return new Response(
      JSON.stringify({ error: "Access denied. Admins only." }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || (req.method === "GET" ? "list" : "");

  // ---- LIST USERS ----
  if (req.method === "GET" && action === "list") {
    const { data, error } = await adminClient
      .from("profiles")
      .select("id, name, email, role, created_at")
      .order("created_at", { ascending: true });

    if (error) {
      return new Response(
        JSON.stringify({ error: "Failed to load users." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    return new Response(
      JSON.stringify({ users: data }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // ---- CREATE USER ----
  if (req.method === "POST" && action === "create") {
    const body = await req.json();
    const { name, email, password, role } = body;

    if (!name || !email || !password) {
      return new Response(
        JSON.stringify({ error: "Name, email, and password are required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: "Password must be at least 6 characters." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const safeRole = role === "admin" ? "admin" : "user";

    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: email.toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: { name },
    });

    if (authError) {
      return new Response(
        JSON.stringify({ error: authError.message || "Failed to create user." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // The trigger creates a default 'user' profile row; update role if admin.
    if (safeRole === "admin") {
      await adminClient
        .from("profiles")
        .update({ role: "admin" })
        .eq("id", authData.user.id);
    }

    return new Response(
      JSON.stringify({ message: "User created successfully.", id: authData.user.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // ---- DELETE USER ----
  if (req.method === "DELETE" && action === "delete") {
    const body = await req.json();
    const { userId } = body;

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "User ID is required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (userId === callerId) {
      return new Response(
        JSON.stringify({ error: "You cannot delete your own account." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prevent deleting the last admin.
    const { data: admins } = await adminClient
      .from("profiles")
      .select("id")
      .eq("role", "admin");

    if (admins && admins.length <= 1 && admins[0]?.id === userId) {
      return new Response(
        JSON.stringify({ error: "Cannot delete the last admin account." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);

    if (deleteError) {
      return new Response(
        JSON.stringify({ error: deleteError.message || "Failed to delete user." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // profiles row is removed by ON DELETE CASCADE on the FK.
    return new Response(
      JSON.stringify({ message: "User deleted successfully." }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ error: "Unsupported request." }),
    { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
} catch (err) {
  return new Response(
    JSON.stringify({ error: "An unexpected error occurred." }),
    { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
