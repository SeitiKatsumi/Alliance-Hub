import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const COUNTRY_CODES = [
  { country: "BR", label: "Brasil", dialCode: "+55" },
  { country: "US", label: "Estados Unidos", dialCode: "+1" },
  { country: "PT", label: "Portugal", dialCode: "+351" },
  { country: "ES", label: "Espanha", dialCode: "+34" },
  { country: "FR", label: "França", dialCode: "+33" },
  { country: "IT", label: "Itália", dialCode: "+39" },
  { country: "GB", label: "Reino Unido", dialCode: "+44" },
  { country: "JP", label: "Japão", dialCode: "+81" },
  { country: "CN", label: "China", dialCode: "+86" },
  { country: "AR", label: "Argentina", dialCode: "+54" },
  { country: "CL", label: "Chile", dialCode: "+56" },
  { country: "UY", label: "Uruguai", dialCode: "+598" },
  { country: "PY", label: "Paraguai", dialCode: "+595" },
  { country: "CO", label: "Colômbia", dialCode: "+57" },
  { country: "MX", label: "México", dialCode: "+52" },
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

  return (
    <div className={cn("flex w-full overflow-hidden rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2", className)}>
      <select
        value={selected.dialCode}
        onChange={(event) => onChange(formatPhoneValue(event.target.value, parsed.number))}
        className={cn("w-[92px] shrink-0 border-0 border-r border-input bg-muted/40 px-2 text-sm font-medium text-foreground outline-none", selectClassName)}
        aria-label="Código internacional"
      >
        {COUNTRY_CODES.map((item) => (
          <option key={`${item.country}-${item.dialCode}`} value={item.dialCode}>
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
