import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const COUNTRY_CODES = [
  { country: "BR", label: "Brasil", dialCode: "+55" },
  { country: "AF", label: "Afeganistão", dialCode: "+93" },
  { country: "ZA", label: "África do Sul", dialCode: "+27" },
  { country: "DE", label: "Alemanha", dialCode: "+49" },
  { country: "AO", label: "Angola", dialCode: "+244" },
  { country: "SA", label: "Arábia Saudita", dialCode: "+966" },
  { country: "DZ", label: "Argélia", dialCode: "+213" },
  { country: "AR", label: "Argentina", dialCode: "+54" },
  { country: "AU", label: "Austrália", dialCode: "+61" },
  { country: "AT", label: "Áustria", dialCode: "+43" },
  { country: "BE", label: "Bélgica", dialCode: "+32" },
  { country: "BO", label: "Bolívia", dialCode: "+591" },
  { country: "CA", label: "Canadá", dialCode: "+1" },
  { country: "CL", label: "Chile", dialCode: "+56" },
  { country: "CN", label: "China", dialCode: "+86" },
  { country: "CO", label: "Colômbia", dialCode: "+57" },
  { country: "KR", label: "Coreia do Sul", dialCode: "+82" },
  { country: "CR", label: "Costa Rica", dialCode: "+506" },
  { country: "CU", label: "Cuba", dialCode: "+53" },
  { country: "DK", label: "Dinamarca", dialCode: "+45" },
  { country: "EC", label: "Equador", dialCode: "+593" },
  { country: "EG", label: "Egito", dialCode: "+20" },
  { country: "SV", label: "El Salvador", dialCode: "+503" },
  { country: "AE", label: "Emirados Árabes Unidos", dialCode: "+971" },
  { country: "US", label: "Estados Unidos", dialCode: "+1" },
  { country: "ES", label: "Espanha", dialCode: "+34" },
  { country: "FI", label: "Finlândia", dialCode: "+358" },
  { country: "FR", label: "França", dialCode: "+33" },
  { country: "GR", label: "Grécia", dialCode: "+30" },
  { country: "GT", label: "Guatemala", dialCode: "+502" },
  { country: "NL", label: "Holanda", dialCode: "+31" },
  { country: "HN", label: "Honduras", dialCode: "+504" },
  { country: "IN", label: "Índia", dialCode: "+91" },
  { country: "ID", label: "Indonésia", dialCode: "+62" },
  { country: "IE", label: "Irlanda", dialCode: "+353" },
  { country: "IL", label: "Israel", dialCode: "+972" },
  { country: "IT", label: "Itália", dialCode: "+39" },
  { country: "JP", label: "Japão", dialCode: "+81" },
  { country: "LU", label: "Luxemburgo", dialCode: "+352" },
  { country: "MX", label: "México", dialCode: "+52" },
  { country: "MA", label: "Marrocos", dialCode: "+212" },
  { country: "MZ", label: "Moçambique", dialCode: "+258" },
  { country: "NI", label: "Nicarágua", dialCode: "+505" },
  { country: "NO", label: "Noruega", dialCode: "+47" },
  { country: "NZ", label: "Nova Zelândia", dialCode: "+64" },
  { country: "PA", label: "Panamá", dialCode: "+507" },
  { country: "PY", label: "Paraguai", dialCode: "+595" },
  { country: "PE", label: "Peru", dialCode: "+51" },
  { country: "PL", label: "Polônia", dialCode: "+48" },
  { country: "PT", label: "Portugal", dialCode: "+351" },
  { country: "GB", label: "Reino Unido", dialCode: "+44" },
  { country: "DO", label: "República Dominicana", dialCode: "+1" },
  { country: "CZ", label: "República Tcheca", dialCode: "+420" },
  { country: "RU", label: "Rússia", dialCode: "+7" },
  { country: "SE", label: "Suécia", dialCode: "+46" },
  { country: "CH", label: "Suíça", dialCode: "+41" },
  { country: "TR", label: "Turquia", dialCode: "+90" },
  { country: "UY", label: "Uruguai", dialCode: "+598" },
  { country: "VE", label: "Venezuela", dialCode: "+58" },
];

type PhoneInputProps = {
  value?: string | null;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  selectClassName?: string;
  "data-testid"?: string;
};

function parsePhoneValue(value?: string | null) {
  const raw = String(value || "").trim();
  const sortedCodes = [...COUNTRY_CODES].sort((a, b) => b.dialCode.length - a.dialCode.length);
  const matched = sortedCodes.find((item) => raw.startsWith(item.dialCode));
  if (matched) {
    return {
      dialCode: matched.dialCode,
      number: raw.slice(matched.dialCode.length).replace(/^\s+/, ""),
    };
  }
  const digitsOnly = raw.replace(/\D/g, "");
  const matchedDigits = sortedCodes.find((item) => {
    const dialDigits = item.dialCode.replace(/\D/g, "");
    return digitsOnly.startsWith(dialDigits) && digitsOnly.length > dialDigits.length + 6;
  });
  if (matchedDigits) {
    const dialDigits = matchedDigits.dialCode.replace(/\D/g, "");
    return {
      dialCode: matchedDigits.dialCode,
      number: digitsOnly.slice(dialDigits.length),
    };
  }
  return { dialCode: "+55", number: raw.replace(/^\+/, "") };
}

function formatPhoneValue(dialCode: string, number: string) {
  const cleanNumber = number.replace(/[^\d\s().-]/g, "").replace(/\s+/g, " ").trimStart();
  return cleanNumber.trim() ? `${dialCode} ${cleanNumber.trim()}` : "";
}

export function hasInternationalDialCode(value?: string | null) {
  return /^\+\d{1,4}\s+\d/.test(normalizePhoneValue(value));
}

export function normalizePhoneValue(value?: string | null) {
  const parsed = parsePhoneValue(value);
  return formatPhoneValue(parsed.dialCode, parsed.number);
}

export function PhoneInput({
  value,
  onChange,
  required,
  placeholder = "Telefone",
  className,
  inputClassName,
  selectClassName,
  "data-testid": dataTestId,
}: PhoneInputProps) {
  const parsed = parsePhoneValue(value);
  const selected = COUNTRY_CODES.find((item) => item.dialCode === parsed.dialCode) || COUNTRY_CODES[0];
  const usesDarkSelect = Boolean(selectClassName?.includes("brand-navy") || selectClassName?.includes("bg-[#001"));

  return (
    <div className={cn("flex w-full overflow-hidden rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2", className)}>
      <select
        value={selected.dialCode}
        onChange={(event) => onChange(formatPhoneValue(event.target.value, parsed.number))}
        className={cn(
          "w-[104px] shrink-0 border-0 border-r border-input bg-white px-2 text-sm font-medium text-foreground outline-none [&>option]:bg-white [&>option]:text-foreground",
          selectClassName,
        )}
        style={usesDarkSelect ? { backgroundColor: "#001d34", color: "#fff" } : undefined}
        aria-label="Código internacional"
      >
        {COUNTRY_CODES.map((item) => (
          <option key={`${item.country}-${item.dialCode}`} value={item.dialCode} className="bg-white text-foreground">
            {item.country} {item.dialCode}
          </option>
        ))}
      </select>
      <Input
        value={parsed.number}
        onChange={(event) => onChange(formatPhoneValue(selected.dialCode, event.target.value))}
        required={required}
        placeholder={placeholder}
        className={cn("min-w-0 flex-1 rounded-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0", inputClassName)}
        data-testid={dataTestId}
      />
    </div>
  );
}

