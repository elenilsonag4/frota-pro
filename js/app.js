
document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("login-form");
  const loginMessage = document.getElementById("login-message");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const submitButton = loginForm?.querySelector('button[type="submit"]');

  function showMessage(message, type = "") {
    if (!loginMessage) return;

    loginMessage.textContent = message;
    loginMessage.className = "message";

    if (type) {
      loginMessage.classList.add(type);
    }
  }

  if (!loginForm) return;

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      showMessage("Informe seu e-mail e sua senha.", "error");
      return;
    }

    const supabaseClient = window.frotaSupabase;

    if (!supabaseClient) {
      showMessage(
        "A conexão com o Supabase ainda está sendo configurada. Tente novamente após a próxima etapa.",
        "error"
      );
      return;
    }

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Entrando...";
    }

    showMessage("Verificando seu acesso...");

    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        throw error;
      }

      if (!data.user) {
        throw new Error("Não foi possível confirmar o usuário.");
      }

      const { data: profile, error: profileError } = await supabaseClient
        .from("profiles")
        .select("full_name, role, active, can_edit")
        .eq("id", data.user.id)
        .maybeSingle();

      if (profileError) {
        await supabaseClient.auth.signOut();
        throw new Error("Não foi possível verificar seu perfil. Tente novamente.");
      }

      if (!profile || !profile.active) {
        await supabaseClient.auth.signOut();
        throw new Error("Seu usuário não está ativo. Procure o administrador.");
      }

      showMessage(
        `Login confirmado. Bem-vindo${profile.full_name ? ", " + profile.full_name : ""}! A próxima etapa será abrir o painel do sistema.`,
        "success"
      );

      loginForm.reset();
    } catch (error) {
      showMessage(
        error.message || "Não foi possível entrar. Confira seus dados.",
        "error"
      );
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "Entrar";
      }
    }
  });
});
