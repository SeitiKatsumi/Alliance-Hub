import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Bot, 
  Send, 
  Sparkles, 
  Users, 
  Target, 
  TrendingUp, 
  Lightbulb,
  BarChart3,
  Loader2,
  MessageSquare
} from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const presets = [
  {
    icon: TrendingUp,
    label: "Análise de Performance",
    prompt: "Faça uma análise geral da performance atual da BUILT Alliances, incluindo métricas de membros, BIAS e oportunidades."
  },
  {
    icon: Users,
    label: "Conexões Estratégicas",
    prompt: "Sugira conexões estratégicas entre membros baseado em suas especialidades e empresas."
  },
  {
    icon: Target,
    label: "Oportunidades Quentes",
    prompt: "Quais são as oportunidades mais promissoras no funil atualmente? Analise por valor e probabilidade de conversão."
  },
  {
    icon: Lightbulb,
    label: "Sugestões de BIAS",
    prompt: "Sugira novos projetos BIA baseados nas especialidades dos membros e tendências do mercado."
  },
  {
    icon: BarChart3,
    label: "Insights do Funil",
    prompt: "Analise o funil de conversão e identifique gargalos ou oportunidades de melhoria."
  },
  {
    icon: Sparkles,
    label: "Resumo Executivo",
    prompt: "Gere um resumo executivo com os principais indicadores e ações recomendadas para esta semana."
  }
];

export function AIAssistant() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: text };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text })
      });

      const data = await response.json();

      if (data.success) {
        const assistantMessage: Message = { 
          role: "assistant", 
          content: data.message 
        };
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        setMessages(prev => [...prev, { 
          role: "assistant", 
          content: "Desculpe, ocorreu um erro ao processar sua solicitação. Tente novamente." 
        }]);
      }
    } catch (error) {
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: "Erro de conexão. Verifique sua internet e tente novamente." 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePreset = (prompt: string) => {
    sendMessage(prompt);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <Card className="border-brand-gold/20 bg-gradient-to-br from-brand-navy/5 to-transparent">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <div className="p-2 rounded-lg bg-brand-gold/10">
            <Bot className="h-5 w-5 text-brand-gold" />
          </div>
          <span>Assistente IA</span>
          <Badge variant="outline" className="ml-auto text-xs border-brand-gold/30 text-brand-gold">
            Powered by GPT
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {messages.length === 0 ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Use os presets abaixo ou faça sua própria pergunta sobre membros, BIAS e oportunidades.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {presets.map((preset, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  className="flex flex-col items-center gap-2 text-xs"
                  onClick={() => handlePreset(preset.prompt)}
                  disabled={isLoading}
                  data-testid={`preset-${index}`}
                >
                  <preset.icon className="h-4 w-4 text-brand-gold" />
                  <span className="text-center leading-tight">{preset.label}</span>
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-4">
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "assistant" && (
                    <div className="p-2 rounded-lg bg-brand-gold/10 h-fit">
                      <Bot className="h-4 w-4 text-brand-gold" />
                    </div>
                  )}
                  <div
                    className={`max-w-[85%] rounded-lg p-3 text-sm ${
                      msg.role === "user"
                        ? "bg-brand-navy text-white"
                        : "bg-muted"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                  {msg.role === "user" && (
                    <div className="p-2 rounded-lg bg-brand-navy h-fit">
                      <MessageSquare className="h-4 w-4 text-white" />
                    </div>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-3 justify-start">
                  <div className="p-2 rounded-lg bg-brand-gold/10 h-fit">
                    <Bot className="h-4 w-4 text-brand-gold" />
                  </div>
                  <div className="bg-muted rounded-lg p-3 flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-brand-gold" />
                    <span className="text-sm text-muted-foreground">Analisando...</span>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        {messages.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-2 border-t">
            {presets.slice(0, 3).map((preset, index) => (
              <Button
                key={index}
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground"
                onClick={() => handlePreset(preset.prompt)}
                disabled={isLoading}
              >
                <preset.icon className="h-3 w-3 mr-1" />
                {preset.label}
              </Button>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pergunte sobre membros, BIAS, oportunidades..."
            className="min-h-[44px] max-h-[120px] resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            data-testid="input-assistant-message"
          />
          <Button 
            type="submit" 
            size="icon"
            variant="default"
            disabled={!input.trim() || isLoading}
            className="shrink-0"
            data-testid="button-send-message"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
