import { useState, ReactNode } from "react";
import { ChevronDown } from "lucide-react";

interface AccordionProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  summary?: string; // Краткое описание для свернутого состояния
  className?: string;
}

/**
 * Компонент аккордиона для сворачивания/разворачивания контента
 */
export const Accordion = ({
  title,
  children,
  defaultOpen = false,
  summary,
  className = ""
}: AccordionProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={`rounded-lg border border-white/10 bg-slate-900/60 ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between gap-3 p-4 text-left transition hover:bg-slate-800/30"
        aria-expanded={isOpen}
        aria-controls={`accordion-content-${title}`}
      >
        <div className="flex-1">
          <div className="text-sm font-medium text-white">{title}</div>
          {summary && !isOpen && (
            <div className="mt-1 text-xs text-slate-400">{summary}</div>
          )}
        </div>
        <ChevronDown
          className={`h-5 w-5 flex-shrink-0 text-slate-400 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>
      <div
        id={`accordion-content-${title}`}
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isOpen ? "max-h-[5000px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="p-4 pt-0">{children}</div>
      </div>
    </div>
  );
};

export default Accordion;



