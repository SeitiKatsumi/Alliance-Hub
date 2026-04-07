import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Eye, EyeOff, LogIn, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function LoginPage() {
  const [, navigate] = useLocation();
  const { login, loginPending } = useAuth();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#001D34]">
      <div className="w-full max-w-sm px-4">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-full bg-[#D7BB7D]/20 flex items-center justify-center mb-4 border border-[#D7BB7D]/40">
            <Shield className="w-7 h-7 text-[#D7BB7D]" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">BUILT Alliances</h1>
          <p className="text-white/50 text-sm mt-1">Plataforma de Gestão</p>
        </div>

        <Card className="bg-white/5 border-white/10 backdrop-blur">
          <CardHeader className="pb-2 pt-6 px-6">
            <h2 className="text-white text-lg font-semibold">Entrar na plataforma</h2>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <form onSubmit={handleSubmit} className="space-y-4">
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
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/30 focus:border-[#D7BB7D] focus:ring-[#D7BB7D]/20"
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
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/30 focus:border-[#D7BB7D] focus:ring-[#D7BB7D]/20 pr-10"
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

              {error && (
                <p className="text-red-400 text-sm text-center">{error}</p>
              )}

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
          </CardContent>
        </Card>

        <p className="text-center text-white/30 text-xs mt-6">
          &copy; {new Date().getFullYear()} BUILT Alliances. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
}
