import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Eye, EyeOff, LogIn, Shield, UserPlus } from "lucide-react";
import { SiGoogle } from "react-icons/si";
import { useToast } from "@/hooks/use-toast";

export default function LoginPage() {
  const [, navigate] = useLocation();
  const { login, loginPending, isAuthenticated } = useAuth();
  const { toast } = useToast();

  const [mode, setMode] = useState<"login" | "register">("login");

  // Login state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  // Handle Google OAuth errors from redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") === "google_failed") {
      setError("Falha ao autenticar com Google. Tente novamente.");
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

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setRegError("");
    if (regPassword !== regPassword2) {
      setRegError("As senhas não coincidem");
      return;
    }
    if (regPassword.length < 4) {
      setRegError("Senha deve ter pelo menos 4 caracteres");
      return;
    }
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
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao criar conta");
      toast({ title: "Conta criada com sucesso!", description: "Agora faça login com suas credenciais." });
      setEmail(regEmail);
      setMode("login");
    } catch (err: any) {
      setRegError(err.message);
    } finally {
      setRegLoading(false);
    }
  }

  const inputCls = "bg-white/10 border-white/20 text-white placeholder:text-white/30 focus:border-[#D7BB7D] focus:ring-[#D7BB7D]/20";

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#001D34]">
      <div className="w-full max-w-sm px-4">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-full bg-[#D7BB7D]/20 flex items-center justify-center mb-4 border border-[#D7BB7D]/40">
            <Shield className="w-7 h-7 text-[#D7BB7D]" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">BUILT Alliances</h1>
          <p className="text-white/50 text-sm mt-1">Plataforma de Gestão</p>
        </div>

        {/* Tab toggle */}
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

        <Card className="bg-white/5 border-white/10 backdrop-blur">
          {mode === "login" ? (
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
                    disabled={regLoading}
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
    </div>
  );
}
