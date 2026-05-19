import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Eye, EyeOff, LogIn, UserPlus, Ticket, CheckCircle, XCircle, KeyRound, ArrowLeft, Mail, Store, TrendingUp, Handshake, Shield, Send } from "lucide-react";
import { SiGoogle } from "react-icons/si";
import { useToast } from "@/hooks/use-toast";
import builtLogo from "@assets/Logo_Built_2_Horizontal_Branca_Nova.png";
import { TERM_CONFIG, getRequiredTermKeys, type TermKey } from "./adesao";

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
  const [forgotError, setForgotError] = useState("");
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
    // Keep reset token in the URL until the password is actually changed.
    // Removing it on mount can leave the user stuck if the page reloads mid-flow.
    if (window.location.search && !params.get("reset")) {
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
  const [primeiroAcessoStep, setPrimeiroAcessoStep] = useState<"interesses" | "termos" | "solicitacao" | "final">("interesses");
  const [interessesSelecionados, setInteressesSelecionados] = useState<string[]>([]);
  const [adesaoToken, setAdesaoToken] = useState("");
  const [adesaoConvite, setAdesaoConvite] = useState<any>(null);
  const [checkedTerms, setCheckedTerms] = useState<Record<string, boolean>>({});
  const [activeTerm, setActiveTerm] = useState<TermKey>("codigo_etica");
  const [aceiteLoading, setAceiteLoading] = useState(false);

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
    setPrimeiroAcessoStep("interesses");
    setAdesaoToken("");
    setAdesaoConvite(null);
    setCheckedTerms({});
    setActiveTerm("codigo_etica");
    setShowInteressesModal(true);
  }

  function toggleInteresse(valor: string) {
    setInteressesSelecionados(prev =>
      prev.includes(valor) ?prev.filter(v => v !== valor) : [...prev, valor]
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
      if (data.vitrine_token) {
        await queryClient.invalidateQueries({ queryKey: ["/api/me"] });
        setAdesaoToken(data.vitrine_token);
        const conviteRes = await fetch(`/api/convites/${data.vitrine_token}`);
        const conviteData = conviteRes.ok ? await conviteRes.json() : null;
        setAdesaoConvite(conviteData);
        const required = getRequiredTermKeys(interessesSelecionados);
        setActiveTerm(required[0] || "codigo_etica");
        setCheckedTerms({});
        setPrimeiroAcessoStep("termos");
      } else if (data.pagamento_token) {
        navigate(`/pagamento/${data.pagamento_token}`);
      } else {
        toast({ title: "Conta criada!", description: "Você já pode fazer login." });
        setEmail(regEmail);
        setMode("login");
      }
    } catch (err: any) {
      setRegError(err.message);
    } finally {
      setRegLoading(false);
    }
  }

  const requiredTermKeys = getRequiredTermKeys(interessesSelecionados);
  const activeTermKey = requiredTermKeys.includes(activeTerm) ? activeTerm : requiredTermKeys[0] || "codigo_etica";
  const activeTermConfig = TERM_CONFIG[activeTermKey];
  const allTermsAccepted = requiredTermKeys.every((key) => checkedTerms[key]);

  async function handleAceitarTermosCadastro() {
    if (!adesaoToken || !allTermsAccepted) return;
    setAceiteLoading(true);
    setRegError("");
    try {
      const now = new Date().toISOString();
      const termosAceitos = Object.fromEntries(requiredTermKeys.map((key) => [key, true]));
      const termosVersoes = Object.fromEntries(requiredTermKeys.map((key) => [key, TERM_CONFIG[key].version]));
      const res = await fetch(`/api/convites/${adesaoToken}/aceitar-termos`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          termos_aceitos: termosAceitos,
          termos_versoes: termosVersoes,
          aceito_em: now,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao aceitar termos");
      setAdesaoConvite(data);
      setPrimeiroAcessoStep("solicitacao");
    } catch (err: any) {
      setRegError(err.message);
    } finally {
      setAceiteLoading(false);
    }
  }

  async function handleEnviarSolicitacaoCadastro() {
    if (!adesaoToken) return;
    setAceiteLoading(true);
    setRegError("");
    try {
      const res = await fetch(`/api/convites/${adesaoToken}/solicitar-acesso`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao enviar solicitaÃ§Ã£o");
      setAdesaoConvite(data);
      setPrimeiroAcessoStep("final");
    } catch (err: any) {
      setRegError(err.message);
    } finally {
      setAceiteLoading(false);
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setForgotError("");
    setForgotLoading(true);
    try {
      const res = await fetch("/api/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Não foi possível enviar o e-mail agora.");
      setForgotSent(true);
    } catch (err: any) {
      setForgotError(err.message || "Não foi possível enviar o e-mail agora.");
    } finally {
      setForgotLoading(false);
    }
  }

  async function handleResend() {
    if (forgotResending) return;
    setForgotResending(true);
    setForgotError("");
    setForgotResentOk(false);
    try {
      const res = await fetch("/api/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Não foi possível reenviar o e-mail agora.");
      setForgotResentOk(true);
      setTimeout(() => setForgotResentOk(false), 4000);
    } catch (err: any) {
      setForgotError(err.message || "Não foi possível reenviar o e-mail agora.");
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
      window.history.replaceState({}, "", "/login");
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
                background: mode === "login" ?"#D7BB7D" : "transparent",
                color: mode === "login" ?"#001D34" : "rgba(255,255,255,0.4)",
              }}
            >
              Entrar
            </button>
            <button
              onClick={() => setMode("register")}
              className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{
                background: mode === "register" ?"#D7BB7D" : "transparent",
                color: mode === "register" ?"#001D34" : "rgba(255,255,255,0.4)",
              }}
            >
              Novo Cadastro
            </button>
          </div>
        )}

        <Card className="bg-white/5 border-white/10 backdrop-blur">
          {mode === "forgot" ?(
            <>
              <CardHeader className="pb-2 pt-6 px-6">
                <button onClick={() => setMode("login")} className="flex items-center gap-1.5 text-white/40 hover:text-white/70 text-xs mb-3 transition-colors">
                  <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao login
                </button>
                <h2 className="text-white text-lg font-semibold">Esqueci minha senha</h2>
                <p className="text-white/40 text-xs mt-0.5">Informe seu e-mail e enviaremos um link para redefinir a senha.</p>
              </CardHeader>
              <CardContent className="px-6 pb-6">
                {forgotSent ?(
                  <div className="text-center py-4 space-y-3">
                    <CheckCircle className="w-10 h-10 text-green-400 mx-auto" />
                    <p className="text-white/80 text-sm">Se existe uma conta com este e-mail, você receberá um link em instantes.</p>
                    <p className="text-white/40 text-xs">Não recebeu?Verifique sua caixa de spam ou reenvie abaixo.</p>
                    {forgotError && <p className="text-red-400 text-sm">{forgotError}</p>}
                    <button
                      onClick={handleResend}
                      disabled={forgotResending}
                      data-testid="btn-reenviar-email"
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-[#D7BB7D]/30 text-[#D7BB7D] text-sm font-semibold hover:bg-[#D7BB7D]/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {forgotResending ?(
                        <>
                          <span className="w-4 h-4 border-2 border-[#D7BB7D]/40 border-t-[#D7BB7D] rounded-full animate-spin" />
                          Reenviando…
                        </>
                      ) : forgotResentOk ?(
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
                      {forgotLoading ?<span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-[#001D34]/30 border-t-[#001D34] rounded-full animate-spin" />Enviando...</span> : <span className="flex items-center gap-2"><Mail className="w-4 h-4" />Enviar link de redefinição</span>}
                    </Button>
                    {forgotError && <p className="text-red-400 text-sm text-center">{forgotError}</p>}
                  </form>
                )}
              </CardContent>
            </>
          ) : mode === "reset" ?(
            <>
              <CardHeader className="pb-2 pt-6 px-6">
                <h2 className="text-white text-lg font-semibold flex items-center gap-2"><KeyRound className="w-5 h-5 text-[#D7BB7D]" />Nova senha</h2>
                <p className="text-white/40 text-xs mt-0.5">Defina sua nova senha de acesso à plataforma.</p>
              </CardHeader>
              <CardContent className="px-6 pb-6">
                {resetDone ?(
                  <div className="text-center py-4 space-y-3">
                    <CheckCircle className="w-10 h-10 text-green-400 mx-auto" />
                    <p className="text-white/80 text-sm">Senha redefinida com sucesso!</p>
                    <button onClick={() => { setMode("login"); setResetDone(false); }} className="text-[#D7BB7D] text-xs hover:underline">Fazer login</button>
                  </div>
                ) : !resetToken ? (
                  <div className="text-center py-4 space-y-3">
                    <XCircle className="w-10 h-10 text-red-400 mx-auto" />
                    <p className="text-white/80 text-sm">Link de redefinição inválido ou incompleto.</p>
                    <button onClick={() => { setMode("forgot"); setResetError(""); }} className="text-[#D7BB7D] text-xs hover:underline">Solicitar novo link</button>
                  </div>
                ) : (
                  <form onSubmit={handleResetPassword} className="space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1.5">
                        <Label className="text-white/70 text-sm">Nova senha</Label>
                        <div className="relative">
                          <Input type={showResetPass ?"text" : "password"} value={resetPassword} onChange={e => setResetPassword(e.target.value)} placeholder="Mín. 4 chars" className={`${inputCls} pr-8`} required data-testid="input-reset-password" />
                          <button type="button" onClick={() => setShowResetPass(v => !v)} className="absolute right-2.5 top-2.5 text-white/30 hover:text-white/60">
                            {showResetPass ?<EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-white/70 text-sm">Confirmar</Label>
                        <Input type="password" value={resetPassword2} onChange={e => setResetPassword2(e.target.value)} placeholder="Repita" className={`${inputCls} ${resetPassword2 && resetPassword !== resetPassword2 ?"border-red-500/40" : ""}`} required data-testid="input-reset-password2" />
                      </div>
                    </div>
                    {resetError && <p className="text-red-400 text-sm text-center">{resetError}</p>}
                    <Button type="submit" disabled={resetLoading} className="w-full bg-[#D7BB7D] hover:bg-[#C4A96A] text-[#001D34] font-semibold h-10" data-testid="button-reset-submit">
                      {resetLoading ?<span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-[#001D34]/30 border-t-[#001D34] rounded-full animate-spin" />Salvando...</span> : <span className="flex items-center gap-2"><KeyRound className="w-4 h-4" />Salvar nova senha</span>}
                    </Button>
                  </form>
                )}
              </CardContent>
            </>
          ) : mode === "login" ?(
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
                        type={showPassword ?"text" : "password"}
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
                        {showPassword ?<EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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
                    {loginPending ?(
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
                        className={`${inputCls} pr-8 ${conviteStatus === "valid" ?"border-green-500/50" : conviteStatus === "invalid" ?"border-red-500/50" : ""}`}
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
                        {conviteInfo.comunidade_nome ?` · ${conviteInfo.comunidade_nome}` : ""}
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
                      placeholder={regEmail ?regEmail.split("@")[0].replace(/[^a-z0-9_]/gi, "_").toLowerCase() : "seu_usuario"}
                      className={inputCls}
                      data-testid="input-reg-username"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label className="text-white/70 text-sm">Senha</Label>
                      <div className="relative">
                        <Input
                          type={showRegPass ?"text" : "password"}
                          value={regPassword}
                          onChange={e => setRegPassword(e.target.value)}
                          placeholder="Mín. 4 chars"
                          className={`${inputCls} pr-8`}
                          data-testid="input-reg-password"
                          required
                        />
                        <button type="button" onClick={() => setShowRegPass(v => !v)} className="absolute right-2.5 top-2.5 text-white/30 hover:text-white/60">
                          {showRegPass ?<EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
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
                        className={`${inputCls} ${regPassword2 && regPassword !== regPassword2 ?"border-red-500/40" : ""}`}
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
                    {regLoading ?(
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
        <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-6xl border-0 bg-white p-0 text-[#001D34] shadow-2xl overflow-hidden">
          <div className="grid max-h-[calc(100dvh-1rem)] min-h-0 md:min-h-[560px] md:grid-cols-[220px_1fr]">
            <aside className="hidden md:flex flex-col justify-between bg-[#001D34] p-6 text-white">
              <div>
                <img src={builtLogo} alt="BUILT" className="w-28" />
                <div className="mt-12 space-y-3">
                  <p className="text-xs text-white/70">Primeiro acesso</p>
                  <p className="text-sm font-semibold">Etapa {primeiroAcessoStep === "interesses" ? "1" : "2"} de 2</p>
                  <div className="flex items-center gap-2 pt-1">
                    {primeiroAcessoStep === "interesses" ? (
                      <span className="h-3 w-3 rounded-full bg-[#D7BB7D]" />
                    ) : (
                      <span className="grid h-6 w-6 place-items-center rounded-full border border-white/40 text-xs">1</span>
                    )}
                    <span className="h-px flex-1 bg-[#D7BB7D]" />
                    {primeiroAcessoStep === "interesses" ? (
                      <span className="grid h-6 w-6 place-items-center rounded-full border border-white/40 text-xs">2</span>
                    ) : (
                      <span className="grid h-6 w-6 place-items-center rounded-full bg-[#D7BB7D] text-xs font-bold text-[#001D34]">2</span>
                    )}
                  </div>
                </div>
              </div>
              <p className="text-xs text-white/60">Precisa de ajuda? Fale com nosso time.</p>
            </aside>

            <div className="flex min-h-0 flex-col">
          <DialogHeader className="hidden">
            <DialogTitle className="text-white text-lg font-semibold">Onde você quer participar?</DialogTitle>
            <DialogDescription className="text-white/50 text-sm">
              Selecione uma ou mais áreas de interesse. Isso determina seu fluxo de adesão.
            </DialogDescription>
          </DialogHeader>

          {primeiroAcessoStep === "interesses" ? (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 pb-6 md:px-8 md:py-8">
              <div className="mb-4 space-y-2 md:mb-6">
                <p className="text-xs text-slate-500">Inicio / Primeiro acesso</p>
                <h2 className="text-xl font-bold text-[#001D34] md:text-2xl">Ola, {regNome || "bem-vindo(a)"}!</h2>
                <p className="max-w-2xl text-sm text-slate-600">
                  Escolha a area que mais combina com seu objetivo atual. Voce podera acessar outras areas depois.
                </p>
              </div>

          <div className="grid gap-3 md:gap-4 lg:grid-cols-3">
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
                  className={`w-full flex flex-col gap-3 rounded-xl border bg-white p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg md:min-h-48 md:gap-4 md:p-4 ${
                    selecionado
                      ?"border-blue-500 ring-2 ring-blue-500/20"
                      : "border-slate-200 hover:border-[#D7BB7D]"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="relative -m-3 mb-3 h-14 overflow-hidden rounded-t-xl border-b border-slate-200 bg-gradient-to-br from-slate-100 via-white to-[#D7BB7D]/20 md:-m-4 md:mb-4 md:h-24">
                      <div className="absolute right-4 top-3 flex items-end gap-1 md:right-5 md:top-4">
                        <span className="h-6 w-2 rounded-full bg-[#D7BB7D]/70 md:h-8" />
                        <span className="h-10 w-2 rounded-full bg-[#0B6F91]/70 md:h-14" />
                        <span className="h-7 w-2 rounded-full bg-slate-400/60 md:h-10" />
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 flex-wrap md:gap-3">
                      <span className={`grid h-9 w-9 place-items-center rounded-full md:h-10 md:w-10 ${selecionado ?"bg-blue-600 text-white" : "bg-[#001D34] text-[#D7BB7D]"}`}>
                        {icone}
                      </span>
                      <p className="text-base font-bold text-[#001D34] md:text-lg">{titulo}</p>
                      {gratuito ?(
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-700 border border-green-500/20">
                          Gratuito
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#D7BB7D]/10 text-[#D7BB7D] border border-[#D7BB7D]/20">
                          Taxa de adesão
                        </span>
                      )}
                    </div>
                    <p className="text-slate-600 text-sm mt-2 leading-relaxed md:mt-3">{descricao}</p>
                  </div>
                  <span className={`shrink-0 w-full rounded-md border px-3 py-2 text-center text-sm font-semibold transition-all ${
                    selecionado ?"border-blue-600 bg-blue-600 text-white" : "border-[#001D34] text-[#001D34]"
                  }`}>
                    {selecionado ? "Selecionado" : `Escolher ${titulo.replace("BUILT ", "")}`}
                  </span>
                </button>
              );
            })}
          </div>

          {regError && <p className="text-red-600 text-sm text-center mt-3">{regError}</p>}

              </div>

          <div className="sticky bottom-0 z-10 mt-0 flex flex-col gap-2 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-10px_24px_rgba(15,23,42,0.08)] backdrop-blur sm:flex-row md:static md:mt-6 md:border-0 md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-0">
            <Button
              type="button"
              variant="ghost"
              data-testid="button-voltar-interesses"
              onClick={() => setShowInteressesModal(false)}
              disabled={regLoading}
              className="flex-1 border border-slate-200 text-slate-600 hover:bg-slate-50"
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
              {regLoading ?(
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-[#001D34]/30 border-t-[#001D34] rounded-full animate-spin" />
                  Criando...
                </span>
              ) : (
                "Continuar para aceites"
              )}
            </Button>
          </div>
            </>
          ) : primeiroAcessoStep === "termos" ? (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 pb-6 md:px-8 md:py-8">
              <div className="mb-4 space-y-2 md:mb-6">
                <p className="text-xs text-slate-500">Inicio / Primeiro acesso / Aceites</p>
                <h2 className="text-xl font-bold text-[#001D34] md:text-2xl">Termos de Acesso BUILT</h2>
                <p className="max-w-2xl text-sm text-slate-600">
                  Leia e confirme os termos aplicaveis para continuar seu primeiro acesso.
                </p>
              </div>

              <div className="rounded-xl border border-[#D7BB7D]/40 bg-[#D7BB7D]/10 p-4 mb-4 flex items-center gap-3">
                <Shield className="w-5 h-5 text-[#D7BB7D]" />
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-[#A8843A]">Aderindo a</p>
                  <p className="text-sm font-bold text-[#001D34]">{adesaoConvite?.comunidade?.nome || conviteInfo?.comunidade_nome || "Rede BUILT"}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-[#D7BB7D]/30 bg-white overflow-hidden shadow-sm">
                <div className="flex items-center gap-2 px-5 py-3 border-b border-[#D7BB7D]/30 bg-[#FCFAF5]">
                  {(() => {
                    const ActiveIcon = activeTermConfig.icon;
                    return <ActiveIcon className="w-4 h-4 text-[#D7BB7D]" />;
                  })()}
                  <span className="text-xs font-mono text-slate-600 uppercase tracking-wider">{activeTermConfig.title}</span>
                </div>
                <div className="max-h-56 overflow-y-auto p-4 md:max-h-72 md:p-5">
                  <pre className="text-sm md:text-base font-mono text-slate-700 leading-7 whitespace-pre-wrap">{activeTermConfig.body}</pre>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-[#D7BB7D]/30 bg-white p-4 space-y-3 shadow-sm">
                <p className="text-[10px] font-mono text-[#A8843A] uppercase tracking-[0.2em]">Termos aplicaveis</p>
                <div className="flex flex-wrap gap-2">
                  {requiredTermKeys.map((key) => {
                    const config = TERM_CONFIG[key];
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setActiveTerm(key)}
                        className={`rounded-full border px-4 py-2 text-sm font-mono transition-colors ${activeTermKey === key ? "border-[#D7BB7D] bg-[#D7BB7D]/20 text-[#001D34]" : "border-slate-200 text-slate-600 hover:border-[#D7BB7D]/50 hover:text-[#001D34]"}`}
                      >
                        {config.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {requiredTermKeys.map((key) => {
                  const config = TERM_CONFIG[key];
                  const accepted = !!checkedTerms[key];
                  return (
                    <label key={key} className="flex items-start gap-3 cursor-pointer group">
                      <button
                        type="button"
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${accepted ? "bg-[#D7BB7D] border-[#D7BB7D]" : "border-slate-300 group-hover:border-[#D7BB7D]"}`}
                        onClick={() => setCheckedTerms((current) => ({ ...current, [key]: !current[key] }))}
                      >
                        {accepted && <CheckCircle className="w-3.5 h-3.5 text-[#001D34]" />}
                      </button>
                      <span className="text-sm text-slate-700 leading-relaxed">
                        Li e concordo com o{" "}
                        <button
                          type="button"
                          className="font-bold text-[#A8843A] hover:underline"
                          onClick={() => setActiveTerm(key)}
                        >
                          {config.label}
                        </button>
                      </span>
                    </label>
                  );
                })}
              </div>

              {regError && <p className="text-red-600 text-sm text-center mt-3">{regError}</p>}

              </div>

              <div className="sticky bottom-0 z-10 mt-0 flex flex-col gap-2 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-10px_24px_rgba(15,23,42,0.08)] backdrop-blur sm:flex-row md:static md:mt-5 md:border-0 md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-0">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setPrimeiroAcessoStep("interesses")}
                  disabled={aceiteLoading}
                  className="flex-1 border border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  <ArrowLeft className="w-4 h-4 mr-1.5" />
                  Voltar
                </Button>
                <Button
                  type="button"
                  onClick={handleAceitarTermosCadastro}
                  disabled={aceiteLoading || !allTermsAccepted}
                  className="flex-1 bg-[#D7BB7D] hover:bg-[#C4A96A] text-[#001D34] font-semibold disabled:opacity-50"
                >
                  {aceiteLoading ? "Salvando..." : "Aceitar termos e avancar"}
                </Button>
              </div>
            </>
          ) : primeiroAcessoStep === "solicitacao" ? (
            <div className="flex min-h-[430px] flex-col justify-center text-center">
              <CheckCircle className="mx-auto mb-4 h-12 w-12 text-emerald-500" />
              <h2 className="text-2xl font-bold text-[#001D34]">Termos aceitos</h2>
              <p className="mx-auto mt-3 max-w-lg text-sm text-slate-600">
                Agora envie sua solicitacao para o membro que te convidou registrar a percepcao de Aura.
              </p>
              {regError && <p className="text-red-600 text-sm text-center mt-4">{regError}</p>}
              <div className="mx-auto mt-6 flex w-full max-w-xl gap-3">
                <Button variant="ghost" onClick={() => setPrimeiroAcessoStep("termos")} className="flex-1 border border-slate-200">
                  <ArrowLeft className="w-4 h-4 mr-1.5" />
                  Voltar
                </Button>
                <Button onClick={handleEnviarSolicitacaoCadastro} disabled={aceiteLoading} className="flex-1 bg-[#D7BB7D] hover:bg-[#C4A96A] text-[#001D34] font-semibold">
                  <Send className="w-4 h-4 mr-1.5" />
                  {aceiteLoading ? "Enviando..." : "Enviar solicitacao"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex min-h-[430px] flex-col justify-center text-center">
              <CheckCircle className="mx-auto mb-4 h-12 w-12 text-emerald-500" />
              <h2 className="text-2xl font-bold text-[#001D34]">Solicitacao enviada</h2>
              <p className="mx-auto mt-3 max-w-lg text-sm text-slate-600">
                Sua solicitacao foi enviada. Acompanhe seu e-mail para os proximos passos.
              </p>
              <Button
                onClick={() => {
                  setShowInteressesModal(false);
                  setMode("login");
                  setEmail(regEmail);
                }}
                className="mx-auto mt-6 bg-[#001D34] text-white hover:bg-[#002946]"
              >
                Voltar para login
              </Button>
            </div>
          )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
