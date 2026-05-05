import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Eye, EyeOff, LogIn, UserPlus, Ticket, CheckCircle, XCircle, KeyRound, ArrowLeft, Mail, Store, TrendingUp, Handshake } from "lucide-react";
import { SiGoogle } from "react-icons/si";
import { useToast } from "@/hooks/use-toast";
import builtLogo from "@assets/Logo_Built_2_Horizontal_Branca_Nova.png";

interface ConviteInfo {
  gerador_nome: string | null;
  comunidade_nome: string | null;
  expires_at: string | null;
}

export default function LoginPage() {
  const [, navigate] = useLocation();
  const { login, loginPending, isAuthenticated } = useAuth();
  const { toast } = useToast();

  // Initialize mode immediately from URL — avoids flash of wrong mode
  const [mode, setMode] = useState<"login" | "register" | "forgot" | "reset">(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("reset")) return "reset";
    if (p.get("convite")) return "register";
    return "login";
  });

  // Login state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  // Forgot / reset password state
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotResending, setForgotResending] = useState(false);
  const [forgotResentOk, setForgotResentOk] = useState(false);
  const [resetToken, setResetToken] = useState(() => new URLSearchParams(window.location.search).get("reset") || "");
  const [resetPassword, setResetPassword] = useState("");
  const [resetPassword2, setResetPassword2] = useState("");
  const [showResetPass, setShowResetPass] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const [resetError, setResetError] = useState("");

  // Clean up URL params after reading them and handle Google errors
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") === "google_failed") {
      setError("Falha ao autenticar com Google. Tente novamente.");
    } else if (params.get("error") === "google_no_invite") {
      setError("Para acessar a plataforma é necessário um convite de um membro da rede BUILT. Acesse via e-mail e senha ou solicite seu convite.");
    }
    // Remove query string from URL bar so tokens aren't visible / bookmarked
    if (window.location.search) {
      window.history.replaceState({}, "", "/login");
    }
  }, []);

  // After Google OAuth redirect, session is set server-side — just refresh
  useEffect(() => {
    if (isAuthenticated) navigate("/");
  }, [isAuthenticated]);

  // Register state
  const [regNome, setRegNome] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regPassword2, setRegPassword2] = useState("");
  const [showRegPass, setShowRegPass] = useState(false);
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState("");
  const [regConviteToken, setRegConviteToken] = useState(() => new URLSearchParams(window.location.search).get("convite") || "");
  const [conviteInfo, setConviteInfo] = useState<ConviteInfo | null>(null);
  const [conviteStatus, setConviteStatus] = useState<"idle" | "valid" | "invalid">("idle");
  const [conviteChecking, setConviteChecking] = useState(false);

  // Interests modal state
  const [showInteressesModal, setShowInteressesModal] = useState(false);
  const [interessesSelecionados, setInteressesSelecionados] = useState<string[]>([]);

  // Validate convite token when it changes
  useEffect(() => {
    if (!regConviteToken || regConviteToken.length < 10) {
      setConviteInfo(null);
      setConviteStatus("idle");
      return;
    }
    const timeout = setTimeout(async () => {
      setConviteChecking(true);
      try {
        const res = await fetch(`/api/convite-publico/${regConviteToken}`);
        if (res.ok) {
          const data = await res.json();
          setConviteInfo(data);
          setConviteStatus("valid");
        } else {
          setConviteInfo(null);
          setConviteStatus("invalid");
        }
      } catch {
        setConviteInfo(null);
        setConviteStatus("invalid");
      } finally {
        setConviteChecking(false);
      }
    }, 500);
    return () => clearTimeout(timeout);
  }, [regConviteToken]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await login({ email, password });
      navigate("/");
    } catch (err: any) {
      const msg = err?.message || "Credenciais inválidas";
      setError(msg);
      toast({ title: "Erro ao entrar", description: msg, variant: "destructive" });
    }
  }

  function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setRegError("");
    if (!regConviteToken) {
      setRegError("Informe o código de convite para se cadastrar.");
      return;
    }
    if (conviteStatus === "invalid") {
      setRegError("Código de convite inválido ou expirado.");
      return;
    }
    if (regPassword !== regPassword2) {
      setRegError("As senhas não coincidem");
      return;
    }
    if (regPassword.length < 4) {
      setRegError("Senha deve ter pelo menos 4 caracteres");
      return;
    }
    setInteressesSelecionados([]);
    setShowInteressesModal(true);
  }

  function toggleInteresse(valor: string) {
    setInteressesSelecionados(prev =>
      prev.includes(valor) ? prev.filter(v => v !== valor) : [...prev, valor]
    );
  }

  async function handleConfirmarCadastro() {
    if (interessesSelecionados.length === 0) return;
    setRegLoading(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: regNome,
          email: regEmail,
          username: regUsername || regEmail.split("@")[0].replace(/[^a-z0-9_]/gi, "_").toLowerCase(),
          password: regPassword,
          convite_token: regConviteToken,
          interesses: interessesSelecionados,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao criar conta");
      setShowInteressesModal(false);
      if (data.pagamento_token) {
        navigate(`/pagamento/${data.pagamento_token}`);
      } else if (data.vitrine_token) {
        await queryClient.invalidateQueries({ queryKey: ["/api/me"] });
        navigate(`/adesao/${data.vitrine_token}`);
      } else {
        toast({ title: "Conta criada!", description: "Você já pode fazer login." });
        setEmail(regEmail);
        setMode("login");
      }
    } catch (err: any) {
      setRegError(err.message);
      setShowInteressesModal(false);
    } finally {
      setRegLoading(false);
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setForgotLoading(true);
    try {
      await fetch("/api/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
      });
      setForgotSent(true);
    } catch {
      // silently fail — user still sees success message
    } finally {
      setForgotLoading(false);
    }
  }

  async function handleResend() {
    if (forgotResending) return;
    setForgotResending(true);
    setForgotResentOk(false);
    try {
      await fetch("/api/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
      });
      setForgotResentOk(true);
      setTimeout(() => setForgotResentOk(false), 4000);
    } catch {
      // silently ignore
    } finally {
      setForgotResending(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setResetError("");
    if (resetPassword !== resetPassword2) { setResetError("As senhas não coincidem"); return; }
    if (resetPassword.length < 4) { setResetError("Senha deve ter pelo menos 4 caracteres"); return; }
    setResetLoading(true);
    try {
      const res = await fetch("/api/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: resetToken, password: resetPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao redefinir senha");
      setResetDone(true);
    } catch (err: any) {
      setResetError(err.message);
    } finally {
      setResetLoading(false);
    }
  }

  const inputCls = "bg-white/10 border-white/20 text-white placeholder:text-white/30 focus:border-[#D7BB7D] focus:ring-[#D7BB7D]/20";

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#001D34]">
      <div className="w-full max-w-sm px-4">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <img src={builtLogo} alt="BUILT Alliances" className="w-56" />
        </div>

        {/* Tab toggle — hidden in forgot/reset mode */}
        {(mode === "login" || mode === "register") && (
          <div className="flex rounded-xl bg-white/5 border border-white/10 p-1 mb-4 gap-1">
            <button
              onClick={() => setMode("login")}
              className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{
                background: mode === "login" ? "#D7BB7D" : "transparent",
                color: mode === "login" ? "#001D34" : "rgba(255,255,255,0.4)",
              }}
            >
              Entrar
            </button>
            <button
              onClick={() => setMode("register")}
              className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{
                background: mode === "register" ? "#D7BB7D" : "transparent",
                color: mode === "register" ? "#001D34" : "rgba(255,255,255,0.4)",
              }}
            >
              Novo Cadastro
            </button>
          </div>
        )}

        <Card className="bg-white/5 border-white/10 backdrop-blur">
          {mode === "forgot" ? (
            <>
              <CardHeader className="pb-2 pt-6 px-6">
                <button onClick={() => setMode("login")} className="flex items-center gap-1.5 text-white/40 hover:text-white/70 text-xs mb-3 transition-colors">
                  <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao login
                </button>
                <h2 className="text-white text-lg font-semibold">Esqueci minha senha</h2>
                <p className="text-white/40 text-xs mt-0.5">Informe seu e-mail e enviaremos um link para redefinir a senha.</p>
              </CardHeader>
              <CardContent className="px-6 pb-6">
                {forgotSent ? (
                  <div className="text-center py-4 space-y-3">
                    <CheckCircle className="w-10 h-10 text-green-400 mx-auto" />
                    <p className="text-white/80 text-sm">Se existe uma conta com este e-mail, você receberá um link em instantes.</p>
                    <p className="text-white/40 text-xs">Não recebeu? Verifique sua caixa de spam ou reenvie abaixo.</p>
                    <button
                      onClick={handleResend}
                      disabled={forgotResending}
                      data-testid="btn-reenviar-email"
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-[#D7BB7D]/30 text-[#D7BB7D] text-sm font-semibold hover:bg-[#D7BB7D]/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {forgotResending ? (
                        <>
                          <span className="w-4 h-4 border-2 border-[#D7BB7D]/40 border-t-[#D7BB7D] rounded-full animate-spin" />
                          Reenviando…
                        </>
                      ) : forgotResentOk ? (
                        <>
                          <CheckCircle className="w-4 h-4 text-green-400" />
                          E-mail reenviado!
                        </>
                      ) : (
                        <>
                          <Mail className="w-4 h-4" />
                          Reenviar e-mail
                        </>
                      )}
                    </button>
                    <button onClick={() => { setMode("login"); setForgotSent(false); setForgotEmail(""); setForgotResentOk(false); }} className="text-white/30 text-xs hover:text-white/60 transition-colors">Voltar ao login</button>
                  </div>
                ) : (
                  <form onSubmit={handleForgot} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-white/70 text-sm">E-mail da conta</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                        <Input type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} placeholder="seu@email.com" className={`${inputCls} pl-9`} required data-testid="input-forgot-email" />
                      </div>
                    </div>
                    <Button type="submit" disabled={forgotLoading} className="w-full bg-[#D7BB7D] hover:bg-[#C4A96A] text-[#001D34] font-semibold h-10" data-testid="button-forgot-submit">
                      {forgotLoading ? <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-[#001D34]/30 border-t-[#001D34] rounded-full animate-spin" />Enviando...</span> : <span className="flex items-center gap-2"><Mail className="w-4 h-4" />Enviar link de redefinição</span>}
                    </Button>
                  </form>
                )}
              </CardContent>
            </>
          ) : mode === "reset" ? (
            <>
              <CardHeader className="pb-2 pt-6 px-6">
                <h2 className="text-white text-lg font-semibold flex items-center gap-2"><KeyRound className="w-5 h-5 text-[#D7BB7D]" />Nova senha</h2>
                <p className="text-white/40 text-xs mt-0.5">Defina sua nova senha de acesso à plataforma.</p>
              </CardHeader>
              <CardContent className="px-6 pb-6">
                {resetDone ? (
                  <div className="text-center py-4 space-y-3">
                    <CheckCircle className="w-10 h-10 text-green-400 mx-auto" />
                    <p className="text-white/80 text-sm">Senha redefinida com sucesso!</p>
                    <button onClick={() => { setMode("login"); setResetDone(false); }} className="text-[#D7BB7D] text-xs hover:underline">Fazer login</button>
                  </div>
                ) : (
                  <form onSubmit={handleResetPassword} className="space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1.5">
                        <Label className="text-white/70 text-sm">Nova senha</Label>
                        <div className="relative">
                          <Input type={showResetPass ? "text" : "password"} value={resetPassword} onChange={e => setResetPassword(e.target.value)} placeholder="Mín. 4 chars" className={`${inputCls} pr-8`} required data-testid="input-reset-password" />
                          <button type="button" onClick={() => setShowResetPass(v => !v)} className="absolute right-2.5 top-2.5 text-white/30 hover:text-white/60">
                            {showResetPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-white/70 text-sm">Confirmar</Label>
                        <Input type="password" value={resetPassword2} onChange={e => setResetPassword2(e.target.value)} placeholder="Repita" className={`${inputCls} ${resetPassword2 && resetPassword !== resetPassword2 ? "border-red-500/40" : ""}`} required data-testid="input-reset-password2" />
                      </div>
                    </div>
                    {resetError && <p className="text-red-400 text-sm text-center">{resetError}</p>}
                    <Button type="submit" disabled={resetLoading} className="w-full bg-[#D7BB7D] hover:bg-[#C4A96A] text-[#001D34] font-semibold h-10" data-testid="button-reset-submit">
                      {resetLoading ? <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-[#001D34]/30 border-t-[#001D34] rounded-full animate-spin" />Salvando...</span> : <span className="flex items-center gap-2"><KeyRound className="w-4 h-4" />Salvar nova senha</span>}
                    </Button>
                  </form>
                )}
              </CardContent>
            </>
          ) : mode === "login" ? (
            <>
              <CardHeader className="pb-2 pt-6 px-6">
                <h2 className="text-white text-lg font-semibold">Entrar na plataforma</h2>
              </CardHeader>
              <CardContent className="px-6 pb-6">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-white/70 text-sm">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      data-testid="input-email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu@email.com"
                      autoComplete="email"
                      className={inputCls}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="password" className="text-white/70 text-sm">Senha</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        data-testid="input-password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Sua senha"
                        autoComplete="current-password"
                        className={`${inputCls} pr-10`}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-end -mt-1">
                    <button type="button" onClick={() => setMode("forgot")} className="text-xs text-white/40 hover:text-[#D7BB7D] transition-colors" data-testid="link-forgot-password">
                      Esqueci minha senha
                    </button>
                  </div>
                  {error && <p className="text-red-400 text-sm text-center">{error}</p>}
                  <Button
                    type="submit"
                    data-testid="button-login"
                    disabled={loginPending}
                    className="w-full bg-[#D7BB7D] hover:bg-[#C4A96A] text-[#001D34] font-semibold h-10 mt-2"
                  >
                    {loginPending ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-[#001D34]/30 border-t-[#001D34] rounded-full animate-spin" />
                        Entrando...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <LogIn className="w-4 h-4" />
                        Entrar
                      </span>
                    )}
                  </Button>
                </form>
                <div className="flex items-center gap-3 my-4 px-6">
                  <div className="flex-1 h-px bg-white/10" />
                  <span className="text-white/30 text-xs">ou</span>
                  <div className="flex-1 h-px bg-white/10" />
                </div>
                <div className="px-6 pb-6">
                  <Button
                    type="button"
                    data-testid="button-google-login"
                    onClick={() => { window.location.href = "/auth/google"; }}
                    className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium h-10 gap-2"
                    variant="ghost"
                  >
                    <SiGoogle className="w-4 h-4 text-[#EA4335]" />
                    Entrar com Google
                  </Button>
                </div>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader className="pb-2 pt-6 px-6">
                <h2 className="text-white text-lg font-semibold">Criar conta</h2>
                <p className="text-white/40 text-xs mt-0.5">Preencha seus dados para solicitar acesso</p>
              </CardHeader>
              <CardContent className="px-6 pb-6">
                <form onSubmit={handleRegister} className="space-y-3">
                  {/* Convite token field */}
                  <div className="space-y-1.5">
                    <Label className="text-white/70 text-sm flex items-center gap-1.5">
                      <Ticket className="w-3.5 h-3.5 text-[#D7BB7D]" />
                      Código de convite <span className="text-red-400">*</span>
                    </Label>
                    <div className="relative">
                      <Input
                        value={regConviteToken}
                        onChange={e => setRegConviteToken(e.target.value.trim())}
                        placeholder="Cole o código do seu convite"
                        className={`${inputCls} pr-8 ${conviteStatus === "valid" ? "border-green-500/50" : conviteStatus === "invalid" ? "border-red-500/50" : ""}`}
                        data-testid="input-reg-convite"
                      />
                      {conviteChecking && (
                        <span className="absolute right-2.5 top-2.5">
                          <span className="w-3.5 h-3.5 border border-white/30 border-t-white/70 rounded-full animate-spin block" />
                        </span>
                      )}
                      {!conviteChecking && conviteStatus === "valid" && (
                        <CheckCircle className="absolute right-2.5 top-2.5 w-3.5 h-3.5 text-green-400" />
                      )}
                      {!conviteChecking && conviteStatus === "invalid" && (
                        <XCircle className="absolute right-2.5 top-2.5 w-3.5 h-3.5 text-red-400" />
                      )}
                    </div>
                    {conviteStatus === "valid" && conviteInfo && (
                      <div className="bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2 text-xs text-green-300">
                        Convite de <strong>{conviteInfo.gerador_nome || "membro BUILT"}</strong>
                        {conviteInfo.comunidade_nome ? ` · ${conviteInfo.comunidade_nome}` : ""}
                      </div>
                    )}
                    {conviteStatus === "invalid" && (
                      <p className="text-red-400 text-xs">Código inválido ou já utilizado.</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-white/70 text-sm">Nome completo</Label>
                    <Input
                      value={regNome}
                      onChange={e => setRegNome(e.target.value)}
                      placeholder="Seu nome"
                      className={inputCls}
                      data-testid="input-reg-nome"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-white/70 text-sm">E-mail</Label>
                    <Input
                      type="email"
                      value={regEmail}
                      onChange={e => setRegEmail(e.target.value)}
                      placeholder="seu@email.com"
                      className={inputCls}
                      data-testid="input-reg-email"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-white/70 text-sm">Nome de usuário</Label>
                    <Input
                      value={regUsername}
                      onChange={e => setRegUsername(e.target.value)}
                      placeholder={regEmail ? regEmail.split("@")[0].replace(/[^a-z0-9_]/gi, "_").toLowerCase() : "seu_usuario"}
                      className={inputCls}
                      data-testid="input-reg-username"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label className="text-white/70 text-sm">Senha</Label>
                      <div className="relative">
                        <Input
                          type={showRegPass ? "text" : "password"}
                          value={regPassword}
                          onChange={e => setRegPassword(e.target.value)}
                          placeholder="Mín. 4 chars"
                          className={`${inputCls} pr-8`}
                          data-testid="input-reg-password"
                          required
                        />
                        <button type="button" onClick={() => setShowRegPass(v => !v)} className="absolute right-2.5 top-2.5 text-white/30 hover:text-white/60">
                          {showRegPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-white/70 text-sm">Confirmar</Label>
                      <Input
                        type="password"
                        value={regPassword2}
                        onChange={e => setRegPassword2(e.target.value)}
                        placeholder="Repita"
                        className={`${inputCls} ${regPassword2 && regPassword !== regPassword2 ? "border-red-500/40" : ""}`}
                        data-testid="input-reg-password2"
                        required
                      />
                    </div>
                  </div>
                  {regError && <p className="text-red-400 text-sm text-center">{regError}</p>}
                  <Button
                    type="submit"
                    data-testid="button-register"
                    disabled={regLoading || conviteStatus === "invalid"}
                    className="w-full bg-[#D7BB7D] hover:bg-[#C4A96A] text-[#001D34] font-semibold h-10 mt-1"
                  >
                    {regLoading ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-[#001D34]/30 border-t-[#001D34] rounded-full animate-spin" />
                        Criando conta...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <UserPlus className="w-4 h-4" />
                        Criar conta
                      </span>
                    )}
                  </Button>
                </form>
              </CardContent>
            </>
          )}
        </Card>

        <p className="text-center text-white/30 text-xs mt-6">
          &copy; {new Date().getFullYear()} BUILT Alliances. Todos os direitos reservados.
        </p>
      </div>

      {/* Interests modal — step 2 of registration */}
      <Dialog open={showInteressesModal} onOpenChange={(open) => { if (!regLoading) setShowInteressesModal(open); }}>
        <DialogContent className="bg-[#001D34] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white text-lg font-semibold">Onde você quer participar?</DialogTitle>
            <DialogDescription className="text-white/50 text-sm">
              Selecione uma ou mais áreas de interesse. Isso determina seu fluxo de adesão.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 mt-2">
            {[
              {
                valor: "vitrine",
                icone: <Store className="w-5 h-5" />,
                titulo: "Vitrine BUILT",
                descricao: "Quero oferecer ou prestar serviços",
                gratuito: true,
              },
              {
                valor: "capital",
                icone: <TrendingUp className="w-5 h-5" />,
                titulo: "BUILT Capital",
                descricao: "Tenho interesse em investir",
                gratuito: true,
              },
              {
                valor: "membros",
                icone: <Handshake className="w-5 h-5" />,
                titulo: "Área de Alianças",
                descricao: "Quero acessar oportunidades e alianças",
                gratuito: false,
              },
            ].map(({ valor, icone, titulo, descricao, gratuito }) => {
              const selecionado = interessesSelecionados.includes(valor);
              return (
                <button
                  key={valor}
                  type="button"
                  data-testid={`interesse-${valor}`}
                  onClick={() => toggleInteresse(valor)}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all ${
                    selecionado
                      ? "border-[#D7BB7D] bg-[#D7BB7D]/10"
                      : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
                  }`}
                >
                  <span className={`shrink-0 ${selecionado ? "text-[#D7BB7D]" : "text-white/40"}`}>
                    {icone}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`font-semibold text-sm ${selecionado ? "text-[#D7BB7D]" : "text-white"}`}>{titulo}</p>
                      {gratuito ? (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/20">
                          Gratuito
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#D7BB7D]/10 text-[#D7BB7D] border border-[#D7BB7D]/20">
                          Taxa de adesão
                        </span>
                      )}
                    </div>
                    <p className="text-white/50 text-xs mt-0.5">{descricao}</p>
                  </div>
                  <span className={`shrink-0 w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                    selecionado ? "border-[#D7BB7D] bg-[#D7BB7D]" : "border-white/20"
                  }`}>
                    {selecionado && <span className="w-2 h-2 rounded-full bg-[#001D34]" />}
                  </span>
                </button>
              );
            })}
          </div>

          {regError && <p className="text-red-400 text-sm text-center mt-1">{regError}</p>}

          <div className="flex gap-3 mt-4">
            <Button
              type="button"
              variant="ghost"
              data-testid="button-voltar-interesses"
              onClick={() => setShowInteressesModal(false)}
              disabled={regLoading}
              className="flex-1 border border-white/10 text-white/60 hover:bg-white/5 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              Voltar
            </Button>
            <Button
              type="button"
              data-testid="button-confirmar-cadastro"
              onClick={handleConfirmarCadastro}
              disabled={regLoading || interessesSelecionados.length === 0}
              className="flex-1 bg-[#D7BB7D] hover:bg-[#C4A96A] text-[#001D34] font-semibold disabled:opacity-50"
            >
              {regLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-[#001D34]/30 border-t-[#001D34] rounded-full animate-spin" />
                  Criando...
                </span>
              ) : (
                "Confirmar e Criar Conta"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
