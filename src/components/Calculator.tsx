"use client";

import { useEffect, useReducer } from "react";

const MAX_DIGITS = 12;

type Operator = "+" | "-" | "×" | "÷";

type State = {
  entry: string;
  stored: number | null;
  operator: Operator | null;
  waiting: boolean;
  expression: string;
  error: boolean;
};

type Action =
  | { type: "digit"; value: string }
  | { type: "decimal" }
  | { type: "operator"; value: Operator }
  | { type: "equals" }
  | { type: "clear" }
  | { type: "sign" }
  | { type: "percent" }
  | { type: "backspace" };

const initialState: State = {
  entry: "0",
  stored: null,
  operator: null,
  waiting: false,
  expression: "",
  error: false,
};

function compute(a: number, b: number, operator: Operator): number {
  switch (operator) {
    case "+":
      return a + b;
    case "-":
      return a - b;
    case "×":
      return a * b;
    case "÷":
      return b === 0 ? Number.NaN : a / b;
  }
}

function toEntry(value: number): string {
  if (!Number.isFinite(value)) {
    return "Error";
  }

  const magnitude = Math.abs(value);

  if (magnitude !== 0 && (magnitude >= 1e12 || magnitude < 1e-9)) {
    return value.toExponential(6).replace("e+", "e");
  }

  return String(parseFloat(value.toPrecision(12)));
}

function formatEntry(entry: string): string {
  if (entry === "Error" || /e/i.test(entry)) {
    return entry;
  }

  const negative = entry.startsWith("-");
  const unsigned = negative ? entry.slice(1) : entry;
  const [integer, decimals] = unsigned.split(".");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const body = decimals === undefined ? grouped : `${grouped},${decimals}`;

  return negative ? `-${body}` : body;
}

function formatNumber(value: number): string {
  return formatEntry(toEntry(value));
}

function withError(state: State): State {
  return {
    ...state,
    entry: "Error",
    stored: null,
    operator: null,
    waiting: true,
    error: true,
  };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "clear":
      return initialState;

    case "digit": {
      if (state.error) {
        return state;
      }

      const digit = action.value;

      if (state.waiting) {
        return { ...state, entry: digit, waiting: false };
      }

      if (state.entry === "0") {
        return { ...state, entry: digit };
      }

      if (state.entry === "-0") {
        return { ...state, entry: `-${digit}` };
      }

      const digitCount = state.entry.replace(/[-.]/g, "").length;

      if (digitCount >= MAX_DIGITS) {
        return state;
      }

      return { ...state, entry: state.entry + digit };
    }

    case "decimal": {
      if (state.error) {
        return state;
      }

      if (state.waiting) {
        return { ...state, entry: "0.", waiting: false };
      }

      if (state.entry.includes(".")) {
        return state;
      }

      return { ...state, entry: `${state.entry}.` };
    }

    case "sign": {
      if (state.error || state.entry === "0") {
        return state;
      }

      const entry = state.entry.startsWith("-")
        ? state.entry.slice(1)
        : `-${state.entry}`;

      return { ...state, entry };
    }

    case "percent": {
      if (state.error) {
        return state;
      }

      const value = parseFloat(state.entry);
      const base =
        state.stored !== null && state.operator !== null ? state.stored : null;
      const result =
        base === null ? value / 100 : (base * value) / 100;
      const entry = toEntry(result);

      if (entry === "Error") {
        return withError(state);
      }

      return { ...state, entry, waiting: false };
    }

    case "backspace": {
      if (state.error || state.waiting) {
        return state;
      }

      if (state.entry.length <= 1) {
        return { ...state, entry: "0" };
      }

      const entry = state.entry.slice(0, -1);

      return { ...state, entry: entry === "-" ? "0" : entry };
    }

    case "operator": {
      if (state.error) {
        return state;
      }

      const current = parseFloat(state.entry);

      if (state.stored === null || state.operator === null) {
        return {
          ...state,
          stored: current,
          operator: action.value,
          waiting: true,
          expression: `${formatNumber(current)} ${action.value}`,
        };
      }

      if (state.waiting) {
        return {
          ...state,
          operator: action.value,
          expression: `${formatNumber(state.stored)} ${action.value}`,
        };
      }

      const result = compute(state.stored, current, state.operator);

      if (!Number.isFinite(result)) {
        return withError({
          ...state,
          expression: `${formatNumber(state.stored)} ${state.operator} ${formatNumber(current)}`,
        });
      }

      return {
        entry: toEntry(result),
        stored: result,
        operator: action.value,
        waiting: true,
        expression: `${formatNumber(result)} ${action.value}`,
        error: false,
      };
    }

    case "equals": {
      if (
        state.error ||
        state.stored === null ||
        state.operator === null
      ) {
        return state;
      }

      const current = parseFloat(state.entry);
      const expression = `${formatNumber(state.stored)} ${state.operator} ${formatNumber(current)} =`;
      const result = compute(state.stored, current, state.operator);

      if (!Number.isFinite(result)) {
        return withError({ ...state, expression });
      }

      return {
        entry: toEntry(result),
        stored: null,
        operator: null,
        waiting: true,
        expression,
        error: false,
      };
    }
  }
}

type ButtonVariant = "digit" | "utility" | "operator" | "equals";

