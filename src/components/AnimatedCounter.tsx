import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { formatCurrency } from "@/lib/salaryEngine";

interface Props {
  value: number;
  prefix?: string;
  duration?: number;
  formatAsCurrency?: boolean;
}

export default function AnimatedCounter({ value, prefix = "", duration = 1.5, formatAsCurrency = false }: Props) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = value;
    const stepTime = (duration * 1000) / end;
    const step = Math.max(Math.ceil(end / 60), 1);

    const timer = setInterval(() => {
      start += step;
      if (start >= end) {
        setDisplay(end);
        clearInterval(timer);
      } else {
        setDisplay(start);
      }
    }, stepTime * step);

    return () => clearInterval(timer);
  }, [value, duration]);

  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="tabular-nums"
    >
      {formatAsCurrency ? formatCurrency(display) : `${prefix}${display.toLocaleString("en-IN")}`}
    </motion.span>
  );
}
