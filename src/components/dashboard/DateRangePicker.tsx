import { useEffect, useState } from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export function DateRangePicker({
  date,
  setDate,
}: {
  date: { from?: Date; to?: Date } | undefined;
  setDate: (date: { from?: Date; to?: Date } | undefined) => void;
}) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  return (
    <div className="grid gap-2 w-full sm:w-auto">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-full sm:w-[260px] justify-start text-left font-normal bg-[oklch(0.16_0_0)] border-[oklch(0.83_0.16_88_/_0.2)] hover:bg-[oklch(0.83_0.16_88_/_0.1)]",
              !date && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, "dd/MM/yy", { locale: ptBR })} -{" "}
                  {format(date.to, "dd/MM/yy", { locale: ptBR })}
                </>
              ) : (
                format(date.from, "dd/MM/yy", { locale: ptBR })
              )
            ) : (
              <span>Filtrar por data</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto p-0 bg-[oklch(0.12_0_0)] border-[oklch(0.83_0.16_88_/_0.2)]"
          align="start"
        >
          <CalendarComponent
            initialFocus
            mode="range"
            defaultMonth={date?.from}
            selected={date}
            onSelect={setDate}
            numberOfMonths={isMobile ? 1 : 2}
            locale={ptBR}
          />
          <div className="p-3 border-t border-[oklch(0.83_0.16_88_/_0.2)] bg-[oklch(0.16_0_0)]">
            <Button
              variant="outline"
              size="sm"
              className="w-full border-[oklch(0.83_0.16_88_/_0.3)] hover:border-[oklch(0.83_0.16_88_/_0.6)]"
              onClick={() => setDate(undefined)}
            >
              Todo o período
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