const variantClasses: Record<ButtonVariant, string> = {
  digit:
    "bg-white/[0.06] text-zinc-50 hover:bg-white/[0.12] active:bg-white/20",
  utility:
    "bg-white/[0.12] text-amber-300 hover:bg-white/20 active:bg-white/25",
  operator:
    "bg-amber-500 text-zinc-950 hover:bg-amber-400 active:bg-amber-300",
  equals:
    "bg-emerald-500 text-zinc-950 hover:bg-emerald-400 active:bg-emerald-300",
};

function CalcButton({
  label,
  onClick,
  variant = "digit",
  ariaLabel,
  className = "",
}: {
  label: string;
  onClick: () => void;
  variant?: ButtonVariant;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel ?? label}
      className={`flex h-14 items-center justify-center rounded-2xl text-xl font-medium shadow-sm transition-colors duration-150 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 sm:h-16 ${variantClasses[variant]} ${className}`}
    >
      {label}
    </button>
  );
}

export default function Calculator() {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      const { key } = event;

      if (/^[0-9]$/.test(key)) {
        event.preventDefault();
        dispatch({ type: "digit", value: key });
        return;
      }

      switch (key) {
        case ".":
        case ",":
          dispatch({ type: "decimal" });
          break;
        case "+":
          dispatch({ type: "operator", value: "+" });
          break;
        case "-":
          dispatch({ type: "operator", value: "-" });
          break;
        case "*":
        case "x":
        case "X":
          dispatch({ type: "operator", value: "×" });
          break;
        case "/":
          dispatch({ type: "operator", value: "÷" });
          break;
        case "Enter":
        case "=":
          dispatch({ type: "equals" });
          break;
        case "Escape":
        case "c":
        case "C":
          dispatch({ type: "clear" });
          break;
        case "Backspace":
          dispatch({ type: "backspace" });
          break;
        case "%":
          dispatch({ type: "percent" });
          break;
        default:
          return;
      }

      event.preventDefault();
    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const display = state.error ? "Error" : formatEntry(state.entry);
  const displaySize =
    display.length > 14
      ? "text-2xl sm:text-3xl"
      : display.length > 10
        ? "text-3xl sm:text-4xl"
        : "text-4xl sm:text-5xl";

  return (
    <section
      aria-label="Calculadora"
      className="w-full rounded-3xl border border-white/10 bg-zinc-900/80 p-5 shadow-2xl shadow-black/50 backdrop-blur sm:p-6"
    >
      <div className="mb-5 rounded-2xl bg-black/40 px-4 py-5 ring-1 ring-white/5 sm:px-5">
        <p className="h-5 truncate text-right font-mono text-sm text-zinc-500">
          {state.expression || "\u00A0"}
        </p>
        <output
          aria-live="polite"
          aria-atomic="true"
          className={`mt-2 block overflow-hidden text-right font-mono font-semibold tracking-tight text-ellipsis whitespace-nowrap tabular-nums ${displaySize} ${
            state.error ? "text-red-400" : "text-zinc-50"
          }`}
        >
          {display}
        </output>
      </div>

      <div className="grid grid-cols-4 gap-2.5 sm:gap-3">
        <CalcButton
          label="AC"
          variant="utility"
          onClick={() => dispatch({ type: "clear" })}
          ariaLabel="Borrar todo"
        />
        <CalcButton
          label="±"
          variant="utility"
          onClick={() => dispatch({ type: "sign" })}
          ariaLabel="Cambiar signo"
        />
        <CalcButton
          label="%"
          variant="utility"
          onClick={() => dispatch({ type: "percent" })}
          ariaLabel="Porcentaje"
        />
        <CalcButton
          label="÷"
          variant="operator"
          onClick={() => dispatch({ type: "operator", value: "÷" })}
          ariaLabel="Dividir"
        />

        {["7", "8", "9"].map((digit) => (
          <CalcButton
            key={digit}
            label={digit}
            onClick={() => dispatch({ type: "digit", value: digit })}
          />
        ))}
        <CalcButton
          label="×"
          variant="operator"
          onClick={() => dispatch({ type: "operator", value: "×" })}
          ariaLabel="Multiplicar"
        />

        {["4", "5", "6"].map((digit) => (
          <CalcButton
            key={digit}
            label={digit}
            onClick={() => dispatch({ type: "digit", value: digit })}
          />
        ))}
        <CalcButton
          label="−"
          variant="operator"
          onClick={() => dispatch({ type: "operator", value: "-" })}
          ariaLabel="Restar"
        />

        {["1", "2", "3"].map((digit) => (
          <CalcButton
            key={digit}
            label={digit}
            onClick={() => dispatch({ type: "digit", value: digit })}
          />
        ))}
        <CalcButton
          label="+"
          variant="operator"
          onClick={() => dispatch({ type: "operator", value: "+" })}
          ariaLabel="Sumar"
        />

        <CalcButton
          label="0"
          className="col-span-2"
          onClick={() => dispatch({ type: "digit", value: "0" })}
        />
        <CalcButton
          label=","
          onClick={() => dispatch({ type: "decimal" })}
          ariaLabel="Coma decimal"
        />
        <CalcButton
          label="="
          variant="equals"
          onClick={() => dispatch({ type: "equals" })}
          ariaLabel="Igual"
        />
      </div>

      <p className="mt-4 text-center text-xs text-zinc-500">
        Teclado: 0-9, + − * /, Enter, Esc, Retroceso
      </p>
    </section>
  );
}
