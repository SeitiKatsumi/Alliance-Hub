import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Bot, Send, Loader2, Sparkles } from "lucide-react";

interface AIAnalyzerProps {
  type: "bia" | "oportunidade";
  id: string;
  title: string;
}

const presetQuestions = {
  bia: [
    "Quais são os pontos fortes deste projeto?",
    "Quais riscos devemos considerar?",
    "Sugira próximos passos estratégicos.",
    "Quem poderia contribuir com este projeto?",
  ],
  oportunidade: [
    "Qual a probabilidade de fecharmos?",
    "Quais objeções podemos enfrentar?",
    "Sugira estratégias de abordagem.",
    "Quais são os próximos passos?",
  ],
};

export function AIAnalyzer({ type, id, title }: AIAnalyzerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [analysis, setAnalysis] = useState("");

  const analyzeMutation = useMutation({
    mutationFn: async (q: string) => {
      const response = await apiRequest("POST", `/api/analyze/${type}/${id}`, { 
        question: q.slice(0, 500) 
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setAnalysis(data.message);
      } else {
        setAnalysis("Erro ao analisar. Tente novamente.");
      }
      setQuestion("");
    },
    onError: () => {
      setAnalysis("Erro de conexão. Verifique sua internet.");
      setQuestion("");
    }
  });

  const analyze = (customQuestion?: string) => {
    const q = customQuestion || question;
    if (!q.trim()) return;
    setAnalysis("");
    analyzeMutation.mutate(q);
  };

  const handlePreset = (q: string) => {
    analyze(q);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    analyze();
  };

  const isLoading = analyzeMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          size="sm" 
          variant="outline"
          className="gap-1"
          data-testid={`button-analyze-${type}-${id}`}
        >
          <Sparkles className="h-3 w-3" />
          Analisar com IA
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-brand-gold" />
            Análise IA: {title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!analysis && !isLoading && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Escolha uma pergunta ou faça sua própria:
              </p>
              <div className="grid grid-cols-2 gap-2">
                {presetQuestions[type].map((q, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    size="sm"
                    className="text-xs text-left justify-start"
                    onClick={() => handlePreset(q)}
                    data-testid={`preset-question-${i}`}
                  >
                    {q}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {isLoading && (
            <div className="flex items-center justify-center py-8 gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-brand-gold" />
              <span className="text-muted-foreground">Analisando com IA...</span>
            </div>
          )}

          {analysis && !isLoading && (
            <ScrollArea className="h-[300px] rounded-md border p-4">
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <p className="whitespace-pre-wrap">{analysis}</p>
              </div>
            </ScrollArea>
          )}

          <form onSubmit={handleSubmit} className="flex gap-2">
            <Textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={`Pergunte sobre ${type === "bia" ? "este projeto BIA" : "esta oportunidade"}...`}
              className="min-h-[44px] max-h-[100px] resize-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              data-testid="input-analysis-question"
            />
            <Button
              type="submit"
              size="icon"
              variant="default"
              disabled={!question.trim() || isLoading}
              className="shrink-0"
              data-testid="button-send-analysis"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>

          {analysis && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAnalysis("")}
              className="w-full"
            >
              Nova análise
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
