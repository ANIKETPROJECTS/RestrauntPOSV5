import { Users, Clock, FileText, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

interface TableCardProps {
  id: string;
  tableNumber: string;
  status: "free" | "occupied" | "preparing" | "ready" | "reserved" | "served";
  seats: number;
  currentGuests?: number;
  orderStartTime?: string | null;
  onClick: (id: string) => void;
  onToggleServed?: (id: string) => void;
  onViewOrder?: (id: string) => void;
  onBilling?: (id: string) => void;
}

const statusConfig = {
  free: {
    borderColor: "border-black",
    circleColor: "bg-white",
    circleBorder: "border-black",
    label: "Available",
  },
  occupied: {
    borderColor: "border-black",
    circleColor: "bg-[#ff2400]",
    circleBorder: "border-[#ff2400]",
    label: "Occupied",
  },
  preparing: {
    borderColor: "border-black",
    circleColor: "bg-[#fff500]",
    circleBorder: "border-[#fff500]",
    label: "Preparing",
  },
  ready: {
    borderColor: "border-black",
    circleColor: "bg-[#3acd32]",
    circleBorder: "border-[#3acd32]",
    label: "Ready",
  },
  reserved: {
    borderColor: "border-black",
    circleColor: "bg-[#0075ff]",
    circleBorder: "border-[#0075ff]",
    label: "Reserved",
  },
  served: {
    borderColor: "border-black",
    circleColor: "bg-[#8000ff]",
    circleBorder: "border-[#8000ff]",
    label: "Served",
  },
};

export default function TableCard({
  id,
  tableNumber,
  status,
  seats,
  currentGuests,
  orderStartTime,
  onClick,
  onToggleServed,
  onViewOrder,
  onBilling,
}: TableCardProps) {
  const config = statusConfig[status];
  const [elapsedTime, setElapsedTime] = useState(0);
  
  useEffect(() => {
    if (!orderStartTime || (status !== "occupied" && status !== "preparing" && status !== "ready" && status !== "served")) {
      return;
    }

    const updateTime = () => {
      const startTime = new Date(orderStartTime).getTime();
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setElapsedTime(Math.max(0, elapsed));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [orderStartTime, status]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleClick = (e: React.MouseEvent) => {
    onClick(id);
  };

  const handleServedClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleServed) {
      onToggleServed(id);
    }
  };

  const handleViewOrder = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onViewOrder) {
      onViewOrder(id);
    }
  };

  const handleBilling = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onBilling) {
      onBilling(id);
    }
  };
  
  return (
    <div className="flex flex-col items-center">
      <button
        onClick={handleClick}
        data-testid={`table-${id}`}
        className={cn(
          "relative w-full p-4 rounded-lg border-2 bg-white transition-all hover:shadow-xl hover:scale-105 active:scale-95 min-w-32",
          config.borderColor
        )}
      >
        <div className="absolute top-1 left-1 z-10 flex items-center gap-1 text-black text-xs font-bold">
          <Users className="h-3 w-3" />
          <span>{seats}</span>
        </div>
        {status === "reserved" && (
          <div className="absolute top-1 right-1 z-10 bg-[#0075ff] text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shadow-md border-2 border-white">
            R
          </div>
        )}
        <div className="flex flex-col items-center gap-2">
          <div className={cn(
            "w-16 h-16 rounded-full border-2 flex items-center justify-center transition-all",
            config.circleColor,
            config.circleBorder,
            status !== "free" && "border-black",
            status === "free" && "text-black"
          )}>
            <span 
              className={cn(
                "text-2xl font-semibold",
                status === "free" ? "text-black" : "text-white"
              )}
              style={status !== "free" ? {
                textShadow: '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000'
              } : {}}
            >{tableNumber}</span>
          </div>
          <div className="text-center w-full">
            <p className="text-xs font-semibold uppercase text-black">{config.label}</p>
            {(status === "occupied" || status === "preparing" || status === "ready" || status === "served") && orderStartTime && (
              <div className="flex items-center gap-1 justify-center mt-1 text-xs font-mono font-semibold text-black">
                <Clock className="h-3 w-3" />
                <span>{formatTime(elapsedTime)}</span>
              </div>
            )}
          </div>
        </div>
      </button>
      
      {status === "ready" && onToggleServed && (
        <button
          onClick={handleServedClick}
          className="mt-2 bg-[#8000ff] hover:bg-[#7000e6] text-white text-xs px-4 py-1.5 rounded-full font-medium transition-all hover:shadow-md"
          data-testid={`toggle-served-${id}`}
        >
          Mark Served
        </button>
      )}
    </div>
  );
}