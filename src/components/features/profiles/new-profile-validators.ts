// --- Validator factories ---

export function fmtRange(a: number, b: number): string {
  if (a >= 100000 || b >= 100000) {
    return `${a.toLocaleString("en-US")}–${b.toLocaleString("en-US")}`;
  }
  return `${a}–${b}`;
}

export function intRequired(min: number, max: number): (value: string) => string {
  const msg = fmtRange(min, max);
  return (value) => {
    if (!value) return "Required";
    const n = Number(value);
    if (isNaN(n) || !Number.isInteger(n) || n < min || n > max) return msg;
    return "";
  };
}

export function intOptional(min: number, max: number): (value: string) => string {
  const msg = fmtRange(min, max);
  return (value) => {
    if (value === "") return "";
    const n = Number(value);
    if (isNaN(n) || !Number.isInteger(n) || n < min || n > max) return msg;
    return "";
  };
}

export function numRequired(min: number, max: number): (value: string) => string {
  return (value) => {
    if (!value) return "Required";
    const n = Number(value);
    if (isNaN(n) || n < min || n > max) return `${min}–${max}`;
    return "";
  };
}

export function floatOptional(min: number, max: number): (value: string) => string {
  const msg = `${min}–${max}`;
  return (value) => {
    if (value === "") return "";
    const n = Number(value);
    if (isNaN(n) || n < min || n > max) return msg;
    return "";
  };
}

export function intGeZeroOptional(): (value: string) => string {
  return (value) => {
    if (value === "") return "";
    const n = Number(value);
    if (isNaN(n) || !Number.isInteger(n) || n < 0) return "≥0";
    return "";
  };
}

export function floatGeZeroOptional(): (value: string) => string {
  return (value) => {
    if (value === "") return "";
    const n = Number(value);
    if (isNaN(n) || n < 0) return "≥0";
    return "";
  };
}

export function stringRequired(maxLength?: number): (value: string) => string {
  return (value) => {
    if (!value.trim()) return "Required";
    if (maxLength && value.trim().length > maxLength) return `Max ${maxLength} chars`;
    return "";
  };
}
